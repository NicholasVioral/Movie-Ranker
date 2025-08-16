import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import "./Movie.css";

const API_KEY = "368b32a597589678671f9961e1b4ba2b"; // <-- put your TMDb API key here
const IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w200";
const GENRES_URL = `https://api.themoviedb.org/3/genre/movie/list?api_key=${API_KEY}`;

/** Helpers */
const normalize = (s = "") =>
  s
    .toString()
    .toLowerCase()
    .replace(/[\u2018\u2019\u201C\u201D]/g, "") // smart quotes
    .replace(/[^a-z0-9\s]/g, "") // remove punctuation
    .replace(/\s+/g, " ")
    .trim();

const extractYear = (s = "") => {
  const m = s.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : null;
};

const removeYearFromTitle = (s = "") =>
  s.replace(/\((?:19|20)\d{2}\)/, "").replace(/\b(?:19|20)\d{2}\b/, "").trim();

const isIrrelevantTitle = (title = "") => {
  const t = title.toLowerCase();
  const blacklist = [
    "explor",
    "set of",
    "featurette",
    "behind the scenes",
    "making of",
    "clip",
    "trailer",
    "interview",
    "gallery",
    "photos",
    "stills",
  ];
  return blacklist.some((b) => t.includes(b));
};

/** Improved search with exact-match preference and filtering */
async function fetchMovieData(rawTitle) {
  if (!rawTitle) return null;

  const year = extractYear(rawTitle);
  const cleaned = removeYearFromTitle(rawTitle);
  const normQuery = normalize(cleaned);

  const url = `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(
    cleaned
  )}${year ? `&year=${year}` : ""}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const results = data.results || [];

    // 1) Exact title match (title or original_title), normalized
    let match = results.find(
      (r) =>
        normalize(r.title) === normQuery ||
        normalize(r.original_title || "") === normQuery
    );

    // 2) If no exact, filter obvious non-movie items and prefer ones that contain query
    if (!match) {
      const filtered = results.filter((r) => !isIrrelevantTitle(r.title));
      // prefer items where the normalized title includes the normalized query
      match =
        filtered.find(
          (r) =>
            normalize(r.title).includes(normQuery) ||
            normalize(r.original_title || "").includes(normQuery)
        ) ||
        filtered.find(
          (r) =>
            normalize(r.title).startsWith(normQuery) ||
            normalize(r.original_title || "").startsWith(normQuery)
        );
      // fallback: take most popular / most voted (prefer one with poster)
      if (!match && filtered.length > 0) {
        const sorted = filtered
          .slice()
          .sort(
            (a, b) =>
              (b.vote_count || 0) - (a.vote_count || 0) ||
              (b.popularity || 0) - (a.popularity || 0)
          );
        match = sorted.find((r) => r.poster_path) || sorted[0];
      }
    }

    // 3) final fallback: if we've still got nothing, try the original results same strategy (in case filter removed everything)
    if (!match && results.length > 0) {
      const sorted = results
        .slice()
        .sort(
          (a, b) =>
            (b.vote_count || 0) - (a.vote_count || 0) ||
            (b.popularity || 0) - (a.popularity || 0)
        );
      match =
        sorted.find(
          (r) => !isIrrelevantTitle(r.title) && r.poster_path
        ) || sorted[0];
    }

    if (!match) return null;

    // Fetch additional details including genres and score
    const detailsUrl = `https://api.themoviedb.org/3/movie/${match.id}?api_key=${API_KEY}`;
    const detailsRes = await fetch(detailsUrl);
    const details = await detailsRes.json();

    return {
      id: match.id,
      title: match.title,
      url: `https://www.themoviedb.org/movie/${match.id}`,
      poster: match.poster_path
        ? `${IMAGE_BASE_URL}${match.poster_path}`
        : null,
      score: match.vote_average,
      genres: details.genres || [],
      releaseDate: details.release_date || null,
    };
  } catch (err) {
    console.error("TMDb fetch error", err);
    return null;
  }
}

