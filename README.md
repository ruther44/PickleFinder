# Pickleball Player Matcher

A Node.js web application for matching pickleball players for random games.

## Features

- Register players with name and email
- View all registered players
- Randomly match 2 or 4 players for a game
- View match history
- Simple validation (prevents duplicate emails, ensures enough players for matching)

## Prerequisites

- Node.js (v14 or higher)
- No additional database setup required (uses SQLite)

## Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

Note: The SQLite database file (`pickleball.db`) will be automatically created in the project root when you first run the server.

## Usage

1. **Register Players**: Fill in the registration form with a player's name and email
2. **View Players**: See all registered players in the players list
3. **Create Matches**: Click "Match 2 Players" or "Match 4 Players" to randomly match available players
4. **View History**: See all created matches in the match history section

## API Endpoints

- `POST /api/players` - Register a new player
- `GET /api/players` - Get all registered players
- `POST /api/matches` - Create a random match (requires `playerIds` array in body)
- `GET /api/matches` - Get all matches with player details

## Technology Stack

- **Backend**: Node.js with Express.js
- **Frontend**: Vanilla HTML/CSS/JavaScript
- **Database**: SQLite with better-sqlite3

## License

ISC

