import { useState, useEffect } from "react";

// ── カラー定数 ────────────────────────────────────────────────
const C = {
  bg:      "#080c10",
  surface: "#0e1318",
  surface2:"#131a22",
  border:  "#1e2830",
  text:    "#e8edf2",
  muted:   "#5a6a78",
  muted2:  "#3a4a58",
  accent:  "#00ff85",
  gold:    "#f0b429",
  blue:    "#6cabdd",
};

const TEAMS = [
  { id: 40, name: "Liverpool", slug: "liverpool", color: "#C8102E", short: "LIV" },
  { id: 42, name: "Arsenal",   slug: "arsenal",   color: "#EF0107", short: "ARS" },
];

const SEASONS = [
  { key: 2024, label: "2024-25" },
  { key: 2023, label: "2023-24" },
  { key: 2022, label: "2022-23" },
  { key: "all", label: "3シーズン比較" },
];

const BASE = import.meta.env.BASE_URL ?? "/";

// ── データ取得 ────────────────────────────────────────────────

async function loadJson(slug, season) {
  try {
    const res = await fetch(`${BASE}data/${slug}-${season}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
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

function sum(arr) { return arr.reduce((a, b) => a + b, 0); }

function calcStats(json) {
  if (!json) return null;
  const teamId   = json.teamId;
  const fixtures = json.fixtures ?? [];
  const scored   = json.scored?.total   ?? 0;
  const conceded = json.conceded?.total ?? 0;

  const homeFx = fixtures.filter(f => f.home_team_id === teamId);
  const awayFx = fixtures.filter(f => f.away_team_id === teamId);

  const homeScored   = sum(homeFx.map(f => f.goals_home ?? 0));
  const homeConceded = sum(homeFx.map(f => f.goals_away ?? 0));
  const awayScored   = sum(awayFx.map(f => f.goals_away ?? 0));
  const awayConceded = sum(awayFx.map(f => f.goals_home ?? 0));

  const homeWins   = homeFx.filter(f => (f.goals_home ?? 0) > (f.goals_away ?? 0)).length;
  const homeLosses = homeFx.filter(f => (f.goals_home ?? 0) < (f.goals_away ?? 0)).length;
  const homeDraws  = homeFx.length - homeWins - homeLosses;
  const awayWins   = awayFx.filter(f => (f.goals_away ?? 0) > (f.goals_home ?? 0)).length;
  const awayLosses = awayFx.filter(f => (f.goals_away ?? 0) < (f.goals_home ?? 0)).length;
  const awayDraws  = awayFx.length - awayWins - awayLosses;

  const htConceded = sum(fixtures.map(f =>
    f.home_team_id === teamId ? (f.ht_away ?? 0) : (f.ht_home ?? 0)
  ));
  const htScored = sum(fixtures.map(f =>
    f.home_team_id === teamId ? (f.ht_home ?? 0) : (f.ht_away ?? 0)
  ));
  const shConceded  = conceded - htConceded;
  const shScored    = scored   - htScored;
  const sh_rate     = conceded > 0 ? Math.round((shConceded / conceded) * 100) : 0;
  const peakPeriod  = shConceded >= htConceded ? "後半" : "前半";

  return {
    scored, conceded, diff: scored - conceded,
    homeScored, homeConceded, awayScored, awayConceded,
    homeWins, homeDraws, homeLosses,
    awayWins, awayDraws, awayLosses,
    htScored, htConceded, shScored, shConceded,
    sh_rate, peakPeriod,
    recentForm: json.recentForm ?? [],
    games: fixtures.length,
  };
}

// ── Gemini API ────────────────────────────────────────────────

async function generateNarrative(prompt) {
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

// ── サブコンポーネント ──────────────────────────────────────────

function SectionHeader({ label, color = C.accent }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{ width: 4, height: 16, background: color, borderRadius: 2, flexShrink: 0 }} />
      <span style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 15, letterSpacing: "0.12em", color: C.text,
      }}>{label}</span>
    </div>
  );
}

function FormBadge({ result }) {
  const colors = { W: C.accent, D: C.gold, L: "#ef4444" };
  const col = colors[result] ?? C.muted;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 22, height: 22, borderRadius: 3, fontSize: 10, fontWeight: 700,
      background: `${col}22`, color: col, border: `1px solid ${col}55`,
    }}>{result}</span>
  );
}

function HalfBar({ label, valA, valB, colorA, colorB, maxVal }) {
  const pctA = maxVal > 0 ? (valA / maxVal) * 100 : 0;
  const pctB = maxVal > 0 ? (valB / maxVal) * 100 : 0;
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        fontSize: 11, color: C.muted, marginBottom: 5,
      }}>
        <span style={{ color: colorA, fontWeight: 700, minWidth: 24 }}>{valA}</span>
        <span style={{ letterSpacing: "0.06em" }}>{label}</span>
        <span style={{ color: colorB, fontWeight: 700, minWidth: 24, textAlign: "right" }}>{valB}</span>
      </div>
      <div style={{ display: "flex", gap: 2, height: 8 }}>
        {/* Left bar (A) — right-aligned */}
        <div style={{ flex: 1, display: "flex", justifyContent: "flex-end", background: C.surface2 }}>
          <div style={{
            width: `${pctA}%`, background: colorA,
            transition: "width 0.5s ease",
          }} />
        </div>
        <div style={{ width: 2, background: C.border, flexShrink: 0 }} />
        {/* Right bar (B) — left-aligned */}
        <div style={{ flex: 1, background: C.surface2 }}>
          <div style={{
            width: `${pctB}%`, background: colorB,
            transition: "width 0.5s ease",
          }} />
        </div>
      </div>
    </div>
  );
}

function HARow({ label, a, b, teamA, teamB }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        fontSize: 10, color: C.muted2, letterSpacing: "0.12em",
        textTransform: "uppercase", marginBottom: 10,
        paddingBottom: 6, borderBottom: `1px solid ${C.border}`,
      }}>{label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr", gap: 8, alignItems: "center" }}>
        {/* Team A */}
        <div>
          <div style={{ fontSize: 10, color: teamA.color, marginBottom: 3, letterSpacing: "0.05em" }}>{teamA.short}</div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, lineHeight: 1 }}>
            {a.scored}
            <span style={{ fontSize: 13, color: C.muted, margin: "0 4px" }}>/</span>
            <span style={{ color: "#ef4444" }}>{a.conceded}</span>
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
            <span style={{ color: C.accent }}>{a.w}W</span>
            {" "}{a.d}D{" "}
            <span style={{ color: "#ef4444" }}>{a.l}L</span>
          </div>
        </div>
        {/* Divider */}
        <div style={{ width: 1, height: 44, background: C.border, margin: "0 auto" }} />
        {/* Team B */}
        <div>
          <div style={{ fontSize: 10, color: teamB.color, marginBottom: 3, letterSpacing: "0.05em" }}>{teamB.short}</div>
          <div style={{ fontFamily: "'Bebas Neue'", fontSize: 26, lineHeight: 1 }}>
            {b.scored}
            <span style={{ fontSize: 13, color: C.muted, margin: "0 4px" }}>/</span>
            <span style={{ color: "#ef4444" }}>{b.conceded}</span>
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>
            <span style={{ color: C.accent }}>{b.w}W</span>
            {" "}{b.d}D{" "}
            <span style={{ color: "#ef4444" }}>{b.l}L</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────

export default function Compare() {
  const [teamAId, setTeamAId] = useState(40);
  const [teamBId, setTeamBId] = useState(42);
  const [season,  setSeason]  = useState(2024);
  const [rawA,    setRawA]    = useState(null);
  const [rawB,    setRawB]    = useState(null);
  const [loading, setLoading] = useState(true);

  const [narrative,   setNarrative]   = useState("");
  const [generating,  setGenerating]  = useState(false);
  const [genError,    setGenError]    = useState("");

  const teamA = TEAMS.find(t => t.id === teamAId);
  const teamB = TEAMS.find(t => t.id === teamBId);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNarrative("");
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

  const seasonLabel = SEASONS.find(s => s.key === season)?.label ?? String(season);

  const handleGenerate = async () => {
    if (!statsA || !statsB) return;
    setGenerating(true);
    setNarrative("");
    setGenError("");

    const prompt = `あなたはプレミアリーグの戦術アナリストです。以下のデータを基に、${teamA.name}と${teamB.name}の${seasonLabel}シーズンを比較分析してください。日本語で、以下の3パートに分けて記述してください：

【得点パターン】
${teamA.name}：総得点${statsA.scored}点（前半${statsA.htScored}・後半${statsA.shScored}）、ホーム${statsA.homeScored}・アウェイ${statsA.awayScored}
${teamB.name}：総得点${statsB.scored}点（前半${statsB.htScored}・後半${statsB.shScored}）、ホーム${statsB.homeScored}・アウェイ${statsB.awayScored}

【失点構造】
${teamA.name}：総失点${statsA.conceded}点（前半${statsA.htConceded}・後半${statsA.shConceded}、後半失点率${statsA.sh_rate}%、最多失点帯：${statsA.peakPeriod}）
${teamB.name}：総失点${statsB.conceded}点（前半${statsB.htConceded}・後半${statsB.shConceded}、後半失点率${statsB.sh_rate}%、最多失点帯：${statsB.peakPeriod}）

【総合評価】
得失点差：${teamA.name} ${statsA.diff >= 0 ? "+" : ""}${statsA.diff} vs ${teamB.name} ${statsB.diff >= 0 ? "+" : ""}${statsB.diff}
ホーム勝率：${teamA.name} ${Math.round(statsA.homeWins / Math.max(statsA.homeWins + statsA.homeDraws + statsA.homeLosses, 1) * 100)}% vs ${teamB.name} ${Math.round(statsB.homeWins / Math.max(statsB.homeWins + statsB.homeDraws + statsB.homeLosses, 1) * 100)}%

各パートは150字程度で具体的かつ簡潔にまとめてください。`.trim();

    try {
      const text = await generateNarrative(prompt);
      setNarrative(text);
    } catch (e) {
      setGenError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const maxHalf = Math.max(
    statsA?.htScored ?? 0, statsA?.shScored ?? 0,
    statsA?.htConceded ?? 0, statsA?.shConceded ?? 0,
    statsB?.htScored ?? 0, statsB?.shScored ?? 0,
    statsB?.htConceded ?? 0, statsB?.shConceded ?? 0,
    1
  );

  return (
    <div style={{
      minHeight: "100vh", background: C.bg, color: C.text,
      fontFamily: "'Barlow Condensed', 'Space Mono', monospace",
      boxSizing: "border-box",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow+Condensed:wght@300;400;600;700&display=swap" rel="stylesheet" />

      {/* ── ヘッダー ── */}
      <div style={{ borderBottom: `1px solid ${C.border}`, padding: "20px 28px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 4, height: 28, background: C.blue, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, letterSpacing: "0.08em", lineHeight: 1 }}>
              TEAM COMPARISON
            </div>
            <div style={{ fontSize: 12, color: C.muted, letterSpacing: "0.05em" }}>チーム間比較分析</div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 28px" }}>

        {/* ── コントロール ── */}
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          padding: "16px 20px", marginBottom: 3,
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          {/* Team A セレクト */}
          <select
            value={teamAId}
            onChange={e => setTeamAId(Number(e.target.value))}
            style={{
              background: C.surface2, border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${teamA.color}`,
              color: C.text, padding: "8px 14px", fontSize: 13,
              fontFamily: "inherit", cursor: "pointer", outline: "none",
            }}
          >
            {TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          <span style={{
            fontFamily: "'Bebas Neue'", fontSize: 20,
            color: C.muted2, letterSpacing: "0.1em",
          }}>VS</span>

          {/* Team B セレクト */}
          <select
            value={teamBId}
            onChange={e => setTeamBId(Number(e.target.value))}
            style={{
              background: C.surface2, border: `1px solid ${C.border}`,
              borderLeft: `3px solid ${teamB.color}`,
              color: C.text, padding: "8px 14px", fontSize: 13,
              fontFamily: "inherit", cursor: "pointer", outline: "none",
            }}
          >
            {TEAMS.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>

          {/* シーズン選択 */}
          <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
            {SEASONS.map(s => {
              const active = season === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => setSeason(s.key)}
                  style={{
                    padding: "7px 13px", fontSize: 11, fontFamily: "inherit",
                    cursor: "pointer", letterSpacing: "0.04em",
                    background: active ? `${C.accent}18` : C.surface2,
                    border: `1px solid ${active ? C.accent : C.border}`,
                    color:  active ? C.accent : C.muted,
                  }}
                >{s.label}</button>
              );
            })}
          </div>
        </div>

        {/* ── ローディング ── */}
        {loading && (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.muted2, fontSize: 12, letterSpacing: "0.12em" }}>
            LOADING...
          </div>
        )}

        {!loading && statsA && statsB && (
          <>
            {/* ── スコアヒーロー ── */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 100px 1fr",
              background: C.surface, border: `1px solid ${C.border}`,
              marginBottom: 3,
            }}>
              {/* Team A */}
              <div style={{ padding: "28px 24px", borderRight: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 3, height: 22, background: teamA.color, flexShrink: 0 }} />
                  <span style={{
                    fontFamily: "'Bebas Neue'", fontSize: 24,
                    letterSpacing: "0.06em", color: teamA.color,
                  }}>{teamA.name}</span>
                </div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, lineHeight: 1, color: C.text }}>
                  {statsA.scored}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                  総得点 / {statsA.games}試合
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 14, flexWrap: "wrap" }}>
                  {statsA.recentForm.slice(-5).map((r, i) => <FormBadge key={i} result={r} />)}
                </div>
              </div>

              {/* センター */}
              <div style={{
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
              }}>
                <div style={{
                  fontFamily: "'Bebas Neue'", fontSize: 16,
                  color: C.muted2, letterSpacing: "0.1em",
                }}>VS</div>
                <div style={{ fontSize: 10, color: C.muted2, marginTop: 8, textAlign: "center", letterSpacing: "0.04em" }}>
                  {seasonLabel}
                </div>
              </div>

              {/* Team B */}
              <div style={{ padding: "28px 24px", borderLeft: `1px solid ${C.border}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                  <div style={{ width: 3, height: 22, background: teamB.color, flexShrink: 0 }} />
                  <span style={{
                    fontFamily: "'Bebas Neue'", fontSize: 24,
                    letterSpacing: "0.06em", color: teamB.color,
                  }}>{teamB.name}</span>
                </div>
                <div style={{ fontFamily: "'Bebas Neue'", fontSize: 80, lineHeight: 1, color: C.text }}>
                  {statsB.scored}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                  総得点 / {statsB.games}試合
                </div>
                <div style={{ display: "flex", gap: 4, marginTop: 14, flexWrap: "wrap" }}>
                  {statsB.recentForm.slice(-5).map((r, i) => <FormBadge key={i} result={r} />)}
                </div>
              </div>
            </div>

            {/* ── キースタッツ 4項目 ── */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(4,1fr)",
              gap: 3, marginBottom: 3,
            }}>
              {[
                { label: "総失点",      valA: statsA.conceded,    valB: statsB.conceded,    fmt: v => v,      lowerBetter: true },
                { label: "得失点差",    valA: statsA.diff,        valB: statsB.diff,        fmt: v => v >= 0 ? `+${v}` : v },
                { label: "後半失点率",  valA: statsA.sh_rate,     valB: statsB.sh_rate,     fmt: v => `${v}%`, lowerBetter: true },
                { label: "最多失点帯",  valA: statsA.peakPeriod,  valB: statsB.peakPeriod,  noCompare: true },
              ].map(({ label, valA, valB, fmt = v => v, lowerBetter, noCompare }) => {
                let winA = false, winB = false;
                if (!noCompare && typeof valA === "number") {
                  if (lowerBetter) { winA = valA < valB; winB = valB < valA; }
                  else             { winA = valA > valB; winB = valB > valA; }
                }
                return (
                  <div key={label} style={{
                    background: C.surface, border: `1px solid ${C.border}`,
                    padding: "16px 16px 14px",
                  }}>
                    <div style={{ fontSize: 10, color: C.muted, letterSpacing: "0.08em", marginBottom: 10 }}>
                      {label}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                      <div style={{
                        fontFamily: "'Bebas Neue'", fontSize: 30,
                        color: winA ? C.accent : C.text,
                      }}>{fmt(valA)}</div>
                      <div style={{ fontSize: 10, color: C.muted2 }}>vs</div>
                      <div style={{
                        fontFamily: "'Bebas Neue'", fontSize: 30,
                        color: winB ? C.accent : C.text, textAlign: "right",
                      }}>{fmt(valB)}</div>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.muted2, marginTop: 4 }}>
                      <span>{teamA.short}</span>
                      <span>{teamB.short}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ── メイングリッド ── */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3, marginBottom: 3 }}>

              {/* 時間帯別得点バー */}
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                padding: "20px 20px",
              }}>
                <SectionHeader label="時間帯別 得点 / 失点" color={C.accent} />
                <div style={{ fontSize: 10, color: C.muted2, marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: teamA.color }}>{teamA.short}</span>
                  <span style={{ color: teamB.color }}>{teamB.short}</span>
                </div>
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, letterSpacing: "0.06em" }}>SCORED</div>
                <HalfBar label="前半" valA={statsA.htScored}   valB={statsB.htScored}   colorA={teamA.color} colorB={teamB.color} maxVal={maxHalf} />
                <HalfBar label="後半" valA={statsA.shScored}   valB={statsB.shScored}   colorA={teamA.color} colorB={teamB.color} maxVal={maxHalf} />
                <div style={{ height: 1, background: C.border, margin: "12px 0" }} />
                <div style={{ fontSize: 10, color: C.muted, marginBottom: 8, letterSpacing: "0.06em" }}>CONCEDED</div>
                <HalfBar label="前半" valA={statsA.htConceded} valB={statsB.htConceded} colorA={teamA.color} colorB={teamB.color} maxVal={maxHalf} />
                <HalfBar label="後半" valA={statsA.shConceded} valB={statsB.shConceded} colorA={teamA.color} colorB={teamB.color} maxVal={maxHalf} />
              </div>

              {/* ホーム / アウェイ成績 */}
              <div style={{
                background: C.surface, border: `1px solid ${C.border}`,
                padding: "20px 20px",
              }}>
                <SectionHeader label="ホーム / アウェイ成績" color={C.blue} />
                <HARow
                  label="HOME"
                  a={{ scored: statsA.homeScored, conceded: statsA.homeConceded, w: statsA.homeWins, d: statsA.homeDraws, l: statsA.homeLosses }}
                  b={{ scored: statsB.homeScored, conceded: statsB.homeConceded, w: statsB.homeWins, d: statsB.homeDraws, l: statsB.homeLosses }}
                  teamA={teamA} teamB={teamB}
                />
                <HARow
                  label="AWAY"
                  a={{ scored: statsA.awayScored, conceded: statsA.awayConceded, w: statsA.awayWins, d: statsA.awayDraws, l: statsA.awayLosses }}
                  b={{ scored: statsB.awayScored, conceded: statsB.awayConceded, w: statsB.awayWins, d: statsB.awayDraws, l: statsB.awayLosses }}
                  teamA={teamA} teamB={teamB}
                />
              </div>
            </div>

            {/* ── AI 比較分析 ── */}
            <div style={{
              background: C.surface, border: `1px solid ${C.border}`,
              padding: "20px 22px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: narrative ? 16 : 0 }}>
                <SectionHeader label="AI 比較分析" color={C.gold} />
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  style={{
                    padding: "8px 20px", fontSize: 12, fontFamily: "inherit",
                    letterSpacing: "0.06em", cursor: generating ? "not-allowed" : "pointer",
                    background: generating ? C.surface2 : `${C.gold}18`,
                    border: `1px solid ${generating ? C.border : C.gold}`,
                    color:  generating ? C.muted : C.gold,
                    marginBottom: 16,
                  }}
                >
                  {generating ? "生成中..." : "比較分析を生成"}
                </button>
              </div>

              {genError && (
                <div style={{
                  fontSize: 12, color: "#ef4444",
                  padding: "10px 14px", background: "#ef444411",
                  border: "1px solid #ef444433", marginTop: 8,
                }}>
                  Error: {genError}
                </div>
              )}

              {!narrative && !generating && !genError && (
                <div style={{ fontSize: 12, color: C.muted2, padding: "20px 0 4px", letterSpacing: "0.03em" }}>
                  「比較分析を生成」ボタンを押すと Gemini AI が2チームの戦術パターンを分析します
                </div>
              )}

              {narrative && (
                <div style={{
                  fontSize: 13, lineHeight: 1.9, color: C.text,
                  whiteSpace: "pre-wrap", letterSpacing: "0.02em",
                  borderTop: `1px solid ${C.border}`, paddingTop: 16,
                }}>
                  {narrative}
                </div>
              )}
            </div>
          </>
        )}

        {!loading && (!statsA || !statsB) && (
          <div style={{ textAlign: "center", padding: "80px 0", color: C.muted, fontSize: 13 }}>
            データを読み込めませんでした
          </div>
        )}

        <div style={{ fontSize: 10, color: C.muted2, marginTop: 20, letterSpacing: "0.05em" }}>
          ※ データ：api-sports.io より取得（Liverpool / Arsenal）
        </div>
      </div>
    </div>
  );
}
