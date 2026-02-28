import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import StatsHighlight from "../components/StatsHighlight";
import { fetchRecentFixturesWithFallback, fetchLatestPressComments } from "../lib/supabase";

// チームID → JSONスラッグ
const SLUG_MAP = { 40: "liverpool", 42: "arsenal" };

// チームカラー
const TEAM_COLORS = {
  33: "#DA291C", 34: "#00A4E4", 35: "#DA020E", 36: "#CC0000",
  39: "#FDB913", 40: "#C8102E", 41: "#D71920", 42: "#EF0107",
  45: "#274488", 46: "#003090", 47: "#132257", 48: "#7A263A",
  49: "#034694", 50: "#6CABDD", 51: "#0057B8", 52: "#C4122E",
  55: "#E03A3E", 57: "#0044A9", 65: "#DD0000", 66: "#95BFE5",
};

const ARTICLE_TABS = [
  { key: "all",       label: "すべて" },
  { key: "manager",   label: "監督コメント" },
  { key: "liverpool", label: "Liverpool" },
  { key: "arsenal",   label: "Arsenal" },
];

// ── ユーティリティ ─────────────────────────────────────────────

function getDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return ""; }
}

function relativeTime(isoStr) {
  if (!isoStr) return "";
  const diff  = Date.now() - new Date(isoStr).getTime();
  const mins  = Math.floor(diff / 60000);
  if (mins < 1)   return "たった今";
  if (mins < 60)  return `${mins}分前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}時間前`;
  return `${Math.floor(hours / 24)}日前`;
}

// ── サブコンポーネント ─────────────────────────────────────────

/** 全幅セクション用ヘッダー（ライン付き） */
function SectionHeader({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18,
        letterSpacing: "0.1em", color: "#4a6070", whiteSpace: "nowrap" }}>
        {label}
      </div>
      <div style={{ flex: 1, height: 1, background: "#1e2830" }} />
    </div>
  );
}

/** サイドバー内カード用ラベル */
function SideLabel({ label }) {
  return (
    <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em",
      textTransform: "uppercase", marginBottom: 14 }}>
      {label}
    </div>
  );
}

function TeamTile({ team, data, hasData, onClick }) {
  const [hovered, setHovered] = useState(false);
  const recentForm = data?.recentForm ?? [];
  const scored     = data?.scored?.total;
  const conceded   = data?.conceded?.total;

  return (
    <div onClick={hasData ? onClick : undefined}
      onMouseEnter={() => hasData && setHovered(true)}
      onMouseLeave={() => hasData && setHovered(false)}
      style={{
        background:    hovered ? "#111d28" : "#0c1117",
        border:        `1px solid ${hovered ? "#00ff85" : "#1e2830"}`,
        borderRadius:  4, padding: "14px 10px 12px",
        cursor:        hasData ? "pointer" : "default",
        opacity:       hasData ? 1 : 0.38,
        transform:     hovered ? "translateY(-3px)" : "translateY(0)",
        transition:    "all 0.15s ease",
        display:       "flex", flexDirection: "column", alignItems: "center",
        gap:           7, minHeight: 128,
        boxShadow:     hovered ? "0 6px 20px rgba(0,255,133,0.12)" : "none",
        position:      "relative",
      }}
    >
      {hasData && (
        <div style={{ position: "absolute", top: 4, right: 4,
          width: 5, height: 5, borderRadius: "50%", background: "#00ff85" }} />
      )}
      <img src={team.logo} alt={team.shortName} width={34} height={34}
        style={{ objectFit: "contain", display: "block" }} loading="lazy" />
      <div style={{ fontSize: 9, fontWeight: 600,
        color: hovered ? "#e0eeff" : "#5a6e82",
        letterSpacing: "0.05em", textAlign: "center", lineHeight: 1.2,
        fontFamily: "'Barlow', sans-serif" }}>
        {team.shortName}
      </div>
      {hasData ? (
        <>
          {(scored != null || conceded != null) && (
            <div style={{ display: "flex", gap: 6, fontSize: 10,
              fontFamily: "'Barlow', sans-serif", fontWeight: 600 }}>
              {scored   != null && <span style={{ color: "#22c55e" }}>▲{scored}</span>}
              {conceded != null && <span style={{ color: "#c8102e" }}>▼{conceded}</span>}
            </div>
          )}
          {recentForm.length > 0 && (
            <div style={{ display: "flex", gap: 2 }}>
              {recentForm.map((r, i) => (
                <span key={i} style={{
                  width: 10, height: 10, borderRadius: 2, display: "inline-block",
                  background: r === "W" ? "#22c55e" : r === "L" ? "#c8102e" : "#4a5568",
                }} />
              ))}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 7.5, color: "#2a3a4a", textAlign: "center",
          letterSpacing: "0.06em", marginTop: 2 }}>
          — データ準備中 —
        </div>
      )}
    </div>
  );
}

