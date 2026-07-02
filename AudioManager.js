/**
 * AudioManager — generates procedural sound effects and background music
 * using the Web Audio API. No external audio files required.
 */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicPlaying = false;
    this.musicEnabled = true;
    this.sfxEnabled = true;
    this.musicOscillators = [];
    this._initialized = false;
  }

  /** Lazily initialize AudioContext on first user interaction */
  _ensureContext() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.15;
      this.musicGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.25;
      this.sfxGain.connect(this.ctx.destination);
    } catch (e) {
      console.warn('AudioManager: Web Audio API not available', e.message);
    }
  }

  _resumeContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  /** Play a short tone (for SFX) */
  _playTone(freq, duration, type = 'square', gainNode = null) {
    this._ensureContext();
    this._resumeContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.value = freq;

    env.gain.setValueAtTime(0.3, this.ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    osc.connect(env);
    env.connect(gainNode || this.sfxGain);

    osc.start(this.ctx.currentTime);
    osc.stop(this.ctx.currentTime + duration);
  }

  /** Play noise burst */
  _playNoise(duration, gainNode = null) {
    this._ensureContext();
    this._resumeContext();
    if (!this.ctx) return;

    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = this.ctx.createBufferSource();
    source.buffer = buffer;

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.2, this.ctx.currentTime);
    env.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

    source.connect(env);
    env.connect(gainNode || this.sfxGain);

    source.start(this.ctx.currentTime);
  }

  // ───── Public SFX ─────

  /** Block picked up from tray */
  playPickup() {
    if (!this.sfxEnabled) return;
    this._playTone(440, 0.08, 'sine');
  }

  /** Block dropped into slot */
  playDrop() {
    if (!this.sfxEnabled) return;
    this._playTone(600, 0.1, 'sine');
  }

  /** Correct equation match */
  playCorrect() {
    if (!this.sfxEnabled) return;
    this._playTone(523, 0.15, 'sine');
    setTimeout(() => this._playTone(659, 0.15, 'sine'), 100);
    setTimeout(() => this._playTone(784, 0.2, 'sine'), 200);
  }

  /** Wrong answer */
  playWrong() {
    if (!this.sfxEnabled) return;
    this._playNoise(0.15);
    this._playTone(200, 0.2, 'sawtooth');
  }

  /** Level complete fanfare */
  playLevelComplete() {
    if (!this.sfxEnabled) return;
    const notes = [523, 659, 784, 1047];
    notes.forEach((freq, i) => {
      setTimeout(() => this._playTone(freq, 0.25, 'sine'), i * 120);
    });
  }

  /** Game over sound */
  playGameOver() {
    if (!this.sfxEnabled) return;
    this._playTone(400, 0.3, 'sawtooth');
    setTimeout(() => this._playTone(300, 0.3, 'sawtooth'), 200);
    setTimeout(() => this._playTone(200, 0.5, 'sawtooth'), 400);
  }

  /** Button click */
  playClick() {
    if (!this.sfxEnabled) return;
    this._playTone(800, 0.05, 'square');
  }

  // ───── Background Music ─────

  startMusic() {
    this._ensureContext();
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;
    this._playMusicLoop();
  }

  stopMusic() {
    this.musicPlaying = false;
    for (const osc of this.musicOscillators) {
      try { osc.stop(); } catch (e) { /* already stopped */ }
    }
    this.musicOscillators = [];
  }

  toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    this.musicGain.gain.value = this.musicEnabled ? 0.15 : 0;
    return this.musicEnabled;
  }

  toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    return this.sfxEnabled;
  }

  _playMusicLoop() {
    if (!this.musicPlaying || !this.ctx) return;

    // Simple bass arpeggio loop
    const notes = [131, 165, 196, 131, 165, 196, 131, 165, 220, 165, 131, 165];
    const noteDuration = 0.25;
    const totalLoop = notes.length * noteDuration;

    notes.forEach((freq, i) => {
      if (!this.musicPlaying) return;
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.value = freq;

      const start = this.ctx.currentTime + i * noteDuration;
      env.gain.setValueAtTime(0, start);
      env.gain.linearRampToValueAtTime(0.2, start + 0.02);
      env.gain.setValueAtTime(0.2, start + noteDuration * 0.8);
      env.gain.linearRampToValueAtTime(0, start + noteDuration);

      osc.connect(env);
      env.connect(this.musicGain);

      osc.start(start);
      osc.stop(start + noteDuration);
      this.musicOscillators.push(osc);
    });

    // Loop
    this._musicTimer = setTimeout(() => {
      this._playMusicLoop();
    }, totalLoop * 1000);
  }

  /** Set overall music volume (0-1) */
  setMusicVolume(v) {
    if (this.musicGain) this.musicGain.gain.value = v * 0.15;
  }

  /** Set SFX volume (0-1) */
  setSfxVolume(v) {
    if (this.sfxGain) this.sfxGain.gain.value = v * 0.25;
  }

  /** Cleanup */
  dispose() {
    this.stopMusic();
    if (this._musicTimer) clearTimeout(this._musicTimer);
    if (this.ctx) this.ctx.close();
    this.ctx = null;
    this._initialized = false;
  }
}

// Singleton
const Audio = new AudioManager();
