import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTeamData } from "../hooks/useTeamData";

const SEASONS      = [2022, 2023, 2024];
const SEASON_LABELS = ["2022-23", "2023-24", "2024-25"];
const TOP_N        = 8;
const PLAYER_COLORS = [
  "#00ff85", "#ff6b6b", "#4ecdc4", "#ffd93d",
  "#a29bfe", "#fd79a8", "#74b9ff", "#e17055",
];

// SVG layout constants
const W    = 720;
const H    = 560;
const PAD  = { top: 56, right: 40, bottom: 44, left: 44 };
const COL_X = [
  PAD.left + (W - PAD.left - PAD.right) * 0 / 2,
  PAD.left + (W - PAD.left - PAD.right) * 1 / 2,
  PAD.left + (W - PAD.left - PAD.right) * 2 / 2,
];

function rankY(rank, maxRank) {
  const usable = H - PAD.top - PAD.bottom;
  return PAD.top + ((rank - 1) / Math.max(maxRank - 1, 1)) * usable;
}

function goalR(goals, maxGoals) {
  return Math.max(7, Math.sqrt(goals / Math.max(maxGoals, 1)) * 16);
}

export default function ScorerTracker({ teamId }) {
  const { data: data2022, loading: l2022 } = useTeamData(teamId, 2022);
  const { data: data2023, loading: l2023 } = useTeamData(teamId, 2023);
  const { data: data2024, loading: l2024 } = useTeamData(teamId, 2024);
  const [tooltip, setTooltip] = useState(null);
  const svgRef   = useRef(null);
  const navigate = useNavigate();

  if (l2022 || l2023 || l2024) {
    return (
      <div style={{ height: 200, display: "flex", alignItems: "center",
        justifyContent: "center", color: "#555", fontSize: 12,
        fontFamily: "'Space Mono', monospace" }}>
        Loading...
      </div>
    );
  }

  const dataMap = { 2022: data2022, 2023: data2023, 2024: data2024 };
  const hasAnyScorers = SEASONS.some(s => dataMap[s]?.scorers?.length > 0);

  if (!hasAnyScorers) {
    return (
      <div style={{ padding: "48px 0", textAlign: "center",
        fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#444",
        background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, lineHeight: 2 }}>
        <div style={{ color: "#555" }}>得点者データなし</div>
        <div style={{ fontSize: 10, color: "#333", marginTop: 4 }}>
          node scripts/fetchData.mjs を実行してデータを取得してください
        </div>
      </div>
    );
  }

  // ── season ごとの rank マップを構築 ──
  // seasonRankings[season][playerId] = { rank, goals, assists, appearances, name, photo }
  const seasonRankings = {};
  for (const season of SEASONS) {
    seasonRankings[season] = {};
    const scorers = dataMap[season]?.scorers ?? [];
    scorers.forEach((s, i) => {
      seasonRankings[season][s.id] = {
        rank: i + 1,
        goals: s.goals,
        assists: s.assists,
        appearances: s.appearances,
        name: s.name,
        photo: s.photo,
      };
    });
  }

  // ── 全シーズンで出現した選手を集めてソート → top 8 ──
  const playerMap = new Map();
  for (const season of SEASONS) {
    for (const [id, info] of Object.entries(seasonRankings[season])) {
      const pid = Number(id);
      const prev = playerMap.get(pid);
      if (!prev || prev.maxGoals < info.goals) {
        playerMap.set(pid, { id: pid, name: info.name, photo: info.photo, maxGoals: info.goals });
      }
    }
  }
  const topPlayers = [...playerMap.values()]
    .sort((a, b) => b.maxGoals - a.maxGoals)
    .slice(0, TOP_N);

  // ── 表示する最大ランク（全 top8 × 全シーズンで出る rank の最大）──
  let maxRank = TOP_N;
  for (const player of topPlayers) {
    for (const season of SEASONS) {
      const entry = seasonRankings[season][player.id];
      if (entry) maxRank = Math.max(maxRank, entry.rank);
    }
  }
  maxRank = Math.min(maxRank, 15);

  const maxGoals = Math.max(...topPlayers.map(p => p.maxGoals), 1);

  // ── SVG ハンドラ ──
  function handleMouseMove(e, data) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({ ...data, mx: e.clientX - rect.left, my: e.clientY - rect.top });
  }

  return (
    <div style={{ position: "relative", background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12,
      padding: "20px 16px 16px", marginBottom: 16 }}>

      <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em",
        textTransform: "uppercase", marginBottom: 16 }}>
        得点者ランキング推移 — Top {TOP_N}
      </div>

      <div ref={svgRef} style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }}
        >
          {/* ── シーズンラベル ── */}
          {SEASONS.map((season, si) => (
            <text key={season} x={COL_X[si]} y={PAD.top - 20}
              textAnchor="middle" fill="#888"
              fontSize={13} fontFamily="'Space Mono', monospace" fontWeight={700}>
              {SEASON_LABELS[si]}
            </text>
          ))}

          {/* ── ランク目盛線 ── */}
          {Array.from({ length: maxRank }, (_, i) => {
            const y = rankY(i + 1, maxRank);
            return (
              <g key={i}>
                <line
                  x1={COL_X[0]} y1={y} x2={COL_X[2]} y2={y}
                  stroke="rgba(255,255,255,0.04)" strokeWidth={1}
                />
                <text x={PAD.left - 10} y={y} textAnchor="end"
                  dominantBaseline="middle" fontSize={9} fill="#444"
                  fontFamily="'Space Mono', monospace">
                  {i + 1}
                </text>
              </g>
            );
          })}

          {/* ── 各選手のライン & バブル ── */}
          {topPlayers.map((player, pi) => {
            const color = PLAYER_COLORS[pi % PLAYER_COLORS.length];

            const points = SEASONS.map((season, si) => {
              const entry = seasonRankings[season][player.id];
              if (!entry || entry.rank > 15) return null;
              return {
                x: COL_X[si],
                y: rankY(entry.rank, maxRank),
                goals: entry.goals,
                assists: entry.assists,
                appearances: entry.appearances,
                rank: entry.rank,
                season,
                seasonLabel: SEASON_LABELS[si],
              };
            });

            // ベジェ曲線
            const paths = [];
            for (let i = 0; i < points.length - 1; i++) {
              const p1 = points[i], p2 = points[i + 1];
              if (!p1 || !p2) continue;
              const cx = (p1.x + p2.x) / 2;
              paths.push(
                <path key={i}
                  d={`M ${p1.x} ${p1.y} C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`}
                  stroke={color} strokeWidth={2.5} fill="none" strokeOpacity={0.6}
                />
              );
            }

            // バブル
            const bubbles = points.map((pt, si) => {
              if (!pt) return null;
              const r = goalR(pt.goals, maxGoals);
              return (
                <g key={si} style={{ cursor: "pointer" }}
                  onMouseMove={e => handleMouseMove(e, { ...pt, name: player.name, color })}
                  onMouseLeave={() => setTooltip(null)}
                  onClick={() => navigate(`/player/${player.id}`)}>
                  {/* 外枠 */}
                  <circle cx={pt.x} cy={pt.y} r={r + 1.5}
                    fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.35} />
                  {/* 塗り */}
                  <circle cx={pt.x} cy={pt.y} r={r}
                    fill={color} fillOpacity={0.88}
                    stroke="#080c10" strokeWidth={1.5} />
                  {/* ゴール数 */}
                  <text x={pt.x} y={pt.y} textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={9} fontWeight={700}
                    fill="#080c10" fontFamily="'Space Mono', monospace">
                    {pt.goals}
                  </text>
                </g>
              );
            });

            return <g key={player.id}>{paths}{bubbles}</g>;
          })}
        </svg>

        {/* ── ツールチップ ── */}
        {tooltip && (
          <div style={{
            position: "absolute",
            left: tooltip.mx + 14,
            top: tooltip.my - 56,
            background: "rgba(5,10,20,0.97)",
            border: `1px solid ${tooltip.color}44`,
            borderLeft: `3px solid ${tooltip.color}`,
            borderRadius: 8,
            padding: "10px 14px",
            pointerEvents: "none",
            fontFamily: "'Space Mono', monospace",
            minWidth: 160,
            zIndex: 10,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 6 }}>
              {tooltip.name}
            </div>
            <div style={{ fontSize: 10, color: tooltip.color, marginBottom: 2 }}>
              {tooltip.seasonLabel} — #{tooltip.rank}位
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 8px", fontSize: 9, color: "#aaa" }}>
              <span style={{ color: "#fff", fontSize: 10, fontWeight: 700 }}>{tooltip.goals}G</span>
              <span>{tooltip.assists}A</span>
              <span>{tooltip.appearances}試</span>
            </div>
            <div style={{ fontSize: 8, color: "#444", marginTop: 6 }}>クリックで詳細 →</div>
          </div>
        )}
      </div>

      {/* ── 凡例 ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginTop: 14 }}>
        {topPlayers.map((p, i) => (
          <div key={p.id} style={{ display: "flex", alignItems: "center",
            gap: 5, fontSize: 10, color: "#aaa" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%",
              background: PLAYER_COLORS[i % PLAYER_COLORS.length], flexShrink: 0 }} />
            {p.name}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 10, fontSize: 9, color: "#2d2d2d" }}>
        ※ バブルサイズ = 得点数 · 数値 = ゴール数 · 縦軸 = 順位（上位ほど上）
      </div>
    </div>
  );
}
