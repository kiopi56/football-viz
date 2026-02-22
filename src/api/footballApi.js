// football-data.org v4 API クライアント
// VITE_FOOTBALL_API_KEY は .env に記載し、絶対に Git にコミットしない

const BASE_URL = "https://api.football-data.org/v4";

// API キーを環境変数から取得する
// import.meta.env は Vite が提供するオブジェクト
// VITE_ プレフィックスがついた変数だけがブラウザ側に公開される
const API_KEY = import.meta.env.VITE_FOOTBALL_API_KEY;

/**
 * football-data.org へのリクエストに APIキーヘッダーを付与する共通 fetch ラッパー
 * @param {string} path - ベースURLからの相対パス（例: "/teams/64/matches"）
 * @returns {Promise<any>} - JSON レスポンス
 */
async function footballFetch(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      // football-data.org はこのヘッダーで認証する
      "X-Auth-Token": API_KEY,
    },
  });

  // HTTP エラー（401, 403, 429 など）は fetch では例外にならないため手動でチェック
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * チームの試合一覧を取得する
 * @param {number} teamId - チームID（Liverpool=64, Arsenal=57）
 * @param {number} season - シーズン開始年（2024 = 2024-25シーズン）
 * @returns {Promise<{ matches: Array }>}
 */
export async function getTeamMatches(teamId, season) {
  return footballFetch(
    `/teams/${teamId}/matches?season=${season}&status=FINISHED`
  );
}

/**
 * プレミアリーグの全チーム一覧を取得する
 * @param {number} season - シーズン開始年（2024 = 2024-25シーズン）
 * @returns {Promise<{ teams: Array<{ id, name, shortName, crest }> }>}
 */
export async function getPLTeams(season = 2024) {
  return footballFetch(`/competitions/PL/teams?season=${season}`);
}
