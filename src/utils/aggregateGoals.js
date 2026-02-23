/**
 * api-sports.io のフィクスチャ配列から「自チームの前半/後半失点数」を集計する
 *
 * api-sports レスポンス構造:
 * {
 *   teams:  { home: { id }, away: { id } },
 *   goals:  { home: N, away: N },          // フルタイム
 *   score:  { halftime: { home: N, away: N } }
 * }
 *
 * @param {Array} fixtures - getTeamFixtures のレスポンスの response 配列
 * @param {number} teamId  - 自チームの ID
 * @returns {Array<{ time: string, goals: number }>}
 */
export function aggregateGoalsByPeriod(fixtures, teamId) {
  let firstHalf  = 0;
  let secondHalf = 0;

  fixtures.forEach(fixture => {
    const isHome = fixture.teams.home.id === teamId;

    const ftHome = fixture.goals.home      ?? 0;
    const ftAway = fixture.goals.away      ?? 0;
    const htHome = fixture.score.halftime.home ?? 0;
    const htAway = fixture.score.halftime.away ?? 0;

    if (isHome) {
      // 自チームがホーム → 相手（away）の得点が自チームの失点
      firstHalf  += htAway;
      secondHalf += (ftAway - htAway);
    } else {
      // 自チームがアウェイ → 相手（home）の得点が自チームの失点
      firstHalf  += htHome;
      secondHalf += (ftHome - htHome);
    }
  });

  return [
    { time: "前半", goals: firstHalf  },
    { time: "後半", goals: secondHalf },
  ];
}
