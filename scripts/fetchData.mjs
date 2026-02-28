/**
 * scripts/fetchData.mjs
 *
 * api-sports.io からプレミアリーグ全チーム・複数シーズンのデータを取得し
 * public/data/{slug}-{season}.json として保存する。
 * Supabase の fixtures テーブルにも upsert する。
 *
 * 実行例:
 *   node scripts/fetchData.mjs                           # season=2024, 全チーム
 *   node scripts/fetchData.mjs --season=2025 --team=all  # 2025全チーム
 *   node scripts/fetchData.mjs --seasons=all             # 全11シーズン×全チーム
 *   node scripts/fetchData.mjs --with-stats              # fixture統計も取得
 *   node scripts/fetchData.mjs --season=2024 --team=liverpool
 *
 * 環境変数（.env から自動読み込み）:
 *   VITE_APISPORTS_KEY
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_SERVICE_KEY
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
const BASE_URL = "https://v3.football.api-sports.io";
const API_KEY  = process.env.VITE_APISPORTS_KEY;

const ALL_SEASONS = [2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025];

// チーム名 → スラッグ の補正テーブル（api-sports の名称に対応）
const SLUG_OVERRIDES = {
  "Manchester United":        "manchester-united",
  "Manchester City":          "manchester-city",
  "Nottingham Forest":        "nottingham-forest",
  "Brighton":                 "brighton",
  "Brighton & Hove Albion":   "brighton",
  "West Ham":                 "west-ham",
  "West Ham United":          "west-ham",
  "Tottenham":                "tottenham",
  "Tottenham Hotspur":        "tottenham",
  "Leicester":                "leicester",
  "Leicester City":           "leicester",
  "Leeds":                    "leeds",
  "Leeds United":             "leeds",
  "Sheffield Utd":            "sheffield-united",
  "Sheffield United":         "sheffield-united",
  "Aston Villa":              "aston-villa",
  "Crystal Palace":           "crystal-palace",
  "Wolverhampton Wanderers":  "wolverhampton",
  "Wolves":                   "wolverhampton",
  "Ipswich":                  "ipswich",
  "Luton":                    "luton",
  "Burnley":                  "burnley",
  "Huddersfield":             "huddersfield",
  "Huddersfield Town":        "huddersfield",
  "Stoke":                    "stoke",
  "Stoke City":               "stoke",
  "Sunderland":               "sunderland",
  "Swansea":                  "swansea",
  "Swansea City":             "swansea",
  "Watford":                  "watford",
  "West Brom":                "west-brom",
  "West Bromwich Albion":     "west-brom",
  "Wigan":                    "wigan",
  "Reading":                  "reading",
  "Middlesbrough":            "middlesbrough",
  "Hull":                     "hull",
  "Hull City":                "hull",
  "Cardiff":                  "cardiff",
  "Cardiff City":             "cardiff",
  "Norwich":                  "norwich",
  "Norwich City":             "norwich",
  "Blackburn":                "blackburn",
  "Blackburn Rovers":         "blackburn",
  "Queens Park Rangers":      "qpr",
  "QPR":                      "qpr",
};

function toSlug(name) {
  if (SLUG_OVERRIDES[name]) return SLUG_OVERRIDES[name];
  return name
    .toLowerCase()
    .replace(/\s+(fc|afc|city|united|town|rovers|athletic|wanderers|hotspur|albion|palace|villa|forest|county)$/i, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ── CLI 引数パース ────────────────────────────────────────────
const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith("--"))
    .map(a => {
      const [k, v] = a.slice(2).split("=");
      return [k, v ?? true];
    })
);

const WITH_STATS    = args["with-stats"] === true;
const TEAM_FILTER   = (args.team ?? "all").toLowerCase();  // "all" or slug
const SEASONS_RAW   = args.seasons ?? (args.season ? String(args.season) : "2024");
const TARGET_SEASONS =
  SEASONS_RAW === "all"
    ? ALL_SEASONS
    : SEASONS_RAW.split(",").map(Number).filter(n => !isNaN(n));

console.log(`\nSeasons   : ${TARGET_SEASONS.join(", ")}`);
console.log(`Team      : ${TEAM_FILTER}`);
console.log(`With stats: ${WITH_STATS}`);

// ── Supabase ──────────────────────────────────────────────────
const supabase =
  process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_SERVICE_KEY
    ? createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_SERVICE_KEY)
    : null;

console.log(`Supabase  : ${supabase ? "connected ✓" : "not configured (skip)"}`);

// ── ユーティリティ ─────────────────────────────────────────────
const wait = ms => new Promise(r => setTimeout(r, ms));

async function apiFetch(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: { "x-apisports-key": API_KEY } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
  const json = await res.json();
  const errors = json.errors;
  if (errors && !Array.isArray(errors) && Object.keys(errors).length > 0) {
    throw new Error(`API error: ${Object.values(errors)[0]}`);
  }
  return json;
}

// ── フィクスチャ取得 ──────────────────────────────────────────

/** シーズン全 FINISHED 試合を一括取得（1 API call） */
async function fetchSeasonFixtures(season) {
  const json = await apiFetch(`/fixtures?league=39&season=${season}&status=FT`);
  return json.response ?? [];
}

