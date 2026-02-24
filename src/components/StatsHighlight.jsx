import { useState, useEffect } from "react";

const PERIOD_KEYS = ["0-15", "16-30", "31-45", "46-60", "61-75", "76-90"];
const PERIOD_LABELS = {
  "0-15": "0–15'", "16-30": "16–30'", "31-45": "31–45'",
  "46-60": "46–60'", "61-75": "61–75'", "76-90": "76–90'",
};

const TEAMS_INFO = [
  { id: 40, name: "Liverpool", short: "LIV", slug: "liverpool", color: "#C8102E" },
  { id: 42, name: "Arsenal",   short: "ARS", slug: "arsenal",   color: "#EF0107" },
];

function findMaxPeriod(byTime) {
  if (!byTime) return null;
  return PERIOD_KEYS.reduce((best, k) => byTime[k] > byTime[best] ? k : best, PERIOD_KEYS[0]);
}
function findMinPeriod(byTime) {
  if (!byTime) return null;
  return PERIOD_KEYS.reduce((best, k) => byTime[k] < byTime[best] ? k : best, PERIOD_KEYS[0]);
}

// ── スケルトンカード ────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div style={{
      background: "#0e1318",
      border: "1px solid #1e2830",
      borderTop: "2px solid #1a2530",
      borderRadius: 8,
      padding: "22px 24px",
      minHeight: 130,
    }}>
      <div style={{ height: 7, width: "55%", background: "#151e28", borderRadius: 2, marginBottom: 16 }} />
      <div style={{ height: 26, width: "65%", background: "#151e28", borderRadius: 2, marginBottom: 10 }} />
      <div style={{ height: 7, width: "85%", background: "#151e28", borderRadius: 2, marginBottom: 6 }} />
      <div style={{ height: 7, width: "75%", background: "#151e28", borderRadius: 2 }} />
    </div>
  );
}

// ── ベースカード ────────────────────────────────────────────────

function StatCard({ label, accent, children }) {
  return (
    <div style={{
      background:   "#0e1318",
      border:       "1px solid #1e2830",
      borderTop:    `2px solid ${accent}`,
      borderRadius: 8,
      padding:      "22px 24px",
    }}>
      <div style={{
        fontSize: 9, color: "#3a5060", letterSpacing: "0.14em",
        textTransform: "uppercase", marginBottom: 14,
        fontFamily: "'Barlow', sans-serif", fontWeight: 600,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}

// ── チーム別の1行（カード1・2共用） ─────────────────────────────

function TeamPeriodRow({ short, color, period, count, unit }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 9 }}>
      <span style={{
        fontSize: 9, fontWeight: 700, color,
        fontFamily: "'Barlow', sans-serif", letterSpacing: "0.06em",
        minWidth: 26,
      }}>
        {short}
      </span>
      <span style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: 26, color, lineHeight: 1, letterSpacing: "0.02em",
      }}>
        {period}
      </span>
      <span style={{ fontSize: 10, color: "#4a6070", fontFamily: "'Barlow', sans-serif" }}>
        {count}{unit}
      </span>
    </div>
  );
}

// ── メインコンポーネント ───────────────────────────────────────

