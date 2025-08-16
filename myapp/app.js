const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Connect to SQLite (creates rankings.db if it doesn’t exist)
const db = new Database("rankings.db");

// Create table if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS rankings (
    userId TEXT PRIMARY KEY,
    movies TEXT
  )
`).run();

// GET /rankings?userId=123
app.get("/rankings", (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  const row = db.prepare("SELECT movies FROM rankings WHERE userId = ?").get(userId);

  if (!row) {
    return res.json({ movies: [] });
  }

  res.json({ movies: JSON.parse(row.movies) });
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

app.listen(PORT, () => {
  console.log(`✅ Server running with SQLite at http://localhost:${PORT}`);
});
