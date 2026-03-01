import { supabase } from "./supabase";

/**
 * ユーザーの特定試合の観戦記録を取得
 * 存在しない場合は null を返す
 */
export async function getRecord(userId, fixtureId) {
  const { data, error } = await supabase
    .from("match_records")
    .select("*")
    .eq("user_id", userId)
    .eq("fixture_id", fixtureId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * 観戦記録を保存（なければINSERT、あればUPDATE）
 */
export async function saveRecord(userId, fixtureId, { watched, rating, memo, mom }) {
  const { data, error } = await supabase
    .from("match_records")
    .upsert(
      {
        user_id: userId,
        fixture_id: fixtureId,
        watched: watched ?? false,
        rating: rating || null,
        memo: memo || null,
        mom: mom || null,
      },
      { onConflict: "user_id,fixture_id" }
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * ユーザーの全観戦記録を取得（fixtureデータをJOINして返す）
 * watched = true のもの、試合日降順
 */
export async function getMyRecords(userId) {
  const { data, error } = await supabase
    .from("match_records")
    .select(`
      *,
      fixture:fixtures (
        id, home_team_name, away_team_name,
        home_team_id, away_team_id,
        goals_home, goals_away,
        match_date, season
      )
    `)
    .eq("user_id", userId)
    .eq("watched", true)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
