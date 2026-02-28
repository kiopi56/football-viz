import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import StatsHighlight from "../components/StatsHighlight";
import { fetchRecentFixturesWithFallback, fetchLatestPressComments } from "../lib/supabase";

// ── カラー定数 ────────────────────────────────────────────────
const C = {
  bg:      "#080c10",
  surface: "#0e1318",
  surface2:"#131a22",
  border:  "#1e2830",
  text:    "#e8edf2",
  muted:   "#5a6a78",
  muted2:  "#3a4a58",
  red:     "#c8102e",
  accent:  "#00ff85",
  gold:    "#f0b429",
  blue:    "#6cabdd",
};

const SLUG_MAP    = { 40: "liverpool", 42: "arsenal" };
const TEAM_COLORS = {
  33:"#DA291C",34:"#00A4E4",35:"#DA020E",36:"#CC0000",
  39:"#FDB913",40:"#C8102E",41:"#D71920",42:"#EF0107",
  45:"#274488",46:"#003090",47:"#132257",48:"#7A263A",
  49:"#034694",50:"#6CABDD",51:"#0057B8",52:"#C4122E",
  55:"#E03A3E",57:"#0044A9",65:"#DD0000",66:"#95BFE5",
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

function fmtMatchDate(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,"0")}.${String(d.getDate()).padStart(2,"0")}`;
}

// ── サブコンポーネント ─────────────────────────────────────────

/** 左カラーバー付きセクションヘッダー */
function SectionHeader({ label, color = C.accent, action }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1rem" }}>
      <div style={{ display:"flex", alignItems:"center", gap:"0.75rem" }}>
        <div style={{ width:4, height:"1.1rem", background:color, flexShrink:0 }} />
        <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.3rem",
          letterSpacing:"2px", color:C.text }}>
          {label}
        </span>
      </div>
      {action && (
        <a href={action.href} style={{ fontSize:"0.75rem", color:C.muted,
          textDecoration:"none", letterSpacing:"1px" }}>
          {action.label}
        </a>
      )}
    </div>
  );
}

/** セクション区切り線（ラベル付き） */
function SectionDivider({ label }) {
  return (
    <div style={{ height:1, background:C.border, margin:"2.5rem 0", position:"relative" }}>
      {label && (
        <span style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)",
          background:C.bg, paddingRight:"1rem",
          fontSize:"0.65rem", letterSpacing:"2px", color:C.muted2,
          textTransform:"uppercase" }}>
          {label}
        </span>
      )}
    </div>
  );
}

/** サイドバーカード共通ラッパー */
function SidebarCard({ headerLabel, dotColor = C.accent, children }) {
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.border}` }}>
      <div style={{ padding:"0.65rem 1rem", borderBottom:`1px solid ${C.border}`,
        fontSize:"0.65rem", letterSpacing:"2px", color:C.muted,
        textTransform:"uppercase", display:"flex", alignItems:"center", gap:"0.5rem" }}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:dotColor, flexShrink:0 }} />
        {headerLabel}
      </div>
      {children}
    </div>
  );
}

