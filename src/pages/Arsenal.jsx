import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";
import { useTeamGoals } from "../hooks/useTeamGoals";

const TEAM_ID   = 57;
const TEAM_COLOR = "#EF0107";

// 2023-24 Arsenal失点データ（比較用・FBref公式より：38試合 29失点）
// 前半(0-45'): 3+4+5 = 12、後半(46-90'): 5+5+7 = 17
const PREV_RAW   = [12, 17];
const TOTAL_PREV = 29;
const GAMES_PREV = 38;

const PERIODS = [
  { label: "前半", color: "#22c55e" },
  { label: "後半", color: "#ef4444" },
];


// ── Tooltips ──────────────────────────────────────────────
const CompareTooltip = ({ active, payload, label, comparisonData }) => {
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
        <span style={{ color: TEAM_COLOR }}>2024-25</span>
        <span>{d.cur}失点 <span style={{ color: "#666" }}>({d.curPct}%)</span></span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ color: "#4ade80" }}>2023-24</span>
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


const LoadingScreen = () => (
  <div style={{
    minHeight: "100vh", background: "#03060F",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Space Mono', monospace", color: "#555", fontSize: 13,
  }}>
    Loading...
  </div>
);

const ErrorScreen = () => (
  <div style={{
    minHeight: "100vh", background: "#03060F",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Space Mono', monospace", color: "#ef4444", fontSize: 13,
  }}>
    Error: データを取得できませんでした
  </div>
);


