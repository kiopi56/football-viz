import { useState, useEffect } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";
import { useTeamData } from "../hooks/useTeamData";
import ScorerTracker from "../components/ScorerTracker";
import { fetchFixturesWithFallback } from "../lib/supabase";
import { TEAMS_BY_SLUG } from "../data/teams";

const PERIOD_KEYS   = ["0-15", "16-30", "31-45", "46-60", "61-75", "76-90"];
const PERIOD_LABELS = ["0–15'", "16–30'", "31–45'", "46–60'", "61–75'", "76–90'"];
const PERIOD_COLORS = ["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444", "#a855f7"];

// ── ヘルパー ──────────────────────────────────────────────────

function getByTime(data, metric, venue) {
  if (!data?.byTimeAvailable) return null;
  const root = venue === "all" ? data : data[venue];
  if (!root?.[metric]?.byTime) return null;
  return PERIOD_KEYS.map(k => root[metric].byTime[k] ?? 0);
}

// home/away の total が null のとき fixtures から補完
function getTotal(data, metric, venue, teamId) {
  if (!data) return null;
  if (venue === "all") return data?.[metric]?.total ?? null;
  const root = data[venue];
  if (root?.[metric]?.total != null) return root[metric].total;
  // fixtures から導出
  if (!data.fixtures?.length || !teamId) return null;
  let total = 0;
  for (const fix of data.fixtures) {
    const isHome = fix.home_team_id === teamId;
    if (venue === "home" && !isHome) continue;
    if (venue === "away" && isHome) continue;
    total += metric === "scored"
      ? (isHome ? (fix.goals_home ?? 0) : (fix.goals_away ?? 0))
      : (isHome ? (fix.goals_away ?? 0) : (fix.goals_home ?? 0));
  }
  return total;
}

// fixtures から前半/後半 [HT goals, 2H goals] を算出
function calcHalfStats(data, metric, venue, teamId) {
  if (!data?.fixtures?.length || !teamId) return null;
  let ht = 0, ft = 0;
  for (const fix of data.fixtures) {
    const isHome = fix.home_team_id === teamId;
    if (venue === "home" && !isHome) continue;
    if (venue === "away" && isHome) continue;
    if (metric === "scored") {
      ht += isHome ? (fix.ht_home ?? 0) : (fix.ht_away ?? 0);
      ft += isHome ? (fix.goals_home ?? 0) : (fix.goals_away ?? 0);
    } else {
      ht += isHome ? (fix.ht_away ?? 0) : (fix.ht_home ?? 0);
      ft += isHome ? (fix.goals_away ?? 0) : (fix.goals_home ?? 0);
    }
  }
  return [ht, ft - ht]; // [前半, 後半]
}

// ── サブコンポーネント ──────────────────────────────────────

function FormBadge({ result }) {
  const bg = result === "W" ? "#22c55e" : result === "L" ? "#ef4444" : "#666";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 22, height: 22, borderRadius: 4, background: bg,
      fontSize: 9, fontWeight: 700, color: "#fff",
    }}>{result}</span>
  );
}

function ToggleGroup({ options, value, onChange, activeColor }) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {options.map(([v, label]) => {
        const active = value === v;
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            padding: "5px 12px", borderRadius: 4, fontSize: 11, cursor: "pointer",
            fontFamily: "'Space Mono', monospace",
            border: active ? `1px solid ${activeColor}` : "1px solid rgba(255,255,255,0.12)",
            background: active ? `${activeColor}22` : "transparent",
            color: active ? activeColor : "#888",
          }}>{label}</button>
        );
      })}
    </div>
  );
}

