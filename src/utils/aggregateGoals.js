/**
 * 試合配列から「自チームの前半/後半失点数」を集計する
 *
 * goals 配列は無料プランでは取得不可のため、
 * score.fullTime / score.halfTime を使って試合単位で集計する
 *
 * @param {Array} matches - getTeamMatches のレスポンスの matches 配列
 * @param {number} teamId - 自チームの ID
 * @returns {Array<{ time: string, goals: number }>}
 */
export function aggregateGoalsByPeriod(matches, teamId) {
  let firstHalf = 0;
  let secondHalf = 0;

  matches.forEach(match => {
    const isHome = match.homeTeam.id === teamId;
    const ftHome = match.score.fullTime.home ?? 0;
    const ftAway = match.score.fullTime.away ?? 0;
    const htHome = match.score.halfTime.home ?? 0;
    const htAway = match.score.halfTime.away ?? 0;

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
    { time: "前半", goals: firstHalf },
    { time: "後半", goals: secondHalf },
  ];
}
