import { HashRouter, Routes, Route, NavLink } from "react-router-dom";
import Home from "./pages/Home";
import Liverpool from "./pages/Liverpool";
import Arsenal from "./pages/Arsenal";

const navStyle = {
  background: "#03060F",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  padding: "0 48px",
  display: "flex",
  gap: "0",
  fontFamily: "monospace",
};

const linkBase = {
  display: "inline-block",
  padding: "14px 20px",
  fontSize: "12px",
  letterSpacing: "0.1em",
  color: "#555",
  textDecoration: "none",
  borderBottom: "2px solid transparent",
  transition: "color 0.2s, border-color 0.2s",
};

export default function App() {
  return (
    <HashRouter>
      {/* ── NavBar ── */}
      <nav style={navStyle}>
        <NavLink
          to="/"
          end
          style={({ isActive }) => ({
            ...linkBase,
            color: isActive ? "#fff" : "#555",
            borderBottomColor: isActive ? "#888" : "transparent",
          })}
        >
          HOME
        </NavLink>
        <NavLink
          to="/liverpool"
          style={({ isActive }) => ({
            ...linkBase,
            color: isActive ? "#fff" : "#555",
            borderBottomColor: isActive ? "#C8102E" : "transparent",
          })}
        >
          LIVERPOOL
        </NavLink>
        <NavLink
          to="/arsenal"
          style={({ isActive }) => ({
            ...linkBase,
            color: isActive ? "#fff" : "#555",
            borderBottomColor: isActive ? "#EF0107" : "transparent",
          })}
        >
          ARSENAL
        </NavLink>
      </nav>

      {/* ── ページコンテンツ ── */}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/liverpool" element={<Liverpool />} />
        <Route path="/arsenal" element={<Arsenal />} />
      </Routes>
    </HashRouter>
  );
}
