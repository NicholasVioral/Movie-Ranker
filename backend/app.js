const express = require("express");
const cors = require("cors");
const Database = require("better-sqlite3");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// Connect to SQLite (creates rankings.db if it doesn't exist)
const db = new Database("rankings.db");

// Create tables if not exists
db.prepare(`
  CREATE TABLE IF NOT EXISTS rankings (
    userId TEXT PRIMARY KEY,
    movies TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS saved_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    listName TEXT NOT NULL,
    movies TEXT NOT NULL,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(userId, listName)
  )
`).run();

// Get rankings for user
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

// Save rankings
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

// Delete specific movie from user's rankings
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

// Get all saved lists for user
app.get("/saved-lists", (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: "Missing userId" });

  try {
    const rows = db.prepare(`
      SELECT id, listName, movies, createdAt 
      FROM saved_lists 
      WHERE userId = ? 
      ORDER BY createdAt DESC
    `).all(userId);

    const lists = rows.map(row => ({
      id: row.id,
      listName: row.listName,
      movies: JSON.parse(row.movies),
      createdAt: row.createdAt
    }));

    res.json({ success: true, lists });
  } catch (error) {
    console.error("Error fetching saved lists:", error);
    res.status(500).json({ error: "Failed to fetch saved lists" });
  }
});

// Save a new list
app.post("/saved-lists", (req, res) => {
  const { userId, listName, movies } = req.body;
  
  if (!userId || !listName || !Array.isArray(movies)) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const stmt = db.prepare(`
      INSERT INTO saved_lists (userId, listName, movies)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(userId, listName, JSON.stringify(movies));
    
    res.json({ 
      success: true, 
      list: {
        id: result.lastInsertRowid,
        listName,
        movies,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: "A list with this name already exists" });
    }
    console.error("Error saving list:", error);
    res.status(500).json({ error: "Failed to save list" });
  }
});

// Get a specific saved list
app.get("/saved-lists/:id", (req, res) => {
  const { id } = req.params;

  try {
    const row = db.prepare(`
      SELECT id, listName, movies, createdAt 
      FROM saved_lists 
      WHERE id = ?
    `).get(id);

    if (!row) {
      return res.status(404).json({ error: "List not found" });
    }

    const list = {
      id: row.id,
      listName: row.listName,
      movies: JSON.parse(row.movies),
      createdAt: row.createdAt
    };

    res.json({ success: true, list });
  } catch (error) {
    console.error("Error fetching saved list:", error);
    res.status(500).json({ error: "Failed to fetch saved list" });
  }
});

// Delete a saved list
app.delete("/saved-lists/:id", (req, res) => {
  const { id } = req.params;

  try {
    const result = db.prepare("DELETE FROM saved_lists WHERE id = ?").run(id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "List not found" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting saved list:", error);
    res.status(500).json({ error: "Failed to delete saved list" });
  }
});

// Update a saved list
app.put("/saved-lists/:id", (req, res) => {
  const { id } = req.params;
  const { listName, movies } = req.body;

  if (!listName || !Array.isArray(movies)) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    const stmt = db.prepare(`
      UPDATE saved_lists 
      SET listName = ?, movies = ? 
      WHERE id = ?
    `);

    const result = stmt.run(listName, JSON.stringify(movies), id);

    if (result.changes === 0) {
      return res.status(404).json({ error: "List not found" });
    }

    res.json({ success: true });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: "A list with this name already exists" });
    }
    console.error("Error updating saved list:", error);
    res.status(500).json({ error: "Failed to update saved list" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running with SQLite at http://localhost:${PORT}`);
});