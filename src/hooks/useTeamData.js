import { useState, useEffect } from "react";

const TEAM_SLUGS = { 40: "liverpool", 42: "arsenal" };

/**
 * ビルド時に生成した JSON からチームの詳細データを取得するカスタムフック
 *
 * @param {number|null} teamId  - チームID（40=Liverpool, 42=Arsenal）
 * @param {number}      season  - シーズン開始年（2024 = 2024-25, 2023 = 2023-24）
 * @returns {{ data: TeamData|null, loading: boolean, error: string|null }}
 *
 * TeamData shape:
 *   byTimeAvailable: boolean
 *   recentForm: ["W","D","L",...]   ← 直近5試合（新しい順）
 *   scored:   { total: number, byTime: { "0-15": N, ... } | null }
 *   conceded: { total: number, byTime: { "0-15": N, ... } | null }
 *   home:     { scored: {...}, conceded: {...} }
 *   away:     { scored: {...}, conceded: {...} }
 *   byPeriod: [{ time, goals }, ...]  ← 後方互換（失点のみ）
 */
export function useTeamData(teamId, season) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(teamId != null);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!teamId) {
      setData(null); setLoading(false); setError(null);
      return;
    }

    const slug = TEAM_SLUGS[teamId];
    if (!slug) {
      setError("このチームのデータは準備中です");
      setLoading(false);
      return;
    }

    setData(null); setLoading(true); setError(null);

    fetch(`${import.meta.env.BASE_URL}data/${slug}-${season}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => { setData(json); setLoading(false); })
      .catch((err) => { setError(err.message); setLoading(false); });
  }, [teamId, season]);

  return { data, loading, error };
}
