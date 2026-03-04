/**
 * src/components/SquadView.jsx
 *
 * TeamDetail の「スカッド」タブ内で使用。
 * public/data/{slug}-squad-{season}.json を fetch し、
 * ポジション別に選手カードを表示する。
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const POS_GROUPS = [
  { pos: "G",  label: "GK",  color: "#f59e0b" },
  { pos: "D",  label: "DF",  color: "#3b82f6" },
  { pos: "M",  label: "MF",  color: "#22c55e" },
  { pos: "F",  label: "FW",  color: "#ef4444" },
];

export default function SquadView({ teamSlug, season, teamColor }) {
  const [squad, setSquad]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const base = import.meta.env.BASE_URL ?? "/";
    fetch(`${base}data/${teamSlug}-squad-${season}.json`)
      .then(res => { if (!res.ok) throw new Error("not found"); return res.json(); })
      .then(data => { setSquad(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [teamSlug, season]);

  if (loading) {
    return (
      <div style={{ padding: "40px 0", textAlign: "center", fontSize: 12, color: "#555" }}>
        Loading...
      </div>
    );
  }

  if (error || !squad) {
    return (
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, padding: "40px 20px", textAlign: "center",
        color: "#444", fontSize: 12,
      }}>
        スカッドデータが見つかりません
        <div style={{ fontSize: 10, color: "#333", marginTop: 8 }}>
          node scripts/fetchData.mjs --season={season} --team=all --with-lineups --force-lineups を実行してください
        </div>
      </div>
    );
  }

  const players = squad.players ?? [];
  const totalApps = players.reduce((s, p) => s + p.appearances, 0);

  return (
    <div>
      {/* ヘッダー情報 */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
        fontSize: 10, color: "#555",
      }}>
        <span>{squad.teamName} — {season}-{String(season + 1).slice(-2)}</span>
        <span style={{ color: "#333" }}>|</span>
        <span>{players.length} 選手</span>
        <span style={{ color: "#333" }}>|</span>
        <span>{totalApps} 登録延べ件数</span>
      </div>

      {/* ポジション別グループ */}
      {POS_GROUPS.map(group => {
        const groupPlayers = players
          .filter(p => p.pos === group.pos)
          .sort((a, b) => b.appearances - a.appearances);

        if (groupPlayers.length === 0) return null;

        return (
          <div key={group.pos} style={{ marginBottom: 24 }}>
            {/* グループヘッダー */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
            }}>
              <span style={{
                fontSize: 9, fontWeight: 700, padding: "2px 8px",
                borderRadius: 3, background: `${group.color}22`,
                color: group.color, border: `1px solid ${group.color}44`,
                letterSpacing: "0.1em",
              }}>{group.label}</span>
              <span style={{ fontSize: 9, color: "#444" }}>{groupPlayers.length}名</span>
            </div>

            {/* 選手カード一覧 */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
              gap: 6,
            }}>
              {groupPlayers.map(player => (
                <PlayerCard
                  key={player.id ?? player.name}
                  player={player}
                  posColor={group.color}
                  teamColor={teamColor}
                />
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ fontSize: 9, color: "#2d2d2d", marginTop: 8 }}>
        ※ appearances = 試合エントリー数（先発＋途中出場）
      </div>
    </div>
  );
}

function PlayerCard({ player, posColor, teamColor }) {
  const card = (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      padding: "9px 12px",
      background: "rgba(255,255,255,0.02)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderLeft: `3px solid ${posColor}44`,
      borderRadius: 7,
      transition: "background 0.15s, border-color 0.15s",
      cursor: player.id ? "pointer" : "default",
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = "rgba(255,255,255,0.05)";
      if (player.id) e.currentTarget.style.borderColor = `${teamColor}55`;
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = "rgba(255,255,255,0.02)";
      e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
      e.currentTarget.style.borderLeftColor = `${posColor}44`;
    }}
    >
      {/* 背番号 */}
      <span style={{
        fontSize: 10, fontWeight: 700, minWidth: 22, textAlign: "center",
        color: posColor, flexShrink: 0,
      }}>
        {player.number ?? "—"}
      </span>

      {/* 名前 */}
      <span style={{ flex: 1, fontSize: 11, color: "#ccc", overflow: "hidden",
        textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {player.name}
      </span>

      {/* 出場数 */}
      <span style={{ fontSize: 10, color: "#555", flexShrink: 0 }}>
        {player.appearances}
      </span>
    </div>
  );

  if (player.id) {
    return (
      <Link to={`/player/${player.id}`} style={{ textDecoration: "none" }}>
        {card}
      </Link>
    );
  }

  return card;
}
