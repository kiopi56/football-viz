/**
 * src/pages/PlayerDetail.jsx
 *
 * 選手詳細ページ。
 * public/data/{team}-{season}.json の scorers 配列からデータを取得する。
 * 外部 API は使用しない。
 */

import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useTeamData } from "../hooks/useTeamData";

// ── 定数 ─────────────────────────────────────────────────────

const TEAMS = [
  { id: 40, slug: "liverpool", name: "Liverpool", color: "#C8102E" },
  { id: 42, slug: "arsenal",   name: "Arsenal",   color: "#EF0107" },
];
const SEASONS       = [2022, 2023, 2024];
const SEASON_LABELS = ["2022-23", "2023-24", "2024-25"];

// ── ミニバンプチャート定数 ──────────────────────────────────
const W   = 480;
const H   = 200;
const PAD = { top: 36, right: 30, bottom: 28, left: 36 };
const COL_X = [
  PAD.left + (W - PAD.left - PAD.right) * 0 / 2,
  PAD.left + (W - PAD.left - PAD.right) * 1 / 2,
  PAD.left + (W - PAD.left - PAD.right) * 2 / 2,
];

function rankY(rank, maxRank) {
  const usable = H - PAD.top - PAD.bottom;
  return PAD.top + ((rank - 1) / Math.max(maxRank - 1, 1)) * usable;
}

// ── ユーティリティ ────────────────────────────────────────────

function g90(goals, appearances) {
  if (!appearances) return "—";
  return (goals / appearances * 90).toFixed(2);
}

// ── メインコンポーネント ──────────────────────────────────────

