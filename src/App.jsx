import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Movie from "./Movie.jsx";
import DirectorStats from "./DirectorStats.jsx"; // Import if you have this
import { Link } from "react-router-dom";

function App() {
  return (
    <Router>
      <nav>
        {/* Add navigation links if needed */}
        <div style={{ padding: '1rem', background: '#333' }}>
          <Link to="/" style={{ color: 'white', marginRight: '1rem' }}>Movie Rankings</Link>
          <Link to="/stats" style={{ color: 'white' }}>Director Stats</Link>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<Movie />} />
        <Route path="/stats" element={<DirectorStats />} />
      </Routes>
    </Router>
  );
}

export default App;