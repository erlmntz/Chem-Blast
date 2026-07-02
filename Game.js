class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.entities = [];
    this.state = 'MENU';
    
    this.designWidth = 800;
    this.designHeight = 600;
    this.cam = Camera.create(this.canvas, {
      width: this.designWidth, height: this.designHeight,
      background: '#1a1a2e'
    });
    
    this.lastTime = 0;
    this.saveData = null;
    
    this.bgGrid = new BackgroundGrid(this.designWidth, this.designHeight);
    this.entities.push(this.bgGrid);
    
    this.setupResize();
    this.setupInput();
    this.setupUI();
    
    this.setupAsync();
    this.start();
  }
  
  async setupAsync() {
    try {
      if (window.SaveData && SaveData.isAvailable()) {
        this.saveData = await SaveData.init({
          highScore: 0,
          unlockedLevel: 1,
          leaderboard: [{ field: 'highScore', label: 'Highest Score' }]
        });
      }
    } catch (e) { console.error("SaveData init error:", e); }
    
    document.getElementById('loadingText').style.display = 'none';
    document.getElementById('btnStart').style.display = 'inline-block';
  }

  setupUI() {
    document.getElementById('btnStart').addEventListener('click', () => {
      document.getElementById('mainMenu').style.display = 'none';
      this.showWorldMap();
    });

    document.getElementById('btnBackToMenu').addEventListener('click', () => {
      document.getElementById('worldMap').style.display = 'none';
      document.getElementById('mainMenu').style.display = 'flex';
    });

    document.getElementById('btnMap').addEventListener('click', () => {
      document.getElementById('gameOver').style.display = 'none';
      this.showWorldMap();
    });

    document.getElementById('btnNextLevel').addEventListener('click', () => {
      document.getElementById('gameOver').style.display = 'none';
      const nextId = this.currentLevel.id + 1;
      const nextLevel = LevelData_levels.find(l => l.id === nextId);
      if (nextLevel) {
        this.startLevel(nextLevel);
      } else {
        this.showWorldMap();
      }
    });
  }

  showWorldMap() {
    document.getElementById('worldMap').style.display = 'flex';
    const list = document.getElementById('levelList');
    list.innerHTML = '';
    
    const unlocked = this.saveData ? this.saveData.unlockedLevel : 1;
    
    for (const level of LevelData_levels) {
      const btn = document.createElement('button');
      btn.className = 'level-btn';
      btn.innerText = level.name;
      
      if (level.id > unlocked) {
        btn.disabled = true;
        btn.innerText += " (Locked)";
      } else {
        btn.addEventListener('click', () => {
          document.getElementById('worldMap').style.display = 'none';
          this.startLevel(level);
        });
      }
      list.appendChild(btn);
    }
  }

  startLevel(levelData) {
    this.currentLevel = levelData;
    this.currentMode = levelData.mode;
    this.equationQueue = [...levelData.eqs];
    this.score = 0;
    this.timer = levelData.time || 0;
    this.lives = 1;
    
    document.getElementById('hud').style.display = 'flex';
    document.getElementById('hudLevel').innerText = levelData.name;
    document.getElementById('hudScore').innerText = `Score: 0`;
    
    this.setupTray();
    this.nextEquation();
    this.state = 'PLAYING';
  }

  setupTray() {
    this.entities.forEach(e => { if (e.name === 'Block' && e.isTray) e.destroy = true; });
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
    }
    this.entities.forEach(e => {
      if (e.name === 'Block' && !e.isTray) e.destroy = true;
    });
    
    if (this.equationQueue.length === 0) {
      if (this.currentMode === 'endless') {
        this.equationQueue = [...this.currentLevel.eqs].sort(() => Math.random() - 0.5);
      } else {
        this.endGame(true);
        return;
      }
    }
    
    const eqId = this.equationQueue.shift();
    const eqData = LevelData_getEquation(eqId);
    
    this.eqDisplay = new EquationDisplay(this.designWidth / 2, this.designHeight / 2 - 50, eqData, this);
    this.entities.push(this.eqDisplay);
  }

  setupInput() {
    this.draggedBlock = null;
    this.offsetX = 0;
    this.offsetY = 0;

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
        if (ent.name === 'Block') {
          const b = ent.getBounds();
          if (pos.x >= b.x && pos.x <= b.x + b.width && pos.y >= b.y && pos.y <= b.y + b.height) {
            if (ent.fizzleTimer > 0) continue;
            
            if (ent.isTray) {
              const newBlock = new Block(ent.x, ent.y, ent.value, false);
              this.entities.push(newBlock);
              this.draggedBlock = newBlock;
              this.offsetX = pos.x - ent.x;
              this.offsetY = pos.y - ent.y;
              newBlock.isDragging = true;
              newBlock.z = 5;
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
        }
      }
    };

    const onMove = (e) => {
      if (!this.draggedBlock) return;
      const pos = getPointerPos(e);
      this.draggedBlock.x = pos.x - this.offsetX;
      this.draggedBlock.y = pos.y - this.offsetY;
    };

    const onUp = (e) => {
      if (!this.draggedBlock) return;
      
      let droppedInSlot = false;
      for (const ent of this.entities) {
        if (ent.name === 'Slot') {
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
              this.checkEquation();
            }
            break;
          }
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
    
    this.canvas.addEventListener('touchstart', onDown, {passive: false});
    this.canvas.addEventListener('touchmove', (e) => { e.preventDefault(); onMove(e); }, {passive: false});
    window.addEventListener('touchend', onUp);
  }

  checkEquation() {
    if (!this.eqDisplay) return;
    
    const slots = this.eqDisplay.slots;
    const allFilled = slots.every(s => s.block !== null);
    if (!allFilled) return;
    
    const allCorrect = slots.every(s => s.block.value === s.expectedValue);
    
    if (allCorrect) {
      this.score += 100;
      document.getElementById('hudScore').innerText = `Score: ${this.score}`;
      
      if (this.bgGrid) this.bgGrid.triggerClear();
      this.spawnParticles(this.designWidth / 2, this.designHeight / 2, "#7bed9f");
      
      this.state = 'TRANSITION';
      setTimeout(() => {
        this.nextEquation();
        this.state = 'PLAYING';
      }, 1000);
      
    } else {
      this.cam.shake(5, 0.5);
      for (const s of slots) {
        if (s.block && s.block.value !== s.expectedValue) {
          s.block.fizzleTimer = 0.5;
        }
      }
      
      if (this.currentMode === 'endless') {
        this.lives--;
        document.getElementById('hudTimer').innerText = `Lives: ${this.lives}`;
        if (this.lives <= 0) {
          this.state = 'TRANSITION';
          setTimeout(() => { this.endGame(false); }, 600);
        }
      }
    }
  }

  spawnParticles(x, y, color) {
    for (let i = 0; i < 30; i++) {
      this.entities.push(new Particle(x, y, color));
    }
  }

  endGame(win) {
    this.state = 'GAMEOVER';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('gameOver').style.display = 'flex';
    
    const title = document.getElementById('gameOverTitle');
    const stats = document.getElementById('gameOverStats');
    
    if (win) {
      title.innerText = "Level Complete!";
      stats.innerText = `Final Score: ${this.score}`;
      document.getElementById('btnNextLevel').style.display = 'inline-block';
    } else {
      title.innerText = "Game Over!";
      stats.innerText = `Final Score: ${this.score}`;
      document.getElementById('btnNextLevel').style.display = 'none';
    }

    if (this.saveData) {
      if (this.score > this.saveData.highScore) {
        this.saveData.highScore = this.score;
      }
      if (win && this.currentLevel.id >= this.saveData.unlockedLevel) {
        this.saveData.unlockedLevel = this.currentLevel.id + 1;
      }
    }

    if (window.Leaderboard && Leaderboard.isAvailable()) {
      Leaderboard.finalize(this.score, { level: this.currentLevel.id, mode: this.currentMode }).catch(console.error);
    }
  }

  setupResize() {
    const fit = () => {
      const dpr = window.devicePixelRatio || 1;
      const r = this.canvas.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return;
      this.canvas.width  = Math.floor(r.width  * dpr);
      this.canvas.height = Math.floor(r.height * dpr);
    };
    window.addEventListener('resize', fit);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(this.canvas);
    fit();
  }

  update(dt) {
    if (this.state === 'PLAYING') {
      if (this.currentMode === 'time') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = 0;
          this.endGame(false);
        }
        document.getElementById('hudTimer').innerText = `Time: ${Math.ceil(this.timer)}s`;
      } else if (this.currentMode === 'endless') {
        document.getElementById('hudTimer').innerText = `Lives: ${this.lives}`;
      } else {
        document.getElementById('hudTimer').innerText = `Learn Mode`;
      }
    }

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