function SortableItem({ movie, rank }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: movie.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="movie-item"
    >
      <span className="rank">{rank}.</span>
      {movie.poster && (
        <img src={movie.poster} alt={movie.title} className="poster" />
      )}
      <div className="movie-details">
        <a href={movie.url} target="_blank" rel="noopener noreferrer">
          {movie.title}
        </a>
        <div className="movie-meta">
          {movie.score && <span className="score">⭐ {movie.score.toFixed(1)}</span>}
          {movie.genres.length > 0 && (
            <span className="genres">
              {movie.genres.map(g => g.name).join(", ")}
            </span>
          )}
          {movie.releaseDate && (
            <span className="year">
              ({new Date(movie.releaseDate).getFullYear()})
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Movie() {
  const [movies, setMovies] = useState([]);
  const [allGenres, setAllGenres] = useState([]);
  const [selectedGenre, setSelectedGenre] = useState("all");
  const [sortBy, setSortBy] = useState("rank");
  const [isLoading, setIsLoading] = useState(false);
  const USER_ID = "12345"
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    // Fetch all available genres
    const fetchGenres = async () => {
      try {
        const res = await fetch(GENRES_URL);
        const data = await res.json();
        setAllGenres(data.genres || []);
      } catch (err) {
        console.error("Failed to fetch genres", err);
      }
    };

    const fetchRankings = async () => {
      try {
        const res = await fetch(`http://localhost:5000/rankings?userId=${USER_ID}`);
        if (res.ok) {
          const data = await res.json();
          if (data.movies) setMovies(data.movies);
        }
      } catch (err) {
        console.error("Failed to fetch rankings", err);
      }
    };
    
    fetchGenres();
    fetchRankings();
  }, []);

  const saveRankings = async (updatedMovies) => {
    try {
      await fetch("http://localhost:5000/rankings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: USER_ID,
          movies: updatedMovies
        })
      });
      setSaveMessage("✅ Rankings saved!");
      // Clear the message after a few seconds
      setTimeout(() => setSaveMessage(""), 3000);
    } catch (err) {
      console.error("Failed to save rankings", err);
      setSaveMessage("⚠ Failed to save rankings");
      setTimeout(() => setSaveMessage(""), 3000);
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rawTitle = e.target.elements[0].value.trim();
    if (!rawTitle) return;

    setIsLoading(true);
    const movieObj = await fetchMovieData(rawTitle);
    setIsLoading(false);
    
    if (movieObj) {
      setMovies((prev) => {
        const updated = [...prev, movieObj];
        saveRankings(updated);
        return updated;
      });
    } else {
      alert(`No good exact match found for "${rawTitle}". Try adding a year.`);
    }

    e.target.reset();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const text = await file.text();
    const titles = text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const movieList = [];
    const notFound = [];

    // Sequential fetch to preserve order and avoid rate limits
    for (const t of titles) {
      const movieObj = await fetchMovieData(t);
      if (movieObj) movieList.push(movieObj);
      else notFound.push(t);
    }

    if (movieList.length > 0) {
      setMovies(movieList);
      saveRankings(movieList);
    }
    if (notFound.length > 0) {
      alert(`These titles had no good matches and were skipped:\n\n${notFound.join("\n")}`);
    }

    setIsLoading(false);
    // reset file input so same file can be re-uploaded if needed
    e.target.value = "";
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setMovies((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const updated = arrayMove(items, oldIndex, newIndex);
      return updated;
    });
  };

  const filteredAndSortedMovies = () => {
    let result = [...movies];
    
    // Filter by genre
    if (selectedGenre !== "all") {
      const genreId = parseInt(selectedGenre);
      result = result.filter(movie => 
        movie.genres.some(g => g.id === genreId)
      );
    }
    
    // Sort by selected option
    switch(sortBy) {
      case "score":
        result.sort((a, b) => (b.score || 0) - (a.score || 0));
        break;
      case "title":
        result.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case "year":
        result.sort((a, b) => 
          (new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime())
        );
        break;
      case "rank":
      default:
        // Maintain current order (drag-sorted order)
        break;
    }
    
    return result;
  };

  const clearList = () => {
    if (window.confirm("Are you sure you want to clear all movies?")) {
      setMovies([]);
      saveRankings([]);
    }
  };


  return (
    <div className="movie">
      <h1>My Movie Rankings</h1>

      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Movie Title" />
        <button type="submit">Add Movie</button>
      </form>

      <div className="controls">
        <div className="control-group">
          <label htmlFor="genre-filter">Filter by Genre:</label>
          <select 
            id="genre-filter"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
          >
            <option value="all">All Genres</option>
            {allGenres.map(genre => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
              </option>
            ))}
          </select>
        </div>

        <div className="save-feedback">{saveMessage}</div>
        <button
          type="button"
          onClick={() => saveRankings(movies)}
          disabled={movies.length === 0}
          className="save-btn"
        >
          Save Rankings
        </button>



        <div className="control-group">
          <label htmlFor="sort-by">Sort by:</label>
          <select
            id="sort-by"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="rank">Current Rank</option>
            <option value="score">Rating Score</option>
            <option value="title">Title (A-Z)</option>
            <option value="year">Release Year (Newest)</option>
          </select>
        </div>

        <button 
          type="button" 
          onClick={clearList}
          className="clear-btn"
        >
          Clear List
        </button>
      </div>

      <input 
        type="file" 
        accept=".txt" 
        onChange={handleFileUpload} 
        className="file-upload"
      />

      {isLoading && <div className="loading">Loading movie data...</div>}

      <div className="movie-count">
        Showing {filteredAndSortedMovies().length} of {movies.length} movies
      </div>

      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext
          items={movies.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          {filteredAndSortedMovies().map((movie, index) => (
            <SortableItem 
              key={movie.id} 
              movie={movie} 
              rank={sortBy === "rank" ? index + 1 : null} 
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}