function ArticleCard({ article }) {
  const [hovered, setHovered] = useState(false);
  const color   = article.team_id === 40 ? "#C8102E" : "#EF0107";
  const domain  = getDomain(article.article_url);
  const title   = article.article_title || article.speaker || "記事";
  const preview = (article.comment_text ?? "").slice(0, 120);
  const ago     = relativeTime(article.published_at);

  return (
    <a href={article.article_url} target="_blank" rel="noreferrer"
      style={{ textDecoration: "none", display: "block" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        background:   hovered ? "#111d28" : "#0e1318",
        border:       "1px solid rgba(255,255,255,0.06)",
        borderLeft:   `3px solid ${color}`,
        borderRadius: 8, padding: "14px 16px",
        transition:   "background 0.15s",
        height: "100%", boxSizing: "border-box",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: 9, color: "#444",
            fontFamily: "'Space Mono', monospace" }}>{domain}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 8, color: "#333" }}>{ago}</span>
            <span style={{ fontSize: 10, color: "#444" }}>↗</span>
          </div>
        </div>
        <div style={{ fontSize: 12, color: hovered ? "#fff" : "#ccc", fontWeight: 600,
          fontFamily: "'Barlow', sans-serif", lineHeight: 1.4, marginBottom: 8 }}>
          {title.length > 60 ? title.slice(0, 60) + "…" : title}
        </div>
        {preview && (
          <div style={{ fontSize: 10, color: "#555", lineHeight: 1.6,
            fontFamily: "'Barlow', sans-serif" }}>
            {preview}{preview.length >= 120 ? "…" : ""}
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 8, color, border: `1px solid ${color}44`,
            padding: "1px 6px", borderRadius: 3 }}>
            {article.team_id === 40 ? "Liverpool" : "Arsenal"}
          </span>
        </div>
      </div>
    </a>
  );
}

