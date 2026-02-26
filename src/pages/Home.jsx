import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import StatsHighlight from "../components/StatsHighlight";
import { fetchRecentFixtures } from "../lib/supabase";

// チームID → JSONスラッグ（fetch-data で生成したファイル名と一致）
const SLUG_MAP = { 40: "liverpool", 42: "arsenal" };

// チームカラー
const TEAM_COLORS = {
  33: "#DA291C", 34: "#00A4E4", 35: "#DA020E", 36: "#CC0000",
  39: "#FDB913", 40: "#C8102E", 41: "#D71920", 42: "#EF0107",
  45: "#274488", 46: "#003090", 47: "#132257", 48: "#7A263A",
  49: "#034694", 50: "#6CABDD", 51: "#0057B8", 52: "#C4122E",
  55: "#E03A3E", 57: "#0044A9", 65: "#DD0000", 66: "#95BFE5",
};

// ── チームタイル ──────────────────────────────────────────────

function TeamTile({ team, data, hasData, teamColor, onClick }) {
  const [hovered, setHovered] = useState(false);
  const recentForm = data?.recentForm ?? [];
  const scored     = data?.scored?.total;
  const conceded   = data?.conceded?.total;

  return (
    <div
      onClick={hasData ? onClick : undefined}
      onMouseEnter={() => hasData && setHovered(true)}
      onMouseLeave={() => hasData && setHovered(false)}
      style={{
        background:    hovered ? "#111d28" : "#0c1117",
        border:        `1px solid ${hovered ? "#00ff85" : "#1e2830"}`,
        borderRadius:  4,
        padding:       "14px 10px 12px",
        cursor:        hasData ? "pointer" : "default",
        opacity:       hasData ? 1 : 0.38,
        transform:     hovered ? "translateY(-3px)" : "translateY(0)",
        transition:    "all 0.15s ease",
        display:       "flex",
        flexDirection: "column",
        alignItems:    "center",
        gap:           7,
        minHeight:     128,
        boxShadow:     hovered ? "0 6px 20px rgba(0,255,133,0.12)" : "none",
        position:      "relative",
      }}
    >
      {/* データありバッジ */}
      {hasData && (
        <div style={{
          position: "absolute", top: 4, right: 4,
          width: 5, height: 5, borderRadius: "50%",
          background: "#00ff85",
        }} />
      )}

      {/* クレスト */}
      <img
        src={team.logo}
        alt={team.shortName}
        width={34}
        height={34}
        style={{ objectFit: "contain", display: "block" }}
        loading="lazy"
      />

      {/* 略称 */}
      <div style={{
        fontSize: 9, fontWeight: 600,
        color: hovered ? "#e0eeff" : "#5a6e82",
        letterSpacing: "0.05em",
        textAlign: "center",
        lineHeight: 1.2,
        fontFamily: "'Barlow', sans-serif",
      }}>
        {team.shortName}
      </div>

      {/* データありチームのみ数値 + フォーム */}
      {hasData ? (
        <>
          {(scored != null || conceded != null) && (
            <div style={{ display: "flex", gap: 6, fontSize: 10, fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>
              {scored   != null && <span style={{ color: "#22c55e" }}>▲{scored}</span>}
              {conceded != null && <span style={{ color: "#c8102e" }}>▼{conceded}</span>}
            </div>
          )}
          {recentForm.length > 0 && (
            <div style={{ display: "flex", gap: 2 }}>
              {recentForm.map((r, i) => {
                const bg = r === "W" ? "#22c55e" : r === "L" ? "#c8102e" : "#4a5568";
                return <span key={i} style={{ width: 10, height: 10, borderRadius: 2, background: bg, display: "inline-block" }} />;
              })}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 7.5, color: "#2a3a4a", textAlign: "center", letterSpacing: "0.06em", marginTop: 2 }}>
          — データ準備中 —
        </div>
      )}
    </div>
  );
}

// ── セクションヘッダ ────────────────────────────────────────

function SectionHeader({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 18,
        letterSpacing: "0.1em",
        color: "#4a6070",
        whiteSpace: "nowrap",
      }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 1, background: "#1e2830" }} />
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────

export default function Home() {
  const [teams,    setTeams]    = useState([]);
  const [teamData,      setTeamData]      = useState({});  // { teamId: JSON }
  const [loading,       setLoading]       = useState(true);
  const [recentMatches, setRecentMatches] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/pl-teams-2024.json`)
      .then(r => r.json())
      .then(async list => {
        setTeams(list);
        const dataTeams = list.filter(t => t.hasData && SLUG_MAP[t.id]);
        const results = await Promise.all(
          dataTeams.map(t =>
            fetch(`${import.meta.env.BASE_URL}data/${SLUG_MAP[t.id]}-2024.json`)
              .then(r => r.ok ? r.json() : null)
              .catch(() => null)
              .then(json => [t.id, json])
          )
        );
        setTeamData(Object.fromEntries(results.filter(([, d]) => d)));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Liverpool(40) + Arsenal(42) の直近3試合ずつ取得
    Promise.all([fetchRecentFixtures(40, 3), fetchRecentFixtures(42, 3)])
      .then(([liv, ars]) => setRecentMatches([...liv, ...ars].sort((a, b) =>
        new Date(b.match_date) - new Date(a.match_date)
      )))
      .catch(() => {});
  }, []);

  return (
    <div style={{
      background: "#080c10",
      minHeight:  "100vh",
      color:      "#fff",
      fontFamily: "'Barlow', sans-serif",
    }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,400;0,500;0,600;1,400&display=swap"
        rel="stylesheet"
      />

      {/* ════════════════════════════════════════
          HERO
      ════════════════════════════════════════ */}
      <section style={{
        padding: "80px 48px 64px",
        maxWidth: 1100,
        margin: "0 auto",
      }}>
        {/* eyebrow */}
        <div style={{
          fontSize: 11,
          color: "#00ff85",
          letterSpacing: "0.2em",
          textTransform: "uppercase",
          marginBottom: 18,
          fontWeight: 500,
        }}>
          Premier League 2024–25 · Data Viz
        </div>

        {/* main title */}
        <div style={{
          fontFamily:    "'Bebas Neue', sans-serif",
          fontSize:      "clamp(60px, 10vw, 112px)",
          lineHeight:    0.88,
          letterSpacing: "0.01em",
          marginBottom:  28,
        }}>
          FOOTBALL<span style={{ color: "#c8102e" }}>-VIZ</span>
        </div>

        {/* subtitle */}
        <div style={{
          fontSize:   16,
          color:      "#6a8098",
          maxWidth:   500,
          lineHeight: 1.75,
        }}>
          プレミアリーグ全チームの得失点パターンをデータで可視化する。<br />
          チームを選んで分析を始めよう。
        </div>
      </section>

      {/* ════════════════════════════════════════
          TEAM GRID
      ════════════════════════════════════════ */}
      <section style={{ padding: "0 48px 72px", maxWidth: 1100, margin: "0 auto" }}>
        <SectionHeader label="Premier League 2024–25 — チームを選択" />

        {/* グリッドラインを背景に持つラッパー */}
        <div style={{
          padding: 10,
          background: "#070b0f",
          backgroundImage: [
            "repeating-linear-gradient(0deg, transparent, transparent 139px, #131e28 139px, #131e28 140px)",
            "repeating-linear-gradient(90deg, transparent, transparent 139px, #131e28 139px, #131e28 140px)",
          ].join(", "),
          borderRadius: 8,
          border: "1px solid #1a2530",
        }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#2a3a4a", fontSize: 12, fontFamily: "'Barlow', sans-serif" }}>
              Loading teams...
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, 1fr)",
              gap: 8,
            }}>
              {teams.map(team => (
                <TeamTile
                  key={team.id}
                  team={team}
                  data={teamData[team.id]}
                  hasData={team.hasData && !!teamData[team.id]}
                  teamColor={TEAM_COLORS[team.id] ?? "#888"}
                  onClick={() => navigate(`/team/${team.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        {/* 凡例 */}
        <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: 10, color: "#2a3a4a", fontFamily: "'Barlow', sans-serif" }}>
          <span><span style={{ color: "#00ff85" }}>●</span> データあり — クリックで分析ページへ</span>
          <span><span style={{ color: "#22c55e" }}>▲</span> 得点 / <span style={{ color: "#c8102e" }}>▼</span> 失点（2024-25）</span>
        </div>
      </section>

      {/* ════════════════════════════════════════
          最新試合
      ════════════════════════════════════════ */}
      {recentMatches.length > 0 && (
        <section style={{ padding: "0 48px 72px", maxWidth: 1100, margin: "0 auto" }}>
          <SectionHeader label="最新試合 — Liverpool / Arsenal" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
            {recentMatches.map(fix => {
              const isLiv    = fix.home_team_id === 40 || fix.away_team_id === 40;
              const teamId   = isLiv ? 40 : 42;
              const color    = isLiv ? "#C8102E" : "#EF0107";
              const isHome   = fix.home_team_id === teamId;
              const scored   = isHome ? fix.goals_home : fix.goals_away;
              const conceded = isHome ? fix.goals_away  : fix.goals_home;
              const opponent = isHome ? fix.away_team_name : fix.home_team_name;
              const result   = scored > conceded ? "W" : scored < conceded ? "L" : "D";
              const rColor   = result === "W" ? "#22c55e" : result === "L" ? "#ef4444" : "#666";
              const dateStr  = new Date(fix.match_date).toLocaleDateString("ja-JP",
                { month: "2-digit", day: "2-digit" });
              return (
                <Link key={fix.id} to={`/match/${fix.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "#0e1318", border: `1px solid #1e2830`,
                    borderLeft: `3px solid ${color}`,
                    borderRadius: 8, padding: "14px 16px",
                    fontFamily: "'Barlow', sans-serif",
                    transition: "background 0.15s, border-color 0.15s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#111d28"; e.currentTarget.style.borderColor = `${color}`; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#0e1318"; e.currentTarget.style.borderColor = "#1e2830"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <span style={{ fontSize: 10, color: "#555" }}>{dateStr}</span>
                      <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 3,
                        background: `${rColor}22`, color: rColor, border: `1px solid ${rColor}44`,
                        fontWeight: 700 }}>{result}</span>
                    </div>
                    <div style={{ fontSize: 12, color: color, fontWeight: 600, marginBottom: 3 }}>
                      {isLiv ? "Liverpool" : "Arsenal"} <span style={{ color: "#555", fontSize: 10 }}>vs</span> {opponent}
                    </div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26,
                      letterSpacing: "0.04em", color: "#fff" }}>
                      {scored}<span style={{ color: "#333" }}>–</span>{conceded}
                    </div>
                    <div style={{ fontSize: 9, color: "#555", marginTop: 4 }}>
                      {isHome ? "HOME" : "AWAY"} · 詳細を見る →
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ════════════════════════════════════════
          注目スタッツ
      ════════════════════════════════════════ */}
      <section style={{ padding: "0 48px 72px", maxWidth: 1100, margin: "0 auto" }}>
        <SectionHeader label="注目スタッツ — 2024-25" />
        <StatsHighlight />
      </section>

      {/* ════════════════════════════════════════
          このサイトについて
      ════════════════════════════════════════ */}
      <section style={{ padding: "0 48px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <SectionHeader label="このサイトについて" />

        <div style={{
          background:   "#0e1318",
          border:       "1px solid #1e2830",
          borderRadius: 8,
          padding:      "28px 32px",
        }}>
          <div style={{
            display:             "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap:                 32,
          }}>
            {[
              { label: "データソース", value: "api-sports.io v3" },
              { label: "更新頻度",     value: "毎週月曜 自動更新" },
              { label: "対象リーグ",   value: "Premier League 2024–25" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{
                  fontSize:      10,
                  color:         "#2a3d50",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  marginBottom:  8,
                  fontWeight:    600,
                }}>
                  {label}
                </div>
                <div style={{ fontSize: 14, color: "#6a8098" }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}
