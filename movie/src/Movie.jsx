import { useState } from "react";

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

    return {
      id: match.id,
      title: match.title,
      url: `https://www.themoviedb.org/movie/${match.id}`,
      poster: match.poster_path
        ? `${IMAGE_BASE_URL}${match.poster_path}`
        : null,
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
      <a href={movie.url} target="_blank" rel="noopener noreferrer">
        {movie.title}
      </a>
    </div>
  );
}

export default function Movie() {
  const [movies, setMovies] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rawTitle = e.target.elements[0].value.trim();
    if (!rawTitle) return;

    const movieObj = await fetchMovieData(rawTitle);
    if (movieObj) {
      setMovies((prev) => [...prev, movieObj]);
    } else {
      alert(
        `No good exact match found for "${rawTitle}". Try adding a year (e.g. "Moonrise Kingdom 2012") or check spelling.`
      );
    }

    e.target.reset();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    if (movieList.length > 0) setMovies(movieList);
    if (notFound.length > 0) {
      alert(`These titles had no good matches and were skipped:\n\n${notFound.join("\n")}`);
    }

    // reset file input so same file can be re-uploaded if needed
    e.target.value = "";
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setMovies((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  return (
    <div className="movie">
      <h1>My Movie Rankings</h1>

      <form onSubmit={handleSubmit}>
        <input type="text" placeholder="Movie Title" />
        <button type="submit">Add Movie</button>
      </form>

      <input type="file" accept=".txt" onChange={handleFileUpload} />

      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext
          items={movies.map((m) => m.id)}
          strategy={verticalListSortingStrategy}
        >
          {movies.map((movie, index) => (
            <SortableItem key={movie.id} movie={movie} rank={index + 1} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
