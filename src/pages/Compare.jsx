import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import TeamSelector from "../components/TeamSelector";
import { useTeamGoals } from "../hooks/useTeamGoals";

// ── チームカラーマップ（football-data.org のチームID → クラブカラー） ──
const TEAM_COLORS = {
  57:  "#EF0107", // Arsenal
  58:  "#95BFE5", // Aston Villa
  61:  "#034694", // Chelsea
  62:  "#C4122E", // Crystal Palace
  64:  "#C8102E", // Liverpool
  65:  "#6CABDD", // Man City
  66:  "#DA291C", // Man United
  67:  "#00A4E4", // Newcastle
  73:  "#FDB913", // Wolves
  328: "#E03A3E", // Brentford
  338: "#0057B8", // Brighton
  340: "#D71920", // Southampton
  341: "#0044A9", // Ipswich
  346: "#FDBE11", // Leicester
  351: "#DD0000", // Nottm Forest
  354: "#CC0000", // Fulham
  356: "#DA291C", // Bournemouth
  402: "#274488", // Everton
  563: "#7A263A", // West Ham
};

// チームカラーが未登録の場合のフォールバック
const FALLBACK_COLORS = ["#4e9af1", "#f59e0b"];

function getTeamColor(teamId, slotIndex) {
  return TEAM_COLORS[teamId] ?? FALLBACK_COLORS[slotIndex % FALLBACK_COLORS.length];
}

// 6時間帯ラベルと対応するカラー（内訳テーブルのボトムライン用）
const PERIODS = [
  { label: "0–15'",  color: "#22c55e" },
  { label: "16–30'", color: "#84cc16" },
  { label: "31–45'", color: "#eab308" },
  { label: "46–60'", color: "#f97316" },
  { label: "61–75'", color: "#ef4444" },
  { label: "76–90'", color: "#a855f7" },
];


