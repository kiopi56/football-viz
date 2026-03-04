/**
 * src/components/FormationChart.jsx
 *
 * 縦型ピッチ SVG にフォーメーションを描画。
 * - ホーム（下側）/ アウェイ（上側）
 * - 選手名クリック → /player/:id（id があれば）
 * - formation フィールドがない場合は pos 分布から推定
 */

import { Link } from "react-router-dom";

// ── フォーメーション推定 ──────────────────────────────────────

function inferFormation(starters) {
  const d = starters.filter(p => p.pos === "D").length;
  const m = starters.filter(p => p.pos === "M").length;
  const f = starters.filter(p => p.pos === "F").length;
  return `${d}-${m}-${f}`;
}

// ── ポジション行を formation 文字列でグループ化 ──────────────

/**
 * スターター11名を { G:[], rows:[[...],[...],...] } に分類
 * formation = "4-3-3" → rows = [[4人],[3人],[3人]] (下→前)
 */
function groupByFormation(starters, formation) {
  const gk = starters.filter(p => p.pos === "G");
  const outfield = starters.filter(p => p.pos !== "G");

  // formation 文字列から各行の人数を取得
  const rowCounts = (formation ?? "")
    .split("-")
    .map(Number)
    .filter(n => !isNaN(n) && n > 0);

  if (rowCounts.length === 0 || rowCounts.reduce((a, b) => a + b, 0) !== outfield.length) {
    // フォールバック: pos でグループ化
    const D = outfield.filter(p => p.pos === "D");
    const M = outfield.filter(p => p.pos === "M");
    const F = outfield.filter(p => p.pos === "F");
    return { gk, rows: [D, M, F].filter(r => r.length > 0) };
  }

  const rows = [];
  let idx = 0;
  for (const count of rowCounts) {
    rows.push(outfield.slice(idx, idx + count));
    idx += count;
  }
  return { gk, rows };
}

// ── SVG 定数 ─────────────────────────────────────────────────

const SVG_W = 340;
const SVG_H = 500;
const PITCH_PAD_X = 16;
const PITCH_PAD_Y = 14;
const PITCH_W = SVG_W - PITCH_PAD_X * 2;
const PITCH_H = SVG_H - PITCH_PAD_Y * 2;

// ピッチ上の y 座標（0=上端, 1=下端）
function pitchY(ratio) {
  return PITCH_PAD_Y + ratio * PITCH_H;
}
function pitchX(col, total) {
  if (total === 1) return SVG_W / 2;
  const usable = PITCH_W * 0.85;
  const start  = (SVG_W - usable) / 2;
  return start + (col / (total - 1)) * usable;
}

// チームの各行を SVG 座標に配置
// isHome=true → 下側（GK が一番下）
// isHome=false → 上側（GK が一番上）
function buildPositions(starters, formation, isHome) {
  const { gk, rows } = groupByFormation(starters, formation);
  const totalRows = rows.length; // field rows (not counting GK)

  // ホーム: GK は下、フォワードは上
  // アウェイ: GK は上、フォワードは下
  const positions = [];

  const half = isHome
    ? { gkRatio: 0.92, fwRatio: 0.55 }  // 下半分
    : { gkRatio: 0.08, fwRatio: 0.45 }; // 上半分

  // GK
  gk.forEach((p, i) => {
    positions.push({ player: p, x: pitchX(i, gk.length), y: pitchY(half.gkRatio) });
  });

  // フィールドプレイヤーの行を配置
  for (let ri = 0; ri < totalRows; ri++) {
    const row = rows[ri];
    // GK から前線へ向かって均等に並べる
    // isHome: gkRatio(下) → fwRatio(中央付近)
    // rows[0]=DF(GKに近い), rows[last]=FW(中央寄り)
    const rowRatio = isHome
      ? half.gkRatio - (ri + 1) * (half.gkRatio - half.fwRatio) / (totalRows)
      : half.gkRatio + (ri + 1) * (half.fwRatio - half.gkRatio) / (totalRows);

    row.forEach((p, ci) => {
      positions.push({ player: p, x: pitchX(ci, row.length), y: pitchY(rowRatio) });
    });
  }

  return positions;
}

// ── 選手ノード ────────────────────────────────────────────────

function PlayerNode({ player, x, y, color }) {
  const shortName = (() => {
    const parts = player.name.split(/[\s.]+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 8);
    return parts[parts.length - 1].slice(0, 8);
  })();

  const node = (
    <>
      <circle cx={x} cy={y} r={12} fill={color} fillOpacity={0.85} stroke="#fff" strokeWidth={1} />
      <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={7} fontWeight={700} fill="#fff" fontFamily="'Space Mono', monospace">
        {player.number ?? ""}
      </text>
      <text x={x} y={y + 18} textAnchor="middle"
        fontSize={8} fill="#ddd" fontFamily="'Space Mono', monospace">
        {shortName}
      </text>
    </>
  );

  if (player.id) {
    return (
      <Link to={`/player/${player.id}`} style={{ textDecoration: "none" }}>
        <g style={{ cursor: "pointer" }}>
          <circle cx={x} cy={y} r={13} fill="transparent" />
          {node}
        </g>
      </Link>
    );
  }

  return <g>{node}</g>;
}

