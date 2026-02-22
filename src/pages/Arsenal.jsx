// useState  = コンポーネント内で「変化する値」を管理するフック
// useEffect = コンポーネントが表示されたタイミングで処理を実行するフック
import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";

const TEAM_COLOR = "#EF0107";

const PERIODS = [
  { label: "0–15'",  min: 0,   max: 15,  color: "#22c55e", colorDim: "#16532e" },
  { label: "16–30'", min: 16,  max: 30,  color: "#84cc16", colorDim: "#3a5a09" },
  { label: "31–45'", min: 31,  max: 45,  color: "#eab308", colorDim: "#6b5100" },
  { label: "46–60'", min: 46,  max: 60,  color: "#f97316", colorDim: "#7c3a0a" },
  { label: "61–75'", min: 61,  max: 75,  color: "#ef4444", colorDim: "#7c1c1c" },
  { label: "76–89'", min: 76,  max: 89,  color: "#dc2626", colorDim: "#6b1414" },
  { label: "90'+",   min: 90,  max: 999, color: "#a855f7", colorDim: "#4c1d95" },
];

function getPeriodIdx(time) {
  for (let i = 0; i < PERIODS.length; i++) {
    if (time >= PERIODS[i].min && time <= PERIODS[i].max) return i;
  }
  return PERIODS.length - 1;
}


// ── Tooltips ──────────────────────────────────────────────
const CompareTooltip = ({ active, payload, label, comparisonData }) => {
  if (!active || !payload?.length) return null;
  const d = comparisonData.find(x => x.period === label);
  return (
    <div style={{
      background: "rgba(5,10,20,0.97)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      padding: "12px 16px",
      fontFamily: "'Space Mono', monospace",
      fontSize: 12,
      color: "#fff",
      minWidth: 180,
    }}>
      <div style={{ color: "#aaa", marginBottom: 8, fontSize: 11 }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 4 }}>
        <span style={{ color: TEAM_COLOR }}>2025-26</span>
        <span>{d.cur}失点 <span style={{ color: "#666" }}>({d.curPct}%)</span></span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
        <span style={{ color: "#4ade80" }}>2024-25</span>
        <span>{d.prev}失点 <span style={{ color: "#666" }}>({d.prevPct}%)</span></span>
      </div>
    </div>
  );
};

const PctTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(5,10,20,0.97)",
      border: "1px solid rgba(255,255,255,0.12)",
      borderRadius: 8,
      padding: "10px 14px",
      fontFamily: "'Space Mono', monospace",
      fontSize: 12,
      color: "#fff",
    }}>
      <div style={{ color: "#aaa", marginBottom: 6, fontSize: 11 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: {p.value}%
        </div>
      ))}
    </div>
  );
};


