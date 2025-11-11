const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database file path
const dbPath = path.join(__dirname, 'pickleball.db');
let db;

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
      } else {
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON', (err) => {
          if (err) reject(err);
          else resolve(db);
        });
      }
    });
  });
}

// Initialize tables if they don't exist
function initializeTables() {
  return new Promise((resolve, reject) => {
    // Check if players table exists and has email column
    db.all("PRAGMA table_info(players)", (err, columns) => {
      if (err) {
        // Table doesn't exist, create it
        createTables();
      } else if (columns && columns.some(col => col.name === 'email')) {
        // Table exists with email column, migrate it
        migrateTables();
        } else {
          // Table exists, check if it needs availability column
          const hasAvailable = columns && columns.some(col => col.name === 'available');
          if (!hasAvailable) {
            // Add availability column to existing table
            db.run('ALTER TABLE players ADD COLUMN available INTEGER DEFAULT 1', (err) => {
              if (err) {
                console.error('Error adding available column:', err);
              }
              checkMatchesTable();
            });
          } else {
            checkMatchesTable();
          }
        }
        
        function checkMatchesTable() {
          db.all("PRAGMA table_info(matches)", (err, columns) => {
            if (err) {
              createMatchesTable();
            } else {
              const hasMatchGroup = columns && columns.some(col => col.name === 'match_group');
              const hasNumCourts = columns && columns.some(col => col.name === 'num_courts');
              
              let pendingAlters = 0;
              let completedAlters = 0;
              
              if (!hasMatchGroup) pendingAlters++;
              if (!hasNumCourts) pendingAlters++;
              
              const checkComplete = () => {
                completedAlters++;
                if (completedAlters >= pendingAlters) {
                  createMatchesTable();
                }
              };
              
              if (pendingAlters === 0) {
                createMatchesTable();
              } else {
                if (!hasMatchGroup) {
                  db.run('ALTER TABLE matches ADD COLUMN match_group INTEGER', (err) => {
                    if (err) {
                      console.error('Error adding match_group column:', err);
                    }
                    checkComplete();
                  });
                } else {
                  checkComplete();
                }
                
                if (!hasNumCourts) {
                  db.run('ALTER TABLE matches ADD COLUMN num_courts INTEGER', (err) => {
                    if (err) {
                      console.error('Error adding num_courts column:', err);
                    }
                    checkComplete();
                  });
                } else {
                  checkComplete();
                }
              }
            }
          });
        }
    });

    function createTables() {
      const queries = [
        `CREATE TABLE IF NOT EXISTS players (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          available INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`,
        `CREATE TABLE IF NOT EXISTS matches (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          player1_id INTEGER REFERENCES players(id),
          player2_id INTEGER REFERENCES players(id),
          player3_id INTEGER REFERENCES players(id),
          player4_id INTEGER REFERENCES players(id),
          match_group INTEGER,
          num_courts INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      ];

      let completed = 0;
      queries.forEach((query) => {
        db.run(query, (err) => {
          if (err) {
            reject(err);
          } else {
            completed++;
            if (completed === queries.length) {
              console.log('Database tables initialized successfully');
              resolve();
            }
          }
        });
      });
    }

    function migrateTables() {
      // Drop and recreate players table without email
      db.serialize(() => {
        db.run('DROP TABLE IF EXISTS matches', (err) => {
          if (err) {
            reject(err);
            return;
          }
          db.run('DROP TABLE IF EXISTS players', (err) => {
            if (err) {
              reject(err);
              return;
            }
            createTables();
          });
        });
      });
    }

    function createMatchesTable() {
      db.run(`CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player1_id INTEGER REFERENCES players(id),
        player2_id INTEGER REFERENCES players(id),
        player3_id INTEGER REFERENCES players(id),
        player4_id INTEGER REFERENCES players(id),
        match_group INTEGER,
        num_courts INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Database tables initialized successfully');
          resolve();
        }
      });
    }
  });
}

// Add a new player
function addPlayer(name) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('INSERT INTO players (name, available) VALUES (?, 1)');
    stmt.run(name, function(err) {
      if (err) {
        reject(err);
      } else {
        db.get('SELECT * FROM players WHERE id = ?', [this.lastID], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      }
    });
    stmt.finalize();
  });
}

// Get all players
function getAllPlayers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM players ORDER BY available DESC, created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Get available players only
function getAvailablePlayers() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM players WHERE available = 1 ORDER BY created_at DESC', (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Toggle player availability
function togglePlayerAvailability(playerId, available) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare('UPDATE players SET available = ? WHERE id = ?');
    stmt.run(available ? 1 : 0, playerId, function(err) {
      if (err) {
        reject(err);
      } else {
        db.get('SELECT * FROM players WHERE id = ?', [playerId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      }
    });
    stmt.finalize();
  });
}

// Get the next match group number for a specific court count
function getNextMatchGroup(numCourts) {
  return new Promise((resolve, reject) => {
    // First check if match_group column exists
    db.all("PRAGMA table_info(matches)", (err, columns) => {
      if (err) {
        reject(err);
        return;
      }
      
      const hasMatchGroup = columns && columns.some(col => col.name === 'match_group');
      const hasNumCourts = columns && columns.some(col => col.name === 'num_courts');
      
      if (!hasMatchGroup || !hasNumCourts) {
        // If columns don't exist, return 1 as the first group
        resolve(1);
        return;
      }
      
      // Handle NULL num_courts for existing matches by using COALESCE
      db.get('SELECT MAX(match_group) as max_group FROM matches WHERE COALESCE(num_courts, 0) = ?', [numCourts], (err, row) => {
        if (err) {
          console.error('Error in getNextMatchGroup query:', err);
          reject(err);
        } else {
          const nextGroup = (row && row.max_group ? row.max_group : 0) + 1;
          resolve(nextGroup);
        }
      });
    });
  });
}

// Create a match with random players
// playerIds should be array of 4 players: [serving1, serving2, receiving1, receiving2]
function createMatch(playerIds, matchGroup, numCourts) {
  return new Promise((resolve, reject) => {
    // Ensure we have exactly 4 players
    if (playerIds.length !== 4) {
      reject(new Error('Match must have exactly 4 players'));
      return;
    }

    // player1_id and player2_id = serving team
    // player3_id and player4_id = receiving team
    const stmt = db.prepare(`
      INSERT INTO matches (player1_id, player2_id, player3_id, player4_id, match_group, num_courts) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      playerIds[0], // serving team player 1
      playerIds[1], // serving team player 2
      playerIds[2], // receiving team player 1
      playerIds[3], // receiving team player 2
      matchGroup,
      numCourts,
      function(err) {
        if (err) {
          reject(err);
        } else {
          db.get('SELECT * FROM matches WHERE id = ?', [this.lastID], (err, row) => {
            if (err) reject(err);
            else resolve(row);
          });
        }
      }
    );
    stmt.finalize();
  });
}

// Get all matches with player details
function getAllMatches() {
  return new Promise((resolve, reject) => {
    db.all(`
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
    `, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  initializeDatabase,
  initializeTables,
  addPlayer,
  getAllPlayers,
  getAvailablePlayers,
  togglePlayerAvailability,
  getNextMatchGroup,
  createMatch,
  getAllMatches
};
