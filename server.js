const express = require('express');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Initialize database
(async () => {
  try {
    await db.initializeDatabase();
    await db.initializeTables();
  } catch (err) {
    console.error('Failed to initialize database tables:', err);
    process.exit(1);
  }
})();

// API Routes

// Register a new player
app.post('/api/players', async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const player = await db.addPlayer(name);
    res.status(201).json(player);
  } catch (error) {
    console.error('Error adding player:', error);
    res.status(500).json({ error: 'Failed to add player' });
  }
});

// Get all players
app.get('/api/players', async (req, res) => {
  try {
    const players = await db.getAllPlayers();
    res.json(players);
  } catch (error) {
    console.error('Error fetching players:', error);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Toggle player availability
app.patch('/api/players/:id/availability', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id);
    const { available } = req.body;

    if (typeof available !== 'boolean') {
      return res.status(400).json({ error: 'available must be a boolean' });
    }

    const player = await db.togglePlayerAvailability(playerId, available);
    res.json(player);
  } catch (error) {
    console.error('Error updating player availability:', error);
    res.status(500).json({ error: 'Failed to update player availability' });
  }
});

// Create a random match
app.post('/api/matches', async (req, res) => {
  try {
    const { playerIds } = req.body;

    if (!playerIds || !Array.isArray(playerIds)) {
      return res.status(400).json({ error: 'playerIds array is required' });
    }

    if (playerIds.length !== 4) {
      return res.status(400).json({ error: 'Match must have exactly 4 players' });
    }

    const match = await db.createMatch(playerIds);
    res.status(201).json(match);
  } catch (error) {
    console.error('Error creating match:', error);
    res.status(500).json({ error: 'Failed to create match' });
  }
});

// Get all matches
app.get('/api/matches', async (req, res) => {
  try {
    const matches = await db.getAllMatches();
    res.json(matches);
  } catch (error) {
    console.error('Error fetching matches:', error);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Pickleball Player Matcher server running on http://localhost:${PORT}`);
});

