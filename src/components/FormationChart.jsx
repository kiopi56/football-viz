/**
 * src/components/FormationChart.jsx
 *
 * 縦型ピッチ SVG にフォーメーションを描画。
 * - ホーム（下側）/ アウェイ（上側）
 * - 選手バッジホバー → 全名ハイライト表示
 * - クリック → /player/:id へ遷移（useNavigate で確実に動作）
 * - formation フィールドがない場合は pos 分布から推定
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

// ── フォーメーション推定 ──────────────────────────────────────

function inferFormation(starters) {
  const d = starters.filter(p => p.pos === "D").length;
  const m = starters.filter(p => p.pos === "M").length;
  const f = starters.filter(p => p.pos === "F").length;
  return `${d}-${m}-${f}`;
}

// ── ポジション行を formation 文字列でグループ化 ──────────────

function groupByFormation(starters, formation) {
  const gk = starters.filter(p => p.pos === "G");
  const outfield = starters.filter(p => p.pos !== "G");

  const rowCounts = (formation ?? "")
    .split("-")
    .map(Number)
    .filter(n => !isNaN(n) && n > 0);

  if (rowCounts.length === 0 || rowCounts.reduce((a, b) => a + b, 0) !== outfield.length) {
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

function pitchY(ratio) {
  return PITCH_PAD_Y + ratio * PITCH_H;
}
function pitchX(col, total) {
  if (total === 1) return SVG_W / 2;
  const usable = PITCH_W * 0.85;
  const start  = (SVG_W - usable) / 2;
  return start + (col / (total - 1)) * usable;
}

function buildPositions(starters, formation, isHome) {
  const { gk, rows } = groupByFormation(starters, formation);
  const totalRows = rows.length;
  const positions = [];

  const half = isHome
    ? { gkRatio: 0.92, fwRatio: 0.55 }
    : { gkRatio: 0.08, fwRatio: 0.45 };

  gk.forEach((p, i) => {
    positions.push({ player: p, x: pitchX(i, gk.length), y: pitchY(half.gkRatio) });
  });

  for (let ri = 0; ri < totalRows; ri++) {
    const row = rows[ri];
    const rowRatio = isHome
      ? half.gkRatio - (ri + 1) * (half.gkRatio - half.fwRatio) / totalRows
      : half.gkRatio + (ri + 1) * (half.fwRatio - half.gkRatio) / totalRows;

    row.forEach((p, ci) => {
      positions.push({ player: p, x: pitchX(ci, row.length), y: pitchY(rowRatio) });
    });
  }

  return positions;
}

// ── 選手ノード ────────────────────────────────────────────────

function PlayerNode({ player, x, y, color, isHovered, onHover, onLeave, onClick }) {
  // SVG 内の名前テキスト: ホバー時はフルネーム、通常は苗字のみ
  const shortName = (() => {
    const parts = player.name.split(/[\s.]+/).filter(Boolean);
    if (parts.length === 1) return parts[0].slice(0, 9);
    return parts[parts.length - 1].slice(0, 9);
  })();

  const canNavigate = !!player.id;
  const circleR = isHovered ? 14 : 12;
  const circleOpacity = isHovered ? 1 : 0.85;
  const nameColor = isHovered ? "#fff" : "#ddd";

  return (
    <g
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={canNavigate ? onClick : undefined}
      style={{ cursor: canNavigate ? "pointer" : "default" }}
    >
      {/* クリック判定を広げる透明な大きい円 */}
      <circle cx={x} cy={y} r={20} fill="transparent" />

      {/* ホバー時の光輪 */}
      {isHovered && (
        <circle cx={x} cy={y} r={17}
          fill="none" stroke="#fff" strokeWidth={1} strokeOpacity={0.5} />
      )}

      {/* メインバッジ */}
      <circle
        cx={x} cy={y} r={circleR}
        fill={color} fillOpacity={circleOpacity}
        stroke={isHovered ? "#fff" : "rgba(255,255,255,0.6)"}
        strokeWidth={isHovered ? 1.5 : 1}
        style={{ transition: "r 0.1s, fill-opacity 0.1s" }}
      />

      {/* 背番号 */}
      <text x={x} y={y + 1} textAnchor="middle" dominantBaseline="middle"
        fontSize={7} fontWeight={700} fill="#fff"
        fontFamily="'Space Mono', monospace" style={{ pointerEvents: "none" }}>
        {player.number ?? ""}
      </text>

      {/* 選手名（ホバー時はフルネーム） */}
      {isHovered ? (
        <>
          {/* ホバー時の背景バー */}
          <rect
            x={x - 42} y={y + 18}
            width={84} height={13}
            rx={3} fill="rgba(0,0,0,0.75)"
            style={{ pointerEvents: "none" }}
          />
          <text x={x} y={y + 27} textAnchor="middle"
            fontSize={8} fontWeight={700} fill="#fff"
            fontFamily="'Space Mono', monospace" style={{ pointerEvents: "none" }}>
            {player.name.length > 14 ? player.name.slice(0, 14) + "…" : player.name}
          </text>
        </>
      ) : (
        <text x={x} y={y + 22} textAnchor="middle"
          fontSize={8} fill={nameColor}
          fontFamily="'Space Mono', monospace" style={{ pointerEvents: "none" }}>
          {shortName}
        </text>
      )}
    </g>
  );
}

