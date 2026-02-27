/**
 * src/pages/MatchDetail.jsx
 *
 * 試合単体の詳細ページ。
 * - Supabase から fixture / goal_events を取得
 * - Gemini API（gemini-2.0-flash）でナラティブを生成
 * - useTeamData で 3 シーズン分の byTime データを読み込み
 *
 * ⚠️ VITE_GEMINI_API_KEY はビルドバンドルに含まれます。
 *    個人・デモ用途以外では Supabase Edge Function 等のサーバーサイドを経由してください。
 */

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  fetchFixtureWithFallback, fetchGoalEvents, resolveTeamId,
} from "../lib/supabase";
import { useTeamData } from "../hooks/useTeamData";

// ── 定数 ─────────────────────────────────────────────────────
const TEAM_INFO = {
  40: { name: "Liverpool", shortName: "LIV", color: "#C8102E", slug: "liverpool" },
  42: { name: "Arsenal",   shortName: "ARS", color: "#EF0107", slug: "arsenal"   },
};

const PERIOD_KEYS   = ["0-15", "16-30", "31-45", "46-60", "61-75", "76-90"];
const PERIOD_LABELS = ["0–15'", "16–30'", "31–45'", "46–60'", "61–75'", "76–90'"];
const PERIOD_COLORS = ["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444", "#a855f7"];

function periodIndex(minute) {
  if (minute <= 15) return 0;
  if (minute <= 30) return 1;
  if (minute <= 45) return 2;
  if (minute <= 60) return 3;
  if (minute <= 75) return 4;
  return 5;
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric", weekday: "short",
  });
}

// ── Gemini API 呼び出し ───────────────────────────────────────
async function generateNarrative(prompt) {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error("VITE_GEMINI_API_KEY が設定されていません");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  const json = await res.json();
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

// ── サブコンポーネント ────────────────────────────────────────

function Skeleton({ w = "100%", h = 16, radius = 4, mb = 8 }) {
  return (
    <div style={{
      width: w, height: h, borderRadius: radius,
      background: "rgba(255,255,255,0.06)",
      marginBottom: mb,
      animation: "pulse 1.4s ease-in-out infinite alternate",
    }} />
  );
}

function FormBadge({ result }) {
  const bg = result === "W" ? "#22c55e" : result === "L" ? "#ef4444" : "#555";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 22, height: 22, borderRadius: 4,
      background: bg, fontSize: 9, fontWeight: 700, color: "#fff",
    }}>{result}</span>
  );
}

// ── メインコンポーネント ──────────────────────────────────────

