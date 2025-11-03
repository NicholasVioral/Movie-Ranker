import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import Movie from "./Movie.jsx";
import DirectorStats from "./DirectorStats.jsx";
import "./App.css"; // 👈 new CSS file for styling

function NavBar() {
  const location = useLocation();

  return (
    <nav className="navbar">
      <div className="nav-container">
        <h1 className="nav-title">🎬 MovieRanker</h1>
        <div className="nav-links">
          <Link
            to="/"
            className={`nav-link ${location.pathname === "/" ? "active" : ""}`}
          >
            Movies
          </Link>
          <Link
            to="/stats"
            className={`nav-link ${location.pathname === "/stats" ? "active" : ""}`}
          >
            Stats
          </Link>
        </div>
      </div>
    </nav>
  );
}

function App() {
  return (
    <Router>
      <NavBar />
      <Routes>
        <Route path="/" element={<Movie />} />
        <Route path="/stats" element={<DirectorStats />} />
      </Routes>
    </Router>
  );
}

export default App;
