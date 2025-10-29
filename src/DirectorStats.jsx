import { useState, useEffect, useMemo } from "react";
import "./DirectorStats.css";

export default function DirectorStats() {
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const USER_ID = "12345";

  useEffect(() => {
    let isMounted = true;

    async function fetchMovies() {
      try {
        const res = await fetch(`http://localhost:5000/rankings?userId=${USER_ID}`);
        const data = await res.json();
        
        if (isMounted) {
          const moviesData = data.movies || [];
          console.log("🎬 Loaded movies:", moviesData); // Debug log
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

    console.log("⭐ Rated movies for stats:", ratedMovies); // Debug log

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

    // Debug: Check director calculations
    console.log("🎭 Director map raw data:", directorMap);

    const directorStats = Object.entries(directorMap)
      .map(([name, data]) => {
        const avg = data.total / data.count;
        console.log(`📊 ${name}: ${data.ratings.join(', ')} = ${data.total} / ${data.count} = ${avg}`); // Debug log
        return {
          name,
          avg: avg, // Keep as number for now
          avgDisplay: avg.toFixed(2), // Formatted for display
          count: data.count,
          movies: data.movies,
          ratings: data.ratings // For debugging
        };
      })
      .sort((a, b) => b.avg - a.avg);

    console.log("🎯 Final director stats:", directorStats); // Debug log

    const genreMap = {};
    ratedMovies.forEach(movie => {
      const genres = movie.genres || [];
      genres.forEach(genre => {
        const genreName = genre.name || genre;
        if (!genreMap[genreName]) genreMap[genreName] = { total: 0, count: 0 };
        genreMap[genreName].total += Number(movie.userRating || 0);
        genreMap[genreName].count += 1;
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

    const monthMap = {};
    ratedMovies.forEach(movie => {
      if (movie.releaseDate) {
        const month = new Date(movie.releaseDate).getMonth();
        const monthName = new Date(2000, month).toLocaleString('default', { month: 'long' });
        if (!monthMap[monthName]) monthMap[monthName] = { total: 0, count: 0 };
        monthMap[monthName].total += Number(movie.userRating || 0);
        monthMap[monthName].count += 1;
      }
    });

    const monthStats = Object.entries(monthMap)
      .map(([month, data]) => ({
        month,
        avg: (data.total / data.count).toFixed(2),
        count: data.count
      }))
      .sort((a, b) => new Date(`2000-${a.month}-01`).getMonth() - new Date(`2000-${b.month}-01`).getMonth());

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
      monthStats,
      highestRated,
      lowestRated,
      ratedMoviesCount: ratedMovies.length
    };
  }, [movies]);

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
    monthStats,
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
            onClick={() => setActiveTab(tab.id)}
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
                        <div className="item-title">{director.name}</div>
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
                        <div className="item-title">{genre.name}</div>
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
            <h2 className="section-title">Director Rankings</h2>
            <div className="stats-list">
              {directorStats.map((director, index) => (
                <div key={director.name} className="stats-item">
                  <div className="rank-number">#{index + 1}</div>
                  <div className="item-main">
                    <div className="item-title">{director.name}</div>
                    <div className="item-subtitle">
                      {director.count} movie{director.count !== 1 ? 's' : ''}
                      {director.ratings && (
                        <span className="text-xs text-gray-400 ml-2">
                          ({director.ratings.join(', ')})
                        </span>
                      )}
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

        {/* ... rest of your component remains the same ... */}
        {activeTab === "genres" && (
          <div>
            <h2 className="section-title">Genre Rankings</h2>
            <div className="stats-list">
              {genreStats.map((genre, index) => (
                <div key={genre.name} className="stats-item">
                  <div className="rank-number">#{index + 1}</div>
                  <div className="item-main">
                    <div className="item-title">{genre.name}</div>
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

        {activeTab === "time" && (
          <div className="stats-grid grid-2">
            <div>
              <h2 className="section-title">By Decade</h2>
              <div className="stats-list">
                {decadeStats.map((decade, index) => (
                  <div key={decade.decade} className="stats-item">
                    <div className="item-main">
                      <div className="item-title">{decade.decade}</div>
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

            <div>
              <h2 className="section-title">By Release Month</h2>
              <div className="stats-list">
                {monthStats.map((month, index) => (
                  <div key={month.month} className="stats-item">
                    <div className="item-main">
                      <div className="item-title">{month.month}</div>
                      <div className="item-subtitle">{month.count} movies</div>
                    </div>
                    <div className="item-rating">
                      <div className="rating-value rating-normal">{month.avg}★</div>
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
                      <div className="item-title">{movie.title}</div>
                      <div className="item-subtitle">
                        {movie.director || "Unknown Director"} • {movie.releaseDate ? new Date(movie.releaseDate).getFullYear() : "Unknown Year"}
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
                      <div className="item-title">{movie.title}</div>
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