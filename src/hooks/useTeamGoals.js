import { useState, useEffect } from "react";
import { getTeamFixtures } from "../api/footballApi";
import { aggregateGoalsByPeriod } from "../utils/aggregateGoals";

/**
 * チームの前半/後半別失点データを取得・集計するカスタムフック
 *
 * @param {number|null} teamId - チームID（Liverpool=40, Arsenal=42）。null の場合はfetchしない
 * @param {number} season - シーズン開始年（2024 = 2024-25シーズン）
 * @returns {{ data: Array|null, loading: boolean, error: string|null }}
 */
export function useTeamGoals(teamId, season) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(teamId != null);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!teamId) {
      setData(null);
      setLoading(false);
      setError(null);
      return;
    }

    setData(null);
    setLoading(true);
    setError(null);

    getTeamFixtures(teamId, season)
      .then(res => {
        setData(aggregateGoalsByPeriod(res.response, teamId));
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [teamId, season]);

  return { data, loading, error };
}
