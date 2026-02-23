import { useState, useEffect } from "react";

/**
 * プレミアリーグのチームをグリッド表示し、最大2チームを選択させるコンポーネント
 * チーム一覧は public/data/pl-teams-2024.json から取得（APIを叩かない）
 *
 * @param {number[]}   selectedIds     - 選択中のチームID配列（最大2件）
 * @param {Function}   onChange        - 選択変更時のコールバック (ids: number[]) => void
 * @param {Function}   [onTeamsLoaded] - チーム一覧取得完了時のコールバック (teams: Team[]) => void
 */
export default function TeamSelector({ selectedIds, onChange, onTeamsLoaded }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/pl-teams-2024.json`)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        setTeams(data);
        onTeamsLoaded?.(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []); // マウント時1回だけ取得

  function handleClick(teamId) {
    if (selectedIds.includes(teamId)) {
      // 選択済み → 解除
      onChange(selectedIds.filter(id => id !== teamId));
    } else if (selectedIds.length < 2) {
      // 未選択かつ枠あり → 追加
      onChange([...selectedIds, teamId]);
    }
    // 2チーム選択済みかつ未選択チームをクリック → 無視
  }

  if (loading) {
    return (
      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 12,
        color: "#555",
        padding: "12px 0",
      }}>
        Loading teams...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        fontFamily: "'Space Mono', monospace",
        fontSize: 12,
        color: "#ef4444",
        padding: "12px 0",
      }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div>
      {/* ラベル */}
      <div style={{
        fontSize: 10,
        color: "#555",
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        marginBottom: 10,
        fontFamily: "'Space Mono', monospace",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}>
        チームを選択（最大2チーム）
        {selectedIds.length >= 2 && (
          <span style={{ color: "#f97316" }}>選択済み：最大</span>
        )}
      </div>

      {/* チームグリッド */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))",
        gap: 6,
      }}>
        {teams.map(team => {
          const slotIndex = selectedIds.indexOf(team.id);
          const isSelected = slotIndex !== -1;
          // データなしチームは選択不可、2チーム埋まっていても選択不可
          const isDisabled = !team.hasData || (!isSelected && selectedIds.length >= 2);

          return (
            <button
              key={team.id}
              onClick={() => handleClick(team.id)}
              disabled={isDisabled}
              style={{
                position: "relative",
                background: isSelected
                  ? "rgba(255,255,255,0.1)"
                  : "rgba(255,255,255,0.03)",
                border: isSelected
                  ? "2px solid rgba(255,255,255,0.65)"
                  : "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                padding: "10px 6px 8px",
                cursor: isDisabled ? "not-allowed" : "pointer",
                // データなしはより薄く表示
                opacity: !team.hasData ? 0.2 : isDisabled ? 0.25 : 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                transition: "background 0.15s, border-color 0.15s, opacity 0.15s",
              }}
            >
              {/* スロット番号バッジ */}
              {isSelected && (
                <div style={{
                  position: "absolute",
                  top: 3,
                  right: 3,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: "#fff",
                  color: "#000",
                  fontSize: 9,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 1,
                }}>
                  {slotIndex + 1}
                </div>
              )}

              {/* クレスト画像 */}
              <img
                src={team.logo}
                alt={team.shortName}
                width={28}
                height={28}
                style={{ objectFit: "contain", display: "block" }}
              />

              {/* チーム略称 */}
              <span style={{
                fontSize: 9,
                color: isSelected ? "#fff" : "#777",
                fontFamily: "'Space Mono', monospace",
                lineHeight: 1.2,
                textAlign: "center",
                letterSpacing: "0.02em",
              }}>
                {team.shortName}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