function TrendingArticles({ articles }) {
  return (
    <div style={{ background: "#0e1318", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "18px 16px" }}>
      <SideLabel label="トレンド記事" />
      {articles.length === 0 ? (
        <div style={{ fontSize: 10, color: "#333" }}>記事準備中</div>
      ) : (
        <div>
          {articles.map((a, i) => {
            const color  = a.team_id === 40 ? "#C8102E" : "#EF0107";
            const title  = a.article_title || a.speaker || "記事";
            const domain = getDomain(a.article_url);
            return (
              <a key={a.id} href={a.article_url} target="_blank" rel="noreferrer"
                style={{ textDecoration: "none" }}>
                <div style={{
                  display: "flex", gap: 10, alignItems: "flex-start",
                  padding: "9px 0",
                  borderBottom: i < articles.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
                }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#1e2d3a",
                    fontFamily: "'Bebas Neue', sans-serif", flexShrink: 0,
                    lineHeight: 1.3, minWidth: 14 }}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: "#bbb",
                      fontFamily: "'Barlow', sans-serif", lineHeight: 1.4, marginBottom: 3 }}>
                      {title.length > 50 ? title.slice(0, 50) + "…" : title}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: 8, color }}>{a.team_id === 40 ? "LIV" : "ARS"}</span>
                      <span style={{ fontSize: 8, color: "#333" }}>{domain}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 9, color: "#333", flexShrink: 0 }}>↗</span>
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MediaSources({ articles }) {
  const domainMap = {};
  for (const a of articles) {
    const d = getDomain(a.article_url);
    if (!d) continue;
    domainMap[d] = (domainMap[d] || 0) + 1;
  }
  const sources = Object.entries(domainMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div style={{ background: "#0e1318", border: "1px solid rgba(255,255,255,0.07)",
      borderRadius: 12, padding: "18px 16px" }}>
      <SideLabel label="収集元メディア" />
      {sources.length === 0 ? (
        <div style={{ fontSize: 10, color: "#333" }}>データなし</div>
      ) : (
        <div>
          {sources.map(([domain, count], i) => (
            <div key={domain} style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "7px 0",
              borderBottom: i < sources.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none",
            }}>
              <span style={{ fontSize: 10, color: "#888",
                fontFamily: "'Space Mono', monospace" }}>{domain}</span>
              <span style={{ fontSize: 9, color: "#555",
                background: "rgba(255,255,255,0.04)",
                padding: "1px 7px", borderRadius: 3 }}>
                {count}件
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── メインコンポーネント ──────────────────────────────────────

export default function Home() {
  const [teams,         setTeams]         = useState([]);
  const [teamData,      setTeamData]      = useState({});
  const [loading,       setLoading]       = useState(true);
  const [recentMatches, setRecentMatches] = useState([]);
  const [allArticles,   setAllArticles]   = useState([]);
  const [articleTab,    setArticleTab]    = useState("all");
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

    Promise.all([fetchRecentFixturesWithFallback(40, 3), fetchRecentFixturesWithFallback(42, 3)])
      .then(([liv, ars]) => setRecentMatches([...liv, ...ars].sort((a, b) =>
        new Date(b.match_date) - new Date(a.match_date)
      )))
      .catch(() => {});

    fetchLatestPressComments(50).then(setAllArticles).catch(() => {});
  }, []);

  const filteredArticles = allArticles.filter(a => {
    if (articleTab === "liverpool") return a.team_id === 40;
    if (articleTab === "arsenal")   return a.team_id === 42;
    if (articleTab === "manager")   return !!a.speaker;
    return true;
  }).slice(0, 10);

  return (
    <div style={{ background: "#080c10", minHeight: "100vh", color: "#fff",
      fontFamily: "'Barlow', sans-serif" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,400;0,500;0,600;1,400&display=swap"
        rel="stylesheet"
      />

      {/* ════ HERO ════ */}
      <section style={{ padding: "80px 48px 64px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: "#00ff85", letterSpacing: "0.2em",
          textTransform: "uppercase", marginBottom: 18, fontWeight: 500 }}>
          Premier League 2024–25 · Data Viz
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif",
          fontSize: "clamp(60px, 10vw, 112px)", lineHeight: 0.88,
          letterSpacing: "0.01em", marginBottom: 28 }}>
          FOOTBALL<span style={{ color: "#c8102e" }}>-VIZ</span>
        </div>
        <div style={{ fontSize: 16, color: "#6a8098", maxWidth: 500, lineHeight: 1.75 }}>
          プレミアリーグ全チームの得失点パターンをデータで可視化する。<br />
          チームを選んで分析を始めよう。
        </div>
      </section>

      {/* ════ TEAM GRID（全幅） ════ */}
      <section style={{ padding: "0 48px 56px", maxWidth: 1100, margin: "0 auto" }}>
        <SectionHeader label="Premier League 2024–25 — チームを選択" />
        <div style={{
          padding: 10, background: "#070b0f",
          backgroundImage: [
            "repeating-linear-gradient(0deg, transparent, transparent 139px, #131e28 139px, #131e28 140px)",
            "repeating-linear-gradient(90deg, transparent, transparent 139px, #131e28 139px, #131e28 140px)",
          ].join(", "),
          borderRadius: 8, border: "1px solid #1a2530",
        }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#2a3a4a",
              fontSize: 12, fontFamily: "'Barlow', sans-serif" }}>
              Loading teams...
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {teams.map(team => (
                <TeamTile
                  key={team.id} team={team}
                  data={teamData[team.id]}
                  hasData={team.hasData && !!teamData[team.id]}
                  teamColor={TEAM_COLORS[team.id] ?? "#888"}
                  onClick={() => navigate(`/team/${team.id}`)}
                />
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 20, marginTop: 12, fontSize: 10, color: "#2a3a4a" }}>
          <span><span style={{ color: "#00ff85" }}>●</span> データあり — クリックで分析ページへ</span>
          <span><span style={{ color: "#22c55e" }}>▲</span> 得点 / <span style={{ color: "#c8102e" }}>▼</span> 失点（2024-25）</span>
        </div>
      </section>

      {/* ════ 2カラムグリッド ════ */}
      <section style={{ padding: "0 48px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "2rem", alignItems: "start" }}>

          {/* ── メインカラム ── */}
          <div>

            {/* 最新試合（2×2グリッド） */}
            {recentMatches.length > 0 && (
              <div style={{ marginBottom: 36 }}>
                <SectionHeader label="最新試合 — Liverpool / Arsenal" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
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
                    const articleCount = allArticles.filter(a => a.fixture_id === fix.id).length;

                    return (
                      <Link key={fix.id} to={`/match/${fix.id}`} style={{ textDecoration: "none" }}>
                        <div style={{
                          background: "#0e1318", border: "1px solid #1e2830",
                          borderLeft: `3px solid ${color}`,
                          borderRadius: 8, padding: "14px 16px",
                          fontFamily: "'Barlow', sans-serif",
                          transition: "background 0.15s, border-color 0.15s",
                        }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#111d28"; e.currentTarget.style.borderColor = color; }}
                          onMouseLeave={e => { e.currentTarget.style.background = "#0e1318"; e.currentTarget.style.borderColor = "#1e2830"; }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between",
                            alignItems: "center", marginBottom: 8 }}>
                            <span style={{ fontSize: 10, color: "#555" }}>{dateStr}</span>
                            <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 3,
                              background: `${rColor}22`, color: rColor,
                              border: `1px solid ${rColor}44`, fontWeight: 700 }}>{result}</span>
                          </div>
                          <div style={{ fontSize: 12, color, fontWeight: 600, marginBottom: 3 }}>
                            {isLiv ? "Liverpool" : "Arsenal"}{" "}
                            <span style={{ color: "#555", fontSize: 10 }}>vs</span>{" "}
                            {opponent}
                          </div>
                          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26,
                            letterSpacing: "0.04em", color: "#fff" }}>
                            {scored}<span style={{ color: "#333" }}>–</span>{conceded}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between",
                            alignItems: "center", marginTop: 6 }}>
                            <span style={{ fontSize: 9, color: "#555" }}>
                              {isHome ? "HOME" : "AWAY"} · 詳細を見る →
                            </span>
                            {articleCount > 0 && (
                              <span style={{ fontSize: 8, color: "#4a8060",
                                background: "rgba(0,255,133,0.06)",
                                border: "1px solid rgba(0,255,133,0.15)",
                                padding: "2px 6px", borderRadius: 3 }}>
                                📰 {articleCount}件
                              </span>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* セクション区切り */}
            <div style={{ height: 1, background: "#1a2530", marginBottom: 36 }} />

            {/* 最新記事フィード */}
            <div>
              <SectionHeader label="最新記事フィード — プレスコメント" />

              {/* タブ */}
              <div style={{ display: "flex", gap: 4, marginBottom: 18, flexWrap: "wrap" }}>
                {ARTICLE_TABS.map(tab => {
                  const active = articleTab === tab.key;
                  return (
                    <button key={tab.key} onClick={() => setArticleTab(tab.key)}
                      style={{
                        padding: "6px 14px", borderRadius: 6, fontSize: 10,
                        cursor: "pointer", fontFamily: "'Barlow', sans-serif", fontWeight: 600,
                        border: active ? "1px solid #00ff85" : "1px solid #1e2830",
                        background: active ? "rgba(0,255,133,0.08)" : "transparent",
                        color: active ? "#00ff85" : "#555",
                        transition: "all 0.15s",
                      }}
                    >
                      {tab.label}
                      {tab.key === "all" && allArticles.length > 0 && (
                        <span style={{ marginLeft: 5, fontSize: 8,
                          color: active ? "#00ff8580" : "#2a3a4a" }}>
                          {allArticles.length}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {filteredArticles.length === 0 ? (
                <div style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 10, padding: "40px 0", textAlign: "center",
                  fontSize: 12, color: "#333",
                }}>
                  記事準備中 — press_comments テーブルにデータがありません
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {filteredArticles.map(a => <ArticleCard key={a.id} article={a} />)}
                </div>
              )}
            </div>

          </div>{/* /メインカラム */}

          {/* ── サイドバー ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* 注目スタッツ */}
            <div style={{ background: "#0e1318", border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12, padding: "18px 16px", overflow: "hidden" }}>
              <SideLabel label="注目スタッツ — 2024-25" />
              <StatsHighlight />
            </div>

            {/* トレンド記事 */}
            <TrendingArticles articles={allArticles.slice(0, 5)} />

            {/* 収集元メディア */}
            <MediaSources articles={allArticles} />

          </div>{/* /サイドバー */}

        </div>
      </section>

      {/* ════ このサイトについて ════ */}
      <section style={{ padding: "0 48px 80px", maxWidth: 1100, margin: "0 auto" }}>
        <SectionHeader label="このサイトについて" />
        <div style={{ background: "#0e1318", border: "1px solid #1e2830",
          borderRadius: 8, padding: "28px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 32 }}>
            {[
              { label: "データソース", value: "api-sports.io v3" },
              { label: "更新頻度",     value: "毎週月曜 自動更新" },
              { label: "対象リーグ",   value: "Premier League 2024–25" },
            ].map(({ label, value }) => (
              <div key={label}>
                <div style={{ fontSize: 10, color: "#2a3d50", letterSpacing: "0.14em",
                  textTransform: "uppercase", marginBottom: 8, fontWeight: 600 }}>
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
