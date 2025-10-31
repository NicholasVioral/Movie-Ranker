import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  useDroppable,
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
import Papa from "papaparse";
import DirectorStats from "./DirectorStats";

const API_KEY = "368b32a597589678671f9961e1b4ba2b";
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
/** Improved search with exact-match preference and filtering - NOW WITH DIRECTOR DATA */
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

    // Fetch additional details including genres, score, AND DIRECTOR
    const detailsUrl = `https://api.themoviedb.org/3/movie/${match.id}?api_key=${API_KEY}&append_to_response=credits`;
    const detailsRes = await fetch(detailsUrl);
    const details = await detailsRes.json();

    // Extract director from credits
    const director = details.credits?.crew?.find(
      (person) => person.job === "Director"
    )?.name || "Unknown Director";

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
      director: director, // Add director information
    };
  } catch (err) {
    console.error("TMDb fetch error", err);
    return null;
  }
}

function SortableItem({ movie, rank, onDelete, setMovies, saveRankings }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: movie.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="movie-item">
      <span className="rank">{rank}.</span>
      {movie.poster && <img src={movie.poster} alt={movie.title} className="poster" />}

      <div className="movie-details">
        <a href={movie.url} target="_blank" rel="noopener noreferrer">{movie.title}</a>
        <div className="movie-meta">
          {movie.score && <span className="score">⭐ {movie.score.toFixed(1)}</span>}
          {Array.isArray(movie.genres) && movie.genres.length > 0 && (
            <span className="genres">
              {movie.genres.map((g) => g.name).join(", ")}
            </span>
          )}
          {movie.releaseDate && (
            <span className="year">({new Date(movie.releaseDate).getFullYear()})</span>
          )}
        </div>
      </div>

      {movie.userRating == null && (
        <select
          onChange={(e) => {
            const newRating = Number(e.target.value);
            setMovies((prev) => {
              const updated = prev.map((m) =>
                m.id === movie.id ? { ...m, userRating: newRating } : m
              );
              saveRankings(updated);
              return updated;
            });
          }}
        >
          <option value="">Set Rating</option>
          {[10,9,8,7,6,5,4,3,2,1].map(r => (
            <option key={r} value={r}>{r}★</option>
          ))}
        </select>
      )}

      <button
        className="delete-btn"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onDelete(movie.title)}
      >
        ❌
      </button>
    </div>
  );
}