export default function Arsenal() {
  const [view, setView] = useState("compare");
  const { data, loading, error } = useTeamGoals(TEAM_ID, 2024);

  if (loading || !data) return <LoadingScreen />;
  if (error)            return <ErrorScreen />;

  const TOTAL_CUR = data.reduce((sum, d) => sum + d.goals, 0);
  const GAMES_CUR = 38;

  const comparisonData = PERIODS.map((p, i) => {
    const cur  = data[i]?.goals ?? 0;
    const prev = PREV_RAW[i];
    return {
      period: p.label,
      "2024-25（実数)":  cur,
      "2023-24（換算)": +(prev * GAMES_CUR / GAMES_PREV).toFixed(2),
      cur,
      prev,
      curPct:  TOTAL_CUR  > 0 ? +((cur  / TOTAL_CUR)  * 100).toFixed(1) : 0,
      prevPct: TOTAL_PREV > 0 ? +((prev / TOTAL_PREV) * 100).toFixed(1) : 0,
      color: p.color,
    };
  });

  const pctData = PERIODS.map((p, i) => ({
    period: p.label,
    "2024-25": comparisonData[i].curPct,
    "2023-24": comparisonData[i].prevPct,
  }));

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
          <div style={{ width: 6, background: TEAM_COLOR, alignSelf: "stretch", borderRadius: 3, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "clamp(24px, 5vw, 48px)", letterSpacing: "0.04em", lineHeight: 1 }}>
              ARSENAL FC
            </div>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "clamp(13px, 2.2vw, 22px)", letterSpacing: "0.1em", color: TEAM_COLOR, lineHeight: 1.3 }}>
              前半/後半 失点分析 — シーズン対比
            </div>
            <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>
              2024-25（全38試合） vs 2023-24（全38試合）
            </div>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr) repeat(2,1fr)", gap: 8, marginBottom: 24 }}>
          {[
            { label: "2024-25 総失点", value: `${TOTAL_CUR}`,  sub: `${GAMES_CUR}試合`,  accent: TEAM_COLOR },
            { label: "2023-24 総失点", value: `${TOTAL_PREV}`, sub: `${GAMES_PREV}試合（PL2位）`, accent: "#4ade80" },
            { label: "後半 2024-25",   value: `${comparisonData[1].cur}`,  sub: `全失点の${comparisonData[1].curPct}%`,  accent: "#ef4444" },
            { label: "後半 2023-24",   value: `${comparisonData[1].prev}`, sub: `全失点の${comparisonData[1].prevPct}%`, accent: "#f97316" },
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
            ["compare", "実数比較"],
            ["pct",     "割合（%）比較"],
            ["radar",   "レーダー"],
          ].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "6px 14px",
              borderRadius: 4,
              border: view === v ? `1px solid ${TEAM_COLOR}` : "1px solid rgba(255,255,255,0.12)",
              background: view === v ? "rgba(239,1,7,0.15)" : "transparent",
              color: view === v ? TEAM_COLOR : "#888",
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
          marginBottom: 20,
          height: 300,
        }}>
          {view === "compare" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} barGap={3} barCategoryGap="35%">
                <XAxis dataKey="period" tick={{ fill: "#888", fontSize: 13, fontFamily: "'Space Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CompareTooltip comparisonData={comparisonData} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend formatter={v => <span style={{ color: v === "2024-25（実数)" ? TEAM_COLOR : "#4ade80", fontSize: 11 }}>{v}</span>} />
                <Bar dataKey="2024-25（実数)" fill={TEAM_COLOR} radius={[3, 3, 0, 0]} />
                <Bar dataKey="2023-24（換算)" fill="#4ade80" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {view === "pct" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pctData} barGap={3} barCategoryGap="35%">
                <XAxis dataKey="period" tick={{ fill: "#888", fontSize: 13, fontFamily: "'Space Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<PctTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend formatter={v => <span style={{ color: v === "2024-25" ? TEAM_COLOR : "#4ade80", fontSize: 11 }}>{v}</span>} />
                <Bar dataKey="2024-25" fill={TEAM_COLOR} radius={[3, 3, 0, 0]} />
                <Bar dataKey="2023-24" fill="#4ade80" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {view === "radar" && (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={pctData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="period" tick={{ fill: "#aaa", fontSize: 13, fontFamily: "'Space Mono', monospace" }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name="2024-25" dataKey="2024-25" stroke={TEAM_COLOR} fill={TEAM_COLOR} fillOpacity={0.3} strokeWidth={2} />
                <Radar name="2023-24" dataKey="2023-24" stroke="#4ade80" fill="#4ade80" fillOpacity={0.2} strokeWidth={2} />
                <Legend formatter={v => <span style={{ color: v === "2024-25" ? TEAM_COLOR : "#4ade80", fontSize: 11 }}>{v}</span>} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── 前半/後半 内訳テーブル ── */}
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>前半/後半 内訳</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 6, marginBottom: 12 }}>
          {comparisonData.map((d, i) => (
            <div key={d.period} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderBottom: `2px solid ${PERIODS[i].color}`,
              borderRadius: 8,
              padding: "14px 10px",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 11, color: "#666", marginBottom: 8 }}>{d.period}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: TEAM_COLOR }}>{d.cur}</div>
              <div style={{ fontSize: 10, color: "#555", marginBottom: 6 }}>{d.curPct}%</div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "8px 0" }} />
              <div style={{ fontSize: 22, fontWeight: 700, color: "#4ade80" }}>{d.prev}</div>
              <div style={{ fontSize: 10, color: "#555" }}>{d.prevPct}%</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 28, fontSize: 10, color: "#555" }}>
          <span><span style={{ color: TEAM_COLOR, fontWeight: 700 }}>赤</span> = 2024-25（実数）</span>
          <span><span style={{ color: "#4ade80", fontWeight: 700 }}>緑</span> = 2023-24（実数）</span>
        </div>

        {/* ── INSIGHT ── */}
        <div style={{
          background: "rgba(239,1,7,0.05)",
          border: "1px solid rgba(239,1,7,0.18)",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, color: TEAM_COLOR, fontWeight: 700, marginBottom: 10, letterSpacing: "0.06em" }}>📊 INSIGHT</div>
          <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.9 }}>
            • <strong>前半失点：今季 {comparisonData[0].cur} / 昨季 {comparisonData[0].prev}</strong>
              （全失点の今季 {comparisonData[0].curPct}%・昨季 {comparisonData[0].prevPct}%）
            <br />
            • <strong>後半失点：今季 {comparisonData[1].cur} / 昨季 {comparisonData[1].prev}</strong>
              （全失点の今季 {comparisonData[1].curPct}%・昨季 {comparisonData[1].prevPct}%）
            <br />
            • 今季総失点 {TOTAL_CUR} vs 昨季（2023-24）{TOTAL_PREV}（{GAMES_PREV}試合）
          </div>
        </div>

        <div style={{ fontSize: 9, color: "#2d2d2d", lineHeight: 1.8 }}>
          ※ 2024-25データ：football-data.org API より取得（全38試合・FINISHED）<br />
          ※ 2023-24データ：FBref公式（全38試合29失点）の前半/後半比率より推定算出
        </div>

      </div>
    </div>
  );
}
