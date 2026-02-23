import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import TeamSelector from "../components/TeamSelector";
import { useTeamData } from "../hooks/useTeamData";

// チームカラーマップ（api-sports チームID → クラブカラー）
const TEAM_COLORS = {
  33: "#DA291C", 34: "#00A4E4", 35: "#DA020E", 36: "#CC0000",
  39: "#FDB913", 40: "#C8102E", 41: "#D71920", 42: "#EF0107",
  45: "#274488", 46: "#003090", 47: "#132257", 48: "#7A263A",
  49: "#034694", 50: "#6CABDD", 51: "#0057B8", 52: "#C4122E",
  55: "#E03A3E", 57: "#0044A9", 65: "#DD0000", 66: "#95BFE5",
};
const FALLBACK_COLORS = ["#4e9af1", "#f59e0b"];
const getTeamColor = (id, slot) => TEAM_COLORS[id] ?? FALLBACK_COLORS[slot % 2];

const PERIOD_KEYS   = ["0-15", "16-30", "31-45", "46-60", "61-75", "76-90"];
const PERIOD_LABELS = ["0–15'", "16–30'", "31–45'", "46–60'", "61–75'", "76–90'"];
const PERIOD_COLORS = ["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444", "#a855f7"];

function getByTime(data, metric) {
  if (!data?.byTimeAvailable) return null;
  if (!data[metric]?.byTime) return null;
  return PERIOD_KEYS.map(k => data[metric].byTime[k] ?? 0);
}

function ToggleGroup({ options, value, onChange, activeColor = "#aaa" }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map(([v, label]) => {
        const active = value === v;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            padding: "5px 12px", borderRadius: 4, fontSize: 11, cursor: "pointer",
            fontFamily: "'Space Mono', monospace",
            border: active ? `1px solid ${activeColor}` : "1px solid rgba(255,255,255,0.12)",
            background: active ? `${activeColor}22` : "transparent",
            color: active ? activeColor : "#888",
          }}>{label}</button>
        );
      })}
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────

