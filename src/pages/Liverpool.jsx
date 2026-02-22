// ── ライブラリの読み込み ──────────────────────────────
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, Legend
} from "recharts";
// Cell = 棒グラフの各棒に個別のスタイルを当てるための部品


// ── データ定義 ────────────────────────────────────────
// ── 試合別データ ──────────────────────────────────────
// 各試合で「何分に失点したか」を記録した配列
// result: W=勝ち, D=引き分け, L=負け
const matches = [
  { id: "TOT", date: "12/20", result: "W 2-1", goals: [83] },
  { id: "WOL", date: "12/27", result: "W 2-1", goals: [51] },
  { id: "LEE", date: "1/1",   result: "D 0-0", goals: [] },
  { id: "FUL", date: "1/4",   result: "D 2-2", goals: [17, 90] },
  { id: "ARS", date: "1/8",   result: "D 0-0", goals: [] },
  { id: "BUR", date: "1/17",  result: "D 1-1", goals: [65] },
  { id: "BOU", date: "1/24",  result: "L 2-3", goals: [26, 33, 90] },
  { id: "NEW", date: "1/31",  result: "W 4-1", goals: [36] },
  { id: "MCI", date: "2/8",   result: "L 1-2", goals: [84, 90] },
  { id: "SUN", date: "2/11",  result: "W 1-0", goals: [] },
];

// 時間帯ごとに「色」も一緒に定義する
// 後半終盤になるほど赤に近づくイメージ
const data = [
  { period: "0-15'",  goals: 0, color: "#22c55e" }, // 緑
  { period: "16-30'", goals: 2, color: "#84cc16" }, // 黄緑
  { period: "31-45'", goals: 1, color: "#eab308" }, // 黄
  { period: "46-60'", goals: 1, color: "#f97316" }, // オレンジ
  { period: "61-75'", goals: 2, color: "#ef4444" }, // 赤
  { period: "76-89'", goals: 1, color: "#dc2626" }, // 濃い赤
  { period: "90'+",   goals: 4, color: "#a855f7" }, // 紫（ATは特別）
];

// 総失点を計算する
// reduce = 配列を1つの値にまとめるJS関数
// acc（accumulator）= 合計値, curr = 現在の要素
const total = data.reduce((acc, curr) => acc + curr.goals, 0);

// 昨季（2024-25）同時間帯別失点（直近10試合相当 ※要実データ更新）
const lastSeasonGoals = [1, 3, 2, 3, 1, 2, 2];

// 今季と昨季を1つの配列にまとめる（grouped BarChart 用）
const comparisonData = data.map((d, i) => ({
  period: d.period,
  今季: d.goals,
  昨季: lastSeasonGoals[i],
}));

// クリーンシート数（今季10試合中）
const cleanSheets = 3;


// ── カスタムTooltip ───────────────────────────────────
// ホバーしたときに表示される吹き出しを自作する
// active = ホバー中かどうか, payload = データ, label = X軸の値
function CustomTooltip({ active, payload, label }) {
  // ホバー中でなければ何も表示しない
  if (!active || !payload?.length) return null;

  return (
    <div style={{
      background: "rgba(0,0,0,0.9)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "8px",
      padding: "10px 14px",
      color: "#fff",
      fontSize: "13px",
    }}>
      {/* label = 時間帯（例：90'+） */}
      <div style={{ color: "#aaa", marginBottom: "4px" }}>{label}</div>
      {/* payload[0].value = その時間帯の失点数 */}
      <div style={{ fontSize: "20px", fontWeight: "bold", color: "#C8102E" }}>
        {payload[0].value} <span style={{ fontSize: "12px", color: "#aaa" }}>失点</span>
      </div>
    </div>
  );
}


// ── 比較グラフ用 Tooltip ──────────────────────────────
function ComparisonTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "rgba(0,0,0,0.9)",
      border: "1px solid rgba(255,255,255,0.2)",
      borderRadius: "8px",
      padding: "10px 14px",
      color: "#fff",
      fontSize: "13px",
    }}>
      <div style={{ color: "#aaa", marginBottom: "6px" }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: "flex", justifyContent: "space-between", gap: "16px" }}>
          <span style={{ color: p.fill }}>{p.name}</span>
          <span style={{ fontWeight: "bold" }}>{p.value} 失点</span>
        </div>
      ))}
    </div>
  );
}


// ── メインコンポーネント ──────────────────────────────
export default function Liverpool() {
  return (
    // 画面全体：ダークテーマ
    <div style={{
      padding: "32px 48px",
      background: "#03060F",  // 濃いネイビーブラック
      minHeight: "100vh",
      color: "#fff",
      fontFamily: "monospace",
      maxWidth: "900px",
      margin: "0 auto",
    }}>

      {/* ── ヘッダー ── */}
      <div style={{ marginBottom: "28px" }}>
        {/* 左の赤いライン＋タイトルのレイアウト */}
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
          {/* 左の赤いアクセントライン */}
          <div style={{
            width: "6px",
            background: "#C8102E",
            borderRadius: "3px",
            alignSelf: "stretch",
          }} />
          <div>
            <div style={{ fontSize: "36px", fontWeight: "bold", letterSpacing: "0.05em" }}>
              LIVERPOOL FC
            </div>
            <div style={{ fontSize: "18px", color: "#C8102E", letterSpacing: "0.1em" }}>
              時間帯別 失点分析 · 2025–26
            </div>
            <div style={{ fontSize: "11px", color: "#555", marginTop: "6px" }}>
              Premier League · 直近10試合
            </div>
          </div>
        </div>
      </div>


      {/* ── KPIカード ── */}
      {/* display:grid で横並びにする */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)", // 3列均等
        gap: "10px",
        marginBottom: "28px",
      }}>

        {/* カード1：総失点 */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderTop: "2px solid #C8102E", // 上だけ赤いライン
          borderRadius: "8px",
          padding: "14px",
        }}>
          <div style={{ fontSize: "10px", color: "#666", marginBottom: "6px" }}>総失点</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#C8102E" }}>{total}</div>
        </div>

        {/* カード2：試合数 */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderTop: "2px solid #f59e0b",
          borderRadius: "8px",
          padding: "14px",
        }}>
          <div style={{ fontSize: "10px", color: "#666", marginBottom: "6px" }}>試合数</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#f59e0b" }}>10</div>
        </div>

        {/* カード3：クリーンシート */}
        <div style={{
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderTop: "2px solid #22c55e",
          borderRadius: "8px",
          padding: "14px",
        }}>
          <div style={{ fontSize: "10px", color: "#666", marginBottom: "6px" }}>クリーンシート</div>
          <div style={{ fontSize: "28px", fontWeight: "bold", color: "#22c55e" }}>{cleanSheets}</div>
        </div>

      </div>


      {/* ── グラフエリア ── */}
      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "12px",
        padding: "24px 16px",
        marginBottom: "24px",
      }}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <XAxis
              dataKey="period"
              tick={{ fill: "#888", fontSize: 12 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#666", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />

            {/* Cellで各棒に個別の色を設定する */}
            {/* data.map でデータの数だけCellを生成する */}
            <Bar dataKey="goals" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Bar>

          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* ── 昨季比較グラフ ── */}
      <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", marginBottom: "12px" }}>
        昨季比較 · 2024–25 vs 2025–26
      </div>

      {/* 凡例（手動） */}
      <div style={{ display: "flex", gap: "20px", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "12px", height: "12px", borderRadius: "2px", background: "#C8102E" }} />
          <span style={{ fontSize: "11px", color: "#aaa" }}>今季 2025–26</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <div style={{ width: "12px", height: "12px", borderRadius: "2px", background: "#22c55e" }} />
          <span style={{ fontSize: "11px", color: "#aaa" }}>昨季 2024–25</span>
        </div>
      </div>

      <div style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "12px",
        padding: "24px 16px",
        marginBottom: "28px",
      }}>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={comparisonData} barCategoryGap="25%">
            <XAxis
              dataKey="period"
              tick={{ fill: "#888", fontSize: 12 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#666", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ComparisonTooltip />} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <Bar dataKey="今季" fill="#C8102E" radius={[4, 4, 0, 0]} />
            <Bar dataKey="昨季" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── 試合別ログ ── */}
      <div style={{ fontSize: "10px", color: "#555", letterSpacing: "0.1em", marginBottom: "12px" }}>
        試合別 失点ログ
      </div>

      {/* matches配列をmapで1試合ずつカードに変換する */}
      {/* mapは「配列の要素を1つずつ取り出して、別の形に変換する」JS関数 */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)", // 5列グリッド
        gap: "8px",
      }}>
        {matches.map((match) => {
          // 結果によって左のラインの色を変える
          // 三項演算子: 条件 ? 真のとき : 偽のとき
          const borderColor =
            match.result.startsWith("W") ? "#22c55e" :  // 勝ち=緑
            match.result.startsWith("D") ? "#f59e0b" :  // 引き分け=黄
            "#ef4444";                                   // 負け=赤

          return (
            <div key={match.id} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderLeft: `3px solid ${borderColor}`, // 左ラインだけ色をつける
              borderRadius: "8px",
              padding: "10px 12px",
            }}>
              {/* 試合名と結果 */}
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "13px", fontWeight: "bold" }}>{match.id}</span>
                <span style={{ fontSize: "10px", color: borderColor }}>{match.result}</span>
              </div>

              {/* 日付 */}
              <div style={{ fontSize: "10px", color: "#555", marginBottom: "8px" }}>{match.date}</div>

              {/* 失点がない場合はクリーンシート表示 */}
              {/* 失点がある場合は分数バッジを表示 */}
              {match.goals.length === 0 ? (
                <div style={{ fontSize: "10px", color: "#22c55e" }}>✓ クリーンシート</div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {/* goalsの各分数をバッジに変換する */}
                  {match.goals.map((minute, i) => (
                    <span key={i} style={{
                      background: "rgba(200,16,46,0.2)",
                      border: "1px solid #C8102E",
                      color: "#C8102E",
                      borderRadius: "4px",
                      padding: "2px 6px",
                      fontSize: "10px",
                    }}>
                      {minute}'
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>



    </div>
  );
}