/** フィクスチャからユニークなチーム一覧を抽出 */
function extractTeams(fixtures) {
  const map = new Map();
  for (const fx of fixtures) {
    for (const side of ["home", "away"]) {
      const t = fx.teams[side];
      if (!map.has(t.id)) {
        map.set(t.id, { id: t.id, name: t.name, logo: t.logo, slug: toSlug(t.name) });
      }
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// ── 得点者取得 ─────────────────────────────────────────────────

async function fetchScorers(teamId, season) {
  const rows = [];
  let page = 1;
  while (page <= 3) {
    if (page > 1) await wait(500);
    const res = await apiFetch(`/players?team=${teamId}&season=${season}&league=39&page=${page}`);
    for (const item of res.response ?? []) {
      const stats = item.statistics?.[0];
      rows.push({
        id:          item.player.id,
        name:        item.player.name,
        photo:       item.player.photo,
        goals:       stats?.goals?.total    ?? 0,
        assists:     stats?.goals?.assists  ?? 0,
        appearances: stats?.games?.appearences ?? 0,
      });
    }
    if (!res.paging || res.paging.current >= res.paging.total) break;
    page++;
  }
  return rows
    .filter(r => r.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 15);
}

// ── 試合スタッツ取得 ───────────────────────────────────────────

/** fixture statistics レスポンスを {teamId: {shots,...}} マップに変換 */
function parseStats(response) {
  const result = {};
  for (const entry of response) {
    const teamId = entry.team.id;
    const statsArr = entry.statistics ?? [];
    const get = type => {
      const found = statsArr.find(s => s.type === type);
      const val = found?.value;
      if (val === null || val === undefined) return null;
      if (typeof val === "string" && val.endsWith("%")) return parseInt(val);
      return val;
    };
    result[teamId] = {
      shots_on_goal:     get("Shots on Goal"),
      shots_off_goal:    get("Shots off Goal"),
      total_shots:       get("Total Shots"),
      blocked_shots:     get("Blocked Shots"),
      corners:           get("Corner Kicks"),
      possession:        get("Ball Possession"),
      fouls:             get("Fouls"),
      yellow_cards:      get("Yellow Cards"),
      red_cards:         get("Red Cards"),
      saves:             get("Goalkeeper Saves"),
      total_passes:      get("Total passes"),
      pass_accuracy:     get("Passes %"),
    };
  }
  return result;
}

async function fetchFixtureStats(fixtureId) {
  try {
    const json = await apiFetch(`/fixtures/statistics?fixture=${fixtureId}`);
    return parseStats(json.response ?? []);
  } catch (e) {
    console.warn(`    [warn] stats ${fixtureId}: ${e.message}`);
    return {};
  }
}

// ── Supabase upsert ───────────────────────────────────────────

async function upsertFixtures(rows) {
  if (!supabase || rows.length === 0) return;
  const { error } = await supabase
    .from("fixtures")
    .upsert(rows, { onConflict: "id" });
  if (error) {
    console.warn(`  [supabase] upsert error: ${error.message}`);
  } else {
    console.log(`  [supabase] upserted: ${rows.length} fixtures`);
  }
}

// ── スコア集計 ─────────────────────────────────────────────────

function calcFromFixtures(teamId, fixtures) {
  let scoredTotal = 0, concededTotal = 0;
  const recentForm = [];

  const sorted = [...fixtures].sort(
    (a, b) => new Date(b.fixture.date) - new Date(a.fixture.date)
  );

  for (const fx of sorted) {
    const isHome   = fx.teams.home.id === teamId;
    const scored   = isHome ? (fx.goals.home ?? 0) : (fx.goals.away ?? 0);
    const conceded = isHome ? (fx.goals.away ?? 0) : (fx.goals.home ?? 0);
    scoredTotal   += scored;
    concededTotal += conceded;
    if (recentForm.length < 5) {
      recentForm.push(scored > conceded ? "W" : scored < conceded ? "L" : "D");
    }
  }

  return {
    byTimeAvailable: false,
    scored:   { total: scoredTotal,   byTime: null },
    conceded: { total: concededTotal, byTime: null },
    home:     { scored: { total: null, byTime: null }, conceded: { total: null, byTime: null } },
    away:     { scored: { total: null, byTime: null }, conceded: { total: null, byTime: null } },
    recentForm,
  };
}

// ── JSON 変換 ──────────────────────────────────────────────────

function toFixtureRow(fx, teamId, season, statsMap) {
  const homeId = fx.teams.home.id;
  const awayId = fx.teams.away.id;
  const homeStats = statsMap?.[homeId] ?? null;
  const awayStats = statsMap?.[awayId] ?? null;

  return {
    id:             fx.fixture.id,
    season,
    team_id:        teamId,
    match_date:     fx.fixture.date,
    home_team_id:   homeId,
    away_team_id:   awayId,
    home_team_name: fx.teams.home.name,
    away_team_name: fx.teams.away.name,
    goals_home:     fx.goals.home,
    goals_away:     fx.goals.away,
    ht_home:        fx.score?.halftime?.home ?? null,
    ht_away:        fx.score?.halftime?.away ?? null,
    status:         fx.fixture.status.short,
    ...(homeStats || awayStats
      ? { stats_home: homeStats, stats_away: awayStats }
      : {}),
  };
}

// ── メイン ────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.error("Error: VITE_APISPORTS_KEY is not set");
    process.exit(1);
  }

  const outDir = join(process.cwd(), "public", "data");
  mkdirSync(outDir, { recursive: true });

  let totalFiles = 0;
  let totalApiCalls = 0;

  for (const [si, season] of TARGET_SEASONS.entries()) {
    if (si > 0) await wait(1000);

    console.log(`\n${"=".repeat(60)}`);
    console.log(`SEASON ${season} (${season}-${String(season + 1).slice(-2)})`);
    console.log("=".repeat(60));

    // ── 1. 全 FINISHED 試合を一括取得 ──
    console.log(`[fixtures] Fetching all FT matches...`);
    let allFixtures;
    try {
      allFixtures = await fetchSeasonFixtures(season);
      totalApiCalls++;
    } catch (e) {
      console.error(`[fixtures] Failed: ${e.message}`);
      continue;
    }
    console.log(`[fixtures] ${allFixtures.length} matches found`);

    if (allFixtures.length === 0) {
      console.warn(`[fixtures] No matches – skipping season ${season}`);
      continue;
    }

    // ── 2. チーム一覧を抽出 ──
    const allTeams = extractTeams(allFixtures);
    const teams = TEAM_FILTER === "all"
      ? allTeams
      : allTeams.filter(t => t.slug === TEAM_FILTER || t.name.toLowerCase() === TEAM_FILTER);

    if (teams.length === 0) {
      console.warn(`[teams] No team matched "${TEAM_FILTER}" in season ${season}`);
      continue;
    }
    console.log(`[teams] ${teams.length} teams to process`);

    // ── 3. fixture statistics 取得（--with-stats のみ） ──
    const fixtureStatsMap = {}; // fixtureId → {homeId: stats, awayId: stats}
    if (WITH_STATS) {
      console.log(`[stats] Fetching statistics for ${allFixtures.length} fixtures...`);
      for (const [i, fx] of allFixtures.entries()) {
        await wait(500);
        fixtureStatsMap[fx.fixture.id] = await fetchFixtureStats(fx.fixture.id);
        totalApiCalls++;
        if ((i + 1) % 50 === 0) {
          console.log(`  ${i + 1}/${allFixtures.length} done`);
        }
      }
    }

    // ── 4. Supabase upsert 用の全試合行（一括） ──
    const supabaseRows = allFixtures.map(fx => ({
      id:             fx.fixture.id,
      season,
      team_id:        fx.teams.home.id,  // home チーム視点
      match_date:     fx.fixture.date,
      home_team_id:   fx.teams.home.id,
      away_team_id:   fx.teams.away.id,
      home_team_name: fx.teams.home.name,
      away_team_name: fx.teams.away.name,
      goals_home:     fx.goals.home,
      goals_away:     fx.goals.away,
      ht_home:        fx.score?.halftime?.home ?? null,
      ht_away:        fx.score?.halftime?.away ?? null,
      status:         fx.fixture.status.short,
    }));
    await upsertFixtures(supabaseRows);

    // ── 5. チームごとに JSON 生成 ──
    for (const [ti, team] of teams.entries()) {
      if (ti > 0) await wait(500);

      const teamFx = allFixtures.filter(
        fx => fx.teams.home.id === team.id || fx.teams.away.id === team.id
      );

      if (teamFx.length === 0) {
        console.warn(`  [${team.slug}] No fixtures found, skipping`);
        continue;
      }

      // スコアラー取得
      let scorers = [];
      try {
        await wait(500);
        scorers = await fetchScorers(team.id, season);
        totalApiCalls += 2; // 平均2ページ
      } catch (e) {
        console.warn(`  [${team.slug}] Scorers failed: ${e.message}`);
      }

      // JSON 用 fixtures 配列
      const fixturesForJson = teamFx
        .sort((a, b) => new Date(b.fixture.date) - new Date(a.fixture.date))
        .map(fx => toFixtureRow(fx, team.id, season, fixtureStatsMap[fx.fixture.id]));

      // 集計
      const agg = calcFromFixtures(team.id, teamFx);

      const data = {
        teamId: team.id,
        season,
        ...agg,
        scorers,
        fixtures: fixturesForJson,
      };

      const outPath = join(outDir, `${team.slug}-${season}.json`);
      writeFileSync(outPath, JSON.stringify(data, null, 2));
      totalFiles++;

      console.log(
        `  ✓ ${team.slug}-${season}.json` +
        `  scored=${agg.scored.total} conceded=${agg.conceded.total}` +
        `  scorers=${scorers.length} fixtures=${teamFx.length}`
      );
    }

    // ── 6. pl-teams-{season}.json 更新（season=2024 のみ） ──
    if (season === 2024) {
      const teamsData = allTeams.map(t => ({
        id:        t.id,
        name:      t.name,
        shortName: t.name,
        slug:      t.slug,
        logo:      t.logo,
        hasData:   true,
      }));
      const teamsPath = join(outDir, "pl-teams-2024.json");
      writeFileSync(teamsPath, JSON.stringify(teamsData, null, 2));
      console.log(`\n✓ Saved pl-teams-2024.json (${teamsData.length} teams)`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`✓ Done! Files: ${totalFiles}  API calls: ${totalApiCalls}+`);
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