/** 試合カード */
function MatchCard({ fix, allArticles }) {
  const [hovered, setHovered] = useState(false);
  const isLiv    = fix.home_team_id === 40 || fix.away_team_id === 40;
  const teamId   = isLiv ? 40 : 42;
  const isHome   = fix.home_team_id === teamId;
  const scored   = isHome ? fix.goals_home : fix.goals_away;
  const conceded = isHome ? fix.goals_away  : fix.goals_home;
  const homeTeam = fix.home_team_name;
  const awayTeam = fix.away_team_name;
  const result   = scored > conceded ? "W" : scored < conceded ? "L" : "D";
  const rStyle   = result === "W"
    ? { bg:"rgba(0,255,133,0.15)", color:C.accent,  border:"1px solid rgba(0,255,133,0.3)" }
    : result === "L"
    ? { bg:"rgba(200,16,46,0.15)",  color:C.red,    border:"1px solid rgba(200,16,46,0.3)" }
    : { bg:"rgba(90,106,120,0.2)",  color:C.muted,  border:`1px solid ${C.muted2}` };
  const articleCount = allArticles.filter(a => a.fixture_id === fix.id).length;
  const season = fix.season ?? 2024;

  return (
    <Link to={`/match/${fix.id}`} style={{ textDecoration:"none", color:"inherit", display:"block" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ background: hovered ? C.surface2 : C.surface, padding:"1.25rem",
        transition:"background 0.15s", height:"100%", boxSizing:"border-box" }}>
        <div style={{ fontSize:"0.65rem", color:C.muted, letterSpacing:"1px",
          marginBottom:"0.75rem", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <span>{fmtMatchDate(fix.match_date)} · PL {season}-{String(season+1).slice(-2)}</span>
          <span style={{ fontSize:"0.6rem", padding:"0.15rem 0.5rem", fontWeight:700,
            letterSpacing:"1px", background:rStyle.bg, color:rStyle.color, border:rStyle.border }}>
            {result}
          </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          gap:"0.5rem", marginBottom:"0.75rem" }}>
          <span style={{ fontSize:"0.85rem", fontWeight:600, color:C.text }}>{homeTeam}</span>
          <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.6rem",
            color:C.text, letterSpacing:"2px", whiteSpace:"nowrap" }}>
            {fix.goals_home} — {fix.goals_away}
          </span>
          <span style={{ fontSize:"0.85rem", fontWeight:600, color:C.muted, textAlign:"right" }}>{awayTeam}</span>
        </div>
        <div style={{ fontSize:"0.7rem", color:C.muted2, display:"flex", alignItems:"center", gap:"0.4rem" }}>
          <span>📰</span>
          <span style={{ background:C.surface2, border:`1px solid ${C.border}`,
            padding:"0.1rem 0.4rem", fontSize:"0.65rem", color:C.muted }}>
            {articleCount}
          </span>
          <span>関連記事</span>
          <span style={{ marginLeft:"auto", color:C.muted }}>詳細を見る →</span>
        </div>
      </div>
    </Link>
  );
}

/** ニュースアイテム（縦リスト） */
function NewsItem({ article, featured }) {
  const [hovered, setHovered] = useState(false);
  const color   = article.team_id === 40 ? "#cc0000"
                : article.team_id === 42 ? "#e8222a" : C.muted;
  const domain  = getDomain(article.article_url);
  const title   = article.article_title || article.speaker || "記事";
  const excerpt = (article.comment_text ?? "").slice(0, 180);
  const ago     = relativeTime(article.published_at);
  const teamLabel = article.team_id === 40 ? "Liverpool"
                  : article.team_id === 42 ? "Arsenal" : null;
  const teamTagStyle = article.team_id === 40
    ? { borderColor:"#cc0000", color:"#cc0000" }
    : { borderColor:C.red, color:C.red };

  const leftBorderColor = featured ? C.gold : hovered ? C.accent : "transparent";

  return (
    <a href={article.article_url} target="_blank" rel="noreferrer"
      style={{ textDecoration:"none", color:"inherit", display:"block" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{
        background: featured ? `rgba(240,180,41,0.03)` : hovered ? C.surface2 : C.surface,
        padding:"1rem 1.25rem",
        display:"grid", gridTemplateColumns:"1fr auto", gap:"1rem",
        transition:"background 0.15s",
        borderLeft:`3px solid ${leftBorderColor}`,
        position:"relative",
      }}>
        <div>
          {/* ソース行 */}
          <div style={{ display:"flex", alignItems:"center", gap:"0.5rem", marginBottom:"0.35rem" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:color, flexShrink:0 }} />
            <span style={{ fontSize:"0.65rem", fontWeight:700, letterSpacing:"1.5px",
              textTransform:"uppercase", color:C.muted }}>
              {domain}
            </span>
            <span style={{ fontSize:"0.65rem", color:C.muted2, marginLeft:"auto" }}>{ago}</span>
          </div>
          {/* タイトル */}
          <div style={{ fontSize:"0.9rem", fontWeight:600, lineHeight:1.4, marginBottom:"0.3rem",
            color: hovered ? C.text : "#ccd4dc" }}>
            {title.length > 80 ? title.slice(0, 80) + "…" : title}
          </div>
          {/* 本文抜粋 */}
          {excerpt && (
            <div style={{ fontSize:"0.78rem", color:C.muted, lineHeight:1.5,
              display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical",
              overflow:"hidden", marginBottom:"0.5rem" }}>
              {excerpt}
            </div>
          )}
          {/* タグ */}
          <div style={{ display:"flex", gap:"0.35rem", flexWrap:"wrap" }}>
            {article.speaker && (
              <span style={{ fontSize:"0.6rem", padding:"0.15rem 0.45rem",
                border:`1px solid ${C.accent}`, color:C.accent }}>
                監督コメント
              </span>
            )}
            {teamLabel && (
              <span style={{ fontSize:"0.6rem", padding:"0.15rem 0.45rem",
                border:"1px solid", ...teamTagStyle }}>
                {teamLabel}
              </span>
            )}
          </div>
        </div>
        <span style={{ fontSize:"0.75rem", color:C.muted2, alignSelf:"flex-start", flexShrink:0 }}>↗</span>
      </div>
    </a>
  );
}

/** サイドバー：トレンド記事 */
function TrendingArticles({ articles }) {
  return (
    <SidebarCard headerLabel="トレンド記事" dotColor={C.gold}>
      {articles.length === 0 ? (
        <div style={{ padding:"0.75rem 1rem", fontSize:"0.75rem", color:C.muted2 }}>記事準備中</div>
      ) : articles.map((a, i) => {
        const title  = a.article_title || a.speaker || "記事";
        const domain = getDomain(a.article_url);
        return (
          <a key={a.id} href={a.article_url} target="_blank" rel="noreferrer"
            style={{ textDecoration:"none", color:"inherit", display:"block" }}>
            <div style={{
              padding:"0.7rem 1rem",
              borderBottom: i < articles.length - 1 ? `1px solid ${C.border}` : "none",
              display:"flex", gap:"0.75rem",
              transition:"background 0.15s",
            }}
              onMouseEnter={e => e.currentTarget.style.background = C.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"1.1rem",
                color:C.muted2, width:18, flexShrink:0 }}>{i+1}</span>
              <div>
                <div style={{ fontSize:"0.78rem", lineHeight:1.35, color:C.text, marginBottom:"0.2rem" }}>
                  {title.length > 50 ? title.slice(0, 50) + "…" : title}
                </div>
                <div style={{ fontSize:"0.65rem", color:C.muted }}>
                  {domain} · {relativeTime(a.published_at)}
                </div>
              </div>
            </div>
          </a>
        );
      })}
    </SidebarCard>
  );
}