export default function PlayerDetail() {
  const { playerId: playerIdStr } = useParams();
  const playerId = Number(playerIdStr);

  // 全チーム × 全シーズン分のデータをロード（6本）
  const { data: d40_2022, loading: l40_2022 } = useTeamData(40, 2022);
  const { data: d40_2023, loading: l40_2023 } = useTeamData(40, 2023);
  const { data: d40_2024, loading: l40_2024 } = useTeamData(40, 2024);
  const { data: d42_2022, loading: l42_2022 } = useTeamData(42, 2022);
  const { data: d42_2023, loading: l42_2023 } = useTeamData(42, 2023);
  const { data: d42_2024, loading: l42_2024 } = useTeamData(42, 2024);

  const loading = l40_2022 || l40_2023 || l40_2024 || l42_2022 || l42_2023 || l42_2024;

  // ── 全データを整理 ──────────────────────────────────────────
  const allData = useMemo(() => ({
    40: { 2022: d40_2022, 2023: d40_2023, 2024: d40_2024 },
    42: { 2022: d42_2022, 2023: d42_2023, 2024: d42_2024 },
  }), [d40_2022, d40_2023, d40_2024, d42_2022, d42_2023, d42_2024]);

  // ── 選手を全JSONから検索 ──────────────────────────────────
  // seasonStats[season] = { goals, assists, appearances, rank, teamId, teamColor, teamName }
  const { seasonStats, playerName, playerPhoto, primaryTeam } = useMemo(() => {
    const stats = {};
    let name = null, photo = null, latestTeam = null, latestSeason = -1;

    for (const team of TEAMS) {
      for (const season of SEASONS) {
        const scorers = allData[team.id]?.[season]?.scorers ?? [];
        const idx = scorers.findIndex(s => s.id === playerId);
        if (idx === -1) continue;

        const s = scorers[idx];
        stats[season] = {
          goals:       s.goals,
          assists:     s.assists,
          appearances: s.appearances,
          rank:        idx + 1,
          teamId:      team.id,
          teamColor:   team.color,
          teamName:    team.name,
        };

        if (!name)  { name = s.name; photo = s.photo; }
        if (season > latestSeason) { latestSeason = season; latestTeam = team; }
      }
    }

    return {
      seasonStats:  stats,
      playerName:   name,
      playerPhoto:  photo,
      primaryTeam:  latestTeam,
    };
  }, [allData, playerId]);

  // ── ローディング ──────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c10",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Space Mono', monospace", color: "#444", fontSize: 12 }}>
        Loading...
      </div>
    );
  }

  // ── データなし ────────────────────────────────────────────
  if (!playerName) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c10",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", fontFamily: "'Space Mono', monospace",
        gap: 14 }}>
        <div style={{ fontSize: 13, color: "#444" }}>データ準備中</div>
        <div style={{ fontSize: 10, color: "#2d2d2d" }}>
          scorers データは node scripts/fetchData.mjs 実行後に利用可能になります
        </div>
        <Link to="/" style={{ fontSize: 10, color: "#00ff85", textDecoration: "none" }}>← HOME</Link>
      </div>
    );
  }

  const ACCENT = primaryTeam?.color ?? "#00ff85";
  const hasSomeData = Object.keys(seasonStats).length > 0;

  // ── ミニバンプチャート用データ ────────────────────────────
  const maxRank  = Math.max(...Object.values(seasonStats).map(s => s.rank), 8);
  const maxGoals = Math.max(...Object.values(seasonStats).map(s => s.goals), 1);

  const bumpPoints = SEASONS.map((season, si) => {
    const s = seasonStats[season];
    if (!s) return null;
    return {
      x: COL_X[si],
      y: rankY(s.rank, maxRank),
      rank: s.rank,
      goals: s.goals,
      season,
      label: SEASON_LABELS[si],
      color: s.teamColor,
    };
  });

  // ── 総合スタッツ ──────────────────────────────────────────
  const totalGoals   = Object.values(seasonStats).reduce((s, d) => s + d.goals, 0);
  const totalAssists = Object.values(seasonStats).reduce((s, d) => s + d.assists, 0);
  const totalApps    = Object.values(seasonStats).reduce((s, d) => s + d.appearances, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#080c10", color: "#fff",
      fontFamily: "'Space Mono', monospace", padding: "28px 20px", boxSizing: "border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Anton&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 800, margin: "0 auto" }}>

        {/* ── Breadcrumb ── */}
        <div style={{ marginBottom: 20, display: "flex", gap: 12, fontSize: 10, color: "#555" }}>
          <Link to="/" style={{ color: "#555", textDecoration: "none" }}
            onMouseEnter={e => e.target.style.color = "#00ff85"}
            onMouseLeave={e => e.target.style.color = "#555"}>← HOME</Link>
          {primaryTeam && (
            <>
              <span>/</span>
              <Link to={`/team/${primaryTeam.id}`} style={{ color: "#555", textDecoration: "none" }}
                onMouseEnter={e => e.target.style.color = ACCENT}
                onMouseLeave={e => e.target.style.color = "#555"}>{primaryTeam.name}</Link>
            </>
          )}
        </div>

        {/* ── 選手ヘッダー ── */}
        <div style={{ background: "#0e1318", border: "1px solid rgba(255,255,255,0.08)",
          borderTop: `3px solid ${ACCENT}`, borderRadius: 12,
          padding: "24px 28px", marginBottom: 20,
          display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>

          {/* 顔写真 */}
          {playerPhoto && (
            <img src={playerPhoto} alt={playerName}
              style={{ width: 80, height: 80, borderRadius: "50%",
                border: `2px solid ${ACCENT}44`,
                objectFit: "cover", background: "#1a2530", flexShrink: 0 }}
              onError={e => { e.target.style.display = "none"; }}
            />
          )}

          {/* 名前・チーム */}
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontFamily: "'Anton', sans-serif",
              fontSize: "clamp(22px,4vw,38px)", letterSpacing: "0.04em",
              lineHeight: 1, marginBottom: 6 }}>
              {playerName}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {primaryTeam && (
                <span style={{ fontSize: 10, color: ACCENT, fontWeight: 700,
                  padding: "2px 8px", border: `1px solid ${ACCENT}44`,
                  borderRadius: 3 }}>{primaryTeam.name}</span>
              )}
              <span style={{ fontSize: 9, color: "#444" }}>PL {SEASONS.filter(s => seasonStats[s]).map(s => `${s}-${String(s+1).slice(-2)}`).join(" / ")}</span>
            </div>
          </div>

          {/* 通算スタッツ */}
          <div style={{ display: "flex", gap: 20, flexShrink: 0 }}>
            {[
              { label: "総得点", value: totalGoals,   color: "#22c55e" },
              { label: "総A",    value: totalAssists,  color: "#ffd93d" },
              { label: "総出場", value: totalApps,     color: "#888"   },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 24, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 8, color: "#444", marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {hasSomeData && (<>

          {/* ── 3シーズン比較テーブル ── */}
          <div style={{ background: "#0e1318", border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em",
              textTransform: "uppercase", marginBottom: 14 }}>
              シーズン別成績
            </div>

            {/* ヘッダー行 */}
            <div style={{ display: "grid", gridTemplateColumns: "90px 1fr 1fr 1fr 1fr 60px",
              gap: 4, marginBottom: 8 }}>
              {["シーズン", "得点", "アシスト", "出場", "G/90", "チーム"].map(h => (
                <div key={h} style={{ fontSize: 8, color: "#444", letterSpacing: "0.08em",
                  textTransform: "uppercase", padding: "4px 8px" }}>{h}</div>
              ))}
            </div>

            {/* データ行 */}
            {SEASONS.map((season, si) => {
              const s = seasonStats[season];
              const isCurrentSeason = season === Math.max(...Object.keys(seasonStats).map(Number));
              return (
                <div key={season} style={{
                  display: "grid", gridTemplateColumns: "90px 1fr 1fr 1fr 1fr 60px",
                  gap: 4, marginBottom: 4,
                  background: isCurrentSeason ? "rgba(255,255,255,0.03)" : "transparent",
                  borderRadius: 6, padding: "2px 0",
                }}>
                  <div style={{ fontSize: 10, color: isCurrentSeason ? "#ccc" : "#555",
                    padding: "8px 8px", fontWeight: isCurrentSeason ? 700 : 400 }}>
                    {SEASON_LABELS[si]}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700,
                    color: s ? "#22c55e" : "#2d2d2d", padding: "4px 8px" }}>
                    {s?.goals ?? "—"}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700,
                    color: s ? "#ffd93d" : "#2d2d2d", padding: "4px 8px" }}>
                    {s?.assists ?? "—"}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700,
                    color: s ? "#aaa" : "#2d2d2d", padding: "4px 8px" }}>
                    {s?.appearances ?? "—"}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700,
                    color: s ? "#4ecdc4" : "#2d2d2d", padding: "4px 8px" }}>
                    {s ? g90(s.goals, s.appearances) : "—"}
                  </div>
                  <div style={{ fontSize: 9, color: s ? s.teamColor : "#2d2d2d",
                    padding: "8px 8px" }}>
                    {s?.teamName?.slice(0, 3).toUpperCase() ?? "—"}
                  </div>
                </div>
              );
            })}

            {/* 凡例 */}
            <div style={{ marginTop: 10, fontSize: 9, color: "#333" }}>
              G/90 = 90分あたり得点
            </div>
          </div>

          {/* ── ミニバンプチャート ── */}
          {bumpPoints.some(p => p !== null) && (
            <div style={{ background: "#0e1318", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
              <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em",
                textTransform: "uppercase", marginBottom: 12 }}>
                得点ランキング推移
              </div>

              <svg viewBox={`0 0 ${W} ${H}`}
                style={{ width: "100%", maxWidth: W, height: "auto", display: "block" }}>

                {/* シーズンラベル */}
                {SEASON_LABELS.map((label, si) => (
                  <text key={label} x={COL_X[si]} y={PAD.top - 14}
                    textAnchor="middle" fill="#666" fontSize={11}
                    fontFamily="'Space Mono', monospace">{label}</text>
                ))}

                {/* ランク目盛 */}
                {Array.from({ length: maxRank }, (_, i) => (
                  <g key={i}>
                    <line x1={COL_X[0]} y1={rankY(i+1, maxRank)}
                      x2={COL_X[2]} y2={rankY(i+1, maxRank)}
                      stroke="rgba(255,255,255,0.04)" strokeWidth={1} />
                    <text x={PAD.left - 8} y={rankY(i+1, maxRank)}
                      textAnchor="end" dominantBaseline="middle"
                      fontSize={8} fill="#333" fontFamily="'Space Mono', monospace">
                      {i + 1}
                    </text>
                  </g>
                ))}

                {/* ベジェ曲線 */}
                {bumpPoints.map((pt, i) => {
                  if (i === bumpPoints.length - 1) return null;
                  const p1 = bumpPoints[i], p2 = bumpPoints[i + 1];
                  if (!p1 || !p2) return null;
                  const cx = (p1.x + p2.x) / 2;
                  return (
                    <path key={i}
                      d={`M ${p1.x} ${p1.y} C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`}
                      stroke={ACCENT} strokeWidth={2.5} fill="none" strokeOpacity={0.7} />
                  );
                })}

                {/* ランクバブル */}
                {bumpPoints.map((pt, si) => {
                  if (!pt) return null;
                  const r = Math.max(14, Math.sqrt(pt.goals / maxGoals) * 24);
                  return (
                    <g key={si}>
                      <circle cx={pt.x} cy={pt.y} r={r + 2}
                        fill="none" stroke={ACCENT} strokeWidth={1.5} strokeOpacity={0.3} />
                      <circle cx={pt.x} cy={pt.y} r={r}
                        fill={ACCENT} fillOpacity={0.9} stroke="#080c10" strokeWidth={1.5} />
                      <text x={pt.x} y={pt.y - 1} textAnchor="middle"
                        dominantBaseline="middle" fontSize={10} fontWeight={700}
                        fill="#080c10" fontFamily="'Space Mono', monospace">
                        #{pt.rank}
                      </text>
                      {/* 得点ラベル（バブル下） */}
                      <text x={pt.x} y={pt.y + r + 12}
                        textAnchor="middle" fontSize={9} fill="#555"
                        fontFamily="'Space Mono', monospace">
                        {pt.goals}G
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div style={{ fontSize: 9, color: "#2d2d2d", marginTop: 8 }}>
                ※ 縦軸 = 得点ランキング（上位ほど上）· バブルサイズ = 得点数
              </div>
            </div>
          )}

        </>)}

        <div style={{ fontSize: 9, color: "#2d2d2d", marginTop: 4, lineHeight: 1.8 }}>
          ※ データ：api-sports.io より取得（PL 登録選手・ビルド時生成）
        </div>
      </div>
    </div>
  );
}
