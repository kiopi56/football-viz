/**
 * scripts/fetchData.mjs
 *
 * ビルド前に実行するデータ取得スクリプト。
 * api-sports.io から Liverpool / Arsenal の試合イベントデータを取得し、
 * 時間帯別得失点・ホーム/アウェイ別・直近フォームを集計して
 * public/data/ に JSON として保存する。
 *
 * 実行: npm run fetch-data
 * 環境変数: VITE_APISPORTS_KEY
 *
 * 出力ファイル:
 *   public/data/{slug}-{season}.json  ← チーム詳細データ
 *   public/data/pl-teams-2024.json    ← PLチーム一覧
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = "https://v3.football.api-sports.io";
const API_KEY  = process.env.VITE_APISPORTS_KEY;

// 取得対象チーム × シーズン
const TEAMS = [
  { id: 40, slug: "liverpool", season: 2024 },
  { id: 40, slug: "liverpool", season: 2023 },
  { id: 42, slug: "arsenal",   season: 2024 },
  { id: 42, slug: "arsenal",   season: 2023 },
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

// ── イベントAPIでの集計（2024シーズン向け） ───────────────────

async function fetchByEvents(teamId, fixtures) {
  // scored/conceded × all/home/away の counts
  const counts = {
    scored:   { all: zeroCounts(), home: zeroCounts(), away: zeroCounts() },
    conceded: { all: zeroCounts(), home: zeroCounts(), away: zeroCounts() },
  };

  for (let i = 0; i < fixtures.length; i++) {
    const fix = fixtures[i];
    const fixtureId = fix.fixture.id;
    const isHome = fix.teams.home.id === teamId; // このチームがホームか

    await wait(7000); // 10 req/min 対策

    const eventsRes = await apiFetch(`/fixtures/events?fixture=${fixtureId}`);
    const events    = eventsRes.response;

    for (const event of events) {
      if (event.type !== "Goal") continue;
      if (event.detail !== "Normal Goal" && event.detail !== "Penalty") continue;

      const elapsed  = event.time.elapsed;
      const idx      = getPeriodIndex(elapsed);
      const isOurGoal = event.team.id === teamId;
      const venue    = isHome ? "home" : "away";

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
  // イベントデータなしの場合、前半(0-45)と後半(45-90)のみ集計
  // byTime は null を返してUIに「データ不足」と知らせる
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

  // 直近5試合フォーム（新しい順）
  const recentForm = fixtures.slice(0, 5).map(fix => {
    const isHome = fix.teams.home.id === teamId;
    const scored   = isHome ? (fix.goals.home ?? 0) : (fix.goals.away ?? 0);
    const conceded = isHome ? (fix.goals.away ?? 0) : (fix.goals.home ?? 0);
    return scored > conceded ? "W" : scored < conceded ? "L" : "D";
  });

  // イベントデータ取得を試みる
  let byTimeAvailable = true;
  let evCounts;
  try {
    console.log(`[${slug}-${season}] Fetching events for ${fixtures.length} fixtures...`);
    evCounts = await fetchByEvents(teamId, fixtures);
  } catch (err) {
    console.warn(`[${slug}-${season}] Events fetch failed (${err.message}), falling back to score only`);
    return fetchByScore(teamId, fixtures);
  }

  // ── 集計まとめ ──
  const sumAll = (c) => Object.values(c).reduce((s, v) => s + v, 0);

  const scoredAll   = countsToObj(evCounts.scored.all);
  const concededAll = countsToObj(evCounts.conceded.all);
  const scoredHome  = countsToObj(evCounts.scored.home);
  const concededHome= countsToObj(evCounts.conceded.home);
  const scoredAway  = countsToObj(evCounts.scored.away);
  const concededAway= countsToObj(evCounts.conceded.away);

  return {
    teamId,
    season,
    byTimeAvailable: true,
    recentForm,
    // 全試合
    scored:   { total: sumAll(scoredAll),   byTime: scoredAll   },
    conceded: { total: sumAll(concededAll), byTime: concededAll },
    // ホームのみ
    home: {
      scored:   { total: sumAll(scoredHome),   byTime: scoredHome   },
      conceded: { total: sumAll(concededHome), byTime: concededHome },
    },
    // アウェイのみ
    away: {
      scored:   { total: sumAll(scoredAway),   byTime: scoredAway   },
      conceded: { total: sumAll(concededAway), byTime: concededAway },
    },
    // 後方互換（useTeamGoals の byPeriod フォーマット）
    byPeriod: PERIOD_KEYS.map(k => ({ time: k, goals: concededAll[k] })),
  };
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

  // ── PLチーム一覧を保存 ───────────────────────────────────────
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

  console.log("\n✓ All done!");
}

main().catch((err) => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
