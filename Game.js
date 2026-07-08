class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.entities = [];
    this.state = 'MENU';

    this.designWidth = 800;
    this.designHeight = 600;
    this.cam = new Camera(canvas, {
      width: this.designWidth,
      height: this.designHeight,
      background: '#0f0e1a'
    });

    this.lastTime = 0;
    this.bgGrid = new BackgroundGrid(this.designWidth, this.designHeight);
    this.entities.push(this.bgGrid);

    // Game state
    this.currentLevel = null;
    this.currentMode = 'learn';
    this.currentDiffKey = 'easy';
    this.gameType = 'challenge';
    this.score = 0;
    this.timer = 0;
    this.lives = 1;
    this.correctCount = 0;
    this.totalAttempted = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.equationQueue = [];
    this.eqDisplay = null;
    this.playerUsername = null;
    this.playerGrade = '';
    this.playerSection = '';
    this.scoreMultiplier = 1;

    this.draggedBlock = null;
    this.offsetX = 0;
    this.offsetY = 0;

    this.mp = Multiplayer;
    this._matchActive = false;
    this._savedState = this._loadSavedState();
    this._saveIndicator = null;

    this.setupResize();
    this.setupInput();
    this.setupUI();

    // Bootstrap with error handling
    this.bootstrap().catch(e => {
      console.error('Bootstrap error:', e);
      this._showError(e);
    });

    this.start();
  }

  // ─── Error Display ───
  _showError(error) {
    const display = document.getElementById('errorDisplay');
    const msg = document.getElementById('errorMessage');
    if (display && msg) {
      display.style.display = 'flex';
      msg.textContent = error.stack || error.message || String(error);
    }
  }

  // ─── Bootstrap ───
  async bootstrap() {
    try {
      document.getElementById('loadingText').textContent = 'Initializing...';
      await SupabaseClient.init();

      let savedName = null;
      try { savedName = localStorage.getItem('chemblast_username'); } catch (e) {}

      if (savedName) {
        try {
          const player = await SupabaseClient.getOrCreatePlayer(savedName);
          this.playerUsername = player.username;
          this.playerGrade = player.grade || '';
          this.playerSection = player.section || '';
        } catch (e) {
          console.warn('Could not restore player:', e.message);
          localStorage.removeItem('chemblast_username');
        }
      }

      document.getElementById('loadingText').style.display = 'none';
      document.getElementById('btnRankMode').style.display = 'inline-block';
      document.getElementById('btnChallenge').style.display = 'inline-block';
      document.getElementById('btnHowToPlay').style.display = 'inline-block';
      document.getElementById('btnLeaderboard').style.display = 'inline-block';
      document.getElementById('mainMenuAudioRow').style.display = 'block';

      try {
        const musicPref = localStorage.getItem('chemblast_music');
        const sfxPref = localStorage.getItem('chemblast_sfx');
        if (musicPref === 'off') {
          Audio.musicEnabled = false;
          Audio.musicGain.gain.value = 0;
        }
        if (sfxPref === 'off') Audio.sfxEnabled = false;
        document.getElementById('btnToggleMusic').textContent = Audio.musicEnabled ? '🎵 Music' : '🚫 Music';
        document.getElementById('btnToggleSfx').textContent = Audio.sfxEnabled ? '🔊 SFX' : '🔇 SFX';
      } catch (e) {}

      if (!this.playerUsername) {
        setTimeout(() => this.showUsernameModal(), 500);
      } else {
        Audio.startMusic();
        this._showPlayerInfo();
        if (this._savedState && this._savedState.levelId) {
          if (confirm('You have a saved game. Do you want to continue?')) {
            this._restoreSavedState();
          } else {
            this._clearSavedState();
          }
        }
      }
    } catch (e) {
      console.error('Bootstrap error:', e);
      this._showError(e);
    }
  }

  // ─── Player Info Toast ───
  _showPlayerInfo() {
    const gradeSection = this.playerGrade || this.playerSection 
      ? `${this.playerGrade}${this.playerGrade && this.playerSection ? ' - ' : ''}${this.playerSection}`
      : '';
    if (gradeSection) {
      const info = document.createElement('div');
      info.style.cssText = `
        position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: rgba(0,0,0,0.6); color: #b0c4e8; padding: 6px 16px;
        border-radius: 20px; font-size: 13px; z-index: 50;
        pointer-events: none; backdrop-filter: blur(4px);
        border: 1px solid rgba(255,255,255,0.05);
      `;
      info.textContent = `👤 ${this.playerUsername}  •  ${gradeSection}`;
      document.getElementById('ui-layer').appendChild(info);
      setTimeout(() => info.remove(), 8000);
    }
  }

  // ─── Save / Restore ───
  _saveProgress() {
    if (this.gameType !== 'challenge' || !this.currentLevel) return;
    const state = {
      levelId: this.currentLevel.id,
      mode: this.currentMode,
      diffKey: this.currentDiffKey,
      score: this.score,
      streak: this.streak,
      maxStreak: this.maxStreak,
      correctCount: this.correctCount,
      totalAttempted: this.totalAttempted,
      timer: this.timer,
      lives: this.lives,
      equationQueue: this.equationQueue,
      queueIndex: this.equationQueue.length > 0 ? 0 : 0,
      currentEqId: this.eqDisplay ? this.eqDisplay.equationData.id : null,
      timestamp: Date.now()
    };
    try { localStorage.setItem('chemblast_save', JSON.stringify(state)); } catch (e) {}
    this._showSaveIndicator('💾 Progress saved');
  }

  _showSaveIndicator(msg) {
    if (this._saveIndicator) this._saveIndicator.remove();
    const el = document.createElement('div');
    el.style.cssText = `
      position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
      background: rgba(123, 237, 159, 0.15); color: #7bed9f;
      padding: 6px 18px; border-radius: 20px; font-size: 13px;
      pointer-events: none; backdrop-filter: blur(4px);
      border: 1px solid rgba(123, 237, 159, 0.2);
      transition: opacity 0.5s; z-index: 50;
    `;
    el.textContent = msg;
    document.getElementById('ui-layer').appendChild(el);
    this._saveIndicator = el;
    setTimeout(() => {
      if (el) el.style.opacity = '0';
      setTimeout(() => el.remove(), 600);
    }, 2500);
  }

  _loadSavedState() {
    try {
      const raw = localStorage.getItem('chemblast_save');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

  _clearSavedState() {
    localStorage.removeItem('chemblast_save');
  }

  _restoreSavedState() {
    const state = this._savedState;
    if (!state) return;
    const level = LevelData_levels.find(l => l.id === state.levelId);
    if (!level) { this._clearSavedState(); return; }
    this.currentLevel = level;
    this.currentMode = state.mode || level.mode;
    this.currentDiffKey = state.diffKey || level.diffKey;
    this.score = state.score || 0;
    this.streak = state.streak || 0;
    this.maxStreak = state.maxStreak || 0;
    this.correctCount = state.correctCount || 0;
    this.totalAttempted = state.totalAttempted || 0;
    this.timer = state.timer || level.time || 0;
    this.lives = state.lives || level.lives || 1;
    this.equationQueue = state.equationQueue || [...level.eqs];
    if (state.queueIndex && state.queueIndex > 0) {
      this.equationQueue.splice(0, state.queueIndex);
    }
    if (state.currentEqId) {
      const idx = this.equationQueue.indexOf(state.currentEqId);
      if (idx > -1) {
        this.equationQueue.splice(idx, 1);
        this.equationQueue.unshift(state.currentEqId);
      }
    }
    this._startLevelFromSaved();
    this._clearSavedState();
  }

  _startLevelFromSaved() {
    this.gameType = 'challenge';
    if (this.eqDisplay) {
      this.eqDisplay.cleanup();
      this.eqDisplay.destroy = true;
      this.eqDisplay = null;
    }
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('hudLevel').textContent = this.currentLevel.shortName || this.currentLevel.name;
    document.getElementById('hudScore').textContent = `Score: ${this.score}`;
    this.setupTray();
    this.nextEquation();
    this.state = 'PLAYING';
  }

  // ─── Username Modal ───
  showUsernameModal() {
    const modal = document.getElementById('usernameModal');
    document.getElementById('usernameInput').value = '';
    document.getElementById('gradeInput').value = '';
    document.getElementById('sectionInput').value = '';
    document.getElementById('usernameError').textContent = '';
    modal.style.display = 'flex';
    setTimeout(() => document.getElementById('usernameInput').focus(), 100);
  }

  closeUsernameModal() {
    document.getElementById('usernameModal').style.display = 'none';
  }

  async handleUsernameSave() {
    const input = document.getElementById('usernameInput');
    const gradeInput = document.getElementById('gradeInput');
    const sectionInput = document.getElementById('sectionInput');
    const error = document.getElementById('usernameError');
    const name = input.value.trim();
    const grade = gradeInput.value.trim();
    const section = sectionInput.value.trim();

    if (!name) { error.textContent = 'Please enter a name or press Skip.'; return; }
    if (name.length < 2) { error.textContent = 'Name must be at least 2 characters.'; return; }

    try {
      const player = await SupabaseClient.getOrCreatePlayer(name, grade, section);
      this.playerUsername = player.username;
      this.playerGrade = player.grade || '';
      this.playerSection = player.section || '';
      localStorage.setItem('chemblast_username', this.playerUsername);
      this.closeUsernameModal();
      Audio.startMusic();
      this._showPlayerInfo();
      if (this._savedState && this._savedState.levelId) {
        if (confirm('You have a saved game. Do you want to continue?')) {
          this._restoreSavedState();
        } else {
          this._clearSavedState();
        }
      }
    } catch (e) {
      error.textContent = 'Error: ' + e.message;
    }
  }

  // ─── UI Setup ───
  setupUI() {
    document.getElementById('btnRankMode').addEventListener('click', () => {
      document.getElementById('mainMenu').style.display = 'none';
      this.startRankMatchmaking();
    });
    document.getElementById('btnChallenge').addEventListener('click', () => {
      document.getElementById('mainMenu').style.display = 'none';
      this.showDifficultySelect();
    });
    document.getElementById('btnLeaderboard').addEventListener('click', () => {
      this.showLeaderboard();
    });
    document.getElementById('btnHowToPlay').addEventListener('click', () => {
      document.getElementById('tutorialModal').style.display = 'flex';
    });
    document.getElementById('btnTutorialClose').addEventListener('click', () => {
      document.getElementById('tutorialModal').style.display = 'none';
    });

    document.getElementById('btnDiffBack').addEventListener('click', () => {
      document.getElementById('difficultySelect').style.display = 'none';
      document.getElementById('mainMenu').style.display = 'flex';
    });
    document.getElementById('btnModeBack').addEventListener('click', () => {
      document.getElementById('modeSelect').style.display = 'none';
      document.getElementById('difficultySelect').style.display = 'flex';
    });

    document.getElementById('btnMap').addEventListener('click', () => {
      document.getElementById('gameOver').style.display = 'none';
      document.getElementById('hud').style.display = 'none';
      document.getElementById('mainMenu').style.display = 'flex';
      this._clearSavedState();
    });
    document.getElementById('btnRetry').addEventListener('click', () => {
      document.getElementById('gameOver').style.display = 'none';
      document.getElementById('hud').style.display = 'none';
      if (this.currentLevel) {
        this.startLevel(this.currentLevel);
      } else {
        this.showDifficultySelect();
      }
    });
    document.getElementById('btnNextLevel').addEventListener('click', () => {
      document.getElementById('gameOver').style.display = 'none';
      document.getElementById('hud').style.display = 'none';
      const diffOrder = ['easy', 'medium', 'hard', 'super_hard'];
      const idx = diffOrder.indexOf(this.currentDiffKey);
      if (idx >= 0 && idx < diffOrder.length - 1) {
        const nextDiff = diffOrder[idx + 1];
        const level = LevelData_levels.find(l => l.diffKey === nextDiff && l.modeKey === this.currentLevel.modeKey);
        if (level) { this.startLevel(level); return; }
      }
      this.showDifficultySelect();
    });
    document.getElementById('btnGameOverLeaderboard').addEventListener('click', () => {
      this.showLeaderboard();
    });

    document.getElementById('btnRankRetry').addEventListener('click', () => {
      document.getElementById('rankGameOver').style.display = 'none';
      document.getElementById('rankHud').style.display = 'none';
      this.startRankMatchmaking();
    });
    document.getElementById('btnRankMap').addEventListener('click', () => {
      document.getElementById('rankGameOver').style.display = 'none';
      document.getElementById('rankHud').style.display = 'none';
      this.mp.leaveMatch();
      document.getElementById('mainMenu').style.display = 'flex';
    });
    document.getElementById('btnRankLeaderboard').addEventListener('click', () => {
      this.showLeaderboard('rank');
    });

    document.getElementById('btnLbClose').addEventListener('click', () => {
      document.getElementById('leaderboardModal').style.display = 'none';
    });

    const usernameInput = document.getElementById('usernameInput');
    usernameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.handleUsernameSave();
    });
    document.getElementById('btnUsernameSave').addEventListener('click', () => {
      this.handleUsernameSave();
    });
    document.getElementById('btnUsernameSkip').addEventListener('click', () => {
      this.closeUsernameModal();
    });

    document.getElementById('btnToggleMusic').addEventListener('click', () => {
      const on = !Audio.toggleMusic();
      document.getElementById('btnToggleMusic').textContent = on ? '🎵 Music' : '🚫 Music';
      localStorage.setItem('chemblast_music', on ? 'on' : 'off');
      Audio.playClick();
    });
    document.getElementById('btnToggleSfx').addEventListener('click', () => {
      const on = !Audio.toggleSfx();
      document.getElementById('btnToggleSfx').textContent = on ? '🔊 SFX' : '🔇 SFX';
      localStorage.setItem('chemblast_sfx', on ? 'on' : 'off');
      if (on) Audio.playClick();
    });

    document.getElementById('btnCancelMatch').addEventListener('click', () => {
      this.mp.leaveMatch();
      document.getElementById('rankWaiting').style.display = 'none';
      document.getElementById('mainMenu').style.display = 'flex';
    });

    document.querySelectorAll('button').forEach(btn => {
      if (btn.id !== 'btnToggleMusic' && btn.id !== 'btnToggleSfx') {
        btn.addEventListener('click', () => Audio.playClick());
      }
    });
  }

  // ─── Rank Mode ───
  startRankMatchmaking() {
    if (!this.playerUsername) { this.showUsernameModal(); return; }
    document.getElementById('rankWaiting').style.display = 'flex';
    this.mp.joinQueue(
      SupabaseClient._currentPlayer.id,
      this.playerUsername,
      (matchData) => this.onMatchFound(matchData),
      (matchData) => this.onMatchUpdate(matchData),
      (matchData) => this.onMatchEnd(matchData)
    ).catch(err => {
      console.error(err);
      document.getElementById('rankWaiting').style.display = 'none';
      alert('Matchmaking error: ' + err.message);
    });
  }

  onMatchFound(matchData) {
    document.getElementById('rankWaiting').style.display = 'none';
    this._matchActive = true;
    this.startRankMatch(matchData);
  }

  onMatchUpdate(matchData) {
    const myId = SupabaseClient._currentPlayer.id;
    const opponentId = (matchData.player1_id === myId) ? matchData.player2_id : matchData.player1_id;
    const opponentUsername = (matchData.player1_id === myId) ? matchData.player2_username : matchData.player1_username;
    const opponentCorrect = (matchData.player1_id === myId) ? matchData.player2_correct : matchData.player1_correct;
    document.getElementById('rankHudOpponent').textContent = `${opponentUsername}: ${opponentCorrect} correct`;
  }

  onMatchEnd(matchData) {
    this._matchActive = false;
    const myId = SupabaseClient._currentPlayer.id;
    const winner = matchData.winner;
    const isWinner = (winner === myId);
    const opponentUsername = (matchData.player1_id === myId) ? matchData.player2_username : matchData.player1_username;
    const myScore = (matchData.player1_id === myId) ? matchData.player1_score : matchData.player2_score;
    const oppScore = (matchData.player1_id === myId) ? matchData.player2_score : matchData.player1_score;

    document.getElementById('rankGameOverTitle').textContent = isWinner ? '🏆 You Win!' : '💀 You Lose!';
    document.getElementById('rankGameOverStats').textContent = `You: ${myScore} | ${opponentUsername}: ${oppScore}`;
    document.getElementById('rankGameOverRank').textContent = isWinner ? 'Great job!' : 'Better luck next time!';
    document.getElementById('rankGameOver').style.display = 'flex';
    document.getElementById('rankHud').style.display = 'none';

    if (this.playerUsername && myScore > 0) {
      SupabaseClient.saveScore({
        score: myScore,
        correctCount: this.correctCount,
        totalAttempted: this.totalAttempted,
        levelId: 999,
        mode: 'rank',
        streak: this.maxStreak
      }).catch(e => console.warn('Failed to save rank score:', e));
    }
  }

  startRankMatch(matchData) {
    this.gameType = 'rank';
    this.currentMode = 'time';
    this.currentDiffKey = 'super_hard';
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.totalAttempted = 0;
    this.timer = 60;
    this.scoreMultiplier = 1;
    this.equationQueue = this._shuffleArray([...matchData.equations]);

    if (this.eqDisplay) {
      this.eqDisplay.cleanup();
      this.eqDisplay.destroy = true;
      this.eqDisplay = null;
    }

    document.getElementById('rankHud').style.display = 'flex';
    document.getElementById('rankHudScore').textContent = 'Score: 0';
    document.getElementById('rankHudStreak').textContent = 'Streak: 0';
    const myId = SupabaseClient._currentPlayer.id;
    const opponentUsername = (matchData.player1_id === myId) ? matchData.player2_username : matchData.player1_username;
    document.getElementById('rankHudOpponent').textContent = `${opponentUsername}: 0 correct`;

    this.setupTray();
    this.nextEquation();
    this.state = 'PLAYING';
  }

  // ─── Challenge Mode ───
  showDifficultySelect() {
    document.getElementById('difficultySelect').style.display = 'flex';
    const list = document.getElementById('difficultyList');
    list.innerHTML = '';
    const diffKeys = ['easy', 'medium', 'hard', 'super_hard'];
    for (const dk of diffKeys) {
      const diff = LevelData_difficulties[dk];
      const btn = document.createElement('button');
      btn.className = 'diff-btn';
      btn.style.background = '#16213e';
      btn.style.color = '#fff';
      const eqCount = LevelData_equations.filter(e => e.diff === dk).length;
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = `${diff.icon} ${diff.label}`;
      btn.appendChild(label);
      const desc = document.createElement('span');
      desc.className = 'desc';
      desc.textContent = `${eqCount} equations | ${diff.timeTime}s time challenge | ×${diff.scoreMultiplier} score`;
      btn.appendChild(desc);
      btn.addEventListener('click', () => {
        document.getElementById('difficultySelect').style.display = 'none';
        this.showModeSelect(dk);
      });
      list.appendChild(btn);
    }
  }

  showModeSelect(diffKey) {
    this.currentDiffKey = diffKey;
    const diff = LevelData_difficulties[diffKey];
    document.getElementById('modeSelectTitle').textContent = `${diff.icon} ${diff.label} — Select Mode`;
    document.getElementById('modeSelect').style.display = 'flex';
    const list = document.getElementById('modeList');
    list.innerHTML = '';
    const modeKeys = ['learn', 'time', 'endless'];
    const modeLabels = {
      learn: { label: '📖 Learn', desc: 'No timer — practice freely', timeDisplay: '-' },
      time: { label: '⏱ Time Challenge', desc: `Race the clock! ${diff.timeTime}s`, timeDisplay: `${diff.timeTime}s` },
      endless: { label: '♾ Endless Survival', desc: `Don't lose all ${diff.endlessLives} lives!`, timeDisplay: `${diff.endlessLives} lives` }
    };
    for (const mk of modeKeys) {
      const info = modeLabels[mk];
      const level = LevelData_levels.find(l => l.diffKey === diffKey && l.modeKey === mk);
      if (!level) continue;
      const btn = document.createElement('button');
      btn.className = 'mode-btn';
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = info.label;
      btn.appendChild(label);
      const desc = document.createElement('span');
      desc.className = 'desc';
      desc.textContent = `${info.desc} | ×${diff.scoreMultiplier} score`;
      btn.appendChild(desc);
      btn.addEventListener('click', () => {
        document.getElementById('modeSelect').style.display = 'none';
        this.gameType = 'challenge';
        this.startLevel(level);
      });
      list.appendChild(btn);
    }
  }

  startLevel(levelData) {
    this.gameType = 'challenge';
    this.currentLevel = levelData;
    this.currentMode = levelData.mode;
    this.currentDiffKey = levelData.diffKey;
    this.scoreMultiplier = levelData.scoreMultiplier;
    this.equationQueue = this._shuffleArray([...levelData.eqs]);
    this.score = 0;
    this.streak = 0;
    this.maxStreak = 0;
    this.correctCount = 0;
    this.totalAttempted = 0;
    this.timer = levelData.time || 0;
    this.lives = levelData.lives || 1;

    if (this.eqDisplay) {
      this.eqDisplay.cleanup();
      this.eqDisplay.destroy = true;
      this.eqDisplay = null;
    }

    document.getElementById('hud').style.display = 'flex';
    document.getElementById('hudLevel').textContent = levelData.shortName || levelData.name;
    document.getElementById('hudScore').textContent = 'Score: 0';

    this.setupTray();
    this.nextEquation();
    this.state = 'PLAYING';
    this._clearSavedState();
  }

  setupTray() {
    this.entities.forEach(e => {
      if (e.name === 'Block' && e.isTray) e.destroy = true;
    });
    const spacing = 70;
    const startX = this.designWidth / 2 - (4 * spacing);
    const y = this.designHeight - 80;
    for (let i = 1; i <= 9; i++) {
      const trayBlock = new Block(startX + (i - 1) * spacing - 30, y, i, true);
      this.entities.push(trayBlock);
    }
  }

  nextEquation() {
    if (this.eqDisplay) {
      this.eqDisplay.cleanup();
      this.eqDisplay.destroy = true;
      this.eqDisplay = null;
    }

    this.entities.forEach(e => {
      if (e.name === 'Block' && !e.isTray) e.destroy = true;
    });

    if (this.equationQueue.length === 0) {
      if (this.currentMode === 'endless') {
        this.equationQueue = this._shuffleArray([...this.currentLevel.eqs]);
      } else if (this.gameType === 'rank') {
        this.endRankMatch();
        return;
      } else {
        this.endGame(true);
        return;
      }
    }

    const eqId = this.equationQueue.shift();
    const eqData = LevelData_getEquation(eqId);
    if (!eqData) { this.nextEquation(); return; }

    this.eqDisplay = new EquationDisplay(
      this.designWidth / 2,
      this.designHeight / 2 - 50,
      eqData,
      this
    );
    this.entities.push(this.eqDisplay);
    if (this.gameType === 'challenge') this._saveProgress();
  }

  endRankMatch() {
    const myId = SupabaseClient._currentPlayer.id;
    const matchData = this.mp._matchData;
    if (!matchData) return;
    const myScore = (matchData.player1_id === myId) ? matchData.player1_score : matchData.player2_score;
    const oppScore = (matchData.player1_id === myId) ? matchData.player2_score : matchData.player1_score;
    const winnerId = (myScore > oppScore) ? myId : (oppScore > myScore ? (matchData.player1_id === myId ? matchData.player2_id : matchData.player1_id) : null);
    this.mp.finishMatch(winnerId);
  }

  // ─── Input ───
  setupInput() {
    const getPointerPos = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return this.cam.screenToWorld(clientX, clientY);
    };

    const onDown = (e) => {
      if (this.state !== 'PLAYING') return;
      const pos = getPointerPos(e);
      const sorted = [...this.entities].sort((a, b) => (b.z || 0) - (a.z || 0));
      for (const ent of sorted) {
        if (ent.name !== 'Block') continue;
        const b = ent.getBounds();
        if (pos.x < b.x || pos.x > b.x + b.width || pos.y < b.y || pos.y > b.y + b.height) continue;
        if (ent.fizzleTimer > 0) continue;
        if (ent.isTray) {
          const newBlock = new Block(ent.x, ent.y, ent.value, false);
          this.entities.push(newBlock);
          this.draggedBlock = newBlock;
          this.offsetX = pos.x - ent.x;
          this.offsetY = pos.y - ent.y;
          newBlock.isDragging = true;
          newBlock.z = 5;
          Audio.playPickup();
        } else {
          this.draggedBlock = ent;
          this.offsetX = pos.x - ent.x;
          this.offsetY = pos.y - ent.y;
          ent.isDragging = true;
          ent.z = 5;
          if (ent.slot) {
            ent.slot.block = null;
            ent.slot = null;
          }
        }
        break;
      }
    };

    const onMove = (e) => {
      if (!this.draggedBlock) return;
      const pos = getPointerPos(e);
      this.draggedBlock.x = pos.x - this.offsetX;
      this.draggedBlock.y = pos.y - this.offsetY;
    };

    const onUp = () => {
      if (!this.draggedBlock) return;
      let droppedInSlot = false;
      for (const ent of this.entities) {
        if (ent.name !== 'Slot') continue;
        const b = ent.getBounds();
        const cx = this.draggedBlock.x + this.draggedBlock.width / 2;
        const cy = this.draggedBlock.y + this.draggedBlock.height / 2;
        if (cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height) {
          if (!ent.block) {
            this.draggedBlock.x = ent.x;
            this.draggedBlock.y = ent.y;
            this.draggedBlock.slot = ent;
            ent.block = this.draggedBlock;
            droppedInSlot = true;
            this.draggedBlock.z = 3;
            this.totalAttempted++;
            Audio.playDrop();
            this.checkEquation();
          }
          break;
        }
      }
      if (!droppedInSlot) {
        this.draggedBlock.destroy = true;
      }
      this.draggedBlock.isDragging = false;
      if (this.draggedBlock && !this.draggedBlock.destroy) {
        this.draggedBlock.z = 3;
      }
      this.draggedBlock = null;
    };

    this.canvas.addEventListener('mousedown', onDown);
    this.canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(e); }, { passive: false });
    this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, { passive: false });
    window.addEventListener('touchend', () => { if (this.draggedBlock) onUp(); });
  }

  // ─── Equation Checking ───
  checkEquation() {
    if (!this.eqDisplay) return;
    const slots = this.eqDisplay.slots;
    const allFilled = slots.every(s => s.block !== null);
    if (!allFilled) return;
    const allCorrect = slots.every(s => s.block.value === s.expectedValue);

    if (allCorrect) {
      this.correctCount++;
      this.streak++;
      if (this.streak > this.maxStreak) this.maxStreak = this.streak;

      if (this.gameType === 'rank') {
        this.score += 100 + (this.streak - 1) * 10;
        document.getElementById('rankHudScore').textContent = `Score: ${this.score}`;
        document.getElementById('rankHudStreak').textContent = `Streak: ${this.streak}`;
        this.mp.updateMatch(SupabaseClient._currentPlayer.id, this.score, this.correctCount, this.totalAttempted);
      } else {
        this.score += Math.floor(100 * this.scoreMultiplier);
        document.getElementById('hudScore').textContent = `Score: ${this.score}`;
        this._saveProgress();
      }

      if (this.bgGrid) this.bgGrid.triggerClear();
      this.spawnParticles(this.designWidth / 2, this.designHeight / 2, '#7bed9f');
      Audio.playCorrect();

      this.state = 'TRANSITION';
      setTimeout(() => {
        this.nextEquation();
        this.state = 'PLAYING';
      }, 800);

    } else {
      this.streak = 0;
      if (this.gameType === 'rank') {
        document.getElementById('rankHudStreak').textContent = `Streak: 0`;
        this.mp.updateMatch(SupabaseClient._currentPlayer.id, this.score, this.correctCount, this.totalAttempted);
      } else {
        this._saveProgress();
      }

      this.cam.shake(5, 0.5);
      Audio.playWrong();

      for (const s of slots) {
        if (s.block && s.block.value !== s.expectedValue) {
          s.block.fizzleTimer = 0.5;
        }
      }

      if (this.currentMode === 'endless') {
        this.lives--;
        document.getElementById('hudTimer').textContent = `❤️ ${this.lives}`;
        if (this.lives <= 0) {
          this.state = 'TRANSITION';
          setTimeout(() => { this.endGame(false); }, 600);
        }
      }
    }
  }

  // ─── Particles ───
  spawnParticles(x, y, color) {
    for (let i = 0; i < 30; i++) {
      this.entities.push(new Particle(x, y, color));
    }
  }

  // ─── Game Over (Challenge) ───
  async endGame(win) {
    this.state = 'GAMEOVER';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('gameOver').style.display = 'flex';

    const title = document.getElementById('gameOverTitle');
    const stats = document.getElementById('gameOverStats');
    const personal = document.getElementById('gameOverPersonal');

    let statsText = `Score: ${this.score} | Correct: ${this.correctCount}/${this.totalAttempted}`;
    if (this.currentMode === 'time' && this.timer > 0) {
      statsText += ` | Time left: ${Math.ceil(this.timer)}s`;
    }

    if (win) {
      title.textContent = '🎉 Level Complete!';
      stats.textContent = statsText;
      document.getElementById('btnNextLevel').style.display = 'inline-block';
      Audio.playLevelComplete();
    } else {
      title.textContent = '💀 Game Over!';
      stats.textContent = statsText;
      document.getElementById('btnNextLevel').style.display = 'none';
      Audio.playGameOver();
    }

    personal.textContent = '';
    if (this.playerUsername && this.currentLevel && this.score > 0) {
      try {
        const isPB = await SupabaseClient.isNewPersonalBest(this.score, this.currentMode);
        await SupabaseClient.saveScore({
          score: this.score,
          correctCount: this.correctCount,
          totalAttempted: this.totalAttempted,
          levelId: this.currentLevel.id,
          mode: this.currentMode
        });
        if (isPB) personal.textContent = '🏆 New personal best!';
      } catch (e) {
        console.warn('Failed to save score:', e.message);
      }
    }
    this._clearSavedState();
  }

  // ─── Leaderboard ───
  async showLeaderboard(mode = 'challenge') {
    const modal = document.getElementById('leaderboardModal');
    const list = document.getElementById('lbList');
    const nameEl = document.getElementById('lbName');
    const rankEl = document.getElementById('lbRank');

    modal.style.display = 'flex';
    list.innerHTML = '<div class="lb-loading">Loading...</div>';

    if (this.playerUsername) {
      nameEl.textContent = this.playerUsername;
      try {
        if (mode === 'rank') {
          const rank = await SupabaseClient.getPlayerRankMode(this.playerUsername);
          const total = await SupabaseClient.getTotalPlayersRankMode();
          if (rank.playerRank !== null) {
            rankEl.textContent = `#${rank.playerRank} out of ${total} players`;
          } else {
            rankEl.textContent = 'No rank mode scores yet — play to compete!';
          }
        } else {
          const rank = await SupabaseClient.getPlayerRank(this.playerUsername);
          if (rank.scoreRank !== null) {
            rankEl.textContent = `#${rank.scoreRank} by score, #${rank.correctRank} by correct`;
          } else {
            rankEl.textContent = 'No scores yet — play a game!';
          }
        }
      } catch (e) {
        rankEl.textContent = 'Could not load rank';
      }
    } else {
      nameEl.textContent = '—';
      rankEl.textContent = 'Log in to see your rank';
    }

    if (mode === 'rank') {
      await this.refreshLeaderboardRank();
    } else {
      await this.refreshLeaderboard('score');
    }
  }

  async refreshLeaderboard(tab) {
    const list = document.getElementById('lbList');
    list.innerHTML = '<div class="lb-loading">Loading...</div>';
    try {
      let entries;
      if (tab === 'score') {
        entries = await SupabaseClient.getLeaderboardByScore(10);
      } else {
        entries = await SupabaseClient.getLeaderboardByCorrect(10);
      }
      if (!entries || entries.length === 0) {
        list.innerHTML = '<div class="lb-empty">No scores yet. Play a game to get on the board!</div>';
        return;
      }
      list.innerHTML = '';
      const username = (this.playerUsername || '').toLowerCase();
      for (const entry of entries) {
        const div = document.createElement('div');
        div.className = 'lb-entry';
        if (entry.username.toLowerCase() === username) div.classList.add('me');
        const rankNum = document.createElement('span');
        rankNum.className = 'rank-num';
        rankNum.textContent = `#${entry.rank}`;
        div.appendChild(rankNum);
        const nameSpan = document.createElement('span');
        nameSpan.className = 'lb-username';
        nameSpan.textContent = entry.username;
        div.appendChild(nameSpan);
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'lb-score';
        if (tab === 'score') {
          scoreSpan.textContent = String(entry.score);
          const extra = document.createElement('span');
          extra.className = 'lb-extra';
          extra.textContent = `${entry.correct_count || 0} correct`;
          scoreSpan.appendChild(extra);
        } else {
          scoreSpan.textContent = String(entry.correct_count || 0);
          const extra = document.createElement('span');
          extra.className = 'lb-extra';
          extra.textContent = `Score: ${entry.score}`;
          scoreSpan.appendChild(extra);
        }
        div.appendChild(scoreSpan);
        list.appendChild(div);
      }
    } catch (e) {
      list.innerHTML = `<div class="lb-empty">Error loading leaderboard: ${e.message}</div>`;
    }
  }

  async refreshLeaderboardRank() {
    const list = document.getElementById('lbList');
    list.innerHTML = '<div class="lb-loading">Loading...</div>';
    try {
      const entries = await SupabaseClient.getLeaderboardRank(8);
      if (!entries || entries.length === 0) {
        list.innerHTML = '<div class="lb-empty">No rank mode scores yet. Be the first!</div>';
        return;
      }
      list.innerHTML = '';
      const username = (this.playerUsername || '').toLowerCase();
      for (const entry of entries) {
        const div = document.createElement('div');
        div.className = 'lb-entry';
        if (entry.username.toLowerCase() === username) div.classList.add('me');
        const rankNum = document.createElement('span');
        rankNum.className = 'rank-num';
        rankNum.textContent = `#${entry.rank}`;
        div.appendChild(rankNum);
        const nameSpan = document.createElement('span');
        nameSpan.className = 'lb-username';
        nameSpan.textContent = entry.username;
        div.appendChild(nameSpan);
        const scoreSpan = document.createElement('span');
        scoreSpan.className = 'lb-score';
        scoreSpan.textContent = String(entry.score);
        const extra = document.createElement('span');
        extra.className = 'lb-extra';
        extra.textContent = `Streak: ${entry.streak || 0}`;
        scoreSpan.appendChild(extra);
        div.appendChild(scoreSpan);
        list.appendChild(div);
      }
    } catch (e) {
      list.innerHTML = `<div class="lb-empty">Error loading leaderboard: ${e.message}</div>`;
    }
  }

  // ─── Resize ───
  setupResize() {
    const fit = () => { this.cam.resize(); };
    window.addEventListener('resize', fit);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(fit).observe(this.canvas);
    }
    fit();
  }

  // ─── Utility ───
  _shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  // ─── Game Loop ───
  update(dt) {
    if (this.state === 'PLAYING') {
      if (this.gameType === 'rank') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = 0;
          this.endRankMatch();
        }
        document.getElementById('rankHudTimer').textContent = `${Math.ceil(this.timer)}s`;
      } else if (this.currentMode === 'time') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = 0;
          this.endGame(false);
        }
        document.getElementById('hudTimer').textContent = `⏱ ${Math.ceil(this.timer)}s`;
      } else if (this.currentMode === 'endless') {
        document.getElementById('hudTimer').textContent = `❤️ ${this.lives}`;
      } else {
        document.getElementById('hudTimer').textContent = '📖 Learn';
      }
    }

    this.cam.update(dt);

    for (const entity of this.entities) {
      if (entity.update) entity.update(dt);
    }

    this.entities = this.entities.filter(e => !e.destroy);
  }

  draw() {
    this.cam.begin(this.ctx);
    const sorted = [...this.entities].sort((a, b) => (a.z || 0) - (b.z || 0));
    for (const entity of sorted) {
      if (entity.draw) entity.draw(this.ctx);
    }
    this.cam.end(this.ctx);
  }

  start() {
    const gameLoop = (timestamp) => {
      const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
      this.lastTime = timestamp;
      this.update(dt || 0);
      this.draw();
      requestAnimationFrame(gameLoop);
    };
    requestAnimationFrame(gameLoop);
  }
}