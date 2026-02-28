/**
 * scripts/fetchData.mjs
 *
 * football-data.org API から Liverpool / Arsenal の試合データ・得点者を取得し
 * public/data/ に JSON として保存する。Supabase の fixtures テーブルにも upsert する。
 *
 * 実行例:
 *   node scripts/fetchData.mjs              # 2024シーズン（デフォルト）
 *   node scripts/fetchData.mjs --season=2022
 *   node scripts/fetchData.mjs --with-stats  # 個別試合詳細も取得（+76 APIコール）
 *
 * 環境変数（.env から自動読み込み）:
 *   FOOTBALL_DATA_API_KEY   ← football-data.org API キー
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_SERVICE_KEY
 *
 * 出力ファイル:
 *   public/data/liverpool-{season}.json
 *   public/data/arsenal-{season}.json
 *
 * API レート制限: 10 calls/min（無料プラン）→ 各コール間に 7 秒待機
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

// ── .env 読み込み ─────────────────────────────────────────────
try {
  const envContent = readFileSync(join(process.cwd(), ".env"), "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = val;
  }
} catch {}

// ── 設定 ─────────────────────────────────────────────────────
const BASE_URL = "https://api.football-data.org/v4";
const API_KEY  = process.env.FOOTBALL_DATA_API_KEY;

// football-data.org チームID → アプリ内レガシーID（後方互換）
const TEAM_ID_MAP = { 64: 40, 57: 42 };

// 取得対象チーム（football-data.org ID）
const FD_TEAMS = [
  { fdId: 64, legacyId: 40, slug: "liverpool" },
  { fdId: 57, legacyId: 42, slug: "arsenal"   },
];

// ── コマンドライン引数 ────────────────────────────────────────
const seasonArg  = process.argv.find(a => a.startsWith("--season="));
const SEASON     = seasonArg ? Number(seasonArg.split("=")[1]) : 2024;
const WITH_STATS = process.argv.includes("--with-stats");

if (isNaN(SEASON) || SEASON < 2018 || SEASON > 2030) {
  console.error(`Error: Invalid season "${seasonArg?.split("=")[1]}". Example: --season=2022`);
  process.exit(1);
}

console.log(`\nTarget season : ${SEASON} (${SEASON}-${String(SEASON + 1).slice(-2)})`);
console.log(`With stats    : ${WITH_STATS}`);

// ── Supabase クライアント ─────────────────────────────────────
const supabase =
  process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_SERVICE_KEY
    ? createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_KEY)
    : null;

if (supabase) {
  console.log("Supabase      : connected ✓");
} else {
  console.warn("Supabase      : not configured – DB への保存をスキップします");
}

// ── ユーティリティ ─────────────────────────────────────────────

const wait = ms => new Promise(r => setTimeout(r, ms));

async function apiFetch(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { "X-Auth-Token": API_KEY },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${path}\n  ${body.slice(0, 200)}`);
  }
  return res.json();
}

/** football-data.org のチームIDをアプリ内 ID にマップ（Liverpool/Arsenal のみ変換） */
function mapTeamId(fdId) {
  return TEAM_ID_MAP[fdId] ?? fdId;
}

// ── 既存 JSON の読み込み（フォールバック用）──────────────────────