// ── ピッチ背景 ────────────────────────────────────────────────

function PitchBackground() {
  const px = PITCH_PAD_X;
  const py = PITCH_PAD_Y;
  const pw = PITCH_W;
  const ph = PITCH_H;
  const lineStyle = { stroke: "rgba(255,255,255,0.18)", strokeWidth: 0.8, fill: "none" };

  return (
    <g>
      <rect x={px} y={py} width={pw} height={ph} rx={4} fill="#0d4a1a" />
      <rect x={px} y={py} width={pw} height={ph} rx={4} fill="none"
        stroke="rgba(255,255,255,0.25)" strokeWidth={1} />
      <line x1={px} y1={py + ph / 2} x2={px + pw} y2={py + ph / 2} {...lineStyle} />
      <circle cx={SVG_W / 2} cy={py + ph / 2} r={30} {...lineStyle} />
      <circle cx={SVG_W / 2} cy={py + ph / 2} r={1.5} fill="rgba(255,255,255,0.3)" />
      {/* ホームペナルティエリア（下） */}
      <rect x={px + pw * 0.18} y={py + ph * 0.78} width={pw * 0.64} height={ph * 0.18} {...lineStyle} />
      <rect x={px + pw * 0.32} y={py + ph * 0.91} width={pw * 0.36} height={ph * 0.07} {...lineStyle} />
      {/* アウェイペナルティエリア（上） */}
      <rect x={px + pw * 0.18} y={py + ph * 0.04} width={pw * 0.64} height={ph * 0.18} {...lineStyle} />
      <rect x={px + pw * 0.32} y={py + ph * 0.02} width={pw * 0.36} height={ph * 0.07} {...lineStyle} />
    </g>
  );
}

// ── メインコンポーネント ──────────────────────────────────────

/**
 * @param {Array}  lineupTeams  - [{ teamId, teamName, formation, players[] }]
 * @param {number} homeTeamId   - ホームチームの ID
 */
export default function FormationChart({ lineupTeams, homeTeamId }) {
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState(null); // player.id or "name-{name}" as key

  if (!lineupTeams || lineupTeams.length === 0) return null;

  const homeEntry = lineupTeams.find(e => e.teamId === homeTeamId) ?? lineupTeams[0];
  const awayEntry = lineupTeams.find(e => e.teamId !== homeTeamId) ?? lineupTeams[1];

  function renderTeam(entry, isHome) {
    if (!entry) return null;
    const starters = (entry.players ?? []).filter(p => p.type === "start");
    const formation = entry.formation ?? inferFormation(starters);
    const color = isHome ? "#C8102E" : "#1d3a6e";

    return buildPositions(starters, formation, isHome).map((pos, i) => {
      const p = pos.player;
      const nodeKey = p.id ?? `name-${p.name}`;
      return (
        <PlayerNode
          key={i}
          player={p}
          x={pos.x}
          y={pos.y}
          color={color}
          isHovered={hoveredId === nodeKey}
          onHover={() => setHoveredId(nodeKey)}
          onLeave={() => setHoveredId(null)}
          onClick={() => navigate(`/player/${p.id}`)}
        />
      );
    });
  }

  const homeFormation = homeEntry?.formation
    ?? inferFormation((homeEntry?.players ?? []).filter(p => p.type === "start"));
  const awayFormation = awayEntry?.formation
    ?? inferFormation((awayEntry?.players ?? []).filter(p => p.type === "start"));

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

      {/* SVG ピッチ */}
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        style={{ width: "100%", maxWidth: SVG_W, height: "auto", display: "block", margin: "0 auto" }}
        onMouseLeave={() => setHoveredId(null)}
      >
        <PitchBackground />
        {renderTeam(awayEntry, false)}
        {renderTeam(homeEntry, true)}
        {/* チーム名ラベル */}
        {awayEntry && (
          <text x={SVG_W / 2} y={PITCH_PAD_Y + 6}
            textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.35)"
            fontFamily="'Space Mono', monospace" style={{ pointerEvents: "none" }}>
            {awayEntry.teamName.toUpperCase()} ({awayFormation})
          </text>
        )}
        {homeEntry && (
          <text x={SVG_W / 2} y={SVG_H - 4}
            textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.35)"
            fontFamily="'Space Mono', monospace" style={{ pointerEvents: "none" }}>
            {homeEntry.teamName.toUpperCase()} ({homeFormation})
          </text>
        )}
      </svg>

      <div style={{ fontSize: 8, color: "#444", textAlign: "center", marginTop: 6 }}>
        選手バッジをクリックで選手詳細へ
      </div>
    </div>
  );
}