function DroppablePlaceholder({ rating }) {
  const { setNodeRef } = useDroppable({
    id: rating.toString(),
  });

  return (
    <div ref={setNodeRef} className="empty-placeholder" data-rating={rating}>
      
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
  const [filterRating, setFilterRating] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResult, setSearchResult] = useState(null);


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
          if (data.movies) {
            const repairedMovies = await Promise.all(
              data.movies.map(async (movie) => {
                if (!movie.poster && movie.title) {
                  const fetched = await fetchMovieData(movie.title);
                  return fetched ? { ...movie, ...fetched } : movie;
                }
                return movie;
              })
            );
            setMovies(repairedMovies);
          }
        }
      } catch (err) {
        console.error("Failed to fetch rankings", err);
      }
    };

    fetchGenres();
    fetchRankings();
  }, []);

  const handleSearch = () => {
    const result = movies.find(
      (m) => m.title.toLowerCase() === searchTerm.toLowerCase()
    );

    if (!result) {
      setSearchResult(null);
      return;
    }

    // Find its rank within its rating group
    const group = movies.filter((m) => m.userRating === result.userRating);
    const rankInGroup = group.findIndex((m) => m.id === result.id) + 1;

    setSearchResult({
      ...result,
      rankInGroup,
    });
  };


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
      const newMovie = { ...movieObj, userRating: null }; // ✅ unsorted
      setMovies((prev) => {
        const updated = [newMovie, ...prev];
        saveRankings(updated);
        return updated;
      });
    } else {
      alert(`No good exact match found for "${rawTitle}". Try adding a year.`);
    }
    e.target.reset();
  };

  const handleDelete = async (title) => {
    console.log("Delete clicked for:", title);
    if (!window.confirm(`Delete "${title}" from your list?`)) return;

    try {
      const res = await fetch(
        `http://localhost:5000/rankings/${USER_ID}/${encodeURIComponent(title)}`,
        { method: "DELETE" }
      );
      console.log("Response status:", res.status);
      const data = await res.json();
      console.log("Response data:", data);

      if (res.ok) {
        const updated = movies.filter((m) => m.title !== title);
        setMovies(updated);
        saveRankings(updated);
      } else {
        alert("Failed to delete movie");
      }
    } catch (err) {
      console.error("Failed to delete movie", err);
    }
  };

  const handleImdbImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsedMovies = results.data
          .filter((row) => row["Title Type"]?.toLowerCase() === "movie") // ✅ only movies
          .map((row) => ({
            title: row.Title?.replace(/"/g, "").trim(),
            imdbRating: parseFloat(row["IMDb Rating"]) || 0,
            userRating: row["Your Rating"] ? parseInt(row["Your Rating"]) : null,
            url: row.URL?.trim(),
            year: row.Year?.trim(),
            genres: row.Genres?.trim(),
            director: row.Directors?.trim(),
          }));

        setMovies(parsedMovies);
        saveRankings(parsedMovies);
      },
    });
  };


  const handleLetterboxdImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        setIsLoading(true);
        
        const parsedMovies = await Promise.all(
          results.data.map(async (row) => {
            const title = row.Name?.trim();
            const year = row.Year;
            const rawRating = parseFloat(row.Rating);
            const rating = isNaN(rawRating) ? null : rawRating * 2; // Convert 5★ → 10★
            const url = row["Letterboxd URI"];

            // Try to fetch movie data from TMDb for poster, genres, director, etc.
            const fetched = await fetchMovieData(`${title} ${year}`);
            
            if (fetched) {
              return {
                title,
                year,
                userRating: rating,
                url,
                ...fetched,
                // Ensure we have director data
                director: fetched.director || "Unknown Director"
              };
            } else {
              // Fallback if TMDb search fails
              return {
                title,
                year,
                userRating: rating,
                url,
                director: "Unknown Director",
                id: crypto.randomUUID()
              };
            }
          })
        );

        // Filter out null results and merge with existing movies
        const validMovies = parsedMovies.filter(movie => movie !== null);
        
        setMovies((prev) => {
          const updated = [...prev, ...validMovies];
          saveRankings(updated);
          return updated;
        });
        
        setIsLoading(false);
      },
    });
  };

  const groupByRating = (movies) => {
    // Pre-fill all groups 10 → 1 and Unsorted
    const groups = { Unsorted: [] };
    for (let r = 10; r >= 1; r--) groups[r] = [];

    movies.forEach((movie) => {
      const rating = movie.userRating == null ? "Unsorted" : movie.userRating;
      if (!groups[rating]) groups[rating] = [];
      groups[rating].push(movie);
    });

    return groups;
  };



  const displayedMovies = filterRating === "All"
  ? movies
  : movies.filter(movie => movie.userRating === Number(filterRating));


  const TMDB_API_KEY = "YOUR_TMDB_KEY";

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const text = await file.text();
    const titles = text
      .split("\n")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setIsLoading(true);

    const newMovies = [];

    for (const title of titles) {
      try {
        // 1. Search TMDb by title
        const searchRes = await fetch(
          `https://api.themoviedb.org/3/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(
            title
          )}`
        );
        const searchData = await searchRes.json();

        if (searchData.results && searchData.results.length > 0) {
          const movieId = searchData.results[0].id;

          // 2. Get full movie details (includes crew info)
          const detailsRes = await fetch(
            `https://api.themoviedb.org/3/movie/${movieId}?api_key=${API_KEY}&append_to_response=credits`
          );
          const details = await detailsRes.json();

          const director = details.credits.crew.find(
            (c) => c.job === "Director"
          )?.name;

          const writers = details.credits.crew
            .filter((c) => c.department === "Writing")
            .map((c) => c.name);

          newMovies.push({
            id: movieId,
            title: details.title,
            year: details.release_date?.split("-")[0] || "N/A",
            director: director || "Unknown",
            writers: writers.length ? writers : ["Unknown"],
            genres: details.genres.map((g) => g.name),
            poster: details.poster_path
              ? `https://image.tmdb.org/t/p/w500${details.poster_path}`
              : null,
            userRating: null, // stays unsorted
            rank: null,
          });
        } else {
          // fallback if no TMDb match
          newMovies.push({
            id: crypto.randomUUID(),
            title,
            userRating: null,
            rank: null,
          });
        }
      } catch (err) {
        console.error("TMDb fetch error:", err);
      }
    }

    // 3. Merge new movies into your existing state
    setMovies((prev) => [...prev, ...newMovies]);
    setIsLoading(false);
  };


  const handleExport = () => {
    if (!movies || movies.length === 0) {
      alert("No movies to export!");
      return;
    }

    const headers = [
      "Rank",
      "Title",
      "Your Rating",
      "IMDb Rating",
      "Year",
      "Genres",
      "Director",
      "URL",
    ];

    // Sort movies by user rating (highest first)
    const sortedMovies = [...movies].sort((a, b) => (b.userRating || 0) - (a.userRating || 0));

    const rows = sortedMovies.map((m, i) => {
      // ✅ Safely convert genres to readable text
      const genres = Array.isArray(m.genres)
        ? m.genres.map((g) => (typeof g === "object" ? g.name : g)).join(", ")
        : m.genres || "";

      return [
        i + 1,
        `"${m.title}"`,
        m.userRating ?? "",
        m.imdbRating ?? "",
        m.year ?? "",
        `"${genres}"`,
        `"${m.director || ""}"`,
        m.url ?? "",
      ];
    });

    const csvContent = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "movie_rankings.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const activeMovie = movies.find((m) => m.id === activeId);
    if (!activeMovie) return;

    let overContainerId = null;

    // --- If dropping on an empty placeholder ---
    if (typeof over.id === "string" && (over.id === "Unsorted" || !isNaN(Number(over.id)))) {
      overContainerId = over.id;
    } 
    // --- If dropping over another movie ---
    else if (over.id) {
      const overMovie = movies.find((m) => m.id === over.id);
      overContainerId = overMovie
        ? (overMovie.userRating == null ? "Unsorted" : overMovie.userRating.toString())
        : null;
    }

    if (!overContainerId) return;

    const newRating = overContainerId === "Unsorted" ? null : parseInt(overContainerId, 10);
    const hasChangedTier = activeMovie.userRating !== newRating;

    setMovies((prevMovies) => {
      let updated = [...prevMovies];

      if (hasChangedTier) {
        // ✅ Move to a different rating group (even if empty)
        updated = updated
          .filter((m) => m.id !== activeId)
          .concat({ ...activeMovie, userRating: newRating });
      } else {
        // ✅ Reorder within the same group
        const oldIndex = prevMovies.findIndex((m) => m.id === activeId);
        const newIndex = prevMovies.findIndex((m) => m.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          updated = arrayMove(prevMovies, oldIndex, newIndex);
        }
      }

      saveRankings(updated);
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

      {/* === Add Movie Form === */}
      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Movie Title" />
        <button type="submit">Add Movie</button>
      </form>

      {/* === Top Controls === */}
      <div className="controls">

        {/* === Filters === */}
        <div className="control-group">
          <label htmlFor="genre-filter">Genre:</label>
          <select
            id="genre-filter"
            value={selectedGenre}
            onChange={(e) => setSelectedGenre(e.target.value)}
          >
            <option value="all">All Genres</option>
            {allGenres.map((genre) => (
              <option key={genre.id} value={genre.id}>
                {genre.name}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label htmlFor="filter-rating">Rating:</label>
          <select
            id="filter-rating"
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value)}
          >
            <option value="All">All</option>
            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={r}>
                {r}-Star
              </option>
            ))}
          </select>
        </div>

        {/* === Sorting === */}
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
      </div>

      {/* === Import / Export / Save === */}
      <div className="controls">
        <label className="import-btn">
          Import IMDb
          <input
            type="file"
            accept=".csv"
            onChange={handleImdbImport}
            style={{ display: "none" }}
          />
        </label>

        <label className="import-btn">
          Import Letterboxd
          <input
            type="file"
            accept=".csv"
            onChange={handleLetterboxdImport}
            style={{ display: "none" }}
          />
        </label>

        <label className="import-btn">
          📁 Import Notes
          <input
            type="file"
            accept=".txt"
            onChange={handleFileUpload}
            className="file-upload"
            style={{ display: "none" }}
          />
        </label>

        <button
          type="button"
          onClick={() => saveRankings(movies)}
          disabled={movies.length === 0}
          className="save-btn"
        >
          Save Rankings
        </button>

        <button className="export-btn" onClick={handleExport}>
          Export Rankings
        </button>

        <button
          type="button"
          onClick={clearList}
          className="clear-btn"
        >
          Clear List
        </button>
      </div>

      {/* === Status Message === */}
      {saveMessage && <div className="save-feedback">{saveMessage}</div>}

      {/* === Movie Count === */}
      <div className="movie-count">
        Showing {filteredAndSortedMovies().length} of {movies.length} movies
      </div>

      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        {Object.entries(
          groupByRating(
            filterRating === "All"
              ? filteredAndSortedMovies()
              : filteredAndSortedMovies().filter(
                  (m) => m.userRating === Number(filterRating)
                )
          )
        )
          .sort(([aKey], [bKey]) => {
            if (aKey === "Unsorted") return -1;
            if (bKey === "Unsorted") return 1;
            return bKey - aKey;
          })
          .map(([rating, group]) => (
            <SortableContext
              key={rating}
              id={rating.toString()}
              items={group.map((m) => m.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="rating-group" data-rating={rating}>
                <h2 className="rating-divider">
                  {rating === "Unsorted" ? "🎬 Unsorted Movies" : `${rating}★ Movies`}
                </h2>

                {group.map((movie, index) => (
                  <SortableItem
                    key={movie.id}
                    movie={movie}
                    rank={index + 1}
                    onDelete={handleDelete}
                    setMovies={setMovies}
                    saveRankings={saveRankings}
                  />
                ))}
                {group.length === 0 && (
                  <DroppablePlaceholder rating={rating} />
                )}
              </div>
            </SortableContext>
          ))}
      </DndContext>

    </div>
  );
}

{/* <div className="search-container">
          <input
            type="text"
            placeholder="Search movie..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button onClick={handleSearch}>Search</button>
        </div>

        {searchResult && (
          <div className="search-result">
            🎬 <strong>{searchResult.title}</strong>{" "}
            {searchResult.userRating
              ? `is ranked #${searchResult.rankInGroup} in ${searchResult.userRating}★ Movies`
              : "is currently Unrated"}
          </div>
        )} */}