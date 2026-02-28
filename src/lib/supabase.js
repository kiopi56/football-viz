import { createClient } from "@supabase/supabase-js";

// フロントエンドからの読み取りは anon key を使用（RLS の SELECT ポリシーに従う）
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const TRACKED_TEAMS = { 40: "liverpool", 42: "arsenal" };

/** チームIDから表示名を返す */
export function teamDisplayName(id) {
  if (id === 40) return "Liverpool";
  if (id === 42) return "Arsenal";
  return null;
}

/** fixture の home/away から追跡チームの teamId を特定する */
export function resolveTeamId(fixture) {
  if (TRACKED_TEAMS[fixture.home_team_id]) return fixture.home_team_id;
  if (TRACKED_TEAMS[fixture.away_team_id]) return fixture.away_team_id;
  return null;
}

/** 特定チーム・シーズンの試合一覧（新しい順）を取得 */
export async function fetchFixtures(teamId, season) {
  const { data, error } = await supabase
    .from("fixtures")
    .select("*")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("season", season)
    .eq("status", "FT")
    .order("match_date", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** 単一試合の詳細を取得 */
export async function fetchFixture(fixtureId) {
  const { data, error } = await supabase
    .from("fixtures")
    .select("*")
    .eq("id", fixtureId)
    .single();

  if (error) throw error;
  return data;
}

/** 試合のゴールイベントを取得（分昇順） */
export async function fetchGoalEvents(fixtureId) {
  const { data, error } = await supabase
    .from("goal_events")
    .select("*")
    .eq("fixture_id", fixtureId)
    .eq("type", "Goal")
    .in("detail", ["Normal Goal", "Penalty"])
    .order("minute", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** 直近 n 試合をチームIDで取得（全シーズン通算） */
export async function fetchRecentFixtures(teamId, limit = 3) {
  const { data, error } = await supabase
    .from("fixtures")
    .select("*")
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
    .eq("status", "FT")
    .order("match_date", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ── JSON フォールバック ────────────────────────────────────────

const SLUGS    = { 40: "liverpool", 42: "arsenal" };
const SEASONS  = [2024, 2023, 2022];
const BASE     = import.meta.env.BASE_URL ?? "/";

/** JSON から fixtures 配列を取得 */
async function loadJsonFixtures(teamId, season) {
  const slug = SLUGS[teamId];
  if (!slug) return [];
  try {
    const res = await fetch(`${BASE}data/${slug}-${season}.json`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.fixtures ?? [];
  } catch {
    return [];
  }
}

/**
 * Supabase → JSON の順で試合一覧を取得
 * Supabase が空または失敗した場合に JSON にフォールバック
 */
export async function fetchFixturesWithFallback(teamId, season) {
  try {
    const data = await fetchFixtures(teamId, season);
    if (data.length > 0) return data;
  } catch { /* fall through */ }

  return loadJsonFixtures(teamId, season);
}

/**
 * Supabase → 全 JSON の順で単一試合を検索
 * Supabase で見つからない場合は全チーム × 全シーズン JSON を検索
 */
export async function fetchFixtureWithFallback(fixtureId) {
  // 1. Supabase
  try {
    const data = await fetchFixture(fixtureId);
    if (data) return data;
  } catch { /* fall through */ }

  // 2. 全 JSON を並列検索
  const searches = Object.keys(SLUGS).flatMap(tid =>
    SEASONS.map(async season => {
      const list = await loadJsonFixtures(Number(tid), season);
      return list.find(f => f.id === fixtureId) ?? null;
    })
  );
  const results = await Promise.all(searches);
  return results.find(r => r !== null) ?? null;
}

/** 最新のプレスコメントを取得（デフォルト50件） */
export async function fetchLatestPressComments(limit = 50) {
  const { data, error } = await supabase
    .from("press_comments")
    .select("id, fixture_id, team_id, article_url, article_title, speaker, comment_text, published_at")
    .order("published_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

/** fixture_id に紐づくプレスコメントを取得（最大5件） */
export async function fetchPressComments(fixtureId) {
  const { data, error } = await supabase
    .from("press_comments")
    .select("id, article_url, article_title, speaker, comment_text, published_at")
    .eq("fixture_id", fixtureId)
    .order("published_at", { ascending: false })
    .limit(5);

  if (error) throw error;
  return data ?? [];
}

/**
 * Supabase → JSON の順で直近 n 試合を取得
 */
export async function fetchRecentFixturesWithFallback(teamId, limit = 3) {
  try {
    const data = await fetchRecentFixtures(teamId, limit);
    if (data.length > 0) return data;
  } catch { /* fall through */ }

  // JSON から全シーズン横断で収集し日付降順に並べる
  const all = (await Promise.all(SEASONS.map(s => loadJsonFixtures(teamId, s)))).flat();
  return all
    .sort((a, b) => new Date(b.match_date) - new Date(a.match_date))
    .slice(0, limit);
}
