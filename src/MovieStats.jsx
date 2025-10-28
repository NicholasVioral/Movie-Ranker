export function getDirectorRankings(movies) {
  const directorData = {};

  movies.forEach((movie) => {
    const { director, userRating } = movie;
    if (!director || !userRating) return; // skip unrated movies

    if (!directorData[director]) {
      directorData[director] = { total: 0, count: 0 };
    }

    directorData[director].total += userRating;
    directorData[director].count += 1;
  });

  const rankedDirectors = Object.entries(directorData)
    .map(([name, data]) => ({
      director: name,
      averageRating: (data.total / data.count).toFixed(2),
      movieCount: data.count,
    }))
    .sort((a, b) => b.averageRating - a.averageRating);

  return rankedDirectors;
}