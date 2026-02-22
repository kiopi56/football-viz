// useState  = 状態（変化する値）を管理するフック
// useEffect = コンポーネント表示時に副作用（fetch など）を実行するフック
import { useState, useEffect } from "react";
import { getTeamMatches } from "../api/footballApi";
import { aggregateGoalsByTime } from "../utils/aggregateGoals";

/**
 * チームの時間帯別失点データを取得・集計するカスタムフック
 *
 * 使い方:
 *   const { data, loading, error } = useTeamGoals(64, 2024);
 *
 * @param {number|null} teamId - チームID（Liverpool=64, Arsenal=57）。null の場合はfetchしない
 * @param {number} season - シーズン開始年（2024 = 2024-25シーズン）
 * @returns {{ data: Array|null, loading: boolean, error: string|null }}
 */
export function useTeamGoals(teamId, season) {
  // data: 集計結果 [{ time: "0-15", goals: 3 }, ...] を保持する
  const [data, setData] = useState(null);

  // loading: teamId が指定されている場合は true でスタート（即 fetch するため）
  // teamId が null の場合は fetch しないので false
  const [loading, setLoading] = useState(teamId != null);

  // error: エラーメッセージを保持する。正常時は null
  const [error, setError] = useState(null);

  // useEffect の依存配列に teamId と season を入れることで、
  // どちらかが変わったときも自動的に再 fetch される
  useEffect(() => {
    // teamId が null/undefined の場合は fetch しない（Compare ページの未選択スロット用）
    if (!teamId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    // 前回のデータをリセットして再ローディング状態にする
    setData(null);
    setLoading(true);
    setError(null);

    getTeamMatches(teamId, season)
      .then(res => {
        // res.matches を受け取り、時間帯別失点に集計する
        const aggregated = aggregateGoalsByTime(res.matches, teamId);
        setData(aggregated);  // 集計結果をstateにセット
        setLoading(false);     // ローディング終了
      })
      .catch(err => {
        // ネットワークエラーや APIエラー（401, 429 など）がここに来る
        setError(err.message);
        setLoading(false);
      });
  }, [teamId, season]); // teamId か season が変わるたびに再実行

  return { data, loading, error };
}