export default function MatchDetail() {
  const { fixtureId } = useParams();
  const id = Number(fixtureId);

  const [fixture,   setFixture]   = useState(null);
  const [goals,     setGoals]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [loadErr,   setLoadErr]   = useState(null);

  const [narrative,        setNarrative]        = useState("");
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeError,   setNarrativeError]   = useState(null);

  // fixture 読み込み後に teamId を決定
  const teamId = fixture ? resolveTeamId(fixture) : null;
  const info   = teamId ? TEAM_INFO[teamId] : null;
  const isHome = fixture ? fixture.home_team_id === teamId : false;

  const { data: data2024 } = useTeamData(teamId, 2024);
  const { data: data2023 } = useTeamData(teamId, 2023);
  const { data: data2022 } = useTeamData(teamId, 2022);

  // ── データロード ──
  useEffect(() => {
    if (!id) return;
    setLoading(true); setLoadErr(null);
    Promise.all([fetchFixtureWithFallback(id), fetchGoalEvents(id)])
      .then(([fix, evts]) => { setFixture(fix); setGoals(evts); })
      .catch(e => setLoadErr(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  // ── ローディング ──
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c10",
        fontFamily: "'Space Mono', monospace", padding: "28px 20px", color: "#fff" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <Skeleton h={12} w={80} mb={24} />
          <Skeleton h={40} mb={12} />
          <Skeleton h={120} mb={20} />
          <Skeleton h={200} />
        </div>
      </div>
    );
  }

  if (loadErr || !fixture) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c10", display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center",
        fontFamily: "'Space Mono', monospace", color: "#555", gap: 12 }}>
        <div>{loadErr ?? "試合データが見つかりません"}</div>
        <Link to="/" style={{ color: "#00ff85", fontSize: 11, textDecoration: "none" }}>← HOME</Link>
      </div>
    );
  }

  const TEAM_COLOR = info?.color ?? "#00ff85";
  const season     = fixture.season;

  // チームの今季 byTime データ
  const currentSeasonData = season === 2024 ? data2024 : season === 2023 ? data2023 : data2022;
  const byTime = currentSeasonData?.byTimeAvailable ? currentSeasonData : null;

  // この試合でのゴール → 時間帯ハイライト
  const concededInMatch = new Set(
    goals.filter(g => g.team_id !== teamId).map(g => periodIndex(g.minute))
  );
  const scoredInMatch = new Set(
    goals.filter(g => g.team_id === teamId).map(g => periodIndex(g.minute))
  );

  // 得点チームの表示名
  const nameOf = (teamIdVal) => {
    if (teamIdVal === 40) return "Liverpool";
    if (teamIdVal === 42) return "Arsenal";
    return teamIdVal === fixture.home_team_id ? fixture.home_team_name : fixture.away_team_name;
  };

  // 3シーズン後半（61-90'）失点推移データ
  const lateGoalsData = [
    { season: "2022-23", value: (data2022?.conceded?.byTime?.["61-75"] ?? 0) + (data2022?.conceded?.byTime?.["76-90"] ?? 0) },
    { season: "2023-24", value: (data2023?.conceded?.byTime?.["61-75"] ?? 0) + (data2023?.conceded?.byTime?.["76-90"] ?? 0) },
    { season: "2024-25", value: (data2024?.conceded?.byTime?.["61-75"] ?? 0) + (data2024?.conceded?.byTime?.["76-90"] ?? 0) },
  ];

  const recentForm = currentSeasonData?.recentForm ?? [];

  // ── AI ナラティブ生成 ──
  async function handleGenerateNarrative() {
    setNarrativeLoading(true); setNarrativeError(null); setNarrative("");

    const scored   = isHome ? fixture.goals_home : fixture.goals_away;
    const conceded = isHome ? fixture.goals_away  : fixture.goals_home;
    const opponent = isHome ? fixture.away_team_name : fixture.home_team_name;

    const goalLines = goals.map(g =>
      `  ${g.minute}' — ${nameOf(g.team_id)}${g.detail === "Penalty" ? "（PK）" : ""}`
    ).join("\n") || "  ゴール情報なし";

    const byTimeStr = byTime
      ? PERIOD_KEYS.map(k =>
          `  ${k}': 得点${byTime.scored?.byTime?.[k] ?? "–"} / 失点${byTime.conceded?.byTime?.[k] ?? "–"}`
        ).join("\n")
      : "  データなし";

    const historyStr = [
      `  2022-23: 得点${data2022?.scored?.total ?? "–"} / 失点${data2022?.conceded?.total ?? "–"}`,
      `  2023-24: 得点${data2023?.scored?.total ?? "–"} / 失点${data2023?.conceded?.total ?? "–"}`,
      `  2024-25: 得点${data2024?.scored?.total ?? "–"} / 失点${data2024?.conceded?.total ?? "–"}`,
    ].join("\n");

    const prompt = `あなたはプレミアリーグの戦術アナリストです。
以下のデータをもとに、この試合の意味を日本語で分析してください。

## この試合
${info?.name ?? "対象チーム"} vs ${opponent}（${isHome ? "ホーム" : "アウェイ"}）
スコア: ${scored}–${conceded}（前半: ${isHome ? fixture.ht_home : fixture.ht_away}–${isHome ? fixture.ht_away : fixture.ht_home}）
日付: ${fmtDate(fixture.match_date)}

ゴールタイム:
${goalLines}

## 今季（${season}-${String(season + 1).slice(-2)}）の時間帯別データ
${byTimeStr}

## 過去3シーズンの得失点推移
${historyStr}

以下の2つの観点で、それぞれ3〜4文で分析してください：
1. 今季トレンドとの照合
2. 過去3シーズンとの比較

データに基づいた具体的な数字を使い、サッカーファンが読んで納得感のある文章にしてください。`;

    try {
      const text = await generateNarrative(prompt);
      setNarrative(text);
    } catch (e) {
      setNarrativeError(e.message);
    } finally {
      setNarrativeLoading(false);
    }
  }

  const scoredTotal   = isHome ? fixture.goals_home : fixture.goals_away;
  const concededTotal = isHome ? fixture.goals_away  : fixture.goals_home;
  const result        = scoredTotal > concededTotal ? "W" : scoredTotal < concededTotal ? "L" : "D";
  const resultColor   = result === "W" ? "#22c55e" : result === "L" ? "#ef4444" : "#888";

  return (
    <div style={{ minHeight: "100vh", background: "#080c10", color: "#fff",
      fontFamily: "'Space Mono', monospace", padding: "28px 20px", boxSizing: "border-box" }}>
      <style>{`@keyframes pulse { from { opacity: 0.4 } to { opacity: 0.8 } }`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Anton&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 880, margin: "0 auto" }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: 20, display: "flex", gap: 12, fontSize: 10, color: "#555" }}>
          <Link to="/" style={{ color: "#555", textDecoration: "none" }}
            onMouseEnter={e => e.target.style.color = "#00ff85"}
            onMouseLeave={e => e.target.style.color = "#555"}>← HOME</Link>
          {info && (
            <>
              <span>/</span>
              <Link to={`/team/${teamId}`} style={{ color: "#555", textDecoration: "none" }}
                onMouseEnter={e => e.target.style.color = TEAM_COLOR}
                onMouseLeave={e => e.target.style.color = "#555"}>{info.name}</Link>
            </>
          )}
        </div>

        {/* ── 試合ヘッダーカード ── */}
        <div style={{ background: "#0e1318", border: "1px solid rgba(255,255,255,0.08)",
          borderTop: `3px solid ${TEAM_COLOR}`, borderRadius: 12, padding: "24px 28px", marginBottom: 20 }}>

          {/* 日付 */}
          <div style={{ fontSize: 10, color: "#555", marginBottom: 16, letterSpacing: "0.06em" }}>
            {fmtDate(fixture.match_date)} · PL {season}-{String(season + 1).slice(-2)}
          </div>

          {/* スコア */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: "clamp(13px,3vw,18px)", fontWeight: 700, color: fixture.home_team_id === teamId ? TEAM_COLOR : "#ccc" }}>
                {fixture.home_team_name}
              </div>
              <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>HOME</div>
            </div>

            <div style={{ textAlign: "center", flexShrink: 0 }}>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "clamp(32px,6vw,56px)",
                letterSpacing: "0.06em", lineHeight: 1 }}>
                <span style={{ color: fixture.home_team_id === teamId ? TEAM_COLOR : "#ccc" }}>{fixture.goals_home}</span>
                <span style={{ color: "#333", margin: "0 8px" }}>—</span>
                <span style={{ color: fixture.away_team_id === teamId ? TEAM_COLOR : "#ccc" }}>{fixture.goals_away}</span>
              </div>
              {(fixture.ht_home != null) && (
                <div style={{ fontSize: 10, color: "#444", marginTop: 4 }}>
                  HT {fixture.ht_home}–{fixture.ht_away}
                </div>
              )}
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px",
                  borderRadius: 3, background: `${resultColor}22`, color: resultColor,
                  border: `1px solid ${resultColor}44` }}>{result}</span>
              </div>
            </div>

            <div style={{ flex: 1, minWidth: 120, textAlign: "right" }}>
              <div style={{ fontSize: "clamp(13px,3vw,18px)", fontWeight: 700, color: fixture.away_team_id === teamId ? TEAM_COLOR : "#ccc" }}>
                {fixture.away_team_name}
              </div>
              <div style={{ fontSize: 9, color: "#444", marginTop: 2 }}>AWAY</div>
            </div>
          </div>

          {/* ゴールタイムライン */}
          {goals.length > 0 && (
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 14 }}>
              <div style={{ fontSize: 9, color: "#555", marginBottom: 8, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                ゴール
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {goals.map((g, i) => {
                  const isOurs = g.team_id === teamId;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 5,
                      fontSize: 10, color: isOurs ? "#ccc" : "#666" }}>
                      <span style={{ color: isOurs ? "#22c55e" : "#ef4444" }}>⚽</span>
                      <span style={{ color: isOurs ? TEAM_COLOR : "#888" }}>{g.minute}'</span>
                      {g.detail === "Penalty" && <span style={{ fontSize: 8, color: "#888" }}>PK</span>}
                      <span style={{ color: "#333", fontSize: 9 }}>({isOurs ? (isHome ? "H" : "A") : (isHome ? "A" : "H")})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── レイアウト: 2カラム ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16, alignItems: "start" }}>

          {/* ── 左カラム ── */}
          <div>

            {/* ── AI ナラティブ ── */}
            <div style={{ background: "#0e1318", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: "20px 22px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                    AI ナラティブ分析
                  </div>
                  <div style={{ fontSize: 9, color: "#333", marginTop: 2 }}>gemini-2.0-flash</div>
                </div>
                <button
                  onClick={handleGenerateNarrative}
                  disabled={narrativeLoading}
                  style={{
                    padding: "7px 16px", borderRadius: 6, fontSize: 10, cursor: narrativeLoading ? "wait" : "pointer",
                    fontFamily: "'Space Mono', monospace",
                    border: `1px solid ${TEAM_COLOR}`,
                    background: `${TEAM_COLOR}18`, color: TEAM_COLOR,
                    opacity: narrativeLoading ? 0.6 : 1,
                  }}
                >
                  {narrativeLoading ? "生成中..." : narrative ? "再生成" : "分析を生成"}
                </button>
              </div>

              {narrativeLoading && (
                <div>
                  <Skeleton h={14} mb={8} />
                  <Skeleton h={14} w="90%" mb={8} />
                  <Skeleton h={14} w="80%" mb={16} />
                  <Skeleton h={14} mb={8} />
                  <Skeleton h={14} w="85%" mb={8} />
                  <Skeleton h={14} w="70%" />
                </div>
              )}

              {narrativeError && (
                <div style={{ fontSize: 11, color: "#ef4444", padding: "10px 14px",
                  background: "#ef444412", borderRadius: 6, border: "1px solid #ef444430" }}>
                  分析を生成できませんでした: {narrativeError}
                </div>
              )}

              {narrative && !narrativeLoading && (
                <div style={{ fontSize: 12, color: "#ccc", lineHeight: 2, whiteSpace: "pre-wrap" }}>
                  {narrative}
                </div>
              )}

              {!narrative && !narrativeLoading && !narrativeError && (
                <div style={{ fontSize: 11, color: "#333", textAlign: "center", padding: "20px 0" }}>
                  「分析を生成」ボタンで AI による試合分析を表示します
                </div>
              )}
            </div>

            {/* ── 時間帯別カード（今季） ── */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                時間帯別データ（{season}-{String(season + 1).slice(-2)}）
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5 }}>
                {PERIOD_KEYS.map((k, i) => {
                  const concededN = byTime?.conceded?.byTime?.[k];
                  const scoredN   = byTime?.scored?.byTime?.[k];
                  const hitConceded = concededInMatch.has(i);
                  const hitScored   = scoredInMatch.has(i);
                  return (
                    <div key={k} style={{
                      background: hitConceded ? `${TEAM_COLOR}18` : hitScored ? "#22c55e12" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${hitConceded ? `${TEAM_COLOR}66` : hitScored ? "#22c55e44" : "rgba(255,255,255,0.06)"}`,
                      borderBottom: `2px solid ${PERIOD_COLORS[i]}`,
                      borderRadius: 8, padding: "10px 5px", textAlign: "center",
                    }}>
                      <div style={{ fontSize: 8, color: "#555", marginBottom: 5 }}>{PERIOD_LABELS[i]}</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#22c55e" }}>{scoredN ?? "–"}</div>
                      <div style={{ fontSize: 7, color: "#444" }}>得</div>
                      <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "3px 0" }} />
                      <div style={{ fontSize: 13, fontWeight: 700, color: TEAM_COLOR }}>{concededN ?? "–"}</div>
                      <div style={{ fontSize: 7, color: "#444" }}>失</div>
                      {(hitConceded || hitScored) && (
                        <div style={{ fontSize: 7, color: hitConceded ? TEAM_COLOR : "#22c55e", marginTop: 3 }}>
                          {hitConceded ? "●失点" : "●得点"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── 3シーズン後半失点推移 ── */}
            {lateGoalsData.some(d => d.value > 0) && (
              <div style={{ background: "#0e1318", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "20px 22px", marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em",
                  textTransform: "uppercase", marginBottom: 16 }}>
                  3シーズン 後半（61–90'）失点推移
                </div>
                <div style={{ height: 120 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={lateGoalsData} layout="vertical" barCategoryGap="30%">
                      <XAxis type="number" allowDecimals={false}
                        tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis type="category" dataKey="season" width={58}
                        tick={{ fill: "#888", fontSize: 10, fontFamily: "'Space Mono', monospace" }}
                        axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: "rgba(5,10,20,0.97)", border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 8, fontFamily: "'Space Mono', monospace", fontSize: 11 }}
                        itemStyle={{ color: "#ccc" }} labelStyle={{ color: "#888" }}
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      />
                      <Bar dataKey="value" name="後半失点" radius={[0,3,3,0]}>
                        {lateGoalsData.map((_, i) => (
                          <Cell key={i} fill={i === lateGoalsData.findIndex(d => d.season === `${season}-${String(season+1).slice(-2)}`) ? TEAM_COLOR : "#334"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* ── 右サイドバー ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* 直近5試合フォーム */}
            <div style={{ background: "#0e1318", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "16px" }}>
              <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                直近フォーム
              </div>
              {recentForm.length > 0 ? (
                <div style={{ display: "flex", gap: 4 }}>
                  {recentForm.map((r, i) => <FormBadge key={i} result={r} />)}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: "#333" }}>データなし</div>
              )}
            </div>

            {/* 今季キースタッツ */}
            <div style={{ background: "#0e1318", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, padding: "16px" }}>
              <div style={{ fontSize: 9, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
                今季キースタッツ
              </div>
              {[
                { label: "総得点", value: currentSeasonData?.scored?.total   ?? "–", color: "#22c55e" },
                { label: "総失点", value: currentSeasonData?.conceded?.total  ?? "–", color: TEAM_COLOR },
                {
                  label: "後半失点率",
                  value: (() => {
                    const total = currentSeasonData?.conceded?.total;
                    const late  = (currentSeasonData?.conceded?.byTime?.["61-75"] ?? 0)
                                + (currentSeasonData?.conceded?.byTime?.["76-90"] ?? 0);
                    return total ? `${Math.round(late / total * 100)}%` : "–";
                  })(),
                  color: "#f97316",
                },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "baseline", padding: "5px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ fontSize: 10, color: "#555" }}>{label}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
            </div>

            {/* チームページへ */}
            {info && (
              <Link to={`/team/${teamId}`} style={{
                display: "block", textAlign: "center",
                padding: "10px", borderRadius: 8, fontSize: 10,
                border: `1px solid ${TEAM_COLOR}44`,
                background: `${TEAM_COLOR}0a`, color: TEAM_COLOR,
                textDecoration: "none",
                transition: "background 0.15s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = `${TEAM_COLOR}18`}
                onMouseLeave={e => e.currentTarget.style.background = `${TEAM_COLOR}0a`}
              >
                {info.name} 全データを見る →
              </Link>
            )}
          </div>
        </div>

        <div style={{ fontSize: 9, color: "#2d2d2d", marginTop: 20, lineHeight: 1.8 }}>
          ※ ゴール情報は選手名を含みません · データ: api-sports.io / Supabase
        </div>
      </div>
    </div>
  );
}
