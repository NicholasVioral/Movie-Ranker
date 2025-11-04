import { useState, useEffect, useMemo } from "react";
import "./DirectorStats.css";

export default function DirectorStats() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const USER_ID = "12345";
  const [sortMode, setSortMode] = useState("rating");
  const [selectedDirector, setSelectedDirector] = useState(null);
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [selectedTimePeriod, setSelectedTimePeriod] = useState(null);


  useEffect(() => {
    let isMounted = true;

    async function fetchMovies() {
      try {
        const res = await fetch(`http://localhost:5000/rankings?userId=${USER_ID}`);
        const data = await res.json();
        
        if (isMounted) {
          const moviesData = data.movies || [];
          setMovies(moviesData);
        }
      } catch (err) {
        console.error("❌ Failed to fetch stats:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchMovies();

    return () => {
      isMounted = false;
    };
  }, []);

  const statistics = useMemo(() => {
    const ratedMovies = movies.filter((m) => m.userRating != null);
    const totalMovies = ratedMovies.length;

    // Calculate overall average rating - keep as number for precision
    const avgRatingValue = totalMovies > 0
      ? ratedMovies.reduce((sum, m) => sum + Number(m.userRating || 0), 0) / totalMovies
      : 0;

    const avgRating = totalMovies > 0 ? avgRatingValue.toFixed(2) : "N/A";

    const ratingDistribution = {};
    for (let i = 1; i <= 10; i++) {
      ratingDistribution[i] = ratedMovies.filter(m => m.userRating === i).length;
    }

    const directorMap = {};
    ratedMovies.forEach(movie => {
      const dir = movie.director || "Unknown Director";
      if (!directorMap[dir]) directorMap[dir] = { total: 0, count: 0, movies: [], ratings: [] };
      const rating = Number(movie.userRating || 0);
      directorMap[dir].total += rating;
      directorMap[dir].count += 1;
      directorMap[dir].movies.push(movie.title);
      directorMap[dir].ratings.push(rating); // Store individual ratings for debugging
    });

    const directorStats = Object.entries(directorMap)
      .map(([name, data]) => {
        const avg = data.total / data.count;
        return {
          name,
          avg: avg, // Keep as number for now
          avgDisplay: avg.toFixed(2), // Formatted for display
          count: data.count,
          movies: data.movies,
          ratings: data.ratings // For debugging
        };
      })
      .sort((a, b) => {
        if (sortMode === "count") {
          return b.count - a.count;
        }
        return b.avg - a.avg;
      });

    const genreMap = {};
      ratedMovies.forEach(movie => {
        // Handle different possible genre formats
        const genres = movie.genres || [];
        
        // Convert to array if it's a string (comma-separated)
        let genreList = [];
        if (Array.isArray(genres)) {
          genreList = genres;
        } else if (typeof genres === 'string') {
          genreList = genres.split(',').map(g => g.trim());
        }
        
        genreList.forEach(genre => {
          const genreName = genre.name || genre;
          if (genreName && genreName !== '') {
            if (!genreMap[genreName]) genreMap[genreName] = { total: 0, count: 0 };
            genreMap[genreName].total += Number(movie.userRating || 0);
            genreMap[genreName].count += 1;
          }
        });
      });

    const genreStats = Object.entries(genreMap)
      .map(([name, data]) => ({
        name,
        avg: (data.total / data.count).toFixed(2),
        count: data.count
      }))
      .sort((a, b) => b.avg - a.avg);

    const decadeMap = {};
    ratedMovies.forEach(movie => {
      const year = movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : 
                   movie.year ? parseInt(movie.year) : null;
      if (year) {
        const decade = Math.floor(year / 10) * 10;
        if (!decadeMap[decade]) decadeMap[decade] = { total: 0, count: 0 };
        decadeMap[decade].total += Number(movie.userRating || 0);
        decadeMap[decade].count += 1;
      }
    });

    const decadeStats = Object.entries(decadeMap)
      .map(([decade, data]) => ({
        decade: `${decade}s`,
        avg: (data.total / data.count).toFixed(2),
        count: data.count
      }))
      .sort((a, b) => parseInt(a.decade) - parseInt(b.decade));


    const sortedByRating = [...ratedMovies].sort((a, b) => b.userRating - a.userRating);
    const highestRated = sortedByRating.slice(0, 5);
    const lowestRated = sortedByRating.slice(-5).reverse();

    return {
      totalMovies,
      avgRating,
      avgRatingValue,
      ratingDistribution,
      directorStats,
      genreStats,
      decadeStats,
      highestRated,
      lowestRated,
      ratedMoviesCount: ratedMovies.length
    };
  }, [movies, sortMode]);

  if (loading) {
    return (
      <div className="stats-page text-white p-6">
        <h1 className="text-3xl font-bold mb-6 text-center">Your Movie Statistics</h1>
        <div className="loading-spinner">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  const {
    totalMovies,
    avgRating,
    avgRatingValue,
    ratingDistribution,
    directorStats,
    genreStats,
    decadeStats,
    highestRated,
    lowestRated,
    ratedMoviesCount
  } = statistics;

  const StatCard = ({ title, value, subtitle }) => (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-title">{title}</div>
      {subtitle && <div className="stat-subtitle">{subtitle}</div>}
    </div>
  );

  const RatingBar = ({ rating, count, total }) => (
    <div className="rating-bar">
      <span className="rating-label">{rating}★</span>
      <div className="rating-progress">
        <div 
          className="rating-fill" 
          style={{ width: `${(count / total) * 100}%` }}
        ></div>
      </div>
      <span className="rating-count">
        {count} ({((count / total) * 100).toFixed(1)}%)
      </span>
    </div>
  );

  // Format number to always show 2 decimal places
  const formatRating = (rating) => {
    if (typeof rating === 'number') {
      return rating.toFixed(2);
    }
    return rating;
  };

  const handleDirectorClick = (director) => {
    setSelectedDirector(director);
    // Optionally scroll to the director details section
    setTimeout(() => {
      document.getElementById('director-details')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const clearSelectedDirector = () => {
    setSelectedDirector(null);
  };

  const handleGenreClick = (genre) => {
    setSelectedGenre(genre);
    setTimeout(() => {
      document.getElementById('genre-details')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const clearSelectedGenre = () => {
    setSelectedGenre(null);
  };

  const handleTimePeriodClick = (period) => {
    setSelectedTimePeriod(period);
    setTimeout(() => {
      document.getElementById('time-details')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const clearSelectedTimePeriod = () => {
    setSelectedTimePeriod(null);
  };


  return (
    <div className="stats-page text-white p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Your Movie Statistics</h1>

      {/* Overview Cards */}
      <div className="stat-grid">
        <StatCard 
          title="Total Movies" 
          value={movies.length} 
          subtitle="In your collection"
        />
        <StatCard 
          title="Rated Movies" 
          value={ratedMoviesCount} 
          subtitle="With your ratings"
        />
        <StatCard 
          title="Average Rating" 
          value={formatRating(avgRatingValue)} 
          subtitle="Out of 10 stars"
        />
        <StatCard 
          title="Directors" 
          value={directorStats.length} 
          subtitle="Unique directors"
        />
      </div>

      {/* Navigation Tabs */}
      <div className="stats-tabs">
        {[
          { id: "overview", label: "📊 Overview" },
          { id: "directors", label: "🎬 Directors" },
          { id: "genres", label: "🎭 Genres" },
          { id: "time", label: "📅 Time Periods" },
          { id: "extremes", label: "⭐ Highest & Lowest" }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              // Clear selected director when switching tabs
              if (tab.id !== "directors") {
                setSelectedDirector(null);
              }
            }}
            className={`stats-tab ${activeTab === tab.id ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="stats-content">
        {activeTab === "overview" && (
          <div>
            <h2 className="section-title">Rating Distribution</h2>
            <div className="rating-bars">
              {Object.entries(ratingDistribution)
                .filter(([_, count]) => count > 0)
                .map(([rating, count]) => (
                  <RatingBar
                    key={rating}
                    rating={rating}
                    count={count}
                    total={ratedMoviesCount}
                  />
                ))}
            </div>

            <div className="stats-grid grid-2 mt-8">
              <div>
                <h3 className="section-title">Top 3 Directors</h3>
                <div className="stats-list">
                  {directorStats.slice(0, 3).map((director, index) => (
                    <div key={director.name} className="stats-item">
                      <div className="rank-number">#{index + 1}</div>
                      <div className="item-main">
                        <div 
                          className="item-title clickable-director" 
                          onClick={() => handleDirectorClick(director)}
                          style={{cursor: 'pointer', textDecoration: 'underline'}}
                        >
                          {director.name}
                        </div>
                        <div className="item-subtitle">{director.count} movies</div>
                      </div>
                      <div className="item-rating">
                        <div className="rating-value rating-high">
                          {formatRating(director.avg)}★
                        </div>
                        <div className="rating-meta">average</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="section-title">Top 3 Genres</h3>
                <div className="stats-list">
                  {genreStats.slice(0, 3).map((genre, index) => (
                    <div key={genre.name} className="stats-item">
                      <div className="rank-number">#{index + 1}</div>
                      <div className="item-main">
                        <div 
                          className="item-title clickable-genre"
                          onClick={() => handleGenreClick(genre)}
                          style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        >
                          {genre.name}
                        </div>
                        <div className="item-subtitle">{genre.count} movies</div>
                      </div>
                      <div className="item-rating">
                        <div className="rating-value rating-high">
                          {genre.avg}★
                        </div>
                        <div className="rating-meta">average</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "directors" && (
          <div>
            {/* Director Details Section */}
            {selectedDirector && (
              <div id="director-details" className="director-details-section mb-8">
                <div className="director-details-header">
                  <div>
                    <h2 className="section-title">{selectedDirector.name}</h2>
                    <div className="director-rank">
                      Rank #{directorStats.findIndex(d => d.name === selectedDirector.name) + 1}
                    </div>
                  </div>
                  <button onClick={clearSelectedDirector} className="close-button">
                    <span className="text-xl">×</span>
                    Close
                  </button>

                </div>
                
                <div className="director-summary">
                  <div className="director-stat">
                    <span className="stat-value">{selectedDirector.count}</span>
                    <span className="stat-label">Movies Watched</span>
                  </div>
                  <div className="director-stat">
                    <span className="stat-value">{formatRating(selectedDirector.avg)}★</span>
                    <span className="stat-label">Average Rating</span>
                  </div>
                </div>

                <h3 className="movies-list-title">Your Rated Movies</h3>
                <div className="director-movies-list">
                  {selectedDirector.movies.map((movieTitle, index) => {
                    const movie = movies.find((m) => m.title === movieTitle);

                    return (
                      <div key={index} className="director-movie-item">
                        {movie ? (
                          <a
                            href={`https://www.themoviedb.org/movie/${movie.tmdbId || movie.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="movie-title hover:underline text-blue-400"
                          >
                            {movie.title}
                          </a>
                        ) : (
                          <div className="movie-title">{movieTitle}</div>
                        )}
                        <div className="movie-rating">
                          {movie?.userRating ? `${movie.userRating}★` : "Not rated"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Directors List */}
            <div className="flex justify-between items-center mb-4">
              <h2 className="section-title">
                {selectedDirector ? 'Other Directors' : 'Director Rankings'}
              </h2>
              <div className="sort-toggle">
                <label className="mr-2 text-gray-300">Sort by:</label>
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  className="bg-gray-800 text-white rounded px-2 py-1 border border-gray-600"
                >
                  <option value="rating">Average Rating</option>
                  <option value="count">Most Watched</option>
                </select>
              </div>
            </div>
            
            <div className="stats-list">
              {directorStats
                .filter(director => !selectedDirector || director.name !== selectedDirector.name)
                .map((director, index) => (
                <div key={director.name} className="stats-item">
                  <div className="rank-number">#{index + 1}</div>
                  <div className="item-main">
                    <div 
                      className="item-title clickable-director" 
                      onClick={() => handleDirectorClick(director)}
                      style={{cursor: 'pointer'}}
                    >
                      {director.name}
                    </div>
                    <div className="item-subtitle">
                      {director.count} movie{director.count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <div className="item-rating">
                    <div className={`rating-value ${
                      director.avg >= 8 ? 'rating-high' : 
                      director.avg <= 5 ? 'rating-low' : 'rating-normal'
                    }`}>
                      {formatRating(director.avg)}★
                    </div>
                    <div className="rating-meta">average</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedGenre && (
          <div id="genre-details" className="genre-details-section mb-8">
            <div className="director-details-header">
              <div>
                <h2 className="section-title">{selectedGenre.name}</h2>
                <div className="director-rank">
                  Rank #{genreStats.findIndex(g => g.name === selectedGenre.name) + 1}
                </div>
              </div>
              <button onClick={clearSelectedGenre} className="close-button">
                <span className="text-xl">×</span>
                Close
              </button>
            </div>

            <div className="director-summary">
              <div className="director-stat">
                <span className="stat-value">{selectedGenre.count}</span>
                <span className="stat-label">Movies Watched</span>
              </div>
              <div className="director-stat">
                <span className="stat-value">{selectedGenre.avg}★</span>
                <span className="stat-label">Average Rating</span>
              </div>
            </div>

            <h3 className="movies-list-title">Movies in this Genre</h3>
            <div className="director-movies-list">
              {movies
                .filter(m => {
                  const genres = Array.isArray(m.genres)
                    ? m.genres.map(g => g.name || g)
                    : (m.genres || "").split(",").map(g => g.trim());
                  return genres.includes(selectedGenre.name);
                })
                .map((movie, index) => (
                  <div key={index} className="director-movie-item">
                    <div className="movie-title">{movie.title}</div>
                    <div className="movie-rating">
                      {movie.userRating ? `${movie.userRating}★` : "Not rated"}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}


        {activeTab === "genres" && (
          <div>
            <h2 className="section-title">Genre Rankings</h2>
            <div className="stats-list">
              {genreStats.map((genre, index) => (
                <div key={genre.name} className="stats-item">
                  <div className="rank-number">#{index + 1}</div>
                  <div className="item-main">
                    <div 
                      className="item-title clickable-genre"
                      onClick={() => handleGenreClick(genre)}
                      style={{ cursor: 'pointer'}}
                    >
                      {genre.name}
                    </div>
                    <div className="item-subtitle">{genre.count} movie{genre.count !== 1 ? 's' : ''}</div>
                  </div>
                  <div className="item-rating">
                    <div className={`rating-value ${
                      parseFloat(genre.avg) >= 8 ? 'rating-high' : 
                      parseFloat(genre.avg) <= 5 ? 'rating-low' : 'rating-normal'
                    }`}>
                      {genre.avg}★
                    </div>
                    <div className="rating-meta">average</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {selectedTimePeriod && (
          <div id="time-details" className="genre-details-section mb-8">
            <div className="director-details-header">
              <div>
                <h2 className="section-title">
                  {selectedTimePeriod.type === 'decade'
                    ? selectedTimePeriod.value
                    : selectedTimePeriod.value}
                </h2>
              </div>
              <button onClick={clearSelectedTimePeriod} className="close-button">
                <span className="text-xl">×</span>
                Close
              </button>
            </div>

            <h3 className="movies-list-title">Movies from this Period</h3>
            <div className="director-movies-list">
              {movies
                .filter(m => {
                  if (selectedTimePeriod.type === 'decade') {
                    const year = m.releaseDate
                      ? new Date(m.releaseDate).getFullYear()
                      : parseInt(m.year);
                    return Math.floor(year / 10) * 10 + 's' === selectedTimePeriod.value;
                  } else {
                    const monthName = new Date(m.releaseDate).toLocaleString('default', {
                      month: 'long',
                    });
                    return monthName === selectedTimePeriod.value;
                  }
                })
                .map((movie, index) => (
                  <div key={index} className="director-movie-item">
                    <div className="movie-title">{movie.title}</div>
                    <div className="movie-rating">
                      {movie.userRating ? `${movie.userRating}★` : "Not rated"}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}


        {activeTab === "time" && (
          <div className="stats-grid grid-2">
            <div>
              <h2 className="section-title">By Decade</h2>
              <div className="stats-list">
                {decadeStats.map((decade, index) => (
                  <div key={decade.decade} className="stats-item">
                    <div className="item-main">
                      <div 
                        className="item-title clickable-period"
                        onClick={() => handleTimePeriodClick({ type: 'decade', value: decade.decade })}
                        style={{ cursor: 'pointer'}}
                      >
                        {decade.decade}
                      </div>

                      <div className="item-subtitle">{decade.count} movies</div>
                    </div>
                    <div className="item-rating">
                      <div className="rating-value rating-normal">{decade.avg}★</div>
                      <div className="rating-meta">average</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "extremes" && (
          <div className="stats-grid grid-2">
            <div className="extreme-section highest-rated">
              <h2 className="section-title">Highest Rated Movies</h2>
              <div className="stats-list">
                {highestRated.map((movie, index) => (
                  <div key={movie.id} className="stats-item">
                    <div className="rank-number">#{index + 1}</div>
                    <div className="item-main">
                      <a
                        href={`https://www.themoviedb.org/movie/${movie.tmdbId || movie.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="item-title hover:underline text-blue-400"
                      >
                        {movie.title}
                      </a>
                      <div className="item-subtitle">
                        {movie.director || "Unknown Director"} •{" "}
                        {movie.releaseDate
                          ? new Date(movie.releaseDate).getFullYear()
                          : "Unknown Year"}
                      </div>
                    </div>
                    <div className="item-rating">
                      <div className="rating-value rating-high">{movie.userRating}★</div>
                      <div className="rating-meta">your rating</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="extreme-section lowest-rated">
              <h2 className="section-title">Lowest Rated Movies</h2>
              <div className="stats-list">
                {lowestRated.map((movie, index) => (
                  <div key={movie.id} className="stats-item">
                    <div className="rank-number">#{index + 1}</div>
                    <div className="item-main">
                      <a
                        href={`https://www.themoviedb.org/movie/${movie.tmdbId || movie.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="item-title hover:underline text-blue-400"
                      >
                        {movie.title}
                      </a>
                      <div className="item-subtitle">
                        {movie.director || "Unknown Director"} • {movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : "Unknown Year"}
                      </div>
                    </div>
                    <div className="item-rating">
                      <div className="rating-value rating-low">{movie.userRating}★</div>
                      <div className="rating-meta">your rating</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="stats-summary">
        Statistics based on {ratedMoviesCount} rated movies out of {movies.length} total movies in your collection
      </div>
    </div>
  );
}