function readExistingJson(slug, season) {
  try {
    const p = join(process.cwd(), "public", "data", `${slug}-${season}.json`);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

// ── API データ取得 ─────────────────────────────────────────────

/** シーズン全試合（FINISHED）を取得 */
async function fetchAllMatches(season) {
  console.log(`\n[matches] Fetching PL finished matches for ${season}...`);
  const json = await apiFetch(`/competitions/PL/matches?season=${season}&status=FINISHED`);
  const matches = json.matches ?? [];
  console.log(`[matches] Total: ${matches.length} matches`);
  return matches;
}

/** PL トップスコアラー（limit=20）を取得 */
async function fetchTopScorers(season) {
  await wait(7000);
  console.log(`[scorers] Fetching top scorers for ${season}...`);
  const json = await apiFetch(`/competitions/PL/scorers?season=${season}&limit=20`);
  return json.scorers ?? [];
}

/** 個別試合の詳細（--with-stats 時のみ呼び出し） */
async function fetchMatchDetail(matchId) {
  try {
    const json = await apiFetch(`/matches/${matchId}`);
    return {
      goals:         json.goals         ?? null,
      bookings:      json.bookings       ?? null,
      substitutions: json.substitutions ?? null,
      referees:      json.referees       ?? null,
    };
  } catch (e) {
    console.warn(`  [warn] match ${matchId}: ${e.message.split("\n")[0]}`);
    return null;
  }
}

// ── スタッツ集計 ───────────────────────────────────────────────

function calcFromMatches(fdId, legacyId, matches) {
  let scoredTotal = 0, concededTotal = 0;
  const recentForm = [];

  // 日付降順で並べ（直近フォーム算出用）
  const sorted = [...matches].sort(
    (a, b) => new Date(b.utcDate) - new Date(a.utcDate)
  );

  for (const m of sorted) {
    const isHome   = m.homeTeam.id === fdId;
    const scored   = isHome ? (m.score.fullTime.home ?? 0) : (m.score.fullTime.away ?? 0);
    const conceded = isHome ? (m.score.fullTime.away ?? 0) : (m.score.fullTime.home ?? 0);
    scoredTotal   += scored;
    concededTotal += conceded;
    if (recentForm.length < 5) {
      recentForm.push(scored > conceded ? "W" : scored < conceded ? "L" : "D");
    }
  }

  return {
    teamId: legacyId,
    season: SEASON,
    byTimeAvailable: false,
    scored:   { total: scoredTotal,   byTime: null },
    conceded: { total: concededTotal, byTime: null },
    home: {
      scored:   { total: null, byTime: null },
      conceded: { total: null, byTime: null },
    },
    away: {
      scored:   { total: null, byTime: null },
      conceded: { total: null, byTime: null },
    },
    recentForm,
  };
}

// ── Supabase upsert ───────────────────────────────────────────

async function upsertFixtures(teamId, fixturesForJson) {
  if (!supabase) return;

  const rows = fixturesForJson.map(f => ({
    id:             f.id,
    team_id:        f.team_id,
    season:         f.season,
    match_date:     f.match_date,
    home_team_id:   f.home_team_id,
    away_team_id:   f.away_team_id,
    home_team_name: f.home_team_name,
    away_team_name: f.away_team_name,
    goals_home:     f.goals_home,
    goals_away:     f.goals_away,
    ht_home:        f.ht_home,
    ht_away:        f.ht_away,
    status:         f.status,
  }));

  const { error } = await supabase
    .from("fixtures")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.warn(`  [supabase] upsert error: ${error.message}`);
  } else {
    console.log(`  [supabase] fixtures upserted: ${rows.length} rows`);
  }
}

// ── チームデータ処理 ───────────────────────────────────────────

async function processTeam(fdId, legacyId, slug, teamMatches, allScorers) {
  console.log(`\n[${slug}] Processing ${teamMatches.length} matches...`);

  // ── 個別試合スタッツ（--with-stats 時のみ）──
  const matchStats = {};
  if (WITH_STATS) {
    console.log(`[${slug}] Fetching individual match stats (${teamMatches.length} calls)...`);
    for (const m of teamMatches) {
      await wait(7000);
      const detail = await fetchMatchDetail(m.id);
      if (detail) matchStats[m.id] = detail;
    }
    console.log(`[${slug}] Stats fetched: ${Object.keys(matchStats).length} matches`);
  }

  // ── fixtures を JSON/Supabase 保存用フォーマットに変換 ──
  const fixturesForJson = teamMatches
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
    .map(m => ({
      id:             m.id,
      season:         SEASON,
      team_id:        legacyId,
      match_date:     m.utcDate,
      home_team_id:   mapTeamId(m.homeTeam.id),
      away_team_id:   mapTeamId(m.awayTeam.id),
      home_team_name: m.homeTeam.shortName ?? m.homeTeam.name,
      away_team_name: m.awayTeam.shortName ?? m.awayTeam.name,
      goals_home:     m.score.fullTime.home,
      goals_away:     m.score.fullTime.away,
      ht_home:        m.score.halfTime?.home  ?? null,
      ht_away:        m.score.halfTime?.away  ?? null,
      status:         "FT",
      ...(WITH_STATS && matchStats[m.id] ? { stats: matchStats[m.id] } : {}),
    }));

  // ── スコアラーをチームでフィルタ（PL top 20 から） ──
  const scorersFromApi = allScorers
    .filter(s => s.team.id === fdId)
    .map(s => ({
      id:          s.player.id,
      name:        s.player.name,
      photo:       null,   // football-data.org は選手写真を提供しない
      goals:       s.goals,
      assists:     s.assists ?? 0,
      appearances: s.playedMatches ?? null,
    }));

  // PL top-20 に含まれない場合は既存 JSON のスコアラーデータを流用
  let scorers = scorersFromApi;
  if (scorers.length === 0) {
    const existing = readExistingJson(slug, SEASON);
    if (existing?.scorers?.length > 0) {
      scorers = existing.scorers;
      console.log(`[${slug}] Scorers: 0 in top-20 → fallback to existing JSON (${scorers.length} scorers)`);
    } else {
      console.warn(`[${slug}] Scorers: 0 in top-20, no fallback data`);
    }
  } else {
    console.log(`[${slug}] Scorers: ${scorers.length} from top-20`);
  }

  // ── 集計 ──
  const coreData = calcFromMatches(fdId, legacyId, teamMatches);

  // ── Supabase upsert ──
  await upsertFixtures(legacyId, fixturesForJson);

  return { ...coreData, scorers, fixtures: fixturesForJson };
}

// ── エントリポイント ───────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.error("Error: FOOTBALL_DATA_API_KEY is not set");
    process.exit(1);
  }

  const outDir = join(process.cwd(), "public", "data");
  mkdirSync(outDir, { recursive: true });

  // ── 1. 全試合データを一括取得（1 API call）──
  const allMatches = await fetchAllMatches(SEASON);

  // ── 2. PL トップスコアラーを取得（1 API call）──
  const allScorers = await fetchTopScorers(SEASON);
  console.log(`[scorers] Total: ${allScorers.length}`);

  // ── 3. チームごとに処理・保存 ──
  for (const { fdId, legacyId, slug } of FD_TEAMS) {
    const teamMatches = allMatches.filter(
      m => m.homeTeam.id === fdId || m.awayTeam.id === fdId
    );
    console.log(`\n[${slug}] Matches found: ${teamMatches.length}`);

    if (teamMatches.length === 0) {
      console.warn(`[${slug}] No matches found, skipping`);
      continue;
    }

    const data = await processTeam(fdId, legacyId, slug, teamMatches, allScorers);

    const outPath = join(outDir, `${slug}-${SEASON}.json`);
    writeFileSync(outPath, JSON.stringify(data, null, 2));

    console.log(`\n✓ Saved: ${outPath}`);
    console.log(`  scored   : ${data.scored.total}`);
    console.log(`  conceded : ${data.conceded.total}`);
    console.log(`  diff     : ${data.scored.total - data.conceded.total >= 0 ? "+" : ""}${data.scored.total - data.conceded.total}`);
    console.log(`  form     : ${data.recentForm.join(" ")}`);
    console.log(`  scorers  : ${data.scorers.length}`);
    console.log(`  fixtures : ${data.fixtures.length}`);
  }

  console.log("\n✓ All done!");
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
