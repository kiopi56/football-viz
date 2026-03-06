import { useState, useEffect } from "react";

/**
 * 複数チーム × 複数シーズンのデータを並列 fetch するカスタムフック
 *
 * @param {string[]} teams   - スラグ配列 e.g. ['liverpool', 'arsenal']
 * @param {number[]} seasons - シーズン配列 e.g. [2023, 2024, 2025]
 * @returns {{ data: Object, loading: boolean }}
 *          data[slug][season] = TeamData | null
 */
export function useMultiTeamData(teams, seasons) {
  const [data,    setData]    = useState({});
  const [loading, setLoading] = useState(teams.length > 0 && seasons.length > 0);

  // 配列を文字列化して依存キーに使う（配列の参照安定性に依存しない）
  const teamsKey   = teams.join(",");
  const seasonsKey = seasons.join(",");

  useEffect(() => {
    if (!teams.length || !seasons.length) {
      setData({});
      setLoading(false);
      return;
    }

    setLoading(true);
    const base = import.meta.env.BASE_URL ?? "/";

    const fetches = teams.flatMap(slug =>
      seasons.map(season =>
        fetch(`${base}data/${slug}-${season}.json`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
          .then(json => ({ slug, season, json }))
      )
    );

    Promise.all(fetches).then(results => {
      const map = {};
      for (const { slug, season, json } of results) {
        if (!map[slug]) map[slug] = {};
        map[slug][season] = json;
      }
      setData(map);
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsKey, seasonsKey]);

  return { data, loading };
}
