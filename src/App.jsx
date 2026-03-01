import { HashRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Home        from "./pages/Home";
import TeamDetail  from "./pages/TeamDetail";
import Compare     from "./pages/Compare";
import MatchDetail  from "./pages/MatchDetail";
import PlayerDetail from "./pages/PlayerDetail";
import MyRecords    from "./pages/MyRecords";
import { useAuth } from "./contexts/AuthContext";

const NAV_BG = "#080c10";

const linkBase = {
  display:        "inline-block",
  padding:        "14px 22px",
  fontSize:       "12px",
  letterSpacing:  "0.12em",
  color:          "#3a5060",
  textDecoration: "none",
  borderBottom:   "2px solid transparent",
  transition:     "color 0.2s, border-color 0.2s",
  fontFamily:     "'Barlow', sans-serif",
  fontWeight:     600,
};

function MyRecordsLink() {
  const { user } = useAuth();
  if (!user) return null;
  return (
    <NavLink
      to="/my-records"
      style={({ isActive }) => ({
        ...linkBase,
        color:             isActive ? "#fff" : "#3a5060",
        borderBottomColor: isActive ? "#00ff85" : "transparent",
      })}
    >
      MY RECORDS
    </NavLink>
  );
}

function AuthButton() {
  const { user, loading, signIn, signOut, displayName, avatarUrl } = useAuth();
  if (loading) return null;
  if (!user) {
    return (
      <button
        onClick={signIn}
        style={{
          marginLeft:      16,
          display:         "flex",
          alignItems:      "center",
          gap:             8,
          padding:         "6px 14px",
          background:      "transparent",
          border:          "1px solid #2a3a4a",
          borderRadius:    6,
          cursor:          "pointer",
          color:           "#aaa",
          fontSize:        11,
          fontFamily:      "'Barlow', sans-serif",
          fontWeight:      600,
          letterSpacing:   "0.08em",
          transition:      "border-color 0.2s, color 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#fff"; e.currentTarget.style.color = "#fff"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a3a4a"; e.currentTarget.style.color = "#aaa"; }}
      >
        {/* Google G icon */}
        <svg width="14" height="14" viewBox="0 0 18 18" fill="none">
          <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
          <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
          <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
          <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
        </svg>
        LOGIN
      </button>
    );
  }
  return (
    <div style={{ marginLeft: 16, display: "flex", alignItems: "center", gap: 10 }}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={displayName ?? "user"} width={28} height={28} style={{ borderRadius: "50%", objectFit: "cover", border: "1px solid #2a3a4a" }} />
      ) : (
        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a2530", border: "1px solid #2a3a4a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#aaa" }}>
          {(displayName ?? "?")[0].toUpperCase()}
        </div>
      )}
      <span style={{ fontSize: 11, color: "#aaa", fontFamily: "'Barlow', sans-serif", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {displayName}
      </span>
      <button
        onClick={signOut}
        style={{
          padding:       "4px 10px",
          background:    "transparent",
          border:        "1px solid #2a3a4a",
          borderRadius:  5,
          cursor:        "pointer",
          color:         "#666",
          fontSize:      10,
          fontFamily:    "'Barlow', sans-serif",
          fontWeight:    600,
          letterSpacing: "0.08em",
          transition:    "border-color 0.2s, color 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "#c8102e"; e.currentTarget.style.color = "#c8102e"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "#2a3a4a"; e.currentTarget.style.color = "#666"; }}
      >
        LOGOUT
      </button>
    </div>
  );
}

function NavBar() {
  return (
    <nav style={{
      background:    NAV_BG,
      borderBottom:  "1px solid #1a2530",
      padding:       "0 44px",
      display:       "flex",
      alignItems:    "center",
      gap:           0,
      position:      "sticky",
      top:           0,
      zIndex:        100,
    }}>
      {/* ロゴ */}
      <NavLink to="/" end style={{ textDecoration: "none", marginRight: "auto" }}>
        <span style={{
          fontFamily:    "'Bebas Neue', sans-serif",
          fontSize:      18,
          letterSpacing: "0.06em",
          color:         "#fff",
          padding:       "16px 0",
          display:       "inline-block",
        }}>
          FOOTBALL<span style={{ color: "#c8102e" }}>-VIZ</span>
        </span>
      </NavLink>

      {/* ナビリンク */}
      <NavLink
        to="/"
        end
        style={({ isActive }) => ({
          ...linkBase,
          color:           isActive ? "#fff" : "#3a5060",
          borderBottomColor: isActive ? "#00ff85" : "transparent",
        })}
      >
        HOME
      </NavLink>
      <NavLink
        to="/compare"
        style={({ isActive }) => ({
          ...linkBase,
          color:           isActive ? "#fff" : "#3a5060",
          borderBottomColor: isActive ? "#6CABDD" : "transparent",
        })}
      >
        COMPARE
      </NavLink>
      {/* ログイン済みのみ表示 */}
      <MyRecordsLink />

      {/* 認証ボタン */}
      <AuthButton />
    </nav>
  );
}

export default function App() {
  return (
    <HashRouter>
      <NavBar />
      <Routes>
        <Route path="/"                    element={<Home />} />
        <Route path="/team/:teamSlug"    element={<TeamDetail />} />
        <Route path="/match/:fixtureId"  element={<MatchDetail />} />
        <Route path="/player/:playerId"  element={<PlayerDetail />} />
        <Route path="/compare"           element={<Compare />} />
        <Route path="/my-records"        element={<MyRecords />} />
        {/* 後方互換：旧URLをslugベースにリダイレクト */}
        <Route path="/liverpool"         element={<Navigate to="/team/liverpool" replace />} />
        <Route path="/arsenal"           element={<Navigate to="/team/arsenal"   replace />} />
        <Route path="/team/40"           element={<Navigate to="/team/liverpool" replace />} />
        <Route path="/team/42"           element={<Navigate to="/team/arsenal"   replace />} />
        {/* 404: HOME にフォールバック */}
        <Route path="*"                  element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
