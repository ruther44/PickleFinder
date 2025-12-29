// Load environment variables from .env file (for local development)
require('dotenv').config();

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

// Delete a player (and any matches they are in)
app.delete('/api/players/:id', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id);
    const deleted = await db.deletePlayer(playerId);
    if (!deleted) {
      return res.status(404).json({ error: 'Player not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting player:', error);
    res.status(500).json({ error: 'Failed to delete player' });
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

// Update or set a player's phone number
app.patch('/api/players/:id/phone', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id);
    const { phone } = req.body;

    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    const trimmedPhone = phone.trim();
    const phonePattern = /^[0-9+\-().\s]{7,20}$/;

    if (!trimmedPhone || !phonePattern.test(trimmedPhone)) {
      return res.status(400).json({ error: 'Phone number is invalid' });
    }

    const player = await db.updatePlayerPhone(playerId, trimmedPhone);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    res.json(player);
  } catch (error) {
    console.error('Error updating player phone:', error);
    res.status(500).json({ error: 'Failed to update player phone' });
  }
});

// Create a random match
app.post('/api/matches', async (req, res) => {
  try {
    const { playerIds, matchGroup, numCourts } = req.body;

    if (!playerIds || !Array.isArray(playerIds)) {
      return res.status(400).json({ error: 'playerIds array is required' });
    }

    if (playerIds.length !== 4) {
      return res.status(400).json({ error: 'Match must have exactly 4 players' });
    }

    if (matchGroup === undefined || matchGroup === null) {
      return res.status(400).json({ error: 'matchGroup is required' });
    }

    if (numCourts === undefined || numCourts === null) {
      return res.status(400).json({ error: 'numCourts is required' });
    }

    const match = await db.createMatch(playerIds, matchGroup, numCourts);
    res.status(201).json(match);
  } catch (error) {
    console.error('Error creating match:', error);
    res.status(500).json({ error: 'Failed to create match' });
  }
});

// Get next match group number for a specific court count
app.get('/api/matches/next-group', async (req, res) => {
  try {
    const numCourts = parseInt(req.query.numCourts) || 1;
    const nextGroup = await db.getNextMatchGroup(numCourts);
    res.json({ nextGroup });
  } catch (error) {
    console.error('Error getting next match group:', error);
    res.status(500).json({ error: 'Failed to get next match group' });
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

