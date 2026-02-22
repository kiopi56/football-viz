// 時間帯の定義
// football-data.org のレスポンスにある minute をこの区分で振り分ける
const PERIODS = [
  { time: "0-15",  min: 0,   max: 15  },
  { time: "16-30", min: 16,  max: 30  },
  { time: "31-45", min: 31,  max: 45  },
  { time: "46-60", min: 46,  max: 60  },
  { time: "61-75", min: 61,  max: 75  },
  { time: "76-90", min: 76,  max: 999 }, // アディショナルタイムも含む
];

/**
 * 試合配列から「自チームの時間帯別失点数」を集計する
 *
 * football-data.org のゴールオブジェクト構造:
 * {
 *   minute: 83,
 *   scorer: { id: 1, name: "Player" },
 *   team: { id: 64, name: "Liverpool FC" },
 *   ...
 * }
 *
 * scorer.team.id が自チームの teamId と異なる
 *   = 相手チームがスコアした = 自チームの失点
 *
 * @param {Array} matches - getTeamMatches のレスポンスの matches 配列
 * @param {number} teamId - 自チームの ID
 * @returns {Array<{ time: string, goals: number }>}
 */
export function aggregateGoalsByTime(matches, teamId) {
  // 全試合のゴールをフラット化して「自チームの失点」だけ抽出する
  // flatMap = map + 1段階フラット化（配列の配列を1つの配列にまとめる）
  const concededGoals = matches.flatMap(match => {
    // goals が存在しない試合（データなし）は空配列を返す
    const goals = match.goals ?? [];

    // scorer.team.id が自チームと異なるゴール = 自チームの失点
    return goals.filter(goal => goal.team?.id !== teamId);
  });

  // 各時間帯に何失点あったか数える
  return PERIODS.map(period => ({
    time: period.time,
    goals: concededGoals.filter(
      goal => goal.minute >= period.min && goal.minute <= period.max
    ).length,
  }));
}
