// API base URL
const API_BASE = '/api';

// Default substitute message template
const DEFAULT_SUB_TEMPLATE = 'Hi {name}, can you sub on {day} at {time}?';
const SESSION_DAY_KEY = 'sessionDay';
const SESSION_TIME_KEY = 'sessionTime';

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
    
    // Count active players
    const activeCount = players.filter(p => p.available === 1 || p.available === true).length;
    document.getElementById('activeCount').textContent = activeCount;
    
    if (players.length === 0) {
      playersList.innerHTML = '<p class="empty">No players registered yet.</p>';
      return;
    }
    
    playersList.innerHTML = players.map(player => {
      const phoneIndicator = player.phone ? `<span class="phone-indicator" title="Phone saved for texting" aria-hidden="true">📞</span>` : '';
      const phoneData = player.phone ? ` data-player-phone="${encodeURIComponent(player.phone)}"` : '';

      return `
        <div class="player-item ${!player.available ? 'unavailable' : ''}" data-player-id="${player.id}">
          <div class="player-info">
            <div class="player-name-row">
              <strong>${escapeHtml(player.name)}</strong>
              ${phoneIndicator}
            </div>
          </div>
          <div class="player-actions">
            <button class="text-btn" data-player-id="${player.id}" data-player-name="${escapeHtml(player.name)}"${phoneData} aria-label="Text ${escapeHtml(player.name)}">Text</button>
            <label class="availability-checkbox">
              <input type="checkbox" ${player.available ? 'checked' : ''} 
                     data-player-id="${player.id}" 
                     class="availability-toggle">
              <span class="checkmark"></span>
            </label>
            <button class="delete-btn" data-player-id="${player.id}" data-player-name="${escapeHtml(player.name)}" aria-label="Delete ${escapeHtml(player.name)}">×</button>
          </div>
        </div>
      `;
    }).join('');
    
    // Attach event listeners to checkboxes
    document.querySelectorAll('.availability-toggle').forEach(checkbox => {
      checkbox.addEventListener('change', handleAvailabilityToggle);
    });
    setupTextButtons();
    setupPlayerDeleteButtons();
    setupPlayerSwipeToDelete();
  } catch (error) {
    console.error('Error loading players:', error);
    document.getElementById('playersList').innerHTML = 
      '<p class="error">Failed to load players. Please refresh the page.</p>';
  }
}

