import React from "react";
import { getDirectorRankings } from "./movieStats";

const DirectorStats = ({ movies }) => {
  const directorRankings = getDirectorRankings(movies);

  if (directorRankings.length === 0) {
    return <p style={{ textAlign: "center", color: "#aaa" }}>No rated movies yet.</p>;
  }

  return (
    <div className="stats-container">
      <h2>🎬 Director Rankings</h2>
      <table className="stats-table">
        <thead>
          <tr>
            <th>Director</th>
            <th>Average Stars</th>
            <th># of Movies</th>
          </tr>
        </thead>
        <tbody>
          {directorRankings.map((d, index) => (
            <tr key={index}>
              <td>{d.director}</td>
              <td>{d.averageRating}</td>
              <td>{d.movieCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DirectorStats;
