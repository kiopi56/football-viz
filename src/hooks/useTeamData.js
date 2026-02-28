import { useState, useEffect } from "react";

/**
 * ビルド時に生成した JSON からチームの詳細データを取得するカスタムフック
 *
 * @param {string|null} slug   - チームスラグ（'liverpool', 'arsenal', 'manchester-city' 等）
 * @param {number}      season - シーズン開始年（2025 = 2025-26, 2024 = 2024-25, ...）
 * @returns {{ data: TeamData|null, loading: boolean, error: string|null }}
 */
export function useTeamData(slug, season) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(slug != null);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!slug) {
      setData(null); setLoading(false); setError(null);
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
  }, [slug, season]);

  return { data, loading, error };
}
