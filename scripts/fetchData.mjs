/**
 * scripts/fetchData.mjs
 *
 * ビルド前に実行するデータ取得スクリプト。
 * api-sports.io から Liverpool / Arsenal の試合イベントデータを取得し、
 * 時間帯別失点を集計して public/data/ に JSON として保存する。
 *
 * 実行: npm run fetch-data
 * 環境変数: VITE_APISPORTS_KEY
 */

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const BASE_URL = "https://v3.football.api-sports.io";
const API_KEY  = process.env.VITE_APISPORTS_KEY;

// 取得対象チーム
const TEAMS = [
  { id: 40, slug: "liverpool", season: 2024 },
  { id: 42, slug: "arsenal",   season: 2024 },
];

// 6時間帯定義
const PERIODS = [
  { time: "0-15",  min: 1,  max: 15  },
  { time: "16-30", min: 16, max: 30  },
  { time: "31-45", min: 31, max: 45  },
  { time: "46-60", min: 46, max: 60  },
  { time: "61-75", min: 61, max: 75  },
  { time: "76-90", min: 76, max: 999 }, // アディショナルタイムも含む
];

// ── ユーティリティ ───────────────────────────────────────────

async function apiFetch(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-apisports-key": API_KEY },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

  const json = await res.json();

  // api-sports はエラーをボディに含める場合がある
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
  return 5; // 76分以上（AT含む）
}

// ── チームデータ取得 ─────────────────────────────────────────

async function fetchTeamData(teamId, slug, season) {
  console.log(`\n[${slug}] Fetching fixtures (team=${teamId}, season=${season})...`);

  const fixturesRes = await apiFetch(
    `/fixtures?team=${teamId}&season=${season}&status=FT&league=39`
  );
  const fixtures = fixturesRes.response;
  console.log(`[${slug}] Found ${fixtures.length} fixtures`);

  const counts    = [0, 0, 0, 0, 0, 0];
  let   totalGoals = 0;

  for (let i = 0; i < fixtures.length; i++) {
    const fixtureId = fixtures[i].fixture.id;
    console.log(`[${slug}] Events fixture ${fixtureId} (${i + 1}/${fixtures.length})`);

    await wait(7000); // rate limit 対策（10 req/min = 6s間隔が必要）

    const eventsRes = await apiFetch(`/fixtures/events?fixture=${fixtureId}`);
    const events    = eventsRes.response;

    for (const event of events) {
      if (event.type !== "Goal") continue;
      if (event.detail !== "Normal Goal" && event.detail !== "Penalty") continue;
      if (event.team.id === teamId) continue; // 自チームの得点 = 失点ではない

      const elapsed = event.time.elapsed;
      const idx     = getPeriodIndex(elapsed);
      counts[idx]++;
      totalGoals++;
    }
  }

  return {
    teamId,
    season,
    totalGoals,
    byPeriod: PERIODS.map((p, i) => ({ time: p.time, goals: counts[i] })),
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
    const data    = await fetchTeamData(team.id, team.slug, team.season);
    const outPath = join(outDir, `${team.slug}-${team.season}.json`);

    writeFileSync(outPath, JSON.stringify(data, null, 2));
    console.log(`\n✓ Saved: ${outPath}`);
    console.log(`  Total conceded: ${data.totalGoals}`);
    data.byPeriod.forEach((p) => console.log(`  ${p.time}: ${p.goals}`));
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
      hasData:   TEAMS.some(t => t.id === item.team.id),
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
