import { HashRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Home        from "./pages/Home";
import TeamDetail  from "./pages/TeamDetail";
import Compare     from "./pages/Compare";
import MatchDetail  from "./pages/MatchDetail";
import PlayerDetail from "./pages/PlayerDetail";

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
