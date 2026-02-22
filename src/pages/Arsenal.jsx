import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const TEAM_COLOR = "#EF0107";

// ── 試合別データ (2025-26) ──────────────────────────────
const matches = [
  { id: "MCI", date: "12/22", result: "W 5-1", goals: [36] },
  { id: "IPS", date: "12/27", result: "W 1-0", goals: [] },
  { id: "BRE", date: "1/1",   result: "W 1-0", goals: [] },
  { id: "TOT", date: "1/5",   result: "W 2-1", goals: [90] },
  { id: "LIV", date: "1/8",   result: "D 0-0", goals: [] },
  { id: "STK", date: "1/14",  result: "W 3-1", goals: [45] },
  { id: "MUN", date: "1/22",  result: "W 3-1", goals: [24] },
  { id: "WOL", date: "1/25",  result: "W 1-0", goals: [] },
  { id: "SOU", date: "2/1",   result: "W 3-1", goals: [62] },
  { id: "LEI", date: "2/15",  result: "W 5-1", goals: [66] },
];

// ── 時間帯別失点データ (2025-26) ──────────────────────
const data = [
  { period: "0-15'",  goals: 0, color: "#22c55e" },
  { period: "16-30'", goals: 1, color: "#84cc16" },
  { period: "31-45'", goals: 1, color: "#eab308" },
  { period: "46-60'", goals: 0, color: "#f97316" },
  { period: "61-75'", goals: 2, color: "#ef4444" },
  { period: "76-89'", goals: 0, color: "#dc2626" },
  { period: "90'+",   goals: 2, color: "#a855f7" },
];

const total = data.reduce((acc, curr) => acc + curr.goals, 0);
const cleanSheets = matches.filter((m) => m.goals.length === 0).length;

// ── 昨季データ (2024-25 プレースホルダー) ──────────────
const lastSeasonGoals = [2, 2, 3, 2, 2, 3, 1];

const comparisonData = data.map((d, i) => ({
  period: d.period,
  今季: d.goals,
  昨季: lastSeasonGoals[i],
}));


// ── カスタムTooltip ───────────────────────────────────
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(0,0,0,0.9)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "8px",
      padding: "10px 14px",
      color: "#fff",
      fontSize: "13px",
    }}>
      <div style={{ color: "#aaa", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "20px", fontWeight: "bold", color: TEAM_COLOR }}>
        {payload[0].value} <span style={{ fontSize: "12px", color: "#aaa" }}>失点</span>
      </div>
    </div>
  );
}

function ComparisonTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(0,0,0,0.9)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "8px",
      padding: "10px 14px",
      color: "#fff",
      fontSize: "13px",
    }}>
      <div style={{ color: "#aaa", marginBottom: "6px" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
          <span style={{ color: p.fill }}>{p.name}</span>
          <span style={{ fontWeight: "bold" }}>{p.value} 失点</span>
        </div>
      ))}
    </div>
  );
}


// ── メインコンポーネント ──────────────────────────────
export default function Arsenal() {
  return (
    <div style={{
      padding: "32px 48px",
      background: "#03060F",
      minHeight: "100vh",
      color: "#fff",
      fontFamily: "monospace",
      maxWidth: "900px",
      margin: "0 auto",
    }}>

      {/* ── ヘッダー ── */}
      <div style={{ marginBottom: "28px" }}>
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
          <div style={{
            width: "6px",
            background: TEAM_COLOR,
            borderRadius: "3px",
            alignSelf: "stretch",
          }} />
          <div>
            <div style={{ fontSize: "36px", fontWeight: "bold", letterSpacing: "0.05em" }}>
              ARSENAL FC
            </div>
            <div style={{ fontSize: "18px", color: TEAM_COLOR, letterSpacing: "0.1em" }}>
              時間帯別 失点分析 · 2025–26
            </div>
            <div style={{ fontSize: "11px", color: "#555", marginTop: "6px" }}>
              Premier League · 直近10試合
            </div>
          </div>
        </div>
      </div>


      {/* ── KPIカード ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "10px",
        marginBottom: "28px",
      }}>
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderTop: `2px solid ${TEAM_COLOR}`,
          borderRadius: "8px",
          padding: "14px",
        }}>
          <div style={{ fontSize: "10px", color: "#666", marginBottom: "6px" }}>総失点</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: TEAM_COLOR }}>{total}</div>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderTop: "2px solid #f59e0b",
          borderRadius: "8px",
          padding: "14px",
        }}>
          <div style={{ fontSize: "10px", color: "#666", marginBottom: "6px" }}>試合数</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#f59e0b" }}>10</div>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderTop: "2px solid #22c55e",
          borderRadius: "8px",
          padding: "14px",
        }}>
          <div style={{ fontSize: "10px", color: "#666", marginBottom: "6px" }}>クリーンシート</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#22c55e" }}>{cleanSheets}</div>
        </div>
      </div>


      {/* ── 時間帯別グラフ ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "12px",
        padding: "24px 16px",
        marginBottom: "24px",
      }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <XAxis
              dataKey="period"
              tick={{ fill: "#888", fontSize: 12 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#666", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="goals" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── 昨季比較グラフ ── */}
      <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", marginBottom: "12px" }}>
        昨季比較 · 2024–25 vs 2025–26
      </div>

      <div style={{ display: "flex", gap: "20px", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "12px", height: "12px", borderRadius: "2px", background: TEAM_COLOR }} />
          <span style={{ fontSize: "11px", color: "#aaa" }}>今季 2025–26</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "12px", height: "12px", borderRadius: "2px", background: "#22c55e" }} />
          <span style={{ fontSize: "11px", color: "#aaa" }}>昨季 2024–25</span>
        </div>
      </div>

      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "12px",
        padding: "24px 16px",
        marginBottom: "28px",
      }}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={comparisonData} barCategoryGap="25%">
            <XAxis
              dataKey="period"
              tick={{ fill: "#888", fontSize: 12 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#666", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ComparisonTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="今季" fill={TEAM_COLOR} radius={[4, 4, 0, 0]} />
            <Bar dataKey="昨季" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── 試合別ログ ── */}
      <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", marginBottom: "12px" }}>
        試合別 失点ログ
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "8px",
      }}>
        {matches.map((match) => {
          const borderColor =
            match.result.startsWith("W") ? "#22c55e" :
            match.result.startsWith("D") ? "#f59e0b" :
            "#ef4444";

          return (
            <div key={match.id} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderLeft: `3px solid ${borderColor}`,
              borderRadius: "8px",
              padding: "10px 12px",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "13px", fontWeight: "bold" }}>{match.id}</span>
                <span style={{ fontSize: "10px", color: borderColor }}>{match.result}</span>
              </div>
              <div style={{ fontSize: "10px", color: "#555", marginBottom: "8px" }}>{match.date}</div>
              {match.goals.length === 0 ? (
                <div style={{ fontSize: "10px", color: "#22c55e" }}>✓ クリーンシート</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {match.goals.map((minute, i) => (
                    <span key={i} style={{
                      background: "rgba(239,1,7,0.2)",
                      border: `1px solid ${TEAM_COLOR}`,
                      color: TEAM_COLOR,
                      borderRadius: "4px",
                      padding: "2px 6px",
                      fontSize: "10px",
                    }}>
                      {minute}'
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
