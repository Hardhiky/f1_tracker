const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Base endpoint
app.get("/", (req, res) => {
  res.json({
    message: "F1 API Running",
    documentation: "https://ergast.com/mrd/",
    endpoints: [
      "/ergast/f1/circuits/",
      "/ergast/f1/constructors/",
      "/ergast/f1/{season}/constructorstandings/",
      "/ergast/f1/drivers/",
      "/ergast/f1/{season}/driverstandings/",
      "/ergast/f1/{season}/{round}/laps/",
      "/ergast/f1/{season}/{round}/pitstops/",
      "/ergast/f1/{season}/qualifying/",
      "/ergast/f1/races/",
      "/ergast/f1/results/",
      "/ergast/f1/seasons/",
      "/ergast/f1/sprint/",
      "/ergast/f1/status/"
    ]
  });
});

// Seasons endpoint
app.get('/ergast/f1/seasons.json', async (req, res) => {
  try {
    const response = await axios.get('http://ergast.com/api/f1/seasons.json?limit=100');
    const seasons = response.data.MRData.SeasonTable.Seasons.map(s => ({
      season: s.season,
      url: s.url
    }));
    res.json({ SeasonTable: { Seasons: seasons }});
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add this new endpoint before the generic proxy handler
app.get('/ergast/f1/:season/sprint/races.json', async (req, res) => {
  try {
    const { season } = req.params;
    const response = await axios.get(`http://ergast.com/api/f1/${season}/sprint.json`);
    const races = await Promise.all(response.data.MRData.RaceTable.Races.map(async (race) => {
      const round = race.round;
      
      // Get sprint results
      const resultRes = await axios.get(`http://ergast.com/api/f1/${season}/${round}/sprint.json`);
      
      return {
        name: race.raceName,
        country: race.Circuit.Location.country,
        location: [
          parseFloat(race.Circuit.Location.long),
          parseFloat(race.Circuit.Location.lat)
        ],
        polePosition: "N/A", // Sprint races don't have traditional pole positions
        winner: resultRes.data.MRData.RaceTable.Races[0]?.SprintResults?.[0]?.Driver?.familyName || "Unknown"
      };
    }));

    const validRaces = races.filter(race => 
      race.location.every(coord => !isNaN(coord)) &&
      race.name &&
      race.country
    );

    res.json({ RaceTable: { Races: validRaces } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Races endpoint
app.get('/ergast/f1/:season/races.json', async (req, res) => {
  try {
    const { season } = req.params;
    const response = await axios.get(`http://ergast.com/api/f1/${season}.json`);
    
    const races = await Promise.all(response.data.MRData.RaceTable.Races.map(async (race) => {
      const round = race.round;
      
      const [qualiRes, resultRes] = await Promise.all([
        axios.get(`http://ergast.com/api/f1/${season}/${round}/qualifying.json`),
        axios.get(`http://ergast.com/api/f1/${season}/${round}/results.json`)
      ]);

      return {
        name: race.raceName,
        country: race.Circuit.Location.country,
        location: [
          parseFloat(race.Circuit.Location.long),
          parseFloat(race.Circuit.Location.lat)
        ],
        polePosition: qualiRes.data.MRData.RaceTable.Races[0]?.QualifyingResults?.[0]?.Driver?.familyName || "Unknown",
        winner: resultRes.data.MRData.RaceTable.Races[0]?.Results?.[0]?.Driver?.familyName || "Unknown"
      };
    }));

    const validRaces = races.filter(race => 
      race.location.every(coord => !isNaN(coord)) &&
      race.name &&
      race.country
    );

    res.json({ RaceTable: { Races: validRaces } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generic API proxy handler
const createErgastProxy = (endpoint) => async (req, res) => {
  try {
    const { season, round } = req.params;
    let url = `http://ergast.com/api/f1/${endpoint}`;
    
    // Replace URL parameters
    url = url
      .replace('{season}', season || 'current')
      .replace('{round}', round || '');

    // Add .json extension if missing
    if (!url.endsWith('.json')) url += '.json';
    
    const response = await axios.get(url, { params: req.query });
    res.json(response.data.MRData);
  } catch (error) {
    console.error(`Error fetching ${endpoint}:`, error.message);
    res.status(500).json({ error: error.message });
  }
};

// Define all endpoints
const endpoints = [
  { path: '/circuits', route: 'circuits' },
  { path: '/constructors', route: 'constructors' },
  { path: '/:season/constructorstandings', route: '{season}/constructorStandings' },
  { path: '/drivers', route: 'drivers' },
  { path: '/:season/driverstandings', route: '{season}/driverStandings' },
  { path: '/:season/:round/laps', route: '{season}/{round}/laps' },
  { path: '/:season/:round/pitstops', route: '{season}/{round}/pitstops' },
  { path: '/:season/qualifying', route: '{season}/qualifying' },
  { path: '/races', route: 'races' },
  { path: '/results', route: 'results' },
  { path: '/seasons', route: 'seasons' },
  { path: '/sprint', route: 'sprint' },
  { path: '/status', route: 'status' }
];

// Register all endpoints with and without .json
endpoints.forEach(({ path, route }) => {
  [path, `${path}.json`].forEach(p => {
    app.get(`/ergast/f1${p}`, createErgastProxy(route));
  });
});

// Enhanced races endpoint with pole position and winner data
app.get(['/ergast/f1/races/', '/ergast/f1/races.json'], async (req, res) => {
  try {
    const response = await axios.get('http://ergast.com/api/f1/current.json');
    const races = response.data.MRData.RaceTable.Races;

    const raceDetails = await Promise.all(races.map(async (race) => {
      const round = race.round;
      
      const [qualiRes, resultRes] = await Promise.all([
        axios.get(`http://ergast.com/api/f1/current/${round}/qualifying.json`),
        axios.get(`http://ergast.com/api/f1/current/${round}/results.json`)
      ]);

      return {
        name: race.raceName,
        country: race.Circuit.Location.country,
        location: [
          parseFloat(race.Circuit.Location.long),
          parseFloat(race.Circuit.Location.lat)
        ],
        polePosition: qualiRes.data.MRData.RaceTable.Races[0]?.QualifyingResults?.[0]?.Driver?.familyName || "Unknown",
        winner: resultRes.data.MRData.RaceTable.Races[0]?.Results?.[0]?.Driver?.familyName || "Unknown"
      };
    }));

    const validRaces = raceDetails.filter(race => 
      race.location.every(coord => !isNaN(coord)) &&
      race.name &&
      race.country
    );

    res.json({ RaceTable: { Races: validRaces } });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

