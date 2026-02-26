/**
 * scripts/fetchData.mjs
 *
 * ビルド前に実行するデータ取得スクリプト。
 * api-sports.io から Liverpool / Arsenal の試合イベントデータを取得し、
 * 時間帯別得失点・ホーム/アウェイ別・直近フォームを集計して
 * public/data/ に JSON として保存する。
 * 同時に Supabase の fixtures / goal_events テーブルにも upsert する。
 *
 * 実行例:
 *   node scripts/fetchData.mjs              # 2024シーズン（デフォルト）
 *   node scripts/fetchData.mjs --season=2022
 *
 * 環境変数（.env から自動読み込み）:
 *   VITE_APISPORTS_KEY
 *   VITE_SUPABASE_URL
 *   VITE_SUPABASE_ANON_KEY
 *
 * 出力ファイル:
 *   public/data/{slug}-{season}.json  ← チーム詳細データ
 *   public/data/pl-teams-2024.json    ← PLチーム一覧（season=2024 のみ）
 */

import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";

// ── .env ファイル読み込み（process.env の既存値は上書きしない）──────
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

const BASE_URL = "https://v3.football.api-sports.io";
const API_KEY  = process.env.VITE_APISPORTS_KEY;

// ── Supabase クライアント（service_role キーで RLS をバイパス）────
const supabase =
  process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_SERVICE_KEY
    ? createClient(
        process.env.VITE_SUPABASE_URL,
        process.env.VITE_SUPABASE_SERVICE_KEY
      )
    : null;

if (supabase) {
  console.log("Supabase: connected ✓");
} else {
  console.warn("Supabase: not configured – DB への保存をスキップします");
}

// ── コマンドライン引数からシーズンを取得 ────────────────────────
const seasonArg = process.argv.find(a => a.startsWith("--season="));
const SEASON = seasonArg ? Number(seasonArg.split("=")[1]) : 2024;

if (isNaN(SEASON) || SEASON < 2020 || SEASON > 2030) {
  console.error(`Error: Invalid season "${seasonArg?.split("=")[1]}". Example: --season=2022`);
  process.exit(1);
}

console.log(`\nTarget season: ${SEASON} (${SEASON}-${String(SEASON + 1).slice(-2)})`);

// 取得対象チーム（指定シーズンの Liverpool + Arsenal のみ）
const TEAMS = [
  { id: 40, slug: "liverpool", season: SEASON },
  { id: 42, slug: "arsenal",   season: SEASON },
];

// 6時間帯定義
const PERIOD_KEYS = ["0-15", "16-30", "31-45", "46-60", "61-75", "76-90"];

// ── ユーティリティ ───────────────────────────────────────────

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-apisports-key": API_KEY },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const json = await res.json();

  const errors = json.errors;
  if (errors && !Array.isArray(errors) && Object.keys(errors).length > 0) {
    throw new Error(`API error: ${Object.values(errors)[0]}`);
  }
  return json;
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function getPeriodIndex(elapsed) {
  if (elapsed <= 15) return 0;
  if (elapsed <= 30) return 1;
  if (elapsed <= 45) return 2;
  if (elapsed <= 60) return 3;
  if (elapsed <= 75) return 4;
  return 5;
}

/** カウント配列 [0,0,0,0,0,0] を初期化して返す */
function zeroCounts() { return [0, 0, 0, 0, 0, 0]; }

/** counts 配列 → { "0-15": N, ... } オブジェクト */
function countsToObj(counts) {
  return Object.fromEntries(PERIOD_KEYS.map((k, i) => [k, counts[i]]));
}

// ── Supabase: fixtures テーブルへ upsert ─────────────────────────

async function upsertFixtures(teamId, season, fixtures) {
  if (!supabase) return;

  const rows = fixtures.map(fix => ({
    id:             fix.fixture.id,
    team_id:        teamId,
    season:         season,
    match_date:     fix.fixture.date,
    home_team_id:   fix.teams.home.id,
    away_team_id:   fix.teams.away.id,
    home_team_name: fix.teams.home.name,
    away_team_name: fix.teams.away.name,
    goals_home:     fix.goals.home,
    goals_away:     fix.goals.away,
    ht_home:        fix.score?.halftime?.home ?? null,
    ht_away:        fix.score?.halftime?.away ?? null,
    status:         fix.fixture.status.short,
  }));

  const { error } = await supabase
    .from("fixtures")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.warn(`  [supabase] fixtures upsert error: ${error.message}`);
  } else {
    console.log(`  [supabase] fixtures upserted: ${rows.length} rows`);
  }
}

