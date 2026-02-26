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
