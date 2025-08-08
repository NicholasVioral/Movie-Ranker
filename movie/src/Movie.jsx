import { useState } from 'react';

export default function Movie() {

    const [movies, setMovies] = useState([]);

    const handleSubmit = (e) => {
        e.preventDefault();
        const title = e.target.elements[0].value.trim();
        if (!title) return;
        setMovies(prev => [...prev, title]);
        e.target.reset();
    };

    return (
        <div className="movie">
            <form onSubmit={handleSubmit}>
                <input type="text" placeholder="Movie Title" />
                <button type="submit">Add Movie</button>
            </form>
            
            {movies.map((movie, index) => (
                <div key={index} className="movie-item">
                    <h3>{movie}</h3>
                </div>
            ))}
            
        </div>
    )
}