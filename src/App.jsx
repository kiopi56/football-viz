// ── ライブラリの読み込み ──────────────────────────────
import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";
// Cell = 棒グラフの各棒に個別のスタイルを当てるための部品


// ── データ定義 ────────────────────────────────────────
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


// ── メインコンポーネント ──────────────────────────────
export default function App() {
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

    </div>
  );
}