export default function Compare() {
  const [selectedIds, setSelectedIds] = useState([]);
  const [allTeams, setAllTeams]       = useState([]);
  const [metric, setMetric]           = useState("conceded"); // "conceded"|"scored"

  const team0 = allTeams.find(t => t.id === selectedIds[0]) ?? null;
  const team1 = allTeams.find(t => t.id === selectedIds[1]) ?? null;

  const { data: data0, loading: loading0, error: error0 } = useTeamData(team0?.id ?? null, 2024);
  const { data: data1, loading: loading1, error: error1 } = useTeamData(team1?.id ?? null, 2024);

  const color0 = team0 ? getTeamColor(team0.id, 0) : FALLBACK_COLORS[0];
  const color1 = team1 ? getTeamColor(team1.id, 1) : FALLBACK_COLORS[1];

  const ready0 = !!team0 && !loading0 && data0 !== null;
  const ready1 = !!team1 && !loading1 && data1 !== null;
  const isAnyLoading = (!!team0 && loading0) || (!!team1 && loading1);

  const vals0 = ready0 ? getByTime(data0, metric) : null;
  const vals1 = ready1 ? getByTime(data1, metric) : null;

  const total0 = ready0 ? (data0[metric]?.total ?? null) : null;
  const total1 = ready1 ? (data1[metric]?.total ?? null) : null;

  const chartData = PERIOD_KEYS.map((k, i) => {
    const e = { period: PERIOD_LABELS[i] };
    if (vals0 && team0) e[team0.shortName] = vals0[i];
    if (vals1 && team1) e[team1.shortName] = vals1[i];
    return e;
  });

  const metricLabel = metric === "conceded" ? "失点" : "得点";
  const metricColor = metric === "conceded" ? "#ef4444" : "#22c55e";

  return (
    <div style={{ minHeight: "100vh", background: "#03060F", color: "#fff",
      fontFamily: "'Space Mono', monospace", padding: "28px 20px", boxSizing: "border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Anton&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 880, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 28 }}>
          <div style={{ width: 6, background: "#555", alignSelf: "stretch", borderRadius: 3, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "clamp(24px,5vw,48px)", letterSpacing: "0.04em", lineHeight: 1 }}>
              TEAM COMPARISON
            </div>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "clamp(12px,2vw,20px)", letterSpacing: "0.1em", color: "#888", lineHeight: 1.3 }}>
              時間帯別 得失点分析 — チーム間比較
            </div>
            <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>
              2024-25 PL シーズン（全38試合・FINISHED）
            </div>
          </div>
        </div>

        {/* ── TeamSelector ── */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px", marginBottom: 24 }}>
          <TeamSelector
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            onTeamsLoaded={setAllTeams}
          />
        </div>

        {/* 未選択時プロンプト */}
        {selectedIds.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 20px", color: "#333", fontSize: 12, letterSpacing: "0.05em" }}>
            上のグリッドからチームを選択してください
          </div>
        )}

        {selectedIds.length > 0 && (
          <>
            {/* ── 得点/失点切り替え ── */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              <ToggleGroup
                options={[["conceded","失点比較"],["scored","得点比較"]]}
                value={metric}
                onChange={setMetric}
                activeColor={metricColor}
              />
              {isAnyLoading && (
                <span style={{ fontSize: 11, color: "#444" }}>データ取得中...</span>
              )}
            </div>

            {/* 選択チームバッジ */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { team: team0, color: color0, total: total0, loading: !!team0 && loading0 },
                { team: team1, color: color1, total: total1, loading: !!team1 && loading1 },
              ]
                .filter(s => s.team !== null)
                .map(({ team, color, total, loading }) => (
                  <div key={team.id} style={{ display: "flex", alignItems: "center", gap: 10,
                    background: "rgba(255,255,255,0.04)", border: `1px solid ${color}`,
                    borderRadius: 10, padding: "10px 16px" }}>
                    <img src={team.logo} width={24} height={24} style={{ objectFit: "contain" }} alt={team.name} />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color }}>{team.shortName}</div>
                      <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>
                        {loading ? "Loading..." : `${metricLabel} ${total ?? "–"}`}
                      </div>
                    </div>
                  </div>
                ))}
            </div>

            {/* エラー表示 */}
            {(error0 || error1) && (
              <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 16 }}>
                Error: データを取得できませんでした
              </div>
            )}

            {/* ── グラフ ── */}
            {(vals0 || vals1) && (
              <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "24px 16px", marginBottom: 20, height: 300 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={3} barCategoryGap="25%">
                    <XAxis dataKey="period" tick={{ fill: "#888", fontSize: 11, fontFamily: "'Space Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "rgba(5,10,20,0.97)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontFamily: "'Space Mono', monospace", fontSize: 11 }}
                      itemStyle={{ color: "#ccc" }} labelStyle={{ color: "#888", marginBottom: 4 }}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Legend formatter={v => <span style={{ fontSize: 11, color: "#ccc" }}>{v}</span>} />
                    {vals0 && team0 && <Bar dataKey={team0.shortName} fill={color0} radius={[3,3,0,0]} />}
                    {vals1 && team1 && <Bar dataKey={team1.shortName} fill={color1} fillOpacity={0.85} radius={[3,3,0,0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── 時間帯別内訳テーブル ── */}
            {(vals0 || vals1) && (
              <>
                <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
                  時間帯別 内訳
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6, marginBottom: 12 }}>
                  {PERIOD_KEYS.map((k, i) => (
                    <div key={k} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderBottom: `2px solid ${PERIOD_COLORS[i]}`, borderRadius: 8, padding: "10px 6px", textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: "#666", marginBottom: 6 }}>{PERIOD_LABELS[i]}</div>
                      {vals0 && (
                        <div style={{ fontSize: 18, fontWeight: 700, color: color0 }}>{vals0[i]}</div>
                      )}
                      {vals0 && vals1 && (
                        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                      )}
                      {vals1 && (
                        <div style={{ fontSize: vals0 ? 15 : 18, fontWeight: 700, color: color1 }}>{vals1[i]}</div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 凡例 */}
                <div style={{ display: "flex", gap: 16, marginBottom: 28, fontSize: 10, color: "#555", flexWrap: "wrap" }}>
                  {vals0 && team0 && (
                    <span><span style={{ color: color0, fontWeight: 700 }}>■</span> {team0.shortName}（2024-25）</span>
                  )}
                  {vals1 && team1 && (
                    <span><span style={{ color: color1, fontWeight: 700 }}>■</span> {team1.shortName}（2024-25）</span>
                  )}
                </div>
              </>
            )}

            {/* データなし */}
            {!vals0 && !vals1 && !isAnyLoading && (
              <div style={{ textAlign: "center", padding: "32px 0", color: "#444", fontSize: 12 }}>
                選択チームの時間帯データは取得できませんでした
              </div>
            )}
          </>
        )}

        <div style={{ fontSize: 9, color: "#2d2d2d", lineHeight: 1.8 }}>
          ※ データ：api-sports.io より取得（2024-25 PL・FINISHED試合）
        </div>

      </div>
    </div>
  );
}
