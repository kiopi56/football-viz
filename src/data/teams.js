/**
 * プレミアリーグ チームマスターデータ
 * current: true → 2025-26シーズン在籍チーム（*-2025.json が存在するもの）
 */
export const TEAMS = [
  // ── 2025-26 在籍チーム（20チーム） ──
  { id: 42,   slug: "arsenal",           name: "Arsenal",           shortName: "ARS", color: "#EF0107", emoji: "🔴", current: true },
  { id: 66,   slug: "aston-villa",       name: "Aston Villa",       shortName: "AVL", color: "#95BFE5", emoji: "🟣", current: true },
  { id: 35,   slug: "bournemouth",       name: "Bournemouth",       shortName: "BOU", color: "#DA291C", emoji: "🔴", current: true },
  { id: 55,   slug: "brentford",         name: "Brentford",         shortName: "BRE", color: "#E30613", emoji: "🔴", current: true },
  { id: 51,   slug: "brighton",          name: "Brighton",          shortName: "BHA", color: "#0057B8", emoji: "🔵", current: true },
  { id: 44,   slug: "burnley",           name: "Burnley",           shortName: "BUR", color: "#6C1D45", emoji: "🟣", current: true },
  { id: 49,   slug: "chelsea",           name: "Chelsea",           shortName: "CHE", color: "#034694", emoji: "🔵", current: true },
  { id: 52,   slug: "crystal-palace",    name: "Crystal Palace",    shortName: "CRY", color: "#C4122E", emoji: "🔴", current: true },
  { id: 45,   slug: "everton",           name: "Everton",           shortName: "EVE", color: "#274488", emoji: "🔵", current: true },
  { id: 36,   slug: "fulham",            name: "Fulham",            shortName: "FUL", color: "#CC0000", emoji: "⚫", current: true },
  { id: 63,   slug: "leeds",             name: "Leeds United",      shortName: "LEE", color: "#1D428A", emoji: "⚪", current: true },
  { id: 40,   slug: "liverpool",         name: "Liverpool",         shortName: "LIV", color: "#C8102E", emoji: "🔴", current: true },
  { id: 50,   slug: "manchester-city",   name: "Manchester City",   shortName: "MCI", color: "#6CABDD", emoji: "🔵", current: true },
  { id: 33,   slug: "manchester-united", name: "Manchester United", shortName: "MUN", color: "#DA020E", emoji: "🔴", current: true },
  { id: 34,   slug: "newcastle",         name: "Newcastle",         shortName: "NEW", color: "#00A4E4", emoji: "⚫", current: true },
  { id: 65,   slug: "nottingham-forest", name: "Nottm Forest",      shortName: "NFO", color: "#DD0000", emoji: "🔴", current: true },
  { id: 746,  slug: "sunderland",        name: "Sunderland",        shortName: "SUN", color: "#EB172B", emoji: "🔴", current: true },
  { id: 47,   slug: "tottenham",         name: "Tottenham",         shortName: "TOT", color: "#132257", emoji: "⚪", current: true },
  { id: 48,   slug: "west-ham",          name: "West Ham",          shortName: "WHU", color: "#7A263A", emoji: "🟣", current: true },
  { id: 39,   slug: "wolverhampton",     name: "Wolves",            shortName: "WOL", color: "#FDB913", emoji: "🟡", current: true },

  // ── 過去在籍チーム（降格・解散等） ──
  { id: 57,   slug: "ipswich",           name: "Ipswich Town",      shortName: "IPS", color: "#0044A9", emoji: "🔵", current: false },
  { id: 46,   slug: "leicester",         name: "Leicester City",    shortName: "LEI", color: "#003090", emoji: "🔵", current: false },
  { id: 41,   slug: "southampton",       name: "Southampton",       shortName: "SOU", color: "#D71920", emoji: "🔴", current: false },
  { id: 71,   slug: "norwich",           name: "Norwich City",      shortName: "NOR", color: "#00A650", emoji: "🟡", current: false },
  { id: 62,   slug: "sheffield-united",  name: "Sheffield United",  shortName: "SHU", color: "#EE2737", emoji: "🔴", current: false },
  { id: 1359, slug: "luton",             name: "Luton Town",        shortName: "LUT", color: "#F78F1E", emoji: "🟠", current: false },
  { id: 38,   slug: "watford",           name: "Watford",           shortName: "WAT", color: "#FBEE23", emoji: "🟡", current: false },
  { id: 60,   slug: "west-brom",         name: "West Brom",         shortName: "WBA", color: "#122F67", emoji: "🔵", current: false },
  { id: 76,   slug: "swansea",           name: "Swansea City",      shortName: "SWA", color: "#3A3939", emoji: "⚪", current: false },
  { id: 75,   slug: "stoke",             name: "Stoke City",        shortName: "STK", color: "#E03A3E", emoji: "🔴", current: false },
  { id: 70,   slug: "middlesbrough",     name: "Middlesbrough",     shortName: "MID", color: "#E03A3E", emoji: "🔴", current: false },
  { id: 64,   slug: "hull",              name: "Hull City",         shortName: "HUL", color: "#F18A01", emoji: "🟠", current: false },
  { id: 37,   slug: "huddersfield",      name: "Huddersfield",      shortName: "HUD", color: "#0E63AD", emoji: "🔵", current: false },
  { id: 43,   slug: "cardiff",           name: "Cardiff City",      shortName: "CAR", color: "#0070B5", emoji: "🔵", current: false },
];

/** slug → チームオブジェクト */
export const TEAMS_BY_SLUG = Object.fromEntries(TEAMS.map(t => [t.slug, t]));

/** teamId → チームオブジェクト */
export const TEAMS_BY_ID = Object.fromEntries(TEAMS.map(t => [t.id, t]));

/** 2025-26シーズン在籍チーム（20チーム） */
export const CURRENT_TEAMS = TEAMS.filter(t => t.current);

/** チームIDからロゴURLを生成 */
export function teamLogo(id) {
  return `https://media.api-sports.io/football/teams/${id}.png`;
}
