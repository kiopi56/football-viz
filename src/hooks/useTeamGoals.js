import { useState, useEffect } from "react";

// チームID → JSONファイルのスラッグ対応表（fetch-data スクリプトの出力と一致させる）
const TEAM_SLUGS = {
  40: "liverpool",
  42: "arsenal",
};

/**
 * ビルド時に生成した JSON からチームの時間帯別失点データを取得するカスタムフック
 *
 * @param {number|null} teamId - チームID（Liverpool=40, Arsenal=42）
 * @param {number} season      - シーズン（2024 = 2024-25）
 * @returns {{ data: Array|null, loading: boolean, error: string|null }}
 *   data = byPeriod 配列 [{ time: "0-15", goals: N }, ...]
 */
export function useTeamGoals(teamId, season) {
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

    // import.meta.env.BASE_URL = "/football-viz/" (dev / production 共通)
    fetch(`${import.meta.env.BASE_URL}data/${slug}-${season}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json) => {
        setData(json.byPeriod); // [{ time, goals }, ...] 6要素
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [teamId, season]);

  return { data, loading, error };
}