// 前半/後半バーチャート（共通）
function HalfBarChart({ chartData, TEAM_COLOR, primaryLabel, otherLabel, isBoth }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData} barCategoryGap="40%">
        <XAxis dataKey="period" tick={{ fill: "#888", fontSize: 12, fontFamily: "'Space Mono', monospace" }}
          axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: "rgba(5,10,20,0.97)", border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8, fontFamily: "'Space Mono', monospace", fontSize: 11 }}
          itemStyle={{ color: "#ccc" }} labelStyle={{ color: "#888", marginBottom: 4 }}
          cursor={{ fill: "rgba(255,255,255,0.03)" }}
        />
        <Legend formatter={v => <span style={{ fontSize: 11, color: "#ccc" }}>{v}</span>} />
        {isBoth ? (
          <>
            <Bar dataKey="得点" fill="#22c55e"    radius={[3,3,0,0]} />
            <Bar dataKey="失点" fill={TEAM_COLOR} radius={[3,3,0,0]} />
          </>
        ) : (
          <>
            <Bar dataKey={primaryLabel} fill={TEAM_COLOR} radius={[3,3,0,0]} />
            {otherLabel && <Bar dataKey={otherLabel} fill="#4ade80" fillOpacity={0.7} radius={[3,3,0,0]} />}
          </>
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── メインコンポーネント ──────────────────────────────────────

export default function TeamDetail() {
  const { teamSlug } = useParams();
  const team = TEAMS_BY_SLUG[teamSlug];

  const [mainView, setMainView] = useState("chart");
  const [season,   setSeason]   = useState(2025);
  const [dataType, setDataType] = useState("conceded");
  const [venue,    setVenue]    = useState("all");
  const [view,     setView]     = useState("compare");

  const [fixtures,    setFixtures]    = useState([]);
  const [fixtureLoad, setFixtureLoad] = useState(false);

  const { data: data2025, loading: l2025 } = useTeamData(teamSlug, 2025);
  const { data: data2024, loading: l2024 } = useTeamData(teamSlug, 2024);
  const { data: data2023, loading: l2023 } = useTeamData(teamSlug, 2023);

  useEffect(() => {
    if (!team) return;
    setFixtureLoad(true);
    fetchFixturesWithFallback(team.id, season)
      .then(setFixtures)
      .catch(() => setFixtures([]))
      .finally(() => setFixtureLoad(false));
  }, [team, season]);

  if (!team) return <Navigate to="/" replace />;

  if (l2025 || l2024 || l2023) {
    return (
      <div style={{ minHeight: "100vh", background: "#080c10", display: "flex",
        alignItems: "center", justifyContent: "center",
        fontFamily: "'Space Mono', monospace", color: "#555", fontSize: 13 }}>
        Loading...
      </div>
    );
  }

  const TEAM_COLOR = team.color;
  const teamId     = team.id;

  // シーズンデータマップ
  const dataMap    = { 2025: data2025, 2024: data2024, 2023: data2023 };
  const otherSeason = season === 2025 ? 2024 : season + 1;
  const primaryData = dataMap[season];
  const otherData   = dataMap[otherSeason];
  const primaryLabel = `${season}-${String(season + 1).slice(-2)}`;
  const otherLabel   = `${otherSeason}-${String(otherSeason + 1).slice(-2)}`;
  const isBoth       = dataType === "both";

  // 6期間データ（byTimeAvailable=trueのときのみ有効）
  const priVals     = isBoth ? null : getByTime(primaryData, dataType, venue);
  const othVals     = isBoth ? null : getByTime(otherData,   dataType, venue);
  const priScored   = isBoth ? getByTime(primaryData, "scored",   venue) : null;
  const priConceded = isBoth ? getByTime(primaryData, "conceded", venue) : null;

  // トータル（home/away も fixtures から補完）
  const priTotal = isBoth
    ? { scored: getTotal(primaryData, "scored",   venue, teamId), conceded: getTotal(primaryData, "conceded", venue, teamId) }
    : getTotal(primaryData, dataType, venue, teamId);
  const othTotal = isBoth ? null : getTotal(otherData, dataType, venue, teamId);

  // 前半/後半 フォールバック（fixtures から算出）
  const priHalf     = isBoth ? calcHalfStats(primaryData, "scored",   venue, teamId)
                              : calcHalfStats(primaryData, dataType,   venue, teamId);
  const priHalfConc = isBoth ? calcHalfStats(primaryData, "conceded", venue, teamId) : null;
  const othHalf     = isBoth ? null : calcHalfStats(otherData, dataType, venue, teamId);

  // 前半/後半チャートデータ
  const halfChartData = priHalf ? [
    {
      period: "前半 0–45'",
      ...(isBoth
        ? { "得点": priHalf[0], "失点": priHalfConc?.[0] ?? 0 }
        : { [primaryLabel]: priHalf[0], ...(othHalf ? { [otherLabel]: othHalf[0] } : {}) }
      ),
    },
    {
      period: "後半 46–90'",
      ...(isBoth
        ? { "得点": priHalf[1], "失点": priHalfConc?.[1] ?? 0 }
        : { [primaryLabel]: priHalf[1], ...(othHalf ? { [otherLabel]: othHalf[1] } : {}) }
      ),
    },
  ] : null;

  // 6期間チャートデータ（byTimeAvailable=trueのときのみ使用）
  const chartData = PERIOD_KEYS.map((_k, i) => {
    const e = { period: PERIOD_LABELS[i] };
    if (isBoth) {
      e["得点"] = priScored?.[i]   ?? 0;
      e["失点"] = priConceded?.[i] ?? 0;
    } else {
      if (priVals) e[primaryLabel] = priVals[i];
      if (othVals) e[otherLabel]   = othVals[i];
    }
    return e;
  });

  const priSum = Array.isArray(priVals) ? priVals.reduce((s, v) => s + v, 0) : 0;
  const othSum = Array.isArray(othVals) ? othVals.reduce((s, v) => s + v, 0) : 0;
  const pctData = PERIOD_KEYS.map((_k, i) => ({
    period: PERIOD_LABELS[i],
    [primaryLabel]: priSum > 0 ? +((priVals?.[i] ?? 0) / priSum * 100).toFixed(1) : 0,
    ...(othVals ? { [otherLabel]: othSum > 0 ? +((othVals[i] ?? 0) / othSum * 100).toFixed(1) : 0 } : {}),
  }));

  const recentForm  = primaryData?.recentForm ?? [];
  const metricLabel = dataType === "conceded" ? "失点" : dataType === "scored" ? "得点" : "得失点";
  const venueLabel  = venue === "all" ? "全試合" : venue === "home" ? "ホーム" : "アウェイ";

  // 6期間の有効データが存在するか
  const has6Period = isBoth ? !!(priScored || priConceded) : !!priVals;
  // 前半/後半フォールバックを使うか
  const useHalfFallback = !has6Period && !!halfChartData;

  return (
    <div style={{ minHeight: "100vh", background: "#080c10", color: "#fff",
      fontFamily: "'Space Mono', monospace", padding: "28px 20px", boxSizing: "border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Anton&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 880, margin: "0 auto" }}>

        {/* Breadcrumb */}
        <div style={{ marginBottom: 20 }}>
          <Link to="/" style={{ fontSize: 10, color: "#555", textDecoration: "none", letterSpacing: "0.08em" }}
            onMouseEnter={e => e.target.style.color = "#00ff85"}
            onMouseLeave={e => e.target.style.color = "#555"}
          >← HOME</Link>
        </div>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 20 }}>
          <div style={{ width: 6, background: TEAM_COLOR, alignSelf: "stretch", borderRadius: 3, flexShrink: 0 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 16, flex: 1 }}>
            <img
              src={`https://media.api-sports.io/football/teams/${teamId}.png`}
              alt={team.name} width={48} height={48}
              style={{ objectFit: "contain", flexShrink: 0 }}
            />
            <div>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "clamp(24px,5vw,48px)", letterSpacing: "0.04em", lineHeight: 1 }}>
                {team.name.toUpperCase()}
              </div>
              <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "clamp(13px,2.2vw,22px)", letterSpacing: "0.1em", color: TEAM_COLOR, lineHeight: 1.3 }}>
                時間帯別 得失点分析
              </div>
              <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>PL シーズン比較</div>
            </div>
          </div>
        </div>

        {/* ── メインビュータブ ── */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          {[["chart", "時間帯分析"], ["scorers", "得点者"]].map(([v, label]) => {
            const active = mainView === v;
            return (
              <button key={v} onClick={() => setMainView(v)} style={{
                padding: "7px 18px", borderRadius: 6, fontSize: 11, cursor: "pointer",
                fontFamily: "'Space Mono', monospace",
                border: active ? `1px solid ${TEAM_COLOR}` : "1px solid rgba(255,255,255,0.12)",
                background: active ? `${TEAM_COLOR}22` : "transparent",
                color: active ? TEAM_COLOR : "#666",
                fontWeight: active ? 700 : 400, letterSpacing: "0.04em",
              }}>{label}</button>
            );
          })}
        </div>

        {/* ── 得点者ビュー ── */}
        {mainView === "scorers" && (
          <ScorerTracker teamSlug={teamSlug} />
        )}

        {/* ── チャートビュー ── */}
        {mainView === "chart" && (<>

        {/* ── シーズンタブ + 直近フォーム ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <ToggleGroup
            options={[[2025, "2025-26"], [2024, "2024-25"], [2023, "2023-24"]]}
            value={season}
            onChange={v => setSeason(Number(v))}
            activeColor={TEAM_COLOR}
          />
          {recentForm.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ fontSize: 9, color: "#555" }}>直近5試合</span>
              {recentForm.map((r, i) => <FormBadge key={i} result={r} />)}
            </div>
          )}
        </div>

        {/* データがない場合 */}
        {!primaryData && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12, padding: "40px 20px", textAlign: "center",
            color: "#444", fontSize: 12, marginBottom: 20 }}>
            {season}-{String(season + 1).slice(-2)} シーズンのデータがありません
            <div style={{ fontSize: 10, color: "#333", marginTop: 8 }}>
              （このシーズンはプレミアリーグ不在の可能性があります）
            </div>
          </div>
        )}

        {primaryData && (<>

        {/* ── KPIカード ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          {isBoth ? (
            [
              { label: `${primaryLabel} 得点`, value: priTotal?.scored  != null ? String(priTotal.scored)   : "–", accent: "#22c55e", sub: venueLabel },
              { label: `${primaryLabel} 失点`, value: priTotal?.conceded != null ? String(priTotal.conceded) : "–", accent: TEAM_COLOR, sub: venueLabel },
              { label: `前半 得点（${primaryLabel}）`, value: priHalf ? String(priHalf[0]) : "–", accent: "#22c55e", sub: "0–45'" },
              { label: `後半 得点（${primaryLabel}）`, value: priHalf ? String(priHalf[1]) : "–", accent: "#84cc16", sub: "46–90'" },
            ].map(({ label, value, accent, sub }) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderTop: `2px solid ${accent}`, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>{sub}</div>
              </div>
            ))
          ) : (
            [
              { label: `${primaryLabel} ${metricLabel}`, value: priTotal != null ? String(priTotal) : "–", accent: TEAM_COLOR, sub: venueLabel },
              { label: `${otherLabel} ${metricLabel}`,   value: othTotal != null ? String(othTotal)  : "–", accent: "#4ade80",  sub: venueLabel },
              {
                label: priVals ? `76-90' ${metricLabel}（${primaryLabel}）` : `前半 ${metricLabel}（${primaryLabel}）`,
                value: priVals ? String(priVals[5]) : (priHalf ? String(priHalf[0]) : "–"),
                accent: "#a855f7", sub: priVals ? primaryLabel : "0–45'",
              },
              {
                label: priVals ? `76-90' ${metricLabel}（${otherLabel}）` : `後半 ${metricLabel}（${primaryLabel}）`,
                value: priVals ? (othVals ? String(othVals[5]) : "–") : (priHalf ? String(priHalf[1]) : "–"),
                accent: "#818cf8", sub: priVals ? otherLabel : "46–90'",
              },
            ].map(({ label, value, accent, sub }) => (
              <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderTop: `2px solid ${accent}`, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
                <div style={{ fontSize: 26, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
                <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>{sub}</div>
              </div>
            ))
          )}
        </div>

        {/* ── コントロール ── */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
          <ToggleGroup options={[["conceded","失点"],["scored","得点"],["both","両方"]]} value={dataType} onChange={setDataType} activeColor={TEAM_COLOR} />
          <ToggleGroup options={[["all","全試合"],["home","ホーム"],["away","アウェイ"]]} value={venue} onChange={setVenue} activeColor="#777" />
          {!isBoth && (
            <ToggleGroup options={[["compare","実数比較"],["pct","割合（%）"],["radar","レーダー"]]} value={view} onChange={setView} activeColor={TEAM_COLOR} />
          )}
        </div>

        {/* ── メインチャート ── */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "24px 16px", marginBottom: 20, height: 300 }}>

          {/* 6期間バーチャート（byTimeAvailable=true かつ compare/both モード） */}
          {has6Period && (view === "compare" || isBoth) && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={3} barCategoryGap="25%">
                <XAxis dataKey="period" tick={{ fill: "#888", fontSize: 11, fontFamily: "'Space Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "rgba(5,10,20,0.97)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontFamily: "'Space Mono', monospace", fontSize: 11 }} itemStyle={{ color: "#ccc" }} labelStyle={{ color: "#888", marginBottom: 4 }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend formatter={v => <span style={{ fontSize: 11, color: "#ccc" }}>{v}</span>} />
                {isBoth ? (
                  <>
                    <Bar dataKey="得点" fill="#22c55e"  radius={[3,3,0,0]} />
                    <Bar dataKey="失点" fill={TEAM_COLOR} radius={[3,3,0,0]} />
                  </>
                ) : (
                  <>
                    {priVals && <Bar dataKey={primaryLabel} fill={TEAM_COLOR} radius={[3,3,0,0]} />}
                    {othVals && <Bar dataKey={otherLabel}   fill="#4ade80"   fillOpacity={0.7} radius={[3,3,0,0]} />}
                  </>
                )}
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* 6期間 pct */}
          {!isBoth && priVals && view === "pct" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pctData} barGap={3} barCategoryGap="25%">
                <XAxis dataKey="period" tick={{ fill: "#888", fontSize: 11, fontFamily: "'Space Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ background: "rgba(5,10,20,0.97)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontFamily: "'Space Mono', monospace", fontSize: 11 }} itemStyle={{ color: "#ccc" }} labelStyle={{ color: "#888" }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend formatter={v => <span style={{ fontSize: 11, color: "#ccc" }}>{v}</span>} />
                <Bar dataKey={primaryLabel} fill={TEAM_COLOR} radius={[3,3,0,0]} />
                {othVals && <Bar dataKey={otherLabel} fill="#4ade80" fillOpacity={0.7} radius={[3,3,0,0]} />}
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* 6期間 radar */}
          {!isBoth && priVals && view === "radar" && (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={pctData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="period" tick={{ fill: "#aaa", fontSize: 11, fontFamily: "'Space Mono', monospace" }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name={primaryLabel} dataKey={primaryLabel} stroke={TEAM_COLOR} fill={TEAM_COLOR} fillOpacity={0.3} strokeWidth={2} />
                {othVals && <Radar name={otherLabel} dataKey={otherLabel} stroke="#4ade80" fill="#4ade80" fillOpacity={0.2} strokeWidth={2} />}
                <Legend formatter={v => <span style={{ fontSize: 11, color: "#ccc" }}>{v}</span>} />
              </RadarChart>
            </ResponsiveContainer>
          )}

          {/* 前半/後半フォールバックチャート（byTimeAvailable=false のとき） */}
          {useHalfFallback && (
            <HalfBarChart
              chartData={halfChartData}
              TEAM_COLOR={TEAM_COLOR}
              primaryLabel={isBoth ? undefined : primaryLabel}
              otherLabel={isBoth ? undefined : (othHalf ? otherLabel : undefined)}
              isBoth={isBoth}
            />
          )}

          {/* 完全にデータなし */}
          {!has6Period && !useHalfFallback && (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 12 }}>
              データなし
            </div>
          )}
        </div>

        {/* ── 時間帯別内訳テーブル ── */}
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          {primaryData?.byTimeAvailable ? "時間帯別 内訳" : "前半 / 後半 内訳"}
        </div>

        {primaryData?.byTimeAvailable ? (
          /* 6期間テーブル */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 6, marginBottom: 12 }}>
            {PERIOD_KEYS.map((k, i) => (
              <div key={k} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderBottom: `2px solid ${PERIOD_COLORS[i]}`, borderRadius: 8, padding: "10px 6px", textAlign: "center" }}>
                <div style={{ fontSize: 9, color: "#666", marginBottom: 6 }}>{PERIOD_LABELS[i]}</div>
                {isBoth ? (
                  <>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#22c55e" }}>{priScored?.[i]   ?? "–"}</div>
                    <div style={{ fontSize: 8, color: "#555", marginBottom: 2 }}>得点</div>
                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                    <div style={{ fontSize: 15, fontWeight: 700, color: TEAM_COLOR }}>{priConceded?.[i] ?? "–"}</div>
                    <div style={{ fontSize: 8, color: "#555" }}>失点</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 18, fontWeight: 700, color: TEAM_COLOR }}>{priVals?.[i] ?? "–"}</div>
                    {othVals && (
                      <>
                        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} />
                        <div style={{ fontSize: 15, fontWeight: 700, color: "#4ade80" }}>{othVals[i]}</div>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          /* 前半/後半 2セルテーブル */
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 }}>
            {["前半 0–45'", "後半 46–90'"].map((label, i) => (
              <div key={label} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderBottom: `2px solid ${i === 0 ? "#22c55e" : "#f97316"}`,
                borderRadius: 8, padding: "14px 10px", textAlign: "center",
              }}>
                <div style={{ fontSize: 10, color: "#666", marginBottom: 8 }}>{label}</div>
                {isBoth ? (
                  <>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#22c55e" }}>{priHalf ? priHalf[i] : "–"}</div>
                    <div style={{ fontSize: 9, color: "#555", marginBottom: 2 }}>得点</div>
                    <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />
                    <div style={{ fontSize: 20, fontWeight: 700, color: TEAM_COLOR }}>{priHalfConc ? priHalfConc[i] : "–"}</div>
                    <div style={{ fontSize: 9, color: "#555" }}>失点</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 24, fontWeight: 700, color: TEAM_COLOR }}>{priHalf ? priHalf[i] : "–"}</div>
                    {othHalf && (
                      <>
                        <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#4ade80" }}>{othHalf[i]}</div>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 凡例 */}
        <div style={{ display: "flex", gap: 16, marginBottom: 28, fontSize: 10, color: "#555", flexWrap: "wrap" }}>
          {isBoth ? (
            <>
              <span><span style={{ color: "#22c55e", fontWeight: 700 }}>■</span> 得点（{primaryLabel}・{venueLabel}）</span>
              <span><span style={{ color: TEAM_COLOR, fontWeight: 700 }}>■</span> 失点（{primaryLabel}・{venueLabel}）</span>
            </>
          ) : (
            <>
              <span><span style={{ color: TEAM_COLOR, fontWeight: 700 }}>■</span> {primaryLabel}（{metricLabel}・{venueLabel}）</span>
              {(othVals || othHalf) && <span><span style={{ color: "#4ade80", fontWeight: 700 }}>■</span> {otherLabel}（{metricLabel}・{venueLabel}）</span>}
              {useHalfFallback && <span style={{ color: "#333" }}>※ ht_home/ht_away から前半/後半を算出</span>}
            </>
          )}
        </div>

        <div style={{ fontSize: 9, color: "#2d2d2d", lineHeight: 1.8 }}>
          ※ データ：api-sports.io より取得（PL FINISHEDを集計・ビルド時生成）
        </div>

        {/* ── 試合一覧 ── */}
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em",
            textTransform: "uppercase", marginBottom: 12 }}>
            試合一覧 — {season}-{String(season + 1).slice(-2)}
          </div>
          {fixtureLoad && (
            <div style={{ fontSize: 11, color: "#333", padding: "12px 0" }}>読み込み中...</div>
          )}
          {!fixtureLoad && fixtures.length === 0 && (
            <div style={{ fontSize: 11, color: "#333", padding: "12px 0" }}>
              データなし（Supabase に試合データがありません）
            </div>
          )}
          {!fixtureLoad && fixtures.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {fixtures.map(fix => {
                const isHome    = fix.home_team_id === teamId;
                const scored    = isHome ? fix.goals_home : fix.goals_away;
                const conceded  = isHome ? fix.goals_away  : fix.goals_home;
                const opponent  = isHome ? fix.away_team_name : fix.home_team_name;
                const result    = scored > conceded ? "W" : scored < conceded ? "L" : "D";
                const rColor    = result === "W" ? "#22c55e" : result === "L" ? "#ef4444" : "#666";
                const dateStr   = new Date(fix.match_date).toLocaleDateString("ja-JP",
                  { month: "2-digit", day: "2-digit" });
                return (
                  <Link key={fix.id} to={`/match/${fix.id}`} style={{ textDecoration: "none" }}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 14px",
                      background: "rgba(255,255,255,0.02)",
                      border: "1px solid rgba(255,255,255,0.06)",
                      borderRadius: 7, fontSize: 11, color: "#aaa",
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = `${TEAM_COLOR}44`; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                    >
                      <span style={{ fontSize: 9, color: "#444", minWidth: 34 }}>{dateStr}</span>
                      <span style={{ fontSize: 9, color: "#333", minWidth: 22 }}>{isHome ? "H" : "A"}</span>
                      <span style={{ flex: 1, color: "#ccc" }}>{opponent}</span>
                      <span style={{ fontWeight: 700, color: TEAM_COLOR, minWidth: 30, textAlign: "center" }}>
                        {scored}–{conceded}
                      </span>
                      <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 7px",
                        borderRadius: 3, background: `${rColor}22`, color: rColor,
                        border: `1px solid ${rColor}44`, minWidth: 22, textAlign: "center" }}>
                        {result}
                      </span>
                      <span style={{ fontSize: 9, color: "#333" }}>→</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        </>)}
        </>)}

      </div>
    </div>
  );
}
