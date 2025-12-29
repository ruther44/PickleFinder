const { Pool } = require('pg');

let pool;

// Initialize database connection
function initializeDatabase() {
  return new Promise((resolve, reject) => {
    try {
      // Railway provides DATABASE_URL automatically
      pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
      });
      
      // Test connection
      pool.query('SELECT NOW()', (err, result) => {
        if (err) {
          console.error('Database connection error:', err);
          reject(err);
        } else {
          console.log('Database connected successfully');
          resolve(pool);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
}

// Initialize tables if they don't exist
async function initializeTables() {
  try {
    // Check if players table exists
    const playersCheck = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'players'
    `);
    
    if (playersCheck.rows.length === 0) {
      // Table doesn't exist, create all tables
      await createTables();
    } else {
      // Check if old schema (has email column)
      const columnNames = playersCheck.rows.map(col => col.column_name);
      const hasEmail = columnNames.includes('email');
      if (hasEmail) {
        await migrateTables();
      } else {
        // Check if availability column exists
        if (!columnNames.includes('available')) {
          await pool.query('ALTER TABLE players ADD COLUMN available INTEGER DEFAULT 1');
        }

        // Ensure phone column exists for sub texting
        if (!columnNames.includes('phone')) {
          await pool.query('ALTER TABLE players ADD COLUMN phone VARCHAR(32)');
        }

        await checkMatchesTable();
      }
    }
  } catch (err) {
    console.error('Error initializing tables:', err);
    throw err;
  }
}

async function checkMatchesTable() {
  try {
    const matchesCheck = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'matches'
    `);
    
    if (matchesCheck.rows.length === 0) {
      await createMatchesTable();
    } else {
      const columns = matchesCheck.rows.map(row => row.column_name);
      const hasMatchGroup = columns.includes('match_group');
      const hasNumCourts = columns.includes('num_courts');
      
      if (!hasMatchGroup) {
        await pool.query('ALTER TABLE matches ADD COLUMN match_group INTEGER');
      }
      if (!hasNumCourts) {
        await pool.query('ALTER TABLE matches ADD COLUMN num_courts INTEGER');
      }
      console.log('Database tables initialized successfully');
    }
  } catch (err) {
    console.error('Error checking matches table:', err);
    throw err;
  }
}

async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        available INTEGER DEFAULT 1,
        phone VARCHAR(32),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        player1_id INTEGER REFERENCES players(id),
        player2_id INTEGER REFERENCES players(id),
        player3_id INTEGER REFERENCES players(id),
        player4_id INTEGER REFERENCES players(id),
        match_group INTEGER,
        num_courts INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    console.log('Database tables initialized successfully');
  } catch (err) {
    console.error('Error creating tables:', err);
    throw err;
  }
}

async function migrateTables() {
  try {
    await pool.query('DROP TABLE IF EXISTS matches CASCADE');
    await pool.query('DROP TABLE IF EXISTS players CASCADE');
    await createTables();
  } catch (err) {
    console.error('Error migrating tables:', err);
    throw err;
  }
}

async function createMatchesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS matches (
        id SERIAL PRIMARY KEY,
        player1_id INTEGER REFERENCES players(id),
        player2_id INTEGER REFERENCES players(id),
        player3_id INTEGER REFERENCES players(id),
        player4_id INTEGER REFERENCES players(id),
        match_group INTEGER,
        num_courts INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('Database tables initialized successfully');
  } catch (err) {
    console.error('Error creating matches table:', err);
    throw err;
  }
}

// Add a new player
async function addPlayer(name) {
  try {
    const result = await pool.query(
      'INSERT INTO players (name, available) VALUES ($1, 1) RETURNING *',
      [name]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error adding player:', err);
    throw err;
  }
}

// Get all players
async function getAllPlayers() {
  try {
    const result = await pool.query(
      'SELECT * FROM players ORDER BY available DESC, created_at DESC'
    );
    return result.rows;
  } catch (err) {
    console.error('Error fetching players:', err);
    throw err;
  }
}

// Get available players only
async function getAvailablePlayers() {
  try {
    const result = await pool.query(
      'SELECT * FROM players WHERE available = 1 ORDER BY created_at DESC'
    );
    return result.rows;
  } catch (err) {
    console.error('Error fetching available players:', err);
    throw err;
  }
}

// Toggle player availability
async function togglePlayerAvailability(playerId, available) {
  try {
    const result = await pool.query(
      'UPDATE players SET available = $1 WHERE id = $2 RETURNING *',
      [available ? 1 : 0, playerId]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error updating player availability:', err);
    throw err;
  }
}

// Update or set a player's phone number
async function updatePlayerPhone(playerId, phone) {
  try {
    const result = await pool.query(
      'UPDATE players SET phone = $1 WHERE id = $2 RETURNING *',
      [phone, playerId]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error updating player phone:', err);
    throw err;
  }
}

// Get the next match group number for a specific court count
async function getNextMatchGroup(numCourts) {
  try {
    const result = await pool.query(
      'SELECT MAX(match_group) as max_group FROM matches WHERE COALESCE(num_courts, 0) = $1',
      [numCourts]
    );
    const nextGroup = (result.rows[0] && result.rows[0].max_group ? result.rows[0].max_group : 0) + 1;
    return nextGroup;
  } catch (err) {
    console.error('Error getting next match group:', err);
    throw err;
  }
}

// Create a match with random players
async function createMatch(playerIds, matchGroup, numCourts) {
  try {
    if (playerIds.length !== 4) {
      throw new Error('Match must have exactly 4 players');
    }

    const result = await pool.query(
      `INSERT INTO matches (player1_id, player2_id, player3_id, player4_id, match_group, num_courts) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [playerIds[0], playerIds[1], playerIds[2], playerIds[3], matchGroup, numCourts]
    );
    return result.rows[0];
  } catch (err) {
    console.error('Error creating match:', err);
    throw err;
  }
}

// Get all matches with player details
async function getAllMatches() {
  try {
    const result = await pool.query(`
      SELECT 
        m.id,
        m.created_at,
        m.match_group,
        m.num_courts,
        p1.id as player1_id, p1.name as player1_name,
        p2.id as player2_id, p2.name as player2_name,
        p3.id as player3_id, p3.name as player3_name,
        p4.id as player4_id, p4.name as player4_name
      FROM matches m
      LEFT JOIN players p1 ON m.player1_id = p1.id
      LEFT JOIN players p2 ON m.player2_id = p2.id
      LEFT JOIN players p3 ON m.player3_id = p3.id
      LEFT JOIN players p4 ON m.player4_id = p4.id
      ORDER BY m.match_group DESC, m.created_at DESC
    `);
    return result.rows;
  } catch (err) {
    console.error('Error fetching matches:', err);
    throw err;
  }
}

// Delete player and any matches referencing them to satisfy FK constraints
async function deletePlayer(playerId) {
  try {
    await pool.query(
      'DELETE FROM matches WHERE player1_id = $1 OR player2_id = $1 OR player3_id = $1 OR player4_id = $1',
      [playerId]
    );
    const result = await pool.query('DELETE FROM players WHERE id = $1 RETURNING *', [playerId]);
    return result.rows[0];
  } catch (err) {
    console.error('Error deleting player:', err);
    throw err;
  }
}

module.exports = {
  initializeDatabase,
  initializeTables,
  addPlayer,
  getAllPlayers,
  getAvailablePlayers,
  togglePlayerAvailability,
  updatePlayerPhone,
  getNextMatchGroup,
  createMatch,
  getAllMatches,
  deletePlayer
};