// ── Supabase: goal_events テーブルへ upsert ──────────────────────

async function upsertGoalEvents(fixtureId, events) {
  if (!supabase || events.length === 0) return;

  // id: fixture_id + index の複合キー（同一試合内の重複を防ぐ）
  const rows = events.map((event, i) => ({
    id:           `${fixtureId}_${i}`,
    fixture_id:   fixtureId,
    team_id:      event.team.id,
    minute:       event.time.elapsed,
    extra_minute: event.time.extra ?? null,
    type:         event.type,
    detail:       event.detail,
  }));

  const { error } = await supabase
    .from("goal_events")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    console.warn(`  [supabase] goal_events upsert error (fixture ${fixtureId}): ${error.message}`);
  }
}

// ── 得点者データ取得 ─────────────────────────────────────────

async function fetchScorers(teamId, season) {
  const rows = [];
  let page = 1;
  while (page <= 3) {
    if (page > 1) await wait(7000);
    const res = await apiFetch(
      `/players?team=${teamId}&season=${season}&league=39&page=${page}`
    );
    for (const item of res.response) {
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
    if (res.paging.current >= res.paging.total) break;
    page++;
  }
  return rows
    .filter(r => r.goals > 0)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 15);
}

// ── イベントAPIでの集計 ───────────────────────────────────────

async function fetchByEvents(teamId, fixtures) {
  // scored/conceded × all/home/away の counts
  const counts = {
    scored:   { all: zeroCounts(), home: zeroCounts(), away: zeroCounts() },
    conceded: { all: zeroCounts(), home: zeroCounts(), away: zeroCounts() },
  };

  for (let i = 0; i < fixtures.length; i++) {
    const fix = fixtures[i];
    const fixtureId = fix.fixture.id;
    const isHome = fix.teams.home.id === teamId;

    await wait(7000); // 10 req/min 対策

    const eventsRes = await apiFetch(`/fixtures/events?fixture=${fixtureId}`);
    const events    = eventsRes.response;

    // Supabase に全イベントを保存
    await upsertGoalEvents(fixtureId, events);

    for (const event of events) {
      if (event.type !== "Goal") continue;
      if (event.detail !== "Normal Goal" && event.detail !== "Penalty") continue;

      const elapsed   = event.time.elapsed;
      const idx       = getPeriodIndex(elapsed);
      const isOurGoal = event.team.id === teamId;
      const venue     = isHome ? "home" : "away";

      if (isOurGoal) {
        counts.scored.all[idx]++;
        counts.scored[venue][idx]++;
      } else {
        counts.conceded.all[idx]++;
        counts.conceded[venue][idx]++;
      }
    }
  }

  return counts;
}

// ── score.halftime / fulltime からの集計（イベントが取れない場合） ──

