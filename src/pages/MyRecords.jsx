import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getMyRecords } from "../lib/matchRecords";

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function Stars({ value }) {
  return (
    <span style={{ letterSpacing: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ color: n <= value ? "#f0b429" : "#2a3a4a", fontSize: 14 }}>★</span>
      ))}
    </span>
  );
}

function RecordCard({ record }) {
  const { fixture, rating, mom, memo, watched } = record;

  if (!fixture) {
    return (
      <div style={{
        background: "#0e1318", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 10, padding: "16px 18px",
        fontSize: 10, color: "#555",
      }}>
        fixture #{record.fixture_id} — データ未取得
      </div>
    );
  }

  const scored   = fixture.goals_home;
  const conceded = fixture.goals_away;

  return (
    <Link
      to={`/match/${fixture.id}`}
      style={{ textDecoration: "none" }}
    >
      <div
        style={{
          background: "#0e1318",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 10,
          padding: "16px 18px",
          transition: "border-color 0.2s, background 0.2s",
          cursor: "pointer",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.borderColor = "rgba(0,255,133,0.3)";
          e.currentTarget.style.background  = "#101820";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
          e.currentTarget.style.background  = "#0e1318";
        }}
      >
        {/* 日付・シーズン */}
        <div style={{ fontSize: 9, color: "#555", marginBottom: 10, letterSpacing: "0.06em" }}>
          {fmtDate(fixture.match_date)} · PL {fixture.season}-{String(fixture.season + 1).slice(-2)}
        </div>

        {/* スコア行 */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#ccc" }}>
            {fixture.home_team_name}
          </div>
          <div style={{
            fontFamily: "'Anton', sans-serif",
            fontSize: 22, letterSpacing: "0.06em", color: "#fff",
            flexShrink: 0,
          }}>
            {scored} — {conceded}
          </div>
          <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: "#ccc", textAlign: "right" }}>
            {fixture.away_team_name}
          </div>
        </div>

        {/* 評価・MOM */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: memo ? 8 : 0 }}>
          {rating > 0 && <Stars value={rating} />}
          {mom && (
            <span style={{ fontSize: 10, color: "#00ff85" }}>
              👑 {mom}
            </span>
          )}
        </div>

        {/* メモ */}
        {memo && (
          <div style={{
            fontSize: 10, color: "#888", lineHeight: 1.6,
            borderTop: "1px solid rgba(255,255,255,0.05)",
            paddingTop: 8, marginTop: 4,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}>
            {memo}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function MyRecords() {
  const { user, signIn, loading: authLoading } = useAuth();
  const [records, setRecords]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true); setError(null);
    getMyRecords(user.id)
      .then(setRecords)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  // ─── 未ログイン ───────────────────────────────────────────
  if (!authLoading && !user) {
    return (
      <div style={{
        minHeight: "100vh", background: "#080c10", color: "#fff",
        fontFamily: "'Space Mono', monospace",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
      }}>
        <div style={{ fontSize: 32, marginBottom: 4 }}>📋</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#ccc" }}>観戦記録を見るにはログインが必要です</div>
        <div style={{ fontSize: 10, color: "#555" }}>試合詳細ページから記録を保存できます</div>
        <button
          onClick={signIn}
          style={{
            marginTop: 8,
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 20px", borderRadius: 6, cursor: "pointer",
            background: "rgba(0,255,133,0.08)",
            border: "1px solid rgba(0,255,133,0.4)",
            color: "#00ff85", fontSize: 11, fontWeight: 700,
            fontFamily: "'Space Mono', monospace", letterSpacing: "0.08em",
          }}
        >
          Googleでログイン
        </button>
      </div>
    );
  }

  // ─── ローディング ─────────────────────────────────────────
  if (authLoading || loading) {
    return (
      <div style={{
        minHeight: "100vh", background: "#080c10", color: "#fff",
        fontFamily: "'Space Mono', monospace",
        padding: "40px 20px",
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{
              height: 100, borderRadius: 10, background: "rgba(255,255,255,0.04)",
              marginBottom: 12,
              animation: "pulse 1.4s ease-in-out infinite alternate",
            }} />
          ))}
        </div>
      </div>
    );
  }

  // ─── メイン ───────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100vh", background: "#080c10", color: "#fff",
      fontFamily: "'Space Mono', monospace", padding: "28px 20px",
    }}>
      <style>{`@keyframes pulse { from { opacity: 0.4 } to { opacity: 0.8 } }`}</style>
      <link href="https://fonts.googleapis.com/css2?family=Anton&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 720, margin: "0 auto" }}>

        {/* ヘッダー */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginBottom: 6 }}>
            <h1 style={{
              margin: 0,
              fontFamily: "'Bebas Neue', sans-serif",
              fontSize: 28, letterSpacing: "0.1em", color: "#fff",
            }}>
              MY RECORDS
            </h1>
            {records.length > 0 && (
              <span style={{ fontSize: 10, color: "#555" }}>{records.length} 試合</span>
            )}
          </div>
          <div style={{ fontSize: 9, color: "#444" }}>
            {user?.user_metadata?.full_name ?? user?.email ?? ""}
          </div>
        </div>

        {/* エラー */}
        {error && (
          <div style={{
            fontSize: 11, color: "#ef4444",
            background: "#ef444412", border: "1px solid #ef444430",
            borderRadius: 6, padding: "10px 14px", marginBottom: 16,
          }}>
            記録の取得に失敗しました: {error}
          </div>
        )}

        {/* 記録なし */}
        {!error && records.length === 0 && (
          <div style={{
            textAlign: "center", padding: "60px 0",
            color: "#444", fontSize: 11,
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div>まだ観戦記録がありません</div>
            <div style={{ marginTop: 6, fontSize: 9, color: "#333" }}>
              試合詳細ページの「観戦記録」から記録を保存できます
            </div>
            <Link to="/" style={{
              display: "inline-block", marginTop: 20,
              color: "#00ff85", fontSize: 10, textDecoration: "none",
            }}>← 試合一覧へ</Link>
          </div>
        )}

        {/* 記録一覧 */}
        {records.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {records.map(rec => (
              <RecordCard key={rec.fixture_id} record={rec} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
