// ── ライブラリの読み込み ──────────────────────────────
// Reactの基本機能を読み込む
import { useState } from "react";

// Rechartsからグラフに必要な部品を読み込む
// BarChart=棒グラフ本体, Bar=棒, XAxis=横軸, YAxis=縦軸
// Tooltip=ホバー時の説明, ResponsiveContainer=画面幅に合わせて伸縮
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer
} from "recharts";


// ── データ定義 ────────────────────────────────────────
// リバプールの時間帯別失点データ
// ※ これがグラフに渡す「データの配列」
//　 各オブジェクトが1本の棒に対応する
const data = [
  { period: "0-15'",  goals: 0 },
  { period: "16-30'", goals: 2 },
  { period: "31-45'", goals: 1 },
  { period: "46-60'", goals: 1 },
  { period: "61-75'", goals: 2 },
  { period: "76-89'", goals: 1 },
  { period: "90'+",   goals: 4 },
];


// ── コンポーネント定義 ────────────────────────────────
// Appという名前の部品（画面全体）を定義する
// Reactでは画面の部品のことを「コンポーネント」と呼ぶ
export default function App() {

  // ── 画面に表示するHTMLを返す ──
  return (
    <div style={{ padding: "40px", background: "#111", minHeight: "100vh", color: "#fff" }}>

      {/* タイトル */}
      <h1 style={{ color: "#C8102E", fontFamily: "sans-serif" }}>
        Liverpool FC - 時間帯別失点（2025-26）
      </h1>

      {/* グラフの表示エリア */}
      {/* ResponsiveContainerで横幅100%・高さ300pxの枠を作る */}
      <ResponsiveContainer width="100%" height={300}>

        {/* BarChartにdataを渡す。これがグラフ全体 */}
        <BarChart data={data}>

          {/* 横軸：dataKeyで「どのキーを軸にするか」を指定 */}
          <XAxis dataKey="period" stroke="#aaa" />

          {/* 縦軸：数字が自動で入る */}
          <YAxis stroke="#aaa" allowDecimals={false} />

          {/* ホバーしたときに数値を表示する */}
          <Tooltip />

          {/* 棒グラフの棒：dataKeyで「何の数値を棒の高さにするか」を指定 */}
          <Bar dataKey="goals" fill="#C8102E" />

        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}