// ── メインコンポーネント ─────────────────────────────────────
export default function Compare() {
  // selectedIds: [teamId, teamId] 形式（最大2件）
  const [selectedIds, setSelectedIds] = useState([]);
  // allTeams: TeamSelector からコールバックで受け取る全チームリスト
  const [allTeams, setAllTeams] = useState([]);

  // selectedIds の順序を保ったまま team オブジェクトを取り出す
  const team0 = allTeams.find(t => t.id === selectedIds[0]) ?? null;
  const team1 = allTeams.find(t => t.id === selectedIds[1]) ?? null;

  // 各スロットのデータを取得（teamId が null の場合はフックが即 return）
  const { data: data0, loading: loading0, error: error0 } = useTeamGoals(team0?.id ?? null, 2024);
  const { data: data1, loading: loading1, error: error1 } = useTeamGoals(team1?.id ?? null, 2024);

  const color0 = team0 ? getTeamColor(team0.id, 0) : FALLBACK_COLORS[0];
  const color1 = team1 ? getTeamColor(team1.id, 1) : FALLBACK_COLORS[1];

  // チームが選択済みかつデータが揃っているか
  const ready0 = !!team0 && !loading0 && data0 !== null;
  const ready1 = !!team1 && !loading1 && data1 !== null;
  const isAnyLoading = (!!team0 && loading0) || (!!team1 && loading1);

  // グラフ用データ（両チームの失点数を同一配列にまとめる）
  const chartData = PERIODS.map((p, i) => {
    const entry = { period: p.label };
    if (ready0 && team0) entry[team0.shortName] = data0[i]?.goals ?? 0;
    if (ready1 && team1) entry[team1.shortName] = data1[i]?.goals ?? 0;
    return entry;
  });

  const total0 = ready0 ? data0.reduce((s, d) => s + d.goals, 0) : null;
  const total1 = ready1 ? data1.reduce((s, d) => s + d.goals, 0) : null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#03060F",
      color: "#fff",
      fontFamily: "'Space Mono', monospace",
      padding: "28px 20px",
      boxSizing: "border-box",
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Anton&display=swap"
        rel="stylesheet"
      />

      <div style={{ maxWidth: 880, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 28 }}>
          <div style={{ width: 6, background: "#555", alignSelf: "stretch", borderRadius: 3, flexShrink: 0 }} />
          <div>
            <div style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: "clamp(24px, 5vw, 48px)",
              letterSpacing: "0.04em",
              lineHeight: 1,
            }}>
              TEAM COMPARISON
            </div>
            <div style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: "clamp(12px, 2vw, 20px)",
              letterSpacing: "0.1em",
              color: "#888",
              lineHeight: 1.3,
            }}>
              時間帯別 失点分析 — チーム間比較
            </div>
            <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>
              2024-25 PL シーズン（全38試合・FINISHED）
            </div>
          </div>
        </div>

        {/* ── TeamSelector ── */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          padding: "16px",
          marginBottom: 24,
        }}>
          <TeamSelector
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            onTeamsLoaded={setAllTeams}
          />
        </div>

        {/* ── 未選択時プロンプト ── */}
        {selectedIds.length === 0 && (
          <div style={{
            textAlign: "center",
            padding: "48px 20px",
            color: "#333",
            fontSize: 12,
            letterSpacing: "0.05em",
          }}>
            上のグリッドからチームを選択してください
          </div>
        )}

        {/* ── 選択済み以降のコンテンツ ── */}
        {selectedIds.length > 0 && (
          <>
            {/* 選択チームバッジ */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { team: team0, color: color0, total: total0, loading: loading0 || (!!team0 && !ready0) },
                { team: team1, color: color1, total: total1, loading: loading1 || (!!team1 && !ready1) },
              ]
                .filter(s => s.team !== null)
                .map(({ team, color, total, loading }) => (
                  <div key={team.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    background: "rgba(255,255,255,0.04)",
                    border: `1px solid ${color}`,
                    borderRadius: 10,
                    padding: "10px 16px",
                  }}>
                    <img
                      src={team.crest}
                      width={24}
                      height={24}
                      style={{ objectFit: "contain" }}
                      alt={team.name}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color }}>{team.shortName}</div>
                      <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>
                        {loading ? "Loading..." : `総失点 ${total}`}
                      </div>
                    </div>
                  </div>
                ))}

              {isAnyLoading && (
                <div style={{ alignSelf: "center", fontSize: 11, color: "#444" }}>
                  データ取得中...
                </div>
              )}
            </div>

            {/* エラー表示 */}
            {(error0 || error1) && (
              <div style={{ color: "#ef4444", fontSize: 12, marginBottom: 16 }}>
                Error: データを取得できませんでした
              </div>
            )}

            {/* ── グラフ ── */}
            {(ready0 || ready1) && (
              <div style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12,
                padding: "24px 16px",
                marginBottom: 20,
                height: 300,
              }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={3} barCategoryGap="25%">
                    <XAxis
                      dataKey="period"
                      tick={{ fill: "#888", fontSize: 11, fontFamily: "'Space Mono', monospace" }}
                      axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fill: "#555", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(5,10,20,0.97)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 8,
                        fontFamily: "'Space Mono', monospace",
                        fontSize: 11,
                      }}
                      itemStyle={{ color: "#ccc" }}
                      labelStyle={{ color: "#888", marginBottom: 4 }}
                      cursor={{ fill: "rgba(255,255,255,0.03)" }}
                    />
                    <Legend
                      formatter={v => (
                        <span style={{ fontSize: 11, color: "#ccc" }}>{v}</span>
                      )}
                    />
                    {ready0 && team0 && (
                      <Bar dataKey={team0.shortName} fill={color0} radius={[3, 3, 0, 0]} />
                    )}
                    {ready1 && team1 && (
                      <Bar dataKey={team1.shortName} fill={color1} fillOpacity={0.85} radius={[3, 3, 0, 0]} />
                    )}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ── 時間帯別 内訳テーブル ── */}
            {(ready0 || ready1) && (
              <>
                <div style={{
                  fontSize: 10,
                  color: "#555",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  marginBottom: 10,
                }}>
                  時間帯別 内訳
                </div>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(6,1fr)",
                  gap: 6,
                  marginBottom: 12,
                }}>
                  {PERIODS.map((p, i) => (
                    <div key={p.label} style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderBottom: `2px solid ${p.color}`,
                      borderRadius: 8,
                      padding: "10px 6px",
                      textAlign: "center",
                    }}>
                      <div style={{ fontSize: 9, color: "#666", marginBottom: 6 }}>{p.label}</div>
                      {ready0 && (
                        <div style={{ fontSize: 18, fontWeight: 700, color: color0 }}>
                          {data0[i]?.goals ?? 0}
                        </div>
                      )}
                      {ready0 && ready1 && (
                        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                      )}
                      {ready1 && (
                        <div style={{ fontSize: ready0 ? 15 : 18, fontWeight: 700, color: color1 }}>
                          {data1[i]?.goals ?? 0}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* 凡例 */}
                <div style={{ display: "flex", gap: 16, marginBottom: 28, fontSize: 10, color: "#555", flexWrap: "wrap" }}>
                  {ready0 && team0 && (
                    <span>
                      <span style={{ color: color0, fontWeight: 700 }}>■</span> {team0.shortName}（2024-25）
                    </span>
                  )}
                  {ready1 && team1 && (
                    <span>
                      <span style={{ color: color1, fontWeight: 700 }}>■</span> {team1.shortName}（2024-25）
                    </span>
                  )}
                </div>
              </>
            )}
          </>
        )}

        <div style={{ fontSize: 9, color: "#2d2d2d", lineHeight: 1.8 }}>
          ※ データ：football-data.org API より取得（2024-25 PL・FINISHED試合）
        </div>

      </div>
    </div>
  );
}