// ── ピッチ背景 ────────────────────────────────────────────────

function PitchBackground() {
  const px = PITCH_PAD_X;
  const py = PITCH_PAD_Y;
  const pw = PITCH_W;
  const ph = PITCH_H;

  const lineStyle = { stroke: "rgba(255,255,255,0.18)", strokeWidth: 0.8, fill: "none" };
  const circleStyle = { ...lineStyle };

  return (
    <g>
      {/* 背景 */}
      <rect x={px} y={py} width={pw} height={ph}
        rx={4} fill="#0d4a1a" />

      {/* アウトライン */}
      <rect x={px} y={py} width={pw} height={ph}
        rx={4} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth={1} />

      {/* センターライン */}
      <line x1={px} y1={py + ph / 2} x2={px + pw} y2={py + ph / 2} {...lineStyle} />

      {/* センターサークル */}
      <circle cx={SVG_W / 2} cy={py + ph / 2} r={30} {...circleStyle} />
      <circle cx={SVG_W / 2} cy={py + ph / 2} r={1.5} fill="rgba(255,255,255,0.3)" />

      {/* ホームペナルティエリア（下） */}
      <rect x={px + pw * 0.18} y={py + ph * 0.78} width={pw * 0.64} height={ph * 0.18}
        {...lineStyle} />
      {/* ホームゴールエリア（下） */}
      <rect x={px + pw * 0.32} y={py + ph * 0.91} width={pw * 0.36} height={ph * 0.07}
        {...lineStyle} />

      {/* アウェイペナルティエリア（上） */}
      <rect x={px + pw * 0.18} y={py + ph * 0.04} width={pw * 0.64} height={ph * 0.18}
        {...lineStyle} />
      {/* アウェイゴールエリア（上） */}
      <rect x={px + pw * 0.32} y={py + ph * 0.02} width={pw * 0.36} height={ph * 0.07}
        {...lineStyle} />
    </g>
  );
}

// ── メインコンポーネント ──────────────────────────────────────

/**
 * @param {Array}  lineupTeams  - [{ teamId, teamName, formation, players[] }]
 * @param {number} homeTeamId   - ホームチームの ID
 */
export default function FormationChart({ lineupTeams, homeTeamId }) {
  if (!lineupTeams || lineupTeams.length === 0) return null;

  const homeEntry = lineupTeams.find(e => e.teamId === homeTeamId) ?? lineupTeams[0];
  const awayEntry = lineupTeams.find(e => e.teamId !== homeTeamId) ?? lineupTeams[1];

  function renderTeam(entry, isHome) {
    if (!entry) return null;
    const starters = (entry.players ?? []).filter(p => p.type === "start");
    const formation = entry.formation ?? inferFormation(starters);
    const color = isHome ? "#C8102E" : "#1d3a6e";
    return buildPositions(starters, formation, isHome).map((pos, i) => (
      <PlayerNode key={i} player={pos.player} x={pos.x} y={pos.y} color={color} />
    ));
  }

  const homeFormation = homeEntry?.formation ?? inferFormation((homeEntry?.players ?? []).filter(p => p.type === "start"));
  const awayFormation = awayEntry?.formation ?? inferFormation((awayEntry?.players ?? []).filter(p => p.type === "start"));

  return (
    <div style={{
      background: "#0e1318",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12,
      padding: "16px 18px",
      marginBottom: 16,
    }}>
      {/* ヘッダー */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: 10,
      }}>
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>
          フォーメーション
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 10 }}>
          {awayEntry && (
            <span style={{ color: "#5a82c0" }}>
              {awayEntry.teamName} <span style={{ color: "#888" }}>{awayFormation}</span>
            </span>
          )}
          {homeEntry && (
            <span style={{ color: "#C8102E" }}>
              {homeEntry.teamName} <span style={{ color: "#888" }}>{homeFormation}</span>
            </span>
          )}
        </div>
      </div>

      {/* SVGピッチ */}
      <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ width: "100%", maxWidth: SVG_W, height: "auto", display: "block", margin: "0 auto" }}>
        <PitchBackground />
        {/* アウェイ（上） */}
        {renderTeam(awayEntry, false)}
        {/* ホーム（下） */}
        {renderTeam(homeEntry, true)}
        {/* チーム名ラベル */}
        {awayEntry && (
          <text x={SVG_W / 2} y={PITCH_PAD_Y + 6}
            textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)"
            fontFamily="'Space Mono', monospace">
            {awayEntry.teamName.toUpperCase()} ({awayFormation})
          </text>
        )}
        {homeEntry && (
          <text x={SVG_W / 2} y={SVG_H - 4}
            textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.4)"
            fontFamily="'Space Mono', monospace">
            {homeEntry.teamName.toUpperCase()} ({homeFormation})
          </text>
        )}
      </svg>
      <div style={{ fontSize: 8, color: "#333", textAlign: "center", marginTop: 4 }}>
        ※ 選手名クリックで選手詳細へ（ID取得済みの場合）
      </div>
    </div>
  );
}
