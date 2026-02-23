// api-sports.io (api-football) v3 API クライアント
// VITE_APISPORTS_KEY は .env に記載し、絶対に Git にコミットしない

// ローカル開発時: Vite プロキシ経由（/api → https://v3.football.api-sports.io）でCORSを回避
// 本番（GitHub Pages）: 直接 API を呼び出す
const BASE_URL = import.meta.env.DEV
  ? "/api"
  : "https://v3.football.api-sports.io";

const API_KEY = import.meta.env.VITE_APISPORTS_KEY;

/**
 * api-sports.io へのリクエストに APIキーヘッダーを付与する共通 fetch ラッパー
 * @param {string} path - ベースURLからの相対パス（例: "/fixtures?team=40&season=2024"）
 * @returns {Promise<any>} - JSON レスポンス
 */
async function apiFetch(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: {
      "x-apisports-key": API_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }

  const json = await response.json();

  // api-sports はエラーをレスポンスボディに含める場合がある
  // errors フィールドがオブジェクト（空配列ではない）のときはエラー
  const errors = json.errors;
  if (errors && !Array.isArray(errors) && Object.keys(errors).length > 0) {
    throw new Error(`API error: ${Object.values(errors)[0]}`);
  }

  return json;
}

/**
 * プレミアリーグの全チーム一覧を取得する
 * @param {number} season - シーズン開始年（2024 = 2024-25シーズン）
 * @returns {Promise<{ response: Array<{ team: { id, name, code, logo } }> }>}
 */
export async function getPLTeams(season = 2024) {
  return apiFetch(`/teams?league=39&season=${season}`);
}