export default function StatsHighlight() {
  const [teamData, setTeamData] = useState({});
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    Promise.all(
      TEAMS_INFO.map(t =>
        fetch(`${import.meta.env.BASE_URL}data/${t.slug}-2024.json`)
          .then(r => r.ok ? r.json() : null)
          .catch(() => null)
          .then(json => [t.id, json])
      )
    ).then(results => {
      setTeamData(Object.fromEntries(results.filter(([, d]) => d)));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    );
  }

  const entries = TEAMS_INFO
    .map(t => ({ ...t, data: teamData[t.id] }))
    .filter(t => t.data);

  if (entries.length === 0) return null;

  // ── 計算 ────────────────────────────────────────────────────

  // カード1: チーム別 最多失点時間帯
  const weakest = entries
    .filter(t => t.data.byTimeAvailable && t.data.conceded?.byTime)
    .map(t => {
      const k = findMaxPeriod(t.data.conceded.byTime);
      return { short: t.short, color: t.color, period: PERIOD_LABELS[k], count: t.data.conceded.byTime[k] };
    });

  // カード2: チーム別 最少失点時間帯
  const strongest = entries
    .filter(t => t.data.byTimeAvailable && t.data.conceded?.byTime)
    .map(t => {
      const k = findMinPeriod(t.data.conceded.byTime);
      return { short: t.short, color: t.color, period: PERIOD_LABELS[k], count: t.data.conceded.byTime[k] };
    });

  // カード3: 得失点差ランキング
  const goalDiffs = entries
    .map(t => ({
      name:  t.name,
      color: t.color,
      diff:  (t.data.scored?.total ?? 0) - (t.data.conceded?.total ?? 0),
    }))
    .sort((a, b) => b.diff - a.diff);
  const topDiff = goalDiffs[0];

  // カード4: 全チーム合算 最多得点時間帯
  const scoredSums = Object.fromEntries(PERIOD_KEYS.map(k => [k, 0]));
  for (const t of entries) {
    if (!t.data.byTimeAvailable || !t.data.scored?.byTime) continue;
    for (const k of PERIOD_KEYS) scoredSums[k] += t.data.scored.byTime[k] ?? 0;
  }
  const topScoringKey   = findMaxPeriod(scoredSums);
  const topScoringLabel = PERIOD_LABELS[topScoringKey];
  const topScoringCount = scoredSums[topScoringKey];

  // ── 描画 ────────────────────────────────────────────────────

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>

      {/* カード1: 最も守備が脆い時間帯 */}
      <StatCard label="最も守備が脆い時間帯" accent="#c8102e">
        {weakest.length > 0
          ? weakest.map(p => (
              <TeamPeriodRow key={p.short} {...p} unit="失点" />
            ))
          : <div style={{ color: "#2a3a4a", fontSize: 11 }}>データなし</div>
        }
      </StatCard>

      {/* カード2: 最も安定している時間帯 */}
      <StatCard label="最も安定している時間帯" accent="#22c55e">
        {strongest.length > 0
          ? strongest.map(p => (
              <TeamPeriodRow key={p.short} {...p} color="#22c55e" unit="失点" />
            ))
          : <div style={{ color: "#2a3a4a", fontSize: 11 }}>データなし</div>
        }
      </StatCard>

      {/* カード3: 得失点差トップ */}
      <StatCard label="得失点差トップ" accent="#6CABDD">
        {topDiff && (
          <>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 44, color: "#6CABDD",
              lineHeight: 1, letterSpacing: "0.02em", marginBottom: 6,
            }}>
              {topDiff.diff >= 0 ? "+" : ""}{topDiff.diff}
            </div>
            <div style={{ fontSize: 11, color: "#4a6070", fontFamily: "'Barlow', sans-serif", marginBottom: 6 }}>
              {topDiff.name} / 2024-25
            </div>
            {goalDiffs.slice(1).map(({ name, diff }) => (
              <div key={name} style={{ fontSize: 10, color: "#2a3a4a", fontFamily: "'Barlow', sans-serif" }}>
                {name}: {diff >= 0 ? "+" : ""}{diff}
              </div>
            ))}
          </>
        )}
      </StatCard>

      {/* カード4: 今季最多得点時間帯 */}
      <StatCard label="今季最多得点時間帯" accent="#eab308">
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 44, color: "#eab308",
          lineHeight: 1, letterSpacing: "0.02em", marginBottom: 6,
        }}>
          {topScoringLabel}
        </div>
        <div style={{ fontSize: 11, color: "#4a6070", fontFamily: "'Barlow', sans-serif" }}>
          合計 {topScoringCount} 得点（{entries.length}チーム）
        </div>
      </StatCard>

    </div>
  );
}
