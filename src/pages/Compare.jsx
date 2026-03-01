import { useState, useEffect, useRef } from "react";
import { CURRENT_TEAMS } from "../data/teams";

// ── カラー定数 ────────────────────────────────────────────────
const C = {
  bg:      "#080c10",
  surface: "#0e1318",
  surface2:"#131a22",
  border:  "#1e2830",
  text:    "#e8edf2",
  muted:   "#5a6a78",
  muted2:  "#3a4a58",
  red:     "#c8102e",
  accent:  "#00ff85",
  gold:    "#f0b429",
  blue:    "#6cabdd",
};

function hexToRgba(hex, alpha = 0.15) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const TEAMS = CURRENT_TEAMS.map(t => ({
  id:      t.id,
  name:    t.name,
  slug:    t.slug,
  color:   t.color,
  short:   t.shortName,
  emoji:   t.emoji,
  bgAlpha: hexToRgba(t.color),
}));

const SEASONS = [
  { key: 2022, label: "2022-23" },
  { key: 2023, label: "2023-24" },
  { key: 2024, label: "2024-25" },
  { key: "all", label: "3シーズン比較" },
];

const BASE = import.meta.env.BASE_URL ?? "/";

// ── データ取得 ────────────────────────────────────────────────

async function loadJson(slug, season) {
  try {
    const res = await fetch(`${BASE}data/${slug}-${season}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function loadTeamData(slug, season) {
  if (season === "all") {
    const jsons = await Promise.all([2022, 2023, 2024].map(s => loadJson(slug, s)));
    const valid  = jsons.filter(Boolean);
    if (!valid.length) return null;
    return {
      teamId:     valid[0].teamId,
      fixtures:   valid.flatMap(j => j.fixtures ?? []),
      scored:     { total: valid.reduce((a, j) => a + (j.scored?.total  ?? 0), 0) },
      conceded:   { total: valid.reduce((a, j) => a + (j.conceded?.total ?? 0), 0) },
      recentForm: valid[valid.length - 1]?.recentForm ?? [],
    };
  }
  return loadJson(slug, season);
}

// ── スタッツ計算 ───────────────────────────────────────────────

function s(arr) { return arr.reduce((a, b) => a + b, 0); }

function calcStats(json) {
  if (!json) return null;
  const teamId   = json.teamId;
  const fixtures = json.fixtures ?? [];
  const scored   = json.scored?.total   ?? 0;
  const conceded = json.conceded?.total ?? 0;

  const homeFx = fixtures.filter(f => f.home_team_id === teamId);
  const awayFx = fixtures.filter(f => f.away_team_id === teamId);

  const homeScored   = s(homeFx.map(f => f.goals_home ?? 0));
  const homeConceded = s(homeFx.map(f => f.goals_away ?? 0));
  const awayScored   = s(awayFx.map(f => f.goals_away ?? 0));
  const awayConceded = s(awayFx.map(f => f.goals_home ?? 0));

  const homeWins   = homeFx.filter(f => (f.goals_home ?? 0) > (f.goals_away ?? 0)).length;
  const homeLosses = homeFx.filter(f => (f.goals_home ?? 0) < (f.goals_away ?? 0)).length;
  const homeDraws  = homeFx.length - homeWins - homeLosses;
  const awayWins   = awayFx.filter(f => (f.goals_away ?? 0) > (f.goals_home ?? 0)).length;
  const awayLosses = awayFx.filter(f => (f.goals_away ?? 0) < (f.goals_home ?? 0)).length;
  const awayDraws  = awayFx.length - awayWins - awayLosses;

  const htConceded = s(fixtures.map(f => f.home_team_id === teamId ? (f.ht_away ?? 0) : (f.ht_home ?? 0)));
  const htScored   = s(fixtures.map(f => f.home_team_id === teamId ? (f.ht_home ?? 0) : (f.ht_away ?? 0)));
  const shConceded  = conceded - htConceded;
  const shScored    = scored   - htScored;
  const sh_rate     = conceded > 0 ? Math.round((shConceded / conceded) * 100) : 0;
  const peakPeriod  = shConceded >= htConceded ? "後半" : "前半";
  const homeGames   = homeWins + homeDraws + homeLosses;
  const homeWinRate = homeGames > 0 ? Math.round(homeWins / homeGames * 100) : 0;

  return {
    scored, conceded, diff: scored - conceded,
    homeScored, homeConceded, awayScored, awayConceded,
    homeWins, homeDraws, homeLosses,
    awayWins, awayDraws, awayLosses,
    htScored, htConceded, shScored, shConceded,
    sh_rate, peakPeriod, homeWinRate,
    recentForm: json.recentForm ?? [],
    games: fixtures.length,
  };
}

// ── 試合スタッツ平均 ───────────────────────────────────────────

function calcAvgStats(json) {
  if (!json) return null;
  const teamId   = json.teamId;
  const fixtures = json.fixtures ?? [];
  const withStats = fixtures.filter(f => f.stats_home != null && f.stats_away != null);
  if (!withStats.length) return null;
  let totPoss = 0, totShots = 0, totCorners = 0, n = 0;
  for (const f of withStats) {
    const isHome = f.home_team_id === teamId;
    const stats  = isHome ? f.stats_home : f.stats_away;
    if (!stats) continue;
    totPoss    += stats.possession  ?? 0;
    totShots   += stats.total_shots ?? 0;
    totCorners += stats.corners     ?? 0;
    n++;
  }
  if (!n) return null;
  return {
    possession: Math.round(totPoss / n),
    shots:      +(totShots / n).toFixed(1),
    corners:    +(totCorners / n).toFixed(1),
    sampleSize: n,
  };
}

// ── Gemini API ────────────────────────────────────────────────

async function callGemini(prompt) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("VITE_GEMINI_API_KEY が設定されていません");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    }
  );
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ── TeamDropdown ──────────────────────────────────────────────

function TeamDropdown({ teamId, onChange, label, seasonLabel }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const team = TEAMS.find(t => t.id === teamId) ?? TEAMS[0];

  useEffect(() => {
    function onMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  return (
    <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div style={{ fontSize: "0.65rem", letterSpacing: "2px", color: C.muted, textTransform: "uppercase" }}>{label}</div>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: "1rem",
          background: C.surface2, border: `1px solid ${open ? C.muted2 : C.border}`,
          padding: "0.75rem 1rem", cursor: "pointer", position: "relative",
          transition: "border-color 0.2s", userSelect: "none",
        }}
      >
        <div style={{
          width: 44, height: 44, borderRadius: "50%", background: team.bgAlpha,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "1.5rem", flexShrink: 0,
        }}>{team.emoji}</div>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.4rem", letterSpacing: "2px", color: team.color, lineHeight: 1 }}>
            {team.name}
          </div>
          <div style={{ fontSize: "0.75rem", color: C.muted, marginTop: 2 }}>{seasonLabel}シーズン</div>
        </div>
        <span style={{ marginLeft: "auto", color: C.muted2, fontSize: "0.75rem" }}>▼</span>

        {open && (
          <div style={{
            position: "absolute", top: "100%", left: -1, right: -1, zIndex: 50,
            background: C.surface, border: `1px solid ${C.border}`, borderTop: "none",
            maxHeight: 320, overflowY: "auto",
          }}>
            {TEAMS.map(t => (
              <div
                key={t.id}
                onMouseDown={e => { e.stopPropagation(); onChange(t.id); setOpen(false); }}
                style={{
                  display: "flex", alignItems: "center", gap: "0.75rem",
                  padding: "0.55rem 1rem", cursor: "pointer",
                  background: t.id === teamId ? C.surface2 : "transparent",
                  borderBottom: `1px solid ${C.border}`,
                  transition: "background 0.15s",
                }}
                onMouseEnter={e => { if (t.id !== teamId) e.currentTarget.style.background = C.surface2; }}
                onMouseLeave={e => { if (t.id !== teamId) e.currentTarget.style.background = "transparent"; }}
              >
                <img
                  src={`https://media.api-sports.io/football/teams/${t.id}.png`}
                  alt={t.name} width={20} height={20}
                  style={{ objectFit: "contain", flexShrink: 0 }}
                />
                <span style={{ fontFamily: "'Bebas Neue'", fontSize: "1.1rem", letterSpacing: "2px", color: t.color }}>
                  {t.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────

export default function Compare() {
  const [teamAId, setTeamAId] = useState(42);
  const [teamBId, setTeamBId] = useState(40);
  const [season,  setSeason]  = useState(2024);
  const [rawA,    setRawA]    = useState(null);
  const [rawB,    setRawB]    = useState(null);
  const [loading, setLoading] = useState(true);

  const [aiData,     setAiData]     = useState(null);
  const [generating, setGenerating] = useState(false);
  const [genError,   setGenError]   = useState("");

  const teamA = TEAMS.find(t => t.id === teamAId) ?? TEAMS[0];
  const teamB = TEAMS.find(t => t.id === teamBId) ?? TEAMS[1];

  const seasonLabel = SEASONS.find(s => s.key === season)?.label ?? String(season);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setAiData(null);
    setGenError("");

    Promise.all([
      loadTeamData(teamA.slug, season),
      loadTeamData(teamB.slug, season),
    ]).then(([a, b]) => {
      if (!cancelled) { setRawA(a); setRawB(b); setLoading(false); }
    });

    return () => { cancelled = true; };
  }, [teamAId, teamBId, season]);

  const statsA = calcStats(rawA);
  const statsB = calcStats(rawB);

  const handleGenerate = async () => {
    if (!statsA || !statsB) return;
    setGenerating(true);
    setAiData(null);
    setGenError("");

    const prompt = `
あなたはプレミアリーグの戦術アナリストです。以下のデータを基に${teamA.name}と${teamB.name}の${seasonLabel}シーズンを比較分析してください。

${teamA.name}: 総得点${statsA.scored}（前半${statsA.htScored}/後半${statsA.shScored}）、総失点${statsA.conceded}（前半${statsA.htConceded}/後半${statsA.shConceded}）、得失点差${statsA.diff >= 0 ? "+" : ""}${statsA.diff}、後半失点率${statsA.sh_rate}%、最多失点帯:${statsA.peakPeriod}
${teamB.name}: 総得点${statsB.scored}（前半${statsB.htScored}/後半${statsB.shScored}）、総失点${statsB.conceded}（前半${statsB.htConceded}/後半${statsB.shConceded}）、得失点差${statsB.diff >= 0 ? "+" : ""}${statsB.diff}、後半失点率${statsB.sh_rate}%、最多失点帯:${statsB.peakPeriod}

必ず以下のJSON形式のみを返してください（説明文・コードブロック不要）:
{"title":"${teamA.name} vs ${teamB.name} — [戦術キーワード]","scoring_text":"得点パターンの違いを130字以内で","defense_text":"失点の構造的差異を130字以内で","verdict":"総合評価を100字以内で"}
    `.trim();

    try {
      const raw = await callGemini(prompt);
      try {
        const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        const parsed  = JSON.parse(cleaned);
        setAiData({
          title:        parsed.title        || `${teamA.name} vs ${teamB.name}`,
          scoring_text: parsed.scoring_text || "",
          defense_text: parsed.defense_text || "",
          verdict:      parsed.verdict      || "",
        });
      } catch {
        setAiData({
          title:        `${teamA.name} vs ${teamB.name} — 比較分析`,
          scoring_text: "",
          defense_text: "",
          verdict:      raw,
        });
      }
    } catch (e) {
      setGenError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const maxScored = Math.max(
    statsA?.htScored ?? 0, statsA?.shScored ?? 0,
    statsB?.htScored ?? 0, statsB?.shScored ?? 0, 1
  );

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Barlow', sans-serif" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>

        {/* ── チームセレクター ── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 80px 1fr",
          gap: "1rem", alignItems: "center", marginBottom: "2rem",
          background: C.surface, border: `1px solid ${C.border}`, padding: "1.5rem",
        }}>
          <TeamDropdown teamId={teamAId} onChange={setTeamAId} label="チーム A" seasonLabel={seasonLabel} />
          <div style={{ textAlign: "center", fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", color: C.muted2, letterSpacing: "2px" }}>
            VS
          </div>
          <TeamDropdown teamId={teamBId} onChange={setTeamBId} label="チーム B" seasonLabel={seasonLabel} />
        </div>

        {/* ── シーズン選択 ── */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "2rem" }}>
          {SEASONS.map(s => {
            const active = season === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSeason(s.key)}
                style={{
                  padding: "0.4rem 1rem", fontSize: "0.75rem",
                  fontFamily: "'Barlow', sans-serif", fontWeight: 600, letterSpacing: "1px",
                  background: active ? "rgba(0,255,133,0.05)" : C.surface,
                  border: `1px solid ${active ? C.accent : C.border}`,
                  color: active ? C.accent : C.muted,
                  cursor: "pointer", transition: "all 0.2s",
                }}
              >{s.label}</button>
            );
          })}
        </div>

        {/* ── ローディング ── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.muted2, fontSize: 12, letterSpacing: "0.12em" }}>
            LOADING...
          </div>
        )}

        {!loading && statsA && statsB && (
          <>
            {/* ── スコアヘッダー ── */}
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              padding: "1.5rem 2rem",
              display: "grid", gridTemplateColumns: "1fr auto 1fr",
              gap: "1rem", alignItems: "center", marginBottom: "1px",
            }}>
              {/* Team A */}
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", letterSpacing: "3px", lineHeight: 1, color: teamA.color }}>
                  {teamA.name.toUpperCase()}
                </div>
                <div style={{ fontSize: "0.75rem", color: C.muted, marginTop: "0.3rem" }}>
                  直近5試合: {statsA.recentForm.slice(-5).join(" ")}
                </div>
              </div>

              {/* Center Score */}
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", justifyContent: "center" }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "3.5rem", lineHeight: 1, color: teamA.color }}>
                    {statsA.scored}
                  </span>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", color: C.muted2 }}>—</span>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "3.5rem", lineHeight: 1, color: teamB.color }}>
                    {statsB.scored}
                  </span>
                </div>
                <div style={{ fontSize: "0.65rem", color: C.muted, letterSpacing: "2px", marginTop: "0.3rem" }}>今季総得点</div>
              </div>

              {/* Team B */}
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "2rem", letterSpacing: "3px", lineHeight: 1, color: teamB.color }}>
                  {teamB.name.toUpperCase()}
                </div>
                <div style={{ fontSize: "0.75rem", color: C.muted, marginTop: "0.3rem" }}>
                  直近5試合: {statsB.recentForm.slice(-5).join(" ")}
                </div>
              </div>
            </div>

            {/* ── キースタッツ 4項目 ── */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
              gap: "1px", background: C.border, marginBottom: "2rem",
            }}>
              {[
                { label: "総失点",     valA: statsA.conceded,    valB: statsB.conceded,   fmtA: v => v,                          fmtB: v => v },
                { label: "得失点差",   valA: statsA.diff,        valB: statsB.diff,        fmtA: v => v >= 0 ? `+${v}` : v,       fmtB: v => v >= 0 ? `+${v}` : v },
                { label: "後半失点率", valA: statsA.sh_rate,     valB: statsB.sh_rate,    fmtA: v => `${v}%`,                    fmtB: v => `${v}%` },
                { label: "最多失点帯", valA: statsA.peakPeriod,  valB: statsB.peakPeriod, fmtA: v => v,                          fmtB: v => v },
              ].map(({ label, valA, valB, fmtA, fmtB }) => (
                <div key={label} style={{
                  background: C.surface, padding: "1rem 1.25rem",
                  display: "grid", gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center", gap: "0.5rem",
                }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", lineHeight: 1, color: teamA.color }}>
                    {fmtA(valA)}
                  </div>
                  <div style={{ fontSize: "0.65rem", color: C.muted, textAlign: "center", letterSpacing: "0.5px", lineHeight: 1.3 }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", lineHeight: 1, color: teamB.color, textAlign: "right" }}>
                    {fmtB(valB)}
                  </div>
                </div>
              ))}
            </div>

            {/* ── AI 比較分析 ── */}
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${C.accent}`, marginBottom: "2rem",
            }}>
              {/* AI ヘッダー */}
              <div style={{
                padding: "0.75rem 1.25rem", borderBottom: `1px solid ${C.border}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "rgba(0,255,133,0.03)",
              }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  fontSize: "0.7rem", letterSpacing: "2px", color: C.accent,
                  fontWeight: 700, textTransform: "uppercase",
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: "50%", background: C.accent,
                    animation: "pulse 2s infinite",
                  }} />
                  AI 比較分析
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{
                    background: generating ? C.surface2 : C.accent,
                    color:      generating ? C.muted    : C.bg,
                    border: "none",
                    padding: "0.4rem 1.25rem", fontSize: "0.75rem",
                    fontFamily: "'Barlow', sans-serif", fontWeight: 700,
                    letterSpacing: "1px", cursor: generating ? "not-allowed" : "pointer",
                    transition: "opacity 0.2s",
                  }}
                >
                  {generating ? "生成中..." : "比較分析を生成"}
                </button>
              </div>

              {/* AI ボディ */}
              <div style={{ padding: "1.5rem" }}>
                {!aiData && !generating && !genError && (
                  <div style={{ fontSize: "0.85rem", color: C.muted2, textAlign: "center", padding: "1.5rem 0" }}>
                    「比較分析を生成」ボタンを押すと Gemini AI が2チームを分析します
                  </div>
                )}
                {genError && (
                  <div style={{
                    fontSize: "0.85rem", color: "#ef4444",
                    padding: "0.75rem 1rem", background: "#ef444411", border: "1px solid #ef444433",
                  }}>
                    Error: {genError}
                  </div>
                )}
                {aiData && (
                  <>
                    <div style={{
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.3rem",
                      letterSpacing: "2px", marginBottom: "1.25rem",
                    }}>
                      {aiData.title}
                    </div>
                    {(aiData.scoring_text || aiData.defense_text) && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
                        {aiData.scoring_text && (
                          <div>
                            <div style={{ fontSize: "0.65rem", letterSpacing: "2px", color: C.accent, textTransform: "uppercase", marginBottom: "0.6rem", fontWeight: 700 }}>
                              得点パターンの違い
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "#b0bec8", lineHeight: 1.7 }}>
                              {aiData.scoring_text}
                            </div>
                          </div>
                        )}
                        {aiData.defense_text && (
                          <div>
                            <div style={{ fontSize: "0.65rem", letterSpacing: "2px", color: C.accent, textTransform: "uppercase", marginBottom: "0.6rem", fontWeight: 700 }}>
                              失点の構造的差異
                            </div>
                            <div style={{ fontSize: "0.85rem", color: "#b0bec8", lineHeight: 1.7 }}>
                              {aiData.defense_text}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {aiData.verdict && (
                      <div style={{ marginTop: "1.25rem", paddingTop: "1.25rem", borderTop: `1px solid ${C.border}` }}>
                        <div style={{ fontSize: "0.65rem", letterSpacing: "2px", color: C.gold, textTransform: "uppercase", marginBottom: "0.5rem", fontWeight: 700 }}>
                          ⚡ 総合評価
                        </div>
                        <div style={{ fontSize: "0.9rem", lineHeight: 1.6, fontStyle: "italic", color: C.text }}>
                          {aiData.verdict}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* ── 時間帯別得点バー ── */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: "1px", background: C.border, marginBottom: "2rem",
            }}>
              {[
                { team: teamA, stats: statsA },
                { team: teamB, stats: statsB },
              ].map(({ team, stats }) => {
                const bars = [
                  { label: "前半 (0–45')", value: stats.htScored },
                  { label: "後半 (46–90')", value: stats.shScored },
                ];
                return (
                  <div key={team.id} style={{ background: C.surface, padding: "1.5rem" }}>
                    <div style={{
                      fontSize: "0.65rem", letterSpacing: "2px", color: C.muted,
                      textTransform: "uppercase", marginBottom: "1rem",
                      display: "flex", alignItems: "center", gap: "0.5rem",
                    }}>
                      <span style={{ width: 3, height: "0.9rem", background: team.color, display: "inline-block", flexShrink: 0 }} />
                      <span style={{ color: team.color }}>{team.name}</span> — 時間帯別得点
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                      {bars.map(({ label, value }) => (
                        <div key={label} style={{
                          display: "grid", gridTemplateColumns: "90px 1fr 30px",
                          alignItems: "center", gap: "0.75rem",
                        }}>
                          <div style={{ fontSize: "0.7rem", color: C.muted }}>{label}</div>
                          <div style={{ height: 6, background: C.surface2, position: "relative", overflow: "hidden" }}>
                            <div style={{
                              height: "100%",
                              width: `${maxScored > 0 ? (value / maxScored) * 100 : 0}%`,
                              background: team.color, transition: "width 0.4s ease",
                            }} />
                          </div>
                          <div style={{ fontSize: "0.75rem", fontWeight: 600, textAlign: "right", color: team.color }}>
                            {value}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── ホーム / アウェイ ── */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: "1px", background: C.border, marginBottom: "2rem",
            }}>
              {[
                { team: teamA, stats: statsA },
                { team: teamB, stats: statsB },
              ].map(({ team, stats }) => {
                const rows = [
                  { label: "ホーム得点",   val: stats.homeScored,   cls: "green" },
                  { label: "アウェイ得点", val: stats.awayScored,   cls: "" },
                  { label: "ホーム失点",   val: stats.homeConceded, cls: "" },
                  { label: "アウェイ失点", val: stats.awayConceded, cls: "red" },
                  { label: "ホーム勝率",   val: `${stats.homeWinRate}%`, cls: "gold" },
                ];
                return (
                  <div key={team.id} style={{ background: C.surface, padding: "1.25rem" }}>
                    <div style={{
                      fontSize: "0.65rem", letterSpacing: "2px", color: team.color,
                      textTransform: "uppercase", marginBottom: "1rem",
                      display: "flex", alignItems: "center", gap: "0.5rem",
                    }}>
                      <span style={{ width: 3, height: "0.9rem", background: team.color, display: "inline-block", flexShrink: 0 }} />
                      {team.name} — ホーム / アウェイ
                    </div>
                    {rows.map(({ label, val, cls }, i) => (
                      <div key={label} style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        padding: "0.5rem 0",
                        borderBottom: i < rows.length - 1 ? `1px solid ${C.border}` : "none",
                        fontSize: "0.82rem",
                      }}>
                        <span style={{ color: C.muted }}>{label}</span>
                        <span style={{
                          fontWeight: 700,
                          color: cls === "green" ? C.accent
                               : cls === "red"   ? C.red
                               : cls === "gold"  ? C.gold
                               : C.text,
                        }}>{val}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!loading && (!statsA || !statsB) && (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.muted, fontSize: 13 }}>
            データを読み込めませんでした
          </div>
        )}

        {/* ── 平均スタッツ比較 ── */}
        {!loading && statsA && statsB && (() => {
          const avgA = calcAvgStats(rawA);
          const avgB = calcAvgStats(rawB);
          if (!avgA && !avgB) return null;
          const rows = [
            { label: "平均ポゼッション", valA: avgA?.possession != null ? `${avgA.possession}%` : "–", valB: avgB?.possession != null ? `${avgB.possession}%` : "–", rawA: avgA?.possession ?? 0, rawB: avgB?.possession ?? 0 },
            { label: "平均シュート",     valA: avgA?.shots    ?? "–",  valB: avgB?.shots    ?? "–",  rawA: avgA?.shots    ?? 0, rawB: avgB?.shots    ?? 0 },
            { label: "平均コーナー",     valA: avgA?.corners  ?? "–",  valB: avgB?.corners  ?? "–",  rawA: avgA?.corners  ?? 0, rawB: avgB?.corners  ?? 0 },
          ];
          const sampleNote = [avgA, avgB].filter(Boolean).map(a => `${a.sampleSize}試合`).join(" / ");
          return (
            <div style={{ background: C.border, marginBottom: "2rem" }}>
              <div style={{
                background: C.surface, padding: "0.75rem 1.25rem",
                borderBottom: `1px solid ${C.border}`,
                fontSize: "0.65rem", letterSpacing: "2px", color: C.muted,
                textTransform: "uppercase",
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}>
                <span>平均スタッツ比較</span>
                <span style={{ color: C.muted2 }}>({sampleNote}・スタッツ取得試合)</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1px", background: C.border }}>
                {rows.map(({ label, valA, valB, rawA: rA, rawB: rB }) => {
                  const total = rA + rB || 1;
                  const pctA = (rA / total) * 100;
                  return (
                    <div key={label} style={{ background: C.surface, padding: "1rem 1.25rem" }}>
                      <div style={{ fontSize: "0.65rem", color: C.muted, letterSpacing: "1px", textAlign: "center", marginBottom: "0.75rem" }}>
                        {label}
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", lineHeight: 1, color: teamA.color }}>{valA}</span>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "1.8rem", lineHeight: 1, color: teamB.color }}>{valB}</span>
                      </div>
                      <div style={{ height: 4, background: C.surface2, display: "flex", overflow: "hidden" }}>
                        <div style={{ width: `${pctA}%`, background: teamA.color, transition: "width 0.4s" }} />
                        <div style={{ flex: 1, background: teamB.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        <div style={{ fontSize: "0.7rem", color: C.muted2, marginTop: "1rem" }}>
          ※ データ：api-sports.io より取得
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  );
}