/** サイドバー：収集元メディア */
function MediaSourcesCard({ articles }) {
  // official domains
  const OFFICIAL = {
    "liverpoolfc.com": { label:"Liverpool FC 公式", color:"#cc0000", auto:true },
    "arsenal.com":     { label:"Arsenal FC 公式",   color:"#e8222a", auto:true },
  };

  // collect domains from articles
  const domainMap = {};
  for (const a of articles) {
    const d = getDomain(a.article_url);
    if (!d) continue;
    domainMap[d] = (domainMap[d] || 0) + 1;
  }

  // build source list: official first, then others
  const officialEntries = Object.entries(OFFICIAL).map(([d, meta]) => ({
    domain: d, ...meta, count: domainMap[d] ?? 0,
  }));
  const otherEntries = Object.keys(domainMap)
    .filter(d => !OFFICIAL[d])
    .map(d => ({ domain:d, label:d, color:C.blue, auto:false, count:domainMap[d] }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const sources = [...officialEntries, ...otherEntries];

  return (
    <SidebarCard headerLabel="収集元メディア" dotColor={C.blue}>
      <div style={{ padding:"0.75rem 1rem", fontSize:"0.75rem", color:C.muted,
        lineHeight:1.6, borderBottom:`1px solid ${C.border}` }}>
        公式サイトから自動取得。著作権は各メディアに帰属します。
      </div>
      {sources.map((s, i) => (
        <div key={s.domain} style={{
          padding:"0.5rem 1rem", display:"flex", alignItems:"center",
          gap:"0.75rem", fontSize:"0.78rem",
          borderTop: i > 0 ? `1px solid ${C.border}` : "none",
        }}>
          <div style={{ width:8, height:8, borderRadius:"50%", background:s.color, flexShrink:0 }} />
          <span style={{ color:C.text }}>{s.label}</span>
          <span style={{ marginLeft:"auto", fontSize:"0.65rem",
            color: s.auto ? C.accent : C.muted }}>
            {s.auto ? "自動取得" : "外部リンク"}
          </span>
        </div>
      ))}
    </SidebarCard>
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
              .then(r => r.ok ? r.json() : null).catch(() => null)
              .then(json => [t.id, json])
          )
        );
        setTeamData(Object.fromEntries(results.filter(([, d]) => d)));
        setLoading(false);
      }).catch(() => setLoading(false));

    Promise.all([fetchRecentFixturesWithFallback(40, 3), fetchRecentFixturesWithFallback(42, 3)])
      .then(([liv, ars]) => setRecentMatches(
        [...liv, ...ars].sort((a, b) => new Date(b.match_date) - new Date(a.match_date))
      )).catch(() => {});

    fetchLatestPressComments(50).then(setAllArticles).catch(() => {});
  }, []);

  const filteredArticles = allArticles.filter(a => {
    if (articleTab === "liverpool") return a.team_id === 40;
    if (articleTab === "arsenal")   return a.team_id === 42;
    if (articleTab === "manager")   return !!a.speaker;
    return true;
  }).slice(0, 10);

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text,
      fontFamily:"'Barlow',sans-serif" }}>
      <link
        href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Barlow:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=Barlow+Condensed:wght@400;600;700&display=swap"
        rel="stylesheet"
      />

      {/* ════ HERO ════ */}
      <div style={{
        background:C.surface, borderBottom:`1px solid ${C.border}`,
        padding:"3rem 2rem 2rem", position:"relative", overflow:"hidden",
      }}>
        {/* グリッドライン */}
        <div style={{
          position:"absolute", inset:0, pointerEvents:"none",
          backgroundImage:"repeating-linear-gradient(90deg,transparent,transparent 99px,#1e2830 99px,#1e2830 100px)",
          opacity:0.4,
        }} />
        <div style={{ maxWidth:1200, margin:"0 auto", position:"relative",
          display:"grid", gridTemplateColumns:"1fr 1fr", gap:"3rem", alignItems:"center" }}>

          {/* ヒーロー左 */}
          <div>
            <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"3.5rem",
              lineHeight:0.95, letterSpacing:"3px", marginBottom:"1rem" }}>
              PREMIER<br />
              <span style={{ color:C.red }}>LEAGUE</span><br />
              DATA
            </div>
            <p style={{ fontSize:"0.9rem", color:C.muted, lineHeight:1.6,
              maxWidth:420, marginBottom:"1.5rem" }}>
              プレミアリーグ全チームの得失点パターンを<br />
              データで可視化する。試合の結果ではなく、<br />
              チームの傾向と変化を理解する場所。
            </p>
            <div style={{ display:"flex", gap:"2rem" }}>
              {[
                { val:"20",   label:"チーム" },
                { val:"3",    label:"シーズン" },
                { val:"2,280",label:"試合データ" },
              ].map(({ val, label }) => (
                <div key={label}>
                  <div style={{ fontFamily:"'Bebas Neue',sans-serif", fontSize:"2rem",
                    color:C.accent, lineHeight:1 }}>{val}</div>
                  <div style={{ fontSize:"0.7rem", color:C.muted, letterSpacing:"1px",
                    marginTop:"0.2rem" }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ヒーロー右: チームグリッド */}
          {loading ? (
            <div style={{ background:C.surface2, height:200,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"0.75rem", color:C.muted2 }}>Loading...</div>
          ) : (
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:"1px",
              background:C.border }}>
              {teams.map(team => {
                const hasData = team.hasData && !!teamData[team.id];
                return (
                  <div key={team.id}
                    onClick={hasData ? () => navigate(`/team/${team.id}`) : undefined}
                    style={{ background:C.surface2, padding:"0.75rem 0.5rem",
                      display:"flex", flexDirection:"column", alignItems:"center", gap:"0.4rem",
                      cursor: hasData ? "pointer" : "default",
                      opacity: hasData ? 1 : 0.4,
                      transition:"background 0.15s",
                    }}
                    onMouseEnter={e => hasData && (e.currentTarget.style.background = "#1a2535")}
                    onMouseLeave={e => (e.currentTarget.style.background = C.surface2)}
                  >
                    <img src={team.logo} alt={team.shortName} width={28} height={28}
                      style={{ objectFit:"contain" }} loading="lazy" />
                    <div style={{ fontSize:"0.6rem", color:C.muted, textAlign:"center",
                      letterSpacing:"0.5px", lineHeight:1.2 }}>
                      {team.shortName}
                    </div>
                    {hasData && (
                      <div style={{ width:4, height:4, borderRadius:"50%",
                        background:C.accent }} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ════ MAIN 2カラム ════ */}
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"2rem",
        display:"grid", gridTemplateColumns:"1fr 340px", gap:"2rem" }}>

        {/* ── メインカラム ── */}
        <main>

          {/* 最新試合 */}
          {recentMatches.length > 0 && (
            <div style={{ marginBottom:"2.5rem" }}>
              <SectionHeader label="最新試合" color={C.red} />
              {/* 1px-gap グリッド */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr",
                gap:"1px", background:C.border }}>
                {recentMatches.map(fix => (
                  <MatchCard key={fix.id} fix={fix} allArticles={allArticles} />
                ))}
              </div>
            </div>
          )}

          <SectionDivider label="記事・分析" />

          {/* 最新記事 */}
          <div>
            <SectionHeader label="最新記事" color={C.gold} />

            {/* タブ（アンダーライン式） */}
            <div style={{ display:"flex", gap:0, marginBottom:"1rem",
              borderBottom:`1px solid ${C.border}` }}>
              {ARTICLE_TABS.map(tab => {
                const active = articleTab === tab.key;
                return (
                  <button key={tab.key} onClick={() => setArticleTab(tab.key)}
                    style={{
                      padding:"0.5rem 1rem", fontSize:"0.75rem", letterSpacing:"1px",
                      color: active ? C.accent : C.muted,
                      cursor:"pointer", fontFamily:"'Barlow',sans-serif", fontWeight:600,
                      background:"none", border:"none",
                      borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
                      transition:"all 0.2s", marginBottom:"-1px",
                    }}
                  >
                    {tab.label}
                    {tab.key === "all" && allArticles.length > 0 && (
                      <span style={{ marginLeft:5, fontSize:"0.65rem",
                        color: active ? `${C.accent}80` : C.muted2 }}>
                        {allArticles.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* 記事リスト（1px-gap） */}
            {filteredArticles.length === 0 ? (
              <div style={{ background:C.surface, padding:"2.5rem 1.25rem",
                textAlign:"center", fontSize:"0.85rem", color:C.muted2,
                border:`1px solid ${C.border}` }}>
                記事準備中 — press_comments テーブルにデータがありません
              </div>
            ) : (
              <>
                <div style={{ display:"flex", flexDirection:"column",
                  gap:"1px", background:C.border }}>
                  {filteredArticles.map((a, i) => (
                    <NewsItem key={a.id} article={a} featured={i === 0} />
                  ))}
                </div>
                {filteredArticles.length >= 10 && (
                  <div style={{ textAlign:"center", padding:"1rem",
                    background:C.surface, color:C.muted,
                    fontSize:"0.75rem", letterSpacing:"1px",
                    borderTop:`1px solid ${C.border}`, cursor:"pointer",
                    transition:"color 0.2s" }}
                    onMouseEnter={e => e.currentTarget.style.color = C.accent}
                    onMouseLeave={e => e.currentTarget.style.color = C.muted}
                  >
                    さらに読み込む →
                  </div>
                )}
              </>
            )}
          </div>

        </main>

        {/* ── サイドバー ── */}
        <aside style={{ display:"flex", flexDirection:"column", gap:"1.5rem" }}>

          {/* 注目スタッツ */}
          <SidebarCard headerLabel="注目スタッツ" dotColor={C.accent}>
            <div style={{ padding:"0.5rem 0" }}>
              <StatsHighlight compact />
            </div>
          </SidebarCard>

          {/* トレンド記事 */}
          <TrendingArticles articles={allArticles.slice(0, 5)} />

          {/* 収集元メディア */}
          <MediaSourcesCard articles={allArticles} />

        </aside>

      </div>

      {/* ════ このサイトについて ════ */}
      <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 2rem 3rem" }}>
        <SectionDivider />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:32,
          background:C.surface, border:`1px solid ${C.border}`, padding:"1.75rem 2rem" }}>
          {[
            { label:"データソース", value:"api-sports.io v3" },
            { label:"更新頻度",     value:"毎週月曜 自動更新" },
            { label:"対象リーグ",   value:"Premier League 2024–25" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize:"0.65rem", color:C.muted2, letterSpacing:"2px",
                textTransform:"uppercase", marginBottom:8, fontWeight:600 }}>{label}</div>
              <div style={{ fontSize:"0.9rem", color:C.muted }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
