const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Connect to SQLite (creates rankings.db if it doesn’t exist)
const db = new Database("rankings.db");

// Create table if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS rankings (
    userId TEXT PRIMARY KEY,
    movies TEXT
  )
`).run();

app.get("/rankings", (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const row = db.prepare("SELECT movies FROM rankings WHERE userId = ?").get(userId);

  if (!row) {
    return res.json({ 
      success: true,
      movies: [],
      rankings: []
    });
  }

  const movies = JSON.parse(row.movies);
  res.json({ 
    success: true,
    movies: movies,
    rankings: movies
  });
});

// POST /rankings
app.post("/rankings", (req, res) => {
  const { userId, movies } = req.body;
  if (!userId || !Array.isArray(movies)) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const stmt = db.prepare(`
    INSERT INTO rankings (userId, movies)
    VALUES (?, ?)
    ON CONFLICT(userId) DO UPDATE SET movies=excluded.movies
  `);

  stmt.run(userId, JSON.stringify(movies));

  res.json({ success: true });
});

// DELETE /rankings/:userId/:movieTitle
app.delete("/rankings/:userId/:movieTitle", (req, res) => {
  const { userId, movieTitle } = req.params;
  if (!userId || !movieTitle) {
    return res.status(400).json({ error: "Missing userId or movieTitle" });
  }

  // Get the user's movies
  const row = db.prepare("SELECT movies FROM rankings WHERE userId = ?").get(userId);
  if (!row) {
    return res.status(404).json({ error: "User not found" });
  }

  const movies = JSON.parse(row.movies);
  const updatedMovies = movies.filter(m => m.title !== movieTitle);

  // Save the updated list
  db.prepare("UPDATE rankings SET movies = ? WHERE userId = ?").run(JSON.stringify(updatedMovies), userId);

  res.json({ success: true, movies: updatedMovies });
});


app.listen(PORT, () => {
  console.log(`✅ Server running with SQLite at http://localhost:${PORT}`);
});
