// API base URL
const API_BASE = '/api';

// Utility function to shuffle array (Fisher-Yates algorithm)
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// Display message
function showMessage(elementId, message, isError = false) {
  const messageEl = document.getElementById(elementId);
  messageEl.textContent = message;
  messageEl.className = `message ${isError ? 'error' : 'success'}`;
  messageEl.style.display = 'block';
  
  setTimeout(() => {
    messageEl.style.display = 'none';
  }, 3000);
}

// Load and display players
async function loadPlayers() {
  try {
    const response = await fetch(`${API_BASE}/players`);
    if (!response.ok) throw new Error('Failed to fetch players');
    
    const players = await response.json();
    const playersList = document.getElementById('playersList');
    
    if (players.length === 0) {
      playersList.innerHTML = '<p class="empty">No players registered yet.</p>';
      return;
    }
    
    playersList.innerHTML = players.map(player => `
      <div class="player-item ${!player.available ? 'unavailable' : ''}">
        <div class="player-info">
          <strong>${escapeHtml(player.name)}</strong>
        </div>
        <label class="availability-checkbox">
          <input type="checkbox" ${player.available ? 'checked' : ''} 
                 data-player-id="${player.id}" 
                 class="availability-toggle">
          <span class="checkmark"></span>
        </label>
      </div>
    `).join('');
    
    // Attach event listeners to checkboxes
    document.querySelectorAll('.availability-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', handleAvailabilityToggle);
    });
  } catch (error) {
    console.error('Error loading players:', error);
    document.getElementById('playersList').innerHTML = 
      '<p class="error">Failed to load players. Please refresh the page.</p>';
  }
}

// Load and display matches
async function loadMatches() {
  try {
    const response = await fetch(`${API_BASE}/matches`);
    if (!response.ok) throw new Error('Failed to fetch matches');
    
    const matches = await response.json();
    const matchesList = document.getElementById('matchesList');
    
    if (matches.length === 0) {
      matchesList.innerHTML = '<p class="empty">No matches created yet.</p>';
      return;
    }
    
    matchesList.innerHTML = matches.map(match => {
      const servingTeam = [];
      const receivingTeam = [];
      
      if (match.player1_name) servingTeam.push(match.player1_name);
      if (match.player2_name) servingTeam.push(match.player2_name);
      if (match.player3_name) receivingTeam.push(match.player3_name);
      if (match.player4_name) receivingTeam.push(match.player4_name);
      
      const matchDate = new Date(match.created_at).toLocaleString();
      
      return `
        <div class="match-item">
          <div class="match-header">
            <span class="match-date">${matchDate}</span>
          </div>
          <div class="match-teams">
            <div class="team serving-team">
              <span class="team-label">Serving</span>
              <div class="team-players">
                ${servingTeam.map(p => `<span class="player-badge serving">${escapeHtml(p)}</span>`).join('')}
              </div>
            </div>
            <div class="team receiving-team">
              <span class="team-label">Receiving</span>
              <div class="team-players">
                ${receivingTeam.map(p => `<span class="player-badge receiving">${escapeHtml(p)}</span>`).join('')}
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error loading matches:', error);
    document.getElementById('matchesList').innerHTML = 
      '<p class="error">Failed to load matches. Please refresh the page.</p>';
  }
}

// Create matches for all courts (always 4 players per match)
async function createMatches() {
  try {
    const numPlayers = 4; // All matches are 4 players
    
    // Get number of courts
    const courtsInput = document.getElementById('courtsInput');
    const numCourts = parseInt(courtsInput.value) || 1;
    
    if (numCourts < 1) {
      showMessage('matchMessage', 'Number of courts must be at least 1', true);
      return;
    }
    
    // First, get all players
    const response = await fetch(`${API_BASE}/players`);
    if (!response.ok) throw new Error('Failed to fetch players');
    
    const allPlayers = await response.json();
    
    // Filter to only available players
    const availablePlayers = allPlayers.filter(p => p.available === 1 || p.available === true);
    
    const totalPlayersNeeded = numPlayers * numCourts;
    
    if (availablePlayers.length < totalPlayersNeeded) {
      showMessage('matchMessage', 
        `Not enough available players. Need ${totalPlayersNeeded} players for ${numCourts} court(s), but only ${availablePlayers.length} are available.`, 
        true);
      return;
    }
    
    // Shuffle available players
    const shuffled = shuffleArray([...availablePlayers]);
    
    // Create matches for each court
    const createdMatches = [];
    let playerIndex = 0;
    
    for (let court = 0; court < numCourts; court++) {
      const selectedPlayers = shuffled.slice(playerIndex, playerIndex + numPlayers);
      
      // Split into two teams: first 2 = serving, last 2 = receiving
      const servingTeam = selectedPlayers.slice(0, 2);
      const receivingTeam = selectedPlayers.slice(2, 4);
      
      // Order: [serving1, serving2, receiving1, receiving2]
      const playerIds = [
        servingTeam[0].id,
        servingTeam[1].id,
        receivingTeam[0].id,
        receivingTeam[1].id
      ];
      
      playerIndex += numPlayers;
      
      // Create the match
      const matchResponse = await fetch(`${API_BASE}/matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playerIds })
      });
      
      if (!matchResponse.ok) {
        const error = await matchResponse.json();
        throw new Error(error.error || 'Failed to create match');
      }
      
      const match = await matchResponse.json();
      createdMatches.push({ 
        match, 
        servingTeam: servingTeam.map(p => p.name),
        receivingTeam: receivingTeam.map(p => p.name)
      });
    }
    
    // Show success message
    const matchText = numCourts === 1 ? 'match' : 'matches';
    const playerNamesList = createdMatches.map((m, idx) => 
      `Court ${idx + 1}: Serving: ${m.servingTeam.join(', ')} | Receiving: ${m.receivingTeam.join(', ')}`
    ).join(' | ');
    
    showMessage('matchMessage', 
      `Created ${numCourts} ${matchText} successfully! ${playerNamesList}`, 
      false);
    
    // Reload matches
    loadMatches();
  } catch (error) {
    console.error('Error creating matches:', error);
    showMessage('matchMessage', error.message || 'Failed to create matches', true);
  }
}

