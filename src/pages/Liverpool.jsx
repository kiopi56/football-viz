import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";
import { useTeamData } from "../hooks/useTeamData";

const TEAM_ID    = 40;
const TEAM_COLOR = "#C8102E";

const PERIOD_KEYS   = ["0-15", "16-30", "31-45", "46-60", "61-75", "76-90"];
const PERIOD_LABELS = ["0–15'", "16–30'", "31–45'", "46–60'", "61–75'", "76–90'"];
const PERIOD_COLORS = ["#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444", "#a855f7"];

// venue × metric の byTime を配列で返す（取れない場合は null）
function getByTime(data, metric, venue) {
  if (!data?.byTimeAvailable) return null;
  const root = venue === "all" ? data : data[venue];
  if (!root?.[metric]?.byTime) return null; // byTime未取得（home/awayなど）
  return PERIOD_KEYS.map(k => root[metric].byTime[k] ?? 0);
}

function getTotal(data, metric, venue) {
  if (!data) return null;
  const root = venue === "all" ? data : data[venue];
  return root?.[metric]?.total ?? null;
}

// ── サブコンポーネント ──────────────────────────────────────

const LoadingScreen = () => (
  <div style={{ minHeight: "100vh", background: "#03060F", display: "flex",
    alignItems: "center", justifyContent: "center",
    fontFamily: "'Space Mono', monospace", color: "#555", fontSize: 13 }}>
    Loading...
  </div>
);

function FormBadge({ result }) {
  const bg = result === "W" ? "#22c55e" : result === "L" ? "#ef4444" : "#666";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: 22, height: 22, borderRadius: 4, background: bg,
      fontSize: 9, fontWeight: 700, color: "#fff" }}>
      {result}
    </span>
  );
}

function ToggleGroup({ options, value, onChange, activeColor = TEAM_COLOR }) {
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

// ── メインコンポーネント ──────────────────────────────────────

export default function Liverpool() {
  const [season,   setSeason]   = useState(2024);
  const [dataType, setDataType] = useState("conceded"); // "conceded"|"scored"|"both"
  const [venue,    setVenue]    = useState("all");      // "all"|"home"|"away"
  const [view,     setView]     = useState("compare");  // "compare"|"pct"|"radar"

  const { data: data2024, loading: l2024 } = useTeamData(TEAM_ID, 2024);
  const { data: data2023, loading: l2023 } = useTeamData(TEAM_ID, 2023);

  if (l2024 || l2023) return <LoadingScreen />;

  const primaryData = season === 2024 ? data2024 : data2023;
  const otherData   = season === 2024 ? data2023 : data2024;
  const primaryLabel = season === 2024 ? "2024-25" : "2023-24";
  const otherLabel   = season === 2024 ? "2023-24" : "2024-25";

  const isBoth = dataType === "both";

  // 時間帯別配列
  const priVals = isBoth ? null : getByTime(primaryData, dataType, venue);
  const othVals = isBoth ? null : getByTime(otherData, dataType, venue);
  const priScored   = isBoth ? getByTime(primaryData, "scored",   venue) : null;
  const priConceded = isBoth ? getByTime(primaryData, "conceded", venue) : null;

  // 合計
  const priTotal    = isBoth
    ? { scored: getTotal(primaryData, "scored", venue), conceded: getTotal(primaryData, "conceded", venue) }
    : getTotal(primaryData, dataType, venue);
  const othTotal    = isBoth ? null : getTotal(otherData, dataType, venue);

  // チャートデータ
  const chartData = PERIOD_KEYS.map((k, i) => {
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
  const pctData = PERIOD_KEYS.map((k, i) => ({
    period: PERIOD_LABELS[i],
    [primaryLabel]: priSum > 0 ? +((priVals?.[i] ?? 0) / priSum * 100).toFixed(1) : 0,
    ...(othVals ? { [otherLabel]: othSum > 0 ? +((othVals[i] ?? 0) / othSum * 100).toFixed(1) : 0 } : {}),
  }));

  const recentForm  = primaryData?.recentForm ?? [];
  const metricLabel = dataType === "conceded" ? "失点" : dataType === "scored" ? "得点" : "得失点";
  const venueLabel  = venue === "all" ? "全試合" : venue === "home" ? "ホーム" : "アウェイ";

  return (
    <div style={{ minHeight: "100vh", background: "#03060F", color: "#fff",
      fontFamily: "'Space Mono', monospace", padding: "28px 20px", boxSizing: "border-box" }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Anton&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 880, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 20 }}>
          <div style={{ width: 6, background: TEAM_COLOR, alignSelf: "stretch", borderRadius: 3, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "clamp(24px,5vw,48px)", letterSpacing: "0.04em", lineHeight: 1 }}>
              LIVERPOOL FC
            </div>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "clamp(13px,2.2vw,22px)", letterSpacing: "0.1em", color: TEAM_COLOR, lineHeight: 1.3 }}>
              時間帯別 得失点分析
            </div>
            <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>PL シーズン比較</div>
          </div>
        </div>

        {/* ── シーズンタブ + 直近フォーム ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <ToggleGroup
            options={[[2024, "2024-25"], [2023, "2023-24"]]}
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

        {/* ── KPIカード ── */}
        <div style={{ display: "grid", gridTemplateColumns: isBoth ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
          {isBoth ? (
            <>
              {[
                { label: `${primaryLabel} 得点`, value: priTotal?.scored  != null ? String(priTotal.scored)   : "–", accent: "#22c55e", sub: venueLabel },
                { label: `${primaryLabel} 失点`, value: priTotal?.conceded != null ? String(priTotal.conceded) : "–", accent: TEAM_COLOR, sub: venueLabel },
              ].map(({ label, value, accent, sub }) => (
                <div key={label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderTop: `2px solid ${accent}`, borderRadius: 8, padding: "12px 14px" }}>
                  <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>{sub}</div>
                </div>
              ))}
            </>
          ) : (
            [
              { label: `${primaryLabel} ${metricLabel}`, value: priTotal != null ? String(priTotal) : "–", accent: TEAM_COLOR, sub: venueLabel },
              { label: `${otherLabel} ${metricLabel}`,   value: othTotal != null ? String(othTotal)  : "–", accent: "#4ade80",  sub: venueLabel },
              { label: `76-90' ${metricLabel}（今季）`,  value: priVals  ? String(priVals[5]) : "–",         accent: "#a855f7", sub: primaryLabel },
              { label: `76-90' ${metricLabel}（昨季）`,  value: othVals  ? String(othVals[5]) : "–",         accent: "#818cf8", sub: otherLabel   },
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
          {(!priVals && !isBoth) && (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#555", fontSize: 12 }}>
              このシーズンの時間帯データは取得できませんでした
            </div>
          )}

          {/* 実数比較 or 両方 */}
          {(isBoth || (priVals && (view === "compare" || !priVals))) && (isBoth || view === "compare") && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barGap={3} barCategoryGap="25%">
                <XAxis dataKey="period" tick={{ fill: "#888", fontSize: 11, fontFamily: "'Space Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "rgba(5,10,20,0.97)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontFamily: "'Space Mono', monospace", fontSize: 11 }} itemStyle={{ color: "#ccc" }} labelStyle={{ color: "#888", marginBottom: 4 }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend formatter={v => <span style={{ fontSize: 11, color: "#ccc" }}>{v}</span>} />
                {isBoth ? (
                  <>
                    <Bar dataKey="得点" fill="#22c55e" radius={[3,3,0,0]} />
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

          {/* 割合比較 */}
          {!isBoth && priVals && view === "pct" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pctData} barGap={3} barCategoryGap="25%">
                <XAxis dataKey="period" tick={{ fill: "#888", fontSize: 11, fontFamily: "'Space Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ background: "rgba(5,10,20,0.97)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, fontFamily: "'Space Mono', monospace", fontSize: 11 }} itemStyle={{ color: "#ccc" }} labelStyle={{ color: "#888" }} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend formatter={v => <span style={{ fontSize: 11, color: "#ccc" }}>{v}</span>} />
                <Bar dataKey={primaryLabel} fill={TEAM_COLOR}        radius={[3,3,0,0]} />
                {othVals && <Bar dataKey={otherLabel} fill="#4ade80" fillOpacity={0.7} radius={[3,3,0,0]} />}
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* レーダー */}
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
        </div>

        {/* ── 時間帯別内訳テーブル ── */}
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>
          時間帯別 内訳
        </div>
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
                  {othVals && <><div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "4px 0" }} /><div style={{ fontSize: 15, fontWeight: 700, color: "#4ade80" }}>{othVals[i]}</div></>}
                </>
              )}
            </div>
          ))}
        </div>

        {/* 凡例 */}
        <div style={{ display: "flex", gap: 16, marginBottom: 28, fontSize: 10, color: "#555", flexWrap: "wrap" }}>
          {isBoth ? (
            <>
              <span><span style={{ color: "#22c55e", fontWeight: 700 }}>■</span> 得点（{primaryLabel}・{venueLabel}）</span>
              <span><span style={{ color: TEAM_COLOR, fontWeight: 700 }}>■</span> 失点（{primaryLabel}・{venueLabel}）</span>
            </>
          ) : (
            <>
              {priVals && <span><span style={{ color: TEAM_COLOR, fontWeight: 700 }}>■</span> {primaryLabel}（{metricLabel}・{venueLabel}）</span>}
              {othVals && <span><span style={{ color: "#4ade80",  fontWeight: 700 }}>■</span> {otherLabel}（{metricLabel}・{venueLabel}）</span>}
              {!priVals && !othVals && <span style={{ color: "#444" }}>時間帯データなし（スコアのみ）</span>}
            </>
          )}
        </div>

        <div style={{ fontSize: 9, color: "#2d2d2d", lineHeight: 1.8 }}>
          ※ データ：api-sports.io より取得（PL FINISHEDを集計・ビルド時生成）
        </div>

      </div>
    </div>
  );
}
