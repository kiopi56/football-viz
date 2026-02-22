import { useNavigate } from "react-router-dom";

const teams = [
  {
    id: "liverpool",
    name: "LIVERPOOL FC",
    color: "#C8102E",
    path: "/liverpool",
    league: "Premier League",
    season: "2025–26",
    stat: "総失点 11 · CS 3",
  },
  {
    id: "arsenal",
    name: "ARSENAL FC",
    color: "#EF0107",
    path: "/arsenal",
    league: "Premier League",
    season: "2025–26",
    stat: "総失点 10 · CS 4",
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{
      padding: "64px 48px",
      background: "#03060F",
      minHeight: "100vh",
      color: "#fff",
      fontFamily: "monospace",
      maxWidth: "900px",
      margin: "0 auto",
    }}>

      {/* ── タイトル ── */}
      <div style={{ marginBottom: "48px" }}>
        <div style={{ fontSize: "11px", color: "#555", letterSpacing: "0.2em", marginBottom: "12px" }}>
          FOOTBALL ANALYTICS
        </div>
        <div style={{ fontSize: "32px", fontWeight: "bold", letterSpacing: "0.04em" }}>
          失点分析ダッシュボード
        </div>
        <div style={{ fontSize: "13px", color: "#555", marginTop: "8px" }}>
          Premier League 2025–26 · 時間帯別 失点データ
        </div>
      </div>

      {/* ── チームカード ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "20px",
      }}>
        {teams.map((team) => (
          <button
            key={team.id}
            onClick={() => navigate(team.path)}
            style={{
              background: "rgba(255,255,255,0.03)",
              border: `1px solid rgba(255,255,255,0.08)`,
              borderTop: `3px solid ${team.color}`,
              borderRadius: "12px",
              padding: "32px 28px",
              cursor: "pointer",
              textAlign: "left",
              color: "#fff",
              fontFamily: "monospace",
              transition: "background 0.2s, transform 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.07)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.03)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            {/* カラーライン + チーム名 */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
              <div style={{
                width: "4px",
                height: "40px",
                background: team.color,
                borderRadius: "2px",
                flexShrink: 0,
              }} />
              <div style={{ fontSize: "22px", fontWeight: "bold", letterSpacing: "0.05em" }}>
                {team.name}
              </div>
            </div>

            {/* メタ情報 */}
            <div style={{ fontSize: "11px", color: "#555", marginBottom: "6px" }}>
              {team.league} · {team.season}
            </div>
            <div style={{ fontSize: "12px", color: "#888" }}>
              {team.stat}
            </div>

            {/* CTAライン */}
            <div style={{
              marginTop: "24px",
              fontSize: "11px",
              color: team.color,
              letterSpacing: "0.1em",
            }}>
              分析を見る →
            </div>
          </button>
        ))}
      </div>

    </div>
  );
}