// ── メインコンポーネント ──────────────────────────────────
export default function Arsenal() {
  // ── useStateの使い方 ──────────────────────────────────────
  // useState(初期値) を呼ぶと [現在の値, 値を更新する関数] が返ってくる
  // 値が更新されると Reactが自動的に画面を再描画する

  // view: グラフの表示モード（"compare" / "pct" / "radar"）
  const [view, setView] = useState("compare");

  // data: fetchで取得したJSONデータを保持する。最初はnull
  const [data, setData] = useState(null);

  // loading: データ読み込み中かどうかを示すフラグ。最初はtrue
  const [loading, setLoading] = useState(true);

  // error: エラーメッセージを保持する。最初はnull（エラーなし）
  const [error, setError] = useState(null);

  // ── useEffectの使い方 ─────────────────────────────────────
  // useEffect(実行したい処理, [依存配列]) の形で使う
  // 依存配列が [] の場合、コンポーネントが初めて表示されたときに1回だけ実行される
  useEffect(() => {
    // fetchはブラウザ組み込みのHTTPリクエスト関数
    // Promiseを返すので .then() / .catch() でチェーンする
    fetch("/data/arsenal.json")
      // レスポンスが返ってきたら JSONに変換する
      // response.json() もPromiseを返す
      .then(response => {
        // HTTPステータスが 200以外（404, 500など）の場合はエラー扱いにする
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        return response.json();
      })
      // JSONのパースが完了したら dataに保存し、loadingをfalseにする
      .then(json => {
        setData(json);     // データをstateにセット → 画面が再描画される
        setLoading(false); // ローディング終了
      })
      // fetch自体が失敗した場合（ネットワークエラーなど）はこちらに来る
      .catch(err => {
        setError(err.message); // エラーメッセージをstateにセット
        setLoading(false);      // ローディング終了（エラー状態で）
      });
  }, []); // [] = 依存配列が空なので、マウント時に1回だけ実行

  // ── ローディング中の表示 ──────────────────────────────────
  // loading が true の間はこの画面を返す
  if (loading) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#03060F",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Space Mono', monospace",
        color: "#555",
        fontSize: 13,
      }}>
        Loading...
      </div>
    );
  }

  // ── エラー時の表示 ────────────────────────────────────────
  // error が null でない場合はエラー画面を返す
  if (error) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "#03060F",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Space Mono', monospace",
        color: "#ef4444",
        fontSize: 13,
      }}>
        Error: データを取得できませんでした
      </div>
    );
  }

  // ── データの展開 ──────────────────────────────────────────
  // ここに来た時点で data は null でないことが保証されている
  const { matches, prevRaw: PREV_RAW, totalPrev: TOTAL_2425, gamesPrev: GAMES_2425 } = data;

  // matches から flat なゴールイベント配列を生成
  const ARS_CONCEDED_2526 = matches.flatMap(m =>
    m.goals.map(time => ({ match: m.id, date: m.date, time, result: m.result }))
  );

  // 試合別サマリー（conceded = 失点数）
  const MATCHES_2526 = matches.map(m => ({
    id: m.id,
    date: m.date,
    result: m.result,
    conceded: m.goals.length,
  }));

  const GAMES_2526 = 10;
  const TOTAL_2526 = ARS_CONCEDED_2526.length;

  const comparisonData = PERIODS.map((p, i) => {
    const cur = ARS_CONCEDED_2526.filter(g => g.time >= p.min && g.time <= p.max).length;
    const prev = PREV_RAW[i];
    return {
      period: p.label,
      "2025-26（実数)": cur,
      "2024-25（10試合換算)": +(prev * GAMES_2526 / GAMES_2425).toFixed(2),
      cur,
      prev,
      curPct: +((cur / TOTAL_2526) * 100).toFixed(1),
      prevPct: +((prev / TOTAL_2425) * 100).toFixed(1),
      color: p.color,
    };
  });

  const pctData = PERIODS.map((p, i) => ({
    period: p.label,
    "2025-26": comparisonData[i].curPct,
    "2024-25": comparisonData[i].prevPct,
  }));

  const cleanSheets = MATCHES_2526.filter(m => m.conceded === 0).length;
  const atGoals2526 = comparisonData[6].cur;
  const atGoals2425 = comparisonData[6].prev;

  return (
    <div style={{
      minHeight: "100vh",
      background: "#03060F",
      color: "#fff",
      fontFamily: "'Space Mono', monospace",
      padding: "28px 20px",
      boxSizing: "border-box",
    }}>
      <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Anton&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 880, margin: "0 auto" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20, marginBottom: 28 }}>
          <div style={{ width: 6, background: TEAM_COLOR, alignSelf: "stretch", borderRadius: 3, flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "clamp(24px, 5vw, 48px)", letterSpacing: "0.04em", lineHeight: 1 }}>
              ARSENAL FC
            </div>
            <div style={{ fontFamily: "'Anton', sans-serif", fontSize: "clamp(13px, 2.2vw, 22px)", letterSpacing: "0.1em", color: TEAM_COLOR, lineHeight: 1.3 }}>
              時間帯別 失点分析 — シーズン対比
            </div>
            <div style={{ fontSize: 10, color: "#555", marginTop: 6 }}>
              2025-26（直近10試合） vs 2024-25（全38試合・PL2位）
            </div>
          </div>
        </div>

        {/* ── KPI strip ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr) repeat(2,1fr)", gap: 8, marginBottom: 24 }}>
          {[
            { label: "2025-26 総失点", value: `${TOTAL_2526}`, sub: "10試合", accent: TEAM_COLOR },
            { label: "2024-25 総失点", value: `${TOTAL_2425}`, sub: "38試合（PL最少失点）", accent: "#4ade80" },
            { label: "90'以降 2025-26", value: `${atGoals2526}`, sub: `全失点の${comparisonData[6].curPct}%`, accent: "#a855f7" },
            { label: "90'以降 2024-25", value: `${atGoals2425}`, sub: `全失点の${comparisonData[6].prevPct}%`, accent: "#818cf8" },
          ].map(({ label, value, sub, accent }) => (
            <div key={label} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderTop: `2px solid ${accent}`,
              borderRadius: 8,
              padding: "12px 14px",
            }}>
              <div style={{ fontSize: 9, color: "#666", letterSpacing: "0.08em", marginBottom: 4, textTransform: "uppercase" }}>{label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: accent, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: 10, color: "#555", marginTop: 4 }}>{sub}</div>
            </div>
          ))}
        </div>

        {/* ── View toggle ── */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[
            ["compare", "10試合換算・実数比較"],
            ["pct", "割合（%）比較"],
            ["radar", "レーダー"],
          ].map(([v, label]) => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "6px 14px",
              borderRadius: 4,
              border: view === v ? `1px solid ${TEAM_COLOR}` : "1px solid rgba(255,255,255,0.12)",
              background: view === v ? "rgba(239,1,7,0.15)" : "transparent",
              color: view === v ? TEAM_COLOR : "#888",
              fontSize: 11,
              cursor: "pointer",
              fontFamily: "'Space Mono', monospace",
            }}>{label}</button>
          ))}
        </div>

        {/* ── Main chart ── */}
        <div style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 12,
          padding: "24px 16px",
          marginBottom: 16,
          height: 300,
        }}>
          {view === "compare" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparisonData} barGap={3} barCategoryGap="25%">
                <XAxis dataKey="period" tick={{ fill: "#888", fontSize: 11, fontFamily: "'Space Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CompareTooltip comparisonData={comparisonData} />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend
                  formatter={v => <span style={{ color: v === "2025-26（実数)" ? TEAM_COLOR : "#4ade80", fontSize: 11 }}>{v}</span>}
                />
                <Bar dataKey="2025-26（実数)" fill={TEAM_COLOR} radius={[3, 3, 0, 0]} />
                <Bar dataKey="2024-25（10試合換算)" fill="#4ade80" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {view === "pct" && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pctData} barGap={3} barCategoryGap="25%">
                <XAxis dataKey="period" tick={{ fill: "#888", fontSize: 11, fontFamily: "'Space Mono', monospace" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
                <YAxis tick={{ fill: "#555", fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip content={<PctTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Legend
                  formatter={v => <span style={{ color: v === "2025-26" ? TEAM_COLOR : "#4ade80", fontSize: 11 }}>{v}</span>}
                />
                <Bar dataKey="2025-26" fill={TEAM_COLOR} radius={[3, 3, 0, 0]} />
                <Bar dataKey="2024-25" fill="#4ade80" fillOpacity={0.7} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          {view === "radar" && (
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={pctData}>
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="period" tick={{ fill: "#aaa", fontSize: 11, fontFamily: "'Space Mono', monospace" }} />
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar name="2025-26" dataKey="2025-26" stroke={TEAM_COLOR} fill={TEAM_COLOR} fillOpacity={0.3} strokeWidth={2} />
                <Radar name="2024-25" dataKey="2024-25" stroke="#4ade80" fill="#4ade80" fillOpacity={0.2} strokeWidth={2} />
                <Legend formatter={v => <span style={{ color: v === "2025-26" ? TEAM_COLOR : "#4ade80", fontSize: 11 }}>{v}</span>} />
              </RadarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── 90+ callout banner ── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(168,85,247,0.12), rgba(239,1,7,0.08))",
          border: "1px solid rgba(168,85,247,0.35)",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 20,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
        }}>
          <div>
            <div style={{ fontSize: 10, color: "#a78bfa", letterSpacing: "0.1em", marginBottom: 4 }}>⚡ 90分以降（アディショナルタイム）</div>
            <div style={{ display: "flex", gap: 24, alignItems: "baseline" }}>
              <div>
                <span style={{ fontSize: 36, fontWeight: 700, color: "#a855f7", fontFamily: "'Anton',sans-serif" }}>{atGoals2526}</span>
                <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>失点 (2025-26 · 10試合)</span>
              </div>
              <div style={{ color: "#555" }}>vs</div>
              <div>
                <span style={{ fontSize: 36, fontWeight: 700, color: "#818cf8", fontFamily: "'Anton',sans-serif" }}>{atGoals2425}</span>
                <span style={{ fontSize: 12, color: "#888", marginLeft: 6 }}>失点 (2024-25 · 全38試合)</span>
              </div>
            </div>
          </div>
          <div style={{
            marginLeft: "auto",
            background: "rgba(168,85,247,0.15)",
            border: "1px solid rgba(168,85,247,0.3)",
            borderRadius: 8,
            padding: "10px 16px",
            textAlign: "center",
            minWidth: 120,
          }}>
            <div style={{ fontSize: 10, color: "#a78bfa", marginBottom: 4 }}>全失点に占める割合</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#a855f7" }}>{comparisonData[6].curPct}%</div>
            <div style={{ fontSize: 10, color: "#666" }}>昨季 {comparisonData[6].prevPct}%</div>
          </div>
        </div>

        {/* ── 時間帯別 内訳テーブル ── */}
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>時間帯別 内訳</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 6, marginBottom: 28 }}>
          {comparisonData.map((d, i) => {
            const isAt = i === 6;
            return (
              <div key={d.period} style={{
                background: isAt ? "rgba(168,85,247,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${isAt ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.06)"}`,
                borderBottom: `2px solid ${PERIODS[i].color}`,
                borderRadius: 8,
                padding: "10px 6px",
                textAlign: "center",
              }}>
                <div style={{ fontSize: 9, color: "#666", marginBottom: 6 }}>{d.period}</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: TEAM_COLOR }}>{d.cur}</div>
                <div style={{ fontSize: 9, color: "#555", marginBottom: 4 }}>{d.curPct}%</div>
                <div style={{ height: 1, background: "rgba(255,255,255,0.07)", margin: "6px 0" }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: "#4ade80" }}>{d.prev}</div>
                <div style={{ fontSize: 9, color: "#555" }}>{d.prevPct}%</div>
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 16, marginBottom: 28, fontSize: 10, color: "#555" }}>
          <span><span style={{ color: TEAM_COLOR, fontWeight: 700 }}>赤</span> = 2025-26（実数）</span>
          <span><span style={{ color: "#4ade80", fontWeight: 700 }}>緑</span> = 2024-25（実数）</span>
        </div>

        {/* ── 試合別 失点ログ ── */}
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>2025-26 試合別 失点ログ</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 8, marginBottom: 28 }}>
          {MATCHES_2526.map(m => {
            const resultColor = m.result.startsWith("W") ? "#22c55e" : m.result.startsWith("D") ? "#f59e0b" : "#ef4444";
            return (
              <div key={m.id} style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderLeft: `3px solid ${resultColor}`,
                borderRadius: 8,
                padding: "10px 12px",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700 }}>{m.id}</span>
                  <span style={{ fontSize: 10, color: resultColor }}>{m.result}</span>
                </div>
                <div style={{ fontSize: 10, color: "#555", marginBottom: 8 }}>{m.date}</div>
                {m.conceded === 0 ? (
                  <div style={{ fontSize: 10, color: "#22c55e" }}>✓ クリーンシート</div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {ARS_CONCEDED_2526.filter(g => g.match === m.id).map((g, i) => {
                      const pidx = getPeriodIdx(g.time);
                      const c = PERIODS[pidx].color;
                      return (
                        <span key={i} style={{
                          background: `${c}22`,
                          border: `1px solid ${c}`,
                          color: c,
                          borderRadius: 3,
                          padding: "2px 6px",
                          fontSize: 10,
                        }}>{g.time}'</span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── INSIGHT ── */}
        <div style={{
          background: "rgba(239,1,7,0.05)",
          border: "1px solid rgba(239,1,7,0.18)",
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 24,
        }}>
          <div style={{ fontSize: 11, color: TEAM_COLOR, fontWeight: 700, marginBottom: 10, letterSpacing: "0.06em" }}>📊 INSIGHT</div>
          <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.9 }}>
            • <strong>61-75分帯に失点が集中（{comparisonData[4].cur}失点・{comparisonData[4].curPct}%）</strong>：今季の最大の脆弱ゾーン。Man United戦(50',87')・Wolves戦(61')・Brighton戦(63')・Brentford戦(70')と複数試合で後半に崩された
            <br/>
            • <strong>Man United戦（1/25）に3失点</strong>：37'・50'・87'と全時間帯で失点。今季唯一の敗戦がすべての時間帯別失点データに影響
            <br/>
            • 昨季（2024-25）は38試合でPL最少の{TOTAL_2425}失点を記録。今季は10試合で{TOTAL_2526}失点（{(TOTAL_2526 / GAMES_2526).toFixed(1)}失点/試合）と昨季ペース（{(TOTAL_2425 / GAMES_2425).toFixed(1)}失点/試合）を上回る
            <br/>
            • クリーンシートは10試合中{cleanSheets}試合（Liverpool・Nottm Forest・Leeds・Sunderland）と堅守は健在
          </div>
        </div>

        <div style={{ fontSize: 9, color: "#2d2d2d", lineHeight: 1.8 }}>
          ※ 2025-26データ：APIから取得した直近10試合の得点イベントより集計（2025年12月〜2026年2月）。シーズン全体ではなく標本データ。<br/>
          ※ 2024-25データ：FBref/Opta公式（全38試合34失点・PL最少）の時間帯別割合より推定算出。
        </div>

      </div>
    </div>
  );
}