// Load and display matches
async function loadMatches() {
  try {
    // Get both matches and players
    const [matchesResponse, playersResponse] = await Promise.all([
      fetch(`${API_BASE}/matches`),
      fetch(`${API_BASE}/players`)
    ]);
    
    if (!matchesResponse.ok) throw new Error('Failed to fetch matches');
    if (!playersResponse.ok) throw new Error('Failed to fetch players');
    
    const matches = await matchesResponse.json();
    const allPlayers = await playersResponse.json();
    const matchesList = document.getElementById('matchesList');
    
    if (matches.length === 0) {
      matchesList.innerHTML = '<p class="empty">No matches created yet.</p>';
      return;
    }
    
    // Get available players
    const availablePlayers = allPlayers.filter(p => p.available === 1 || p.available === true);
    const availablePlayerIds = new Set(availablePlayers.map(p => p.id));
    const availablePlayerMap = new Map(availablePlayers.map(p => [p.id, p]));
    
    // Group matches by num_courts and match_group
    const groupedMatches = {};
    matches.forEach(match => {
      const numCourts = match.num_courts || 1;
      const group = match.match_group || 0;
      const key = `${numCourts}-${group}`;
      if (!groupedMatches[key]) {
        groupedMatches[key] = {
          numCourts: numCourts,
          group: group,
          matches: []
        };
      }
      groupedMatches[key].matches.push(match);
    });
    
    // Sort groups by most recent timestamp (descending - newest first)
    const sortedGroups = Object.values(groupedMatches).sort((a, b) => {
      const dateA = new Date(a.matches[0].created_at);
      const dateB = new Date(b.matches[0].created_at);
      return dateB - dateA; // Most recent first
    });
    
    matchesList.innerHTML = sortedGroups.map(groupData => {
      const groupMatches = groupData.matches;
      const matchDate = new Date(groupMatches[0].created_at).toLocaleString('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
      
      // Get all player IDs playing in this match group
      const playingPlayerIds = new Set();
      groupMatches.forEach(match => {
        if (match.player1_id) playingPlayerIds.add(match.player1_id);
        if (match.player2_id) playingPlayerIds.add(match.player2_id);
        if (match.player3_id) playingPlayerIds.add(match.player3_id);
        if (match.player4_id) playingPlayerIds.add(match.player4_id);
      });
      
      // Find players who are available but not playing (sitting out)
      const sittingOut = availablePlayers.filter(p => !playingPlayerIds.has(p.id));
      
      return `
        <div class="match-group">
          <div class="match-group-header">
            <span class="match-group-number">Match #${groupData.group}</span>
            <span class="match-group-date">${matchDate}</span>
          </div>
          ${sittingOut.length > 0 ? `
            <div class="sitting-out">
              <span class="sitting-out-label">Sitting Out:</span>
              <div class="sitting-out-players">
                ${sittingOut.map(p => `<span class="player-badge sitting-out">${escapeHtml(p.name)}</span>`).join('')}
              </div>
            </div>
          ` : ''}
          <div class="match-group-matches">
            ${groupData.matches.map(match => {
              const servingTeam = [];
              const receivingTeam = [];
              
              if (match.player1_name) servingTeam.push(match.player1_name);
              if (match.player2_name) servingTeam.push(match.player2_name);
              if (match.player3_name) receivingTeam.push(match.player3_name);
              if (match.player4_name) receivingTeam.push(match.player4_name);
              
              return `
                <div class="match-item">
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
            }).join('')}
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

// Track last courts value to detect changes
let lastCourtsValue = 1;

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
    
    // Get next match group number for this court count (automatically resets per court count)
    const groupResponse = await fetch(`${API_BASE}/matches/next-group?numCourts=${numCourts}`);
    if (!groupResponse.ok) {
      const errorData = await groupResponse.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || 'Failed to get match group number');
    }
    const groupData = await groupResponse.json();
    const matchGroup = groupData.nextGroup;
    
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
        body: JSON.stringify({ playerIds, matchGroup, numCourts })
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
      `Created Match #${matchGroup} with ${numCourts} ${matchText}! ${playerNamesList}`, 
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

// Delete player
async function handleDeletePlayer(playerId, playerName) {
  try {
    const response = await fetch(`${API_BASE}/players/${playerId}`, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to delete player');
    }
    showMessage('formMessage', `Removed ${playerName || 'player'}`);
    loadPlayers();
    loadMatches();
  } catch (error) {
    console.error('Error deleting player:', error);
    showMessage('formMessage', error.message || 'Failed to delete player', true);
  }
}

// Prompt for a phone number (if needed) and open the user's messaging app
async function handleTextPlayer(button) {
  const playerId = parseInt(button.dataset.playerId);
  const playerName = button.dataset.playerName || 'player';
  let storedPhone = button.dataset.playerPhone ? decodeURIComponent(button.dataset.playerPhone) : '';

  if (Number.isNaN(playerId)) return;

  if (!storedPhone) {
    const userInput = window.prompt(`Enter ${playerName}'s phone number to text about substituting:`);
    if (userInput === null) return; // User canceled

    const trimmed = userInput.trim();
    const phonePattern = /^[0-9+\-().\s]{7,20}$/;

    if (!trimmed || !phonePattern.test(trimmed)) {
      showMessage('formMessage', 'Please enter a valid phone number (7-20 digits).', true);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/players/${playerId}/phone`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmed })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to save phone number');
      }

      const updatedPlayer = await response.json();
      storedPhone = updatedPlayer.phone;
      button.dataset.playerPhone = encodeURIComponent(updatedPlayer.phone || '');
      showMessage('formMessage', `Saved phone for ${playerName}.`);
      loadPlayers(); // Refresh to show phone icon
    } catch (error) {
      console.error('Error saving phone:', error);
      showMessage('formMessage', error.message || 'Failed to save phone number', true);
      return;
    }
  }

  if (!storedPhone) return;

  // Use stored session day/time
  const { day, time } = getSessionInfo();
  if (!day || !time) {
    showMessage('formMessage', 'Set session day/time in the header before texting.', true);
    return;
  }

  const messageTemplate = getSavedSubTemplate();
  const messageBody = buildSubMessage(messageTemplate, {
    name: playerName,
    day,
    time
  });

  openSmsIntent(storedPhone, messageBody);
}

function setupTextButtons() {
  document.querySelectorAll('.text-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      handleTextPlayer(button);
    });
  });
}

// Open the default SMS/messaging app with a prefilled message
function openSmsIntent(phone, messageBody) {
  const cleanedPhone = phone.replace(/[^\d+]/g, '');
  if (!cleanedPhone) return;

  const smsLink = `sms:${cleanedPhone}?&body=${encodeURIComponent(messageBody || '')}`;

  const link = document.createElement('a');
  link.href = smsLink;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Template editor helpers
function getSavedSubTemplate() {
  const saved = localStorage.getItem('subTemplate');
  return saved && saved.trim() ? saved : DEFAULT_SUB_TEMPLATE;
}

function saveSubTemplate(value) {
  const toSave = value && value.trim() ? value : DEFAULT_SUB_TEMPLATE;
  localStorage.setItem('subTemplate', toSave);
}

function buildSubMessage(template, data) {
  return (template || DEFAULT_SUB_TEMPLATE)
    .replace(/\{name\}/gi, data.name || '')
    .replace(/\{day\}/gi, data.day || '')
    .replace(/\{time\}/gi, data.time || '');
}

function setupTemplateEditor() {
  const input = document.getElementById('subTemplateInput');
  if (!input) return;

  input.value = getSavedSubTemplate();
  input.addEventListener('input', () => {
    saveSubTemplate(input.value);
  });
}

// Session day/time helpers
function getSessionInfo() {
  return {
    day: (localStorage.getItem(SESSION_DAY_KEY) || '').trim(),
    time: (localStorage.getItem(SESSION_TIME_KEY) || '').trim()
  };
}

function saveSessionInfo(day, time) {
  localStorage.setItem(SESSION_DAY_KEY, day || '');
  localStorage.setItem(SESSION_TIME_KEY, time || '');
  updateSessionTitle();
}

function updateSessionTitle() {
  const titleEl = document.getElementById('sessionTitleText');
  if (!titleEl) return;
  const { day, time } = getSessionInfo();
  if (day && time) {
    titleEl.textContent = `Session: ${day} at ${time}`;
  } else {
    titleEl.textContent = 'Set session day/time';
  }
}

function setupSessionControls() {
  const dayInput = document.getElementById('sessionDayInput');
  const timeInput = document.getElementById('sessionTimeInput');
  const saveBtn = document.getElementById('sessionSaveBtn');
  const editBtn = document.getElementById('sessionEditBtn');
  const inputs = document.getElementById('sessionInputs');
  if (!dayInput || !timeInput || !saveBtn || !editBtn || !inputs) return;

  const { day, time } = getSessionInfo();
  dayInput.value = day;
  timeInput.value = time;
  updateSessionTitle();

  const setEditing = (isEditing) => {
    inputs.classList.toggle('hidden', !isEditing);
    saveBtn.classList.toggle('hidden', !isEditing);
    editBtn.classList.toggle('active', isEditing);
    if (isEditing) {
      dayInput.focus();
    }
  };

  const persist = () => {
    const newDay = dayInput.value.trim();
    const newTime = timeInput.value.trim();
    saveSessionInfo(newDay, newTime);
    setEditing(false);
  };

  // Initial state: hide inputs if day/time already set
  setEditing(!(day && time));

  saveBtn.addEventListener('click', persist);
  editBtn.addEventListener('click', () => setEditing(true));
}

function setupPlayerDeleteButtons() {
  document.querySelectorAll('.delete-btn').forEach(button => {
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      const playerId = parseInt(button.dataset.playerId);
      const playerName = button.dataset.playerName;
      if (Number.isNaN(playerId)) return;
      if (window.confirm(`Delete ${playerName || 'this player'}?`)) {
        handleDeletePlayer(playerId, playerName);
      }
    });
  });
}

function setupPlayerSwipeToDelete() {
  const threshold = 60;
  const verticalLimit = 40;
  document.querySelectorAll('.player-item').forEach(item => {
    let startX = 0;
    let startY = 0;
    item.style.touchAction = 'pan-y';

    item.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    }, { passive: true });

    item.addEventListener('touchend', (e) => {
      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - startX;
      const deltaY = touch.clientY - startY;
      if (Math.abs(deltaY) > verticalLimit) return;
      if (deltaX < -threshold) {
        const deleteBtn = item.querySelector('.delete-btn');
        if (deleteBtn) deleteBtn.click();
      }
    }, { passive: true });
  });
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
  setupTemplateEditor();
  setupSessionControls();
  
  // Setup accordion for Players section
  const playersAccordionHeader = document.getElementById('playersAccordionHeader');
  const playersAccordionContent = document.getElementById('playersAccordionContent');
  
  playersAccordionHeader.addEventListener('click', () => {
    const isCollapsed = playersAccordionHeader.classList.contains('collapsed');
    if (isCollapsed) {
      playersAccordionHeader.classList.remove('collapsed');
      playersAccordionContent.classList.remove('collapsed');
    } else {
      playersAccordionHeader.classList.add('collapsed');
      playersAccordionContent.classList.add('collapsed');
    }
  });
  
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
      lastCourtsValue = numValue;
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

