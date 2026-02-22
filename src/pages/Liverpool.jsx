import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";

// ────────────────────────────────────────────────────────────
// 2025-26 LFC 試合別データ（直近10試合）
// goals = 失点した分数の配列
// ────────────────────────────────────────────────────────────
const matches = [
  { id: "TOT", date: "12/20", result: "W 2-1", goals: [83] },
  { id: "WOL", date: "12/27", result: "W 2-1", goals: [51] },
  { id: "LEE", date: "1/1",   result: "D 0-0", goals: [] },
  { id: "FUL", date: "1/4",   result: "D 2-2", goals: [17, 90] },
  { id: "ARS", date: "1/8",   result: "D 0-0", goals: [] },
  { id: "BUR", date: "1/17",  result: "D 1-1", goals: [65] },
  { id: "BOU", date: "1/24",  result: "L 2-3", goals: [26, 33, 90] },
  { id: "NEW", date: "1/31",  result: "W 4-1", goals: [36] },
  { id: "MCI", date: "2/8",   result: "L 1-2", goals: [84, 90] },
  { id: "SUN", date: "2/11",  result: "W 1-0", goals: [] },
];

// ────────────────────────────────────────────────────────────
// 2024-25 LFC失点データ（FootyStats公式より：38試合 41失点）
// 時間帯別: 0-15'=2, 16-30'=1, 31-45'=10, 46-60'=9, 61-75'=5, 76-89'=12, 90+'=2
// 注: FootyStatsは76-90をまとめて14と報告。Opta記事より90+AT失点は
//   Southampton戦の1件のみが確認されているため 76-89'=12, 90+'=2 と推定
// ────────────────────────────────────────────────────────────
const PREV_RAW = [2, 1, 10, 9, 5, 12, 2];

const PERIODS = [
  { label: "0–15'",  min: 0,   max: 15,  color: "#22c55e", colorDim: "#16532e" },
  { label: "16–30'", min: 16,  max: 30,  color: "#84cc16", colorDim: "#3a5a09" },
  { label: "31–45'", min: 31,  max: 45,  color: "#eab308", colorDim: "#6b5100" },
  { label: "46–60'", min: 46,  max: 60,  color: "#f97316", colorDim: "#7c3a0a" },
  { label: "61–75'", min: 61,  max: 75,  color: "#ef4444", colorDim: "#7c1c1c" },
  { label: "76–89'", min: 76,  max: 89,  color: "#dc2626", colorDim: "#6b1414" },
  { label: "90'+",   min: 90,  max: 999, color: "#a855f7", colorDim: "#4c1d95" },
];

// matches から flat なゴールイベント配列を生成
const LFC_CONCEDED_2526 = matches.flatMap(m =>
  m.goals.map(time => ({ match: m.id, date: m.date, time, result: m.result }))
);

// 試合別サマリー（conceded = 失点数）
const MATCHES_2526 = matches.map(m => ({
  id: m.id,
  date: m.date,
  result: m.result,
  conceded: m.goals.length,
}));

function getPeriodIdx(time) {
  for (let i = 0; i < PERIODS.length; i++) {
    if (time >= PERIODS[i].min && time <= PERIODS[i].max) return i;
  }
  return PERIODS.length - 1;
}

const GAMES_2526 = 10;
const GAMES_2425 = 38;
const TOTAL_2526 = LFC_CONCEDED_2526.length;
const TOTAL_2425 = 41;

const comparisonData = PERIODS.map((p, i) => {
  const cur = LFC_CONCEDED_2526.filter(g => g.time >= p.min && g.time <= p.max).length;
  const prev = PREV_RAW[i];
  return {
    period: p.label,
    "2025-26（実数)": cur,
    "2024-25（10試合換算)": +(prev * GAMES_2526 / GAMES_2425).toFixed(2),
    cur,
    prev,
    curPct: +((cur / TOTAL_2526) * 100).toFixed(1),
    prevPct: +((prev / TOTAL_2425) * 100).toFixed(1),
    color: p.color,
  };
});

const pctData = PERIODS.map((p, i) => ({
  period: p.label,
  "2025-26": comparisonData[i].curPct,
  "2024-25": comparisonData[i].prevPct,
}));


// ── Tooltips ──────────────────────────────────────────────
const CompareTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const d = comparisonData.find(x => x.period === label);
  return (
    <div style={{
      background: "rgba(5,10,20,0.97)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      padding: "12px 16px",
      fontFamily: "'Space Mono', monospace",
      fontSize: 12,
      color: "#fff",
      minWidth: 180,
    }}>
      <div style={{ color: "#aaa", marginBottom: 8, fontSize: 11 }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
        <span style={{ color: "#C8102E" }}>2025-26</span>
        <span>{d.cur}失点 <span style={{ color: "#666" }}>({d.curPct}%)</span></span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ color: "#4ade80" }}>2024-25</span>
        <span>{d.prev}失点 <span style={{ color: "#666" }}>({d.prevPct}%)</span></span>
      </div>
    </div>
  );
};

const PctTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(5,10,20,0.97)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      padding: "10px 14px",
      fontFamily: "'Space Mono', monospace",
      fontSize: 12,
      color: "#fff",
    }}>
      <div style={{ color: "#aaa", marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {p.value}%
        </div>
      ))}
    </div>
  );
};


// ── メインコンポーネント ──────────────────────────────────
export default function Liverpool() {
  const [view, setView] = useState("compare");
  const cleanSheets = MATCHES_2526.filter(m => m.conceded === 0).length;
  const atGoals2526 = comparisonData[6].cur;
  const atGoals2425 = comparisonData[6].prev;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#03060F",
      color: "#fff",
      fontFamily: "'Space Mono', monospace",
      padding: "28px 20px",
      boxSizing: "border-box",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Anton&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 880, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 28 }}>
          <div style={{ width: 6, background: "#C8102E", alignSelf: "stretch", borderRadius: 3, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "clamp(24px, 5vw, 48px)", letterSpacing: "0.04em", lineHeight: 1 }}>
              LIVERPOOL FC
            </div>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "clamp(13px, 2.2vw, 22px)", letterSpacing: "0.1em", color: "#C8102E", lineHeight: 1.3 }}>
              時間帯別 失点分析 — シーズン対比
            </div>
            <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>
              2025-26（直近10試合） vs 2024-25（全38試合・優勝シーズン）
            </div>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr) repeat(2,1fr)", gap: 8, marginBottom: 24 }}>
          {[
            { label: "2025-26 総失点", value: `${TOTAL_2526}`, sub: "10試合", accent: "#C8102E" },
            { label: "2024-25 総失点", value: `${TOTAL_2425}`, sub: "38試合（優勝）", accent: "#4ade80" },
            { label: "90'以降 2025-26", value: `${atGoals2526}`, sub: `全失点の${comparisonData[6].curPct}%`, accent: "#a855f7" },
            { label: "90'以降 2024-25", value: `${atGoals2425}`, sub: `全失点の${comparisonData[6].prevPct}%`, accent: "#818cf8" },
          ].map(({ label, value, sub, accent }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderTop: `2px solid ${accent}`,
              borderRadius: 8,
              padding: "12px 14px",
            }}>
              <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── View toggle ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[
            ["compare", "10試合換算・実数比較"],
            ["pct", "割合（%）比較"],
            ["radar", "レーダー"],
          ].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "6px 14px",
              borderRadius: 4,
              border: view === v ? "1px solid #C8102E" : "1px solid rgba(255,255,255,0.12)",
              background: view === v ? "rgba(200,16,46,0.15)" : "transparent",
              color: view === v ? "#C8102E" : "#888",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "'Space Mono', monospace",
            }}>{label}</button>
          ))}
        </div>

        {/* ── Main chart ── */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          padding: "24px 16px",
          marginBottom: 16,
          height: 300,
        }}>
          {view === "compare" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} barGap={3} barCategoryGap="25%">
                <XAxis dataKey="period" tick={{ fill: "#888", fontSize: 11, fontFamily: "'Space Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CompareTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend
                  formatter={v => <span style={{ color: v === "2025-26（実数)" ? "#C8102E" : "#4ade80", fontSize: 11 }}>{v}</span>}
                />
                <Bar dataKey="2025-26（実数)" fill="#C8102E" radius={[3, 3, 0, 0]} />
                <Bar dataKey="2024-25（10試合換算)" fill="#4ade80" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {view === "pct" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pctData} barGap={3} barCategoryGap="25%">
                <XAxis dataKey="period" tick={{ fill: "#888", fontSize: 11, fontFamily: "'Space Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<PctTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend
                  formatter={v => <span style={{ color: v === "2025-26" ? "#C8102E" : "#4ade80", fontSize: 11 }}>{v}</span>}
                />
                <Bar dataKey="2025-26" fill="#C8102E" radius={[3, 3, 0, 0]} />
                <Bar dataKey="2024-25" fill="#4ade80" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {view === "radar" && (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={pctData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="period" tick={{ fill: "#aaa", fontSize: 11, fontFamily: "'Space Mono', monospace" }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name="2025-26" dataKey="2025-26" stroke="#C8102E" fill="#C8102E" fillOpacity={0.3} strokeWidth={2} />
                <Radar name="2024-25" dataKey="2024-25" stroke="#4ade80" fill="#4ade80" fillOpacity={0.2} strokeWidth={2} />
                <Legend formatter={v => <span style={{ color: v === "2025-26" ? "#C8102E" : "#4ade80", fontSize: 11 }}>{v}</span>} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── 90+ callout banner ── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(200,16,46,0.08))",
          border: "1px solid rgba(168,85,247,0.35)",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 10, color: "#a78bfa", letterSpacing: "0.1em", marginBottom: 4 }}>⚡ 90分以降（アディショナルタイム）</div>
            <div style={{ display: "flex", gap: 24, alignItems: "baseline" }}>
              <div>
                <span style={{ fontSize: 36, fontWeight: 700, color: "#a855f7", fontFamily: "'Anton',sans-serif" }}>{atGoals2526}</span>
                <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>失点 (2025-26 · 10試合)</span>
              </div>
              <div style={{ color: "#555" }}>vs</div>
              <div>
                <span style={{ fontSize: 36, fontWeight: 700, color: "#818cf8", fontFamily: "'Anton',sans-serif" }}>{atGoals2425}</span>
                <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>失点 (2024-25 · 全38試合)</span>
              </div>
            </div>
          </div>
          <div style={{
            marginLeft: "auto",
            background: "rgba(168,85,247,0.15)",
            border: "1px solid rgba(168,85,247,0.3)",
            borderRadius: 8,
            padding: "10px 16px",
            textAlign: "center",
            minWidth: 120,
          }}>
            <div style={{ fontSize: 10, color: "#a78bfa", marginBottom: 4 }}>全失点に占める割合</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#a855f7" }}>{comparisonData[6].curPct}%</div>
            <div style={{ fontSize: 10, color: "#666" }}>昨季 {comparisonData[6].prevPct}%</div>
          </div>
        </div>

        {/* ── 時間帯別 内訳テーブル ── */}
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>時間帯別 内訳</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 28 }}>
          {comparisonData.map((d, i) => {
            const isAt = i === 6;
            return (
              <div key={d.period} style={{
                background: isAt ? "rgba(168,85,247,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${isAt ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.06)"}`,
                borderBottom: `2px solid ${PERIODS[i].color}`,
                borderRadius: 8,
                padding: "10px 6px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 9, color: "#666", marginBottom: 6 }}>{d.period}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#C8102E" }}>{d.cur}</div>
                <div style={{ fontSize: 9, color: "#555", marginBottom: 4 }}>{d.curPct}%</div>
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: "#4ade80" }}>{d.prev}</div>
                <div style={{ fontSize: 9, color: "#555" }}>{d.prevPct}%</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 28, fontSize: 10, color: "#555" }}>
          <span><span style={{ color: "#C8102E", fontWeight: 700 }}>赤</span> = 2025-26（実数）</span>
          <span><span style={{ color: "#4ade80", fontWeight: 700 }}>緑</span> = 2024-25（実数）</span>
        </div>

        {/* ── 試合別 失点ログ ── */}
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>2025-26 試合別 失点ログ</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, marginBottom: 28 }}>
          {MATCHES_2526.map(m => {
            const resultColor = m.result.startsWith("W") ? "#22c55e" : m.result.startsWith("D") ? "#f59e0b" : "#ef4444";
            return (
              <div key={m.id} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderLeft: `3px solid ${resultColor}`,
                borderRadius: 8,
                padding: "10px 12px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{m.id}</span>
                  <span style={{ fontSize: 10, color: resultColor }}>{m.result}</span>
                </div>
                <div style={{ fontSize: 10, color: "#555", marginBottom: 8 }}>{m.date}</div>
                {m.conceded === 0 ? (
                  <div style={{ fontSize: 10, color: "#22c55e" }}>✓ クリーンシート</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {LFC_CONCEDED_2526.filter(g => g.match === m.id).map((g, i) => {
                      const pidx = getPeriodIdx(g.time);
                      const c = PERIODS[pidx].color;
                      return (
                        <span key={i} style={{
                          background: `${c}22`,
                          border: `1px solid ${c}`,
                          color: c,
                          borderRadius: 3,
                          padding: "2px 6px",
                          fontSize: 10,
                        }}>{g.time}'</span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── INSIGHT ── */}
        <div style={{
          background: "rgba(200,16,46,0.05)",
          border: "1px solid rgba(200,16,46,0.18)",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, color: "#C8102E", fontWeight: 700, marginBottom: 10, letterSpacing: "0.06em" }}>📊 INSIGHT</div>
          <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.9 }}>
            • <strong>90分以降の失点が {atGoals2526}→{atGoals2425} の逆転現象</strong>：今季は10試合で{atGoals2526}失点（{comparisonData[6].curPct}%）、昨季は38試合全体でわずか{atGoals2425}失点（{comparisonData[6].prevPct}%）と、アディショナルタイムの脆弱性が今季の最大の特徴
            <br/>
            • <strong>Opta統計では今季リバプールは後半ATで6失点（うち4本が逆転弾）</strong>—PLシーズン最多タイ記録
            <br/>
            • 昨季は 31-45'（10失点・24%）と 46-60'（9失点・22%）に失点が集中していた。今季は終盤に集中する形にパターンが変化
            <br/>
            • クリーンシートは10試合中{cleanSheets}試合のみ（Leeds・Arsenal・Sunderland）
          </div>
        </div>

        <div style={{ fontSize: 9, color: "#2d2d2d", lineHeight: 1.8 }}>
          ※ 2025-26データ：APIから取得した直近10試合の得点イベントより集計（2025年12月〜2026年2月）。シーズン全体ではなく標本データ。<br/>
          ※ 2024-25データ：FootyStats公式（全38試合41失点）の時間帯別割合より算出。90'区分はOpta記事の言及をもとに76-89'/90'+に分割推定。
        </div>

      </div>
    </div>
  );
}