function fetchByScore(teamId, fixtures) {
  let scoredTotal = 0, concededTotal = 0;
  const recentForm = [];

  for (const fix of fixtures) {
    const isHome = fix.teams.home.id === teamId;
    const scored   = isHome ? (fix.goals.home ?? 0) : (fix.goals.away ?? 0);
    const conceded = isHome ? (fix.goals.away ?? 0) : (fix.goals.home ?? 0);
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

// ── チームデータ取得メイン ─────────────────────────────────────

async function fetchTeamData(teamId, slug, season) {
  console.log(`\n[${slug}-${season}] Fetching fixtures...`);

  const fixturesRes = await apiFetch(
    `/fixtures?team=${teamId}&season=${season}&status=FT&league=39`
  );
  // 新しい試合順に並べ替え（フォーム算出用）
  const fixtures = fixturesRes.response.sort(
    (a, b) => new Date(b.fixture.date) - new Date(a.fixture.date)
  );
  console.log(`[${slug}-${season}] Found ${fixtures.length} fixtures`);

  if (fixtures.length === 0) {
    console.warn(`[${slug}-${season}] No fixtures found, skipping`);
    return null;
  }

  // Supabase: fixtures テーブルへ保存
  await upsertFixtures(teamId, season, fixtures);

  // 直近5試合フォーム（新しい順）
  const recentForm = fixtures.slice(0, 5).map(fix => {
    const isHome = fix.teams.home.id === teamId;
    const scored   = isHome ? (fix.goals.home ?? 0) : (fix.goals.away ?? 0);
    const conceded = isHome ? (fix.goals.away ?? 0) : (fix.goals.home ?? 0);
    return scored > conceded ? "W" : scored < conceded ? "L" : "D";
  });

  // イベントデータ取得を試みる
  let coreData;
  try {
    console.log(`[${slug}-${season}] Fetching events for ${fixtures.length} fixtures...`);
    const evCounts = await fetchByEvents(teamId, fixtures);

    // ── 集計まとめ ──
    const sumAll = (c) => Object.values(c).reduce((s, v) => s + v, 0);

    const scoredAll    = countsToObj(evCounts.scored.all);
    const concededAll  = countsToObj(evCounts.conceded.all);
    const scoredHome   = countsToObj(evCounts.scored.home);
    const concededHome = countsToObj(evCounts.conceded.home);
    const scoredAway   = countsToObj(evCounts.scored.away);
    const concededAway = countsToObj(evCounts.conceded.away);

    coreData = {
      teamId,
      season,
      byTimeAvailable: true,
      recentForm,
      scored:   { total: sumAll(scoredAll),   byTime: scoredAll   },
      conceded: { total: sumAll(concededAll), byTime: concededAll },
      home: {
        scored:   { total: sumAll(scoredHome),   byTime: scoredHome   },
        conceded: { total: sumAll(concededHome), byTime: concededHome },
      },
      away: {
        scored:   { total: sumAll(scoredAway),   byTime: scoredAway   },
        conceded: { total: sumAll(concededAway), byTime: concededAway },
      },
      byPeriod: PERIOD_KEYS.map(k => ({ time: k, goals: concededAll[k] })),
    };
  } catch (err) {
    console.warn(`[${slug}-${season}] Events fetch failed (${err.message}), falling back to score only`);
    coreData = fetchByScore(teamId, fixtures);
  }

  // 得点者データ取得（イベント取得成否に関わらず実行）
  let scorers = [];
  try {
    await wait(7000);
    console.log(`[${slug}-${season}] Fetching scorers...`);
    scorers = await fetchScorers(teamId, season);
    console.log(`[${slug}-${season}] Found ${scorers.length} scorers`);
  } catch (err) {
    console.warn(`[${slug}-${season}] Scorers fetch failed: ${err.message}`);
  }

  // fixtures を Supabase と同じ shape で JSON にも保存（フォールバック用）
  const fixturesForJson = fixtures.map(fix => ({
    id:             fix.fixture.id,
    season,
    team_id:        teamId,
    match_date:     fix.fixture.date,
    home_team_id:   fix.teams.home.id,
    away_team_id:   fix.teams.away.id,
    home_team_name: fix.teams.home.name,
    away_team_name: fix.teams.away.name,
    goals_home:     fix.goals.home,
    goals_away:     fix.goals.away,
    ht_home:        fix.score?.halftime?.home ?? null,
    ht_away:        fix.score?.halftime?.away ?? null,
    status:         fix.fixture.status.short,
  }));

  return { ...coreData, scorers, fixtures: fixturesForJson };
}

// ── エントリポイント ─────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.error("Error: VITE_APISPORTS_KEY is not set");
    process.exit(1);
  }

  const outDir = join(process.cwd(), "public", "data");
  mkdirSync(outDir, { recursive: true });

  for (const team of TEAMS) {
    const data = await fetchTeamData(team.id, team.slug, team.season);
    if (!data) continue;

    const outPath = join(outDir, `${team.slug}-${team.season}.json`);
    writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`\n✓ Saved: ${outPath}`);
    if (data.byTimeAvailable) {
      console.log(`  scored total  : ${data.scored.total}`);
      console.log(`  conceded total: ${data.conceded.total}`);
    } else {
      console.log(`  (byTime not available – score fallback)`);
      console.log(`  scored total  : ${data.scored.total}`);
      console.log(`  conceded total: ${data.conceded.total}`);
    }
    console.log(`  recentForm: ${data.recentForm.join(" ")}`);
  }

  // ── PLチーム一覧を保存（2024シーズン指定時のみ・API節約）───────
  if (SEASON === 2024) {
    console.log("\n[teams] Fetching PL team list...");
    await wait(7000);
    const teamsRes = await apiFetch(`/teams?league=39&season=2024`);
    const teamsData = teamsRes.response
      .map(item => ({
        id:        item.team.id,
        name:      item.team.name,
        shortName: item.team.code || item.team.name.slice(0, 3).toUpperCase(),
        logo:      item.team.logo,
        hasData:   [40, 42].includes(item.team.id),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const teamsPath = join(outDir, "pl-teams-2024.json");
    writeFileSync(teamsPath, JSON.stringify(teamsData, null, 2));
    console.log(`✓ Saved: ${teamsPath} (${teamsData.length} teams)`);
  } else {
    console.log(`\n[teams] Skipping team list fetch (season=${SEASON}, not 2024)`);
  }

  console.log("\n✓ All done!");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