// Handle adding a new player
function setupAddPlayer() {
  const input = document.getElementById('playerNameInput');
  const addBtn = document.getElementById('addPlayerBtn');
  
  const addPlayer = async () => {
    const name = input.value.trim();
    
    if (!name) {
      showMessage('formMessage', 'Please enter a player name', true);
      return;
    }
    
    try {
      const response = await fetch(`${API_BASE}/players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add player');
      }
      
      // Clear input
      input.value = '';
      
      // Reload players
      loadPlayers();
    } catch (error) {
      console.error('Error adding player:', error);
      showMessage('formMessage', error.message || 'Failed to add player', true);
    }
  };
  
  addBtn.addEventListener('click', addPlayer);
  input.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addPlayer();
    }
  });
}

// Handle availability toggle
async function handleAvailabilityToggle(e) {
  const playerId = parseInt(e.target.dataset.playerId);
  const available = e.target.checked;
  
  try {
    const response = await fetch(`${API_BASE}/players/${playerId}/availability`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ available })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update availability');
    }
    
    // Reload players list to apply new sorting
    loadPlayers();
  } catch (error) {
    console.error('Error updating availability:', error);
    // Revert checkbox on error
    e.target.checked = !available;
    showMessage('formMessage', error.message || 'Failed to update availability', true);
  }
}

// Handle match creation button
document.getElementById('createMatches').addEventListener('click', () => {
  createMatches();
});

// Utility function to escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Initialize: Load players and matches on page load
document.addEventListener('DOMContentLoaded', () => {
  setupAddPlayer();
  loadPlayers();
  loadMatches();
  
  // Setup courts stepper
  const decreaseBtn = document.getElementById('decreaseCourts');
  const increaseBtn = document.getElementById('increaseCourts');
  const courtsValue = document.getElementById('courtsValue');
  const courtsInput = document.getElementById('courtsInput');
  
  const updateCourts = (value) => {
    const numValue = parseInt(value);
    if (numValue >= 1 && numValue <= 10) {
      courtsValue.textContent = numValue;
      courtsInput.value = numValue;
    }
  };
  
  decreaseBtn.addEventListener('click', () => {
    const current = parseInt(courtsInput.value) || 1;
    if (current > 1) {
      updateCourts(current - 1);
    }
  });
  
  increaseBtn.addEventListener('click', () => {
    const current = parseInt(courtsInput.value) || 1;
    if (current < 10) {
      updateCourts(current + 1);
    }
  });
  
  // Refresh every 30 seconds
  setInterval(() => {
    loadPlayers();
    loadMatches();
  }, 30000);
});

