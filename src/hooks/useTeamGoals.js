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
 * @param {number} teamId - チームID（Liverpool=64, Arsenal=57）
 * @param {number} season - シーズン開始年（2024 = 2024-25シーズン）
 * @returns {{ data: Array|null, loading: boolean, error: string|null }}
 */
export function useTeamGoals(teamId, season) {
  // data: 集計結果 [{ time: "0-15", goals: 3 }, ...] を保持する
  // 最初は null（データ未取得）
  const [data, setData] = useState(null);

  // loading: API 通信中かどうかを示すフラグ
  // 最初は true（表示時にすぐ fetch を開始するため）
  const [loading, setLoading] = useState(true);

  // error: エラーメッセージを保持する。正常時は null
  const [error, setError] = useState(null);

  // useEffect の依存配列に teamId と season を入れることで、
  // どちらかが変わったときも自動的に再 fetch される
  useEffect(() => {
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
