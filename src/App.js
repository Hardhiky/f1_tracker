import React, { useEffect, useState, useMemo } from 'react';
import Globe from 'react-globe.gl';
import './App.css';

const API_BASE = 'http://localhost:5000/ergast/f1';

const App = () => {
  const [races, setRaces] = useState([]);
  const [selectedRace, setSelectedRace] = useState(null);
  const [seasons, setSeasons] = useState([]);
  const [season, setSeason] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('races');
  const [driverStandings, setDriverStandings] = useState([]);
  const [constructorStandings, setConstructorStandings] = useState([]);

  // Fetch available seasons
  useEffect(() => {
    fetch(`${API_BASE}/seasons.json`)
      .then(res => res.json())
      .then(data => {
        const seasonData = data.SeasonTable?.Seasons || [];
        const sortedSeasons = seasonData.map(s => s.season).reverse();
        setSeasons(sortedSeasons);
        setSeason(sortedSeasons[0] || new Date().getFullYear());
      })
      .catch(err => {
        setError('Failed to load seasons');
        setSeason(new Date().getFullYear());
      });
  }, []);

  // Fetch data based on view mode
  useEffect(() => {
    if (!season) return;

    setLoading(true);
    let endpoint;
    switch(viewMode) {
      case 'sprint':
        endpoint = `${API_BASE}/${season}/sprint/races.json`;
        break;
      case 'driver':
        endpoint = `${API_BASE}/${season}/driverstandings.json`;
        break;
      case 'constructor':
        endpoint = `${API_BASE}/${season}/constructorstandings.json`;
        break;
      default:
        endpoint = `${API_BASE}/${season}/races.json`;
    }

    fetch(endpoint)
      .then(res => {
        if (!res.ok) throw new Error(`No data for ${season}`);
        return res.json();
      })
      .then(data => {
        if (viewMode === 'races' || viewMode === 'sprint') {
          const racesData = data.RaceTable?.Races || [];
          setRaces(racesData.filter(race => 
            race.location?.length === 2 &&
            !isNaN(race.location[0]) && 
            !isNaN(race.location[1])
          ));
        } else if (viewMode === 'driver') {
          setDriverStandings(data.StandingsTable?.StandingsLists[0]?.DriverStandings || []);
        } else if (viewMode === 'constructor') {
          setConstructorStandings(data.StandingsTable?.StandingsLists[0]?.ConstructorStandings || []);
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [season, viewMode]);

  // Globe data
  const pointsData = useMemo(() => 
    races.map(race => ({
      id: race.name,
      lat: race.location[1],
      lng: race.location[0],
      color: viewMode === 'sprint' ? '#00FF00' : '#FF1801',
      label: `${race.name}\n${race.country}`,
      radius: 0.7
    })),
    [races, viewMode]
  );

  return (
    <div className="app">
      <div className="header">
        <h1>Formula 1 Race Globe</h1>
        <div className="controls">
          <div className="season-picker">
            <select value={season} onChange={(e) => setSeason(e.target.value)}>
              {seasons.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
          <div className="view-buttons">
            <button 
              className={viewMode === 'races' ? 'active' : ''} 
              onClick={() => setViewMode('races')}
            >
              Races
            </button>
            <button 
              className={viewMode === 'sprint' ? 'active' : ''} 
              onClick={() => setViewMode('sprint')}
            >
              Sprint
            </button>
            <button 
              className={viewMode === 'driver' ? 'active' : ''} 
              onClick={() => setViewMode('driver')}
            >
              Drivers
            </button>
            <button 
              className={viewMode === 'constructor' ? 'active' : ''} 
              onClick={() => setViewMode('constructor')}
            >
              Constructors
            </button>
          </div>
        </div>
      </div>

      <div className="globe-container">
        {error && <div className="error-banner">{error}</div>}
        
        {(viewMode === 'races' || viewMode === 'sprint') && !error && (
          <Globe
            globeImageUrl="//unpkg.com/three-globe/example/img/earth-night.jpg"
            pointsData={pointsData}
            pointRadius="radius"
            pointAltitude={0.01}
            pointColor="color"
            onPointClick={point => {
              const race = races.find(r => r.name === point?.id);
              setSelectedRace(race || null);
            }}
            backgroundColor="rgba(0, 0, 0, 0.9)"
          />
        )}

        {viewMode === 'driver' && (
          <div className="standings-table">
            <h2>{season} Driver Standings</h2>
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Driver</th>
                  <th>Points</th>
                  <th>Wins</th>
                </tr>
              </thead>
              <tbody>
                {driverStandings.map(driver => (
                  <tr key={driver.Driver.driverId}>
                    <td>{driver.position}</td>
                    <td>{driver.Driver.givenName} {driver.Driver.familyName}</td>
                    <td>{driver.points}</td>
                    <td>{driver.wins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {viewMode === 'constructor' && (
          <div className="standings-table">
            <h2>{season} Constructor Standings</h2>
            <table>
              <thead>
                <tr>
                  <th>Pos</th>
                  <th>Constructor</th>
                  <th>Points</th>
                  <th>Wins</th>
                </tr>
              </thead>
              <tbody>
                {constructorStandings.map(constructor => (
                  <tr key={constructor.Constructor.constructorId}>
                    <td>{constructor.position}</td>
                    <td>{constructor.Constructor.name}</td>
                    <td>{constructor.points}</td>
                    <td>{constructor.wins}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {loading && (
          <div className="loader-container">
            <div className="loader"></div>
            <div>Loading {season} data...</div>
          </div>
        )}

        {selectedRace && (
          <div className="race-details">
            <h2>{selectedRace.name}</h2>
            <div className="detail-item">
              <span>Country:</span>
              <span>{selectedRace.country}</span>
            </div>
            <div className="detail-item">
              <span>{viewMode === 'sprint' ? 'Sprint Winner' : 'Winner'}:</span>
              <span>{selectedRace.winner}</span>
            </div>
            {viewMode !== 'sprint' && (
              <div className="detail-item">
                <span>Pole Position:</span>
                <span>{selectedRace.polePosition}</span>
              </div>
            )}
            <button onClick={() => setSelectedRace(null)}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
