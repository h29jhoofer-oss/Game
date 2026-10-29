// =====================================================================
// audio.js — retro sound effects, made from scratch with code.
//
// There are no audio files. The Web Audio API lets us create simple
// waves (square, triangle, sawtooth) and noise, then shape their pitch
// and volume — exactly how old arcade machines made their sounds.
//
// Browsers only allow sound after the player clicks or presses a key,
// so the audio system "unlocks" itself on the first input.
// =====================================================================

const MASTER_VOLUME = 0.22;

// Each sound is a little recipe. `minGap` stops the same sound from
// playing too often (40 shots in one second would be noise, not fun).
const SOUND_RECIPES = {
  shoot: { minGap: 0.05, play: (s) => s.tone({ type: 'square', freq: 1150 * s.vary(0.06), endFreq: 520, duration: 0.05, volume: 0.07 }) },
  // A heavy, crunchy boom for the Shotgun.
  shotgun: {
    minGap: 0.05,
    play: (s) => {
      s.noise({ duration: 0.16, volume: 0.22, filter: 2400, endFilter: 300 });
      s.tone({ type: 'square', freq: 180 * s.vary(0.05), endFreq: 60, duration: 0.12, volume: 0.1 });
    },
  },
  // A sharp, high "zing" that rings out for the Sniper.
  sniper: {
    minGap: 0.05,
    play: (s) => {
      s.tone({ type: 'sawtooth', freq: 2200 * s.vary(0.03), endFreq: 500, duration: 0.14, volume: 0.07 });
      s.tone({ type: 'triangle', freq: 1500, endFreq: 1400, duration: 0.2, volume: 0.05, delay: 0.02 });
    },
  },
  hit: { minGap: 0.03, play: (s) => s.noise({ duration: 0.04, volume: 0.12, filter: 3000 }) },
  enemyDie: {
    minGap: 0.04,
    play: (s) => {
      s.noise({ duration: 0.14, volume: 0.22, filter: 1800, endFilter: 300 });
      s.tone({ type: 'square', freq: 420 * s.vary(0.1), endFreq: 90, duration: 0.12, volume: 0.08 });
    },
  },
  bruteDie: {
    minGap: 0.1,
    play: (s) => {
      s.noise({ duration: 0.4, volume: 0.35, filter: 900, endFilter: 120 });
      s.tone({ type: 'sawtooth', freq: 160, endFreq: 40, duration: 0.35, volume: 0.15 });
    },
  },
  // `step` climbs a little musical scale while you collect orbs quickly.
  collect: {
    minGap: 0.03,
    play: (s, step = 0) => {
      const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
      const note = scale[Math.min(step, scale.length - 1)];
      s.tone({ type: 'square', freq: 880 * Math.pow(2, note / 12), duration: 0.05, volume: 0.06 });
    },
  },
  levelUp: {
    minGap: 0.2,
    play: (s) => {
      [523, 659, 784, 1047].forEach((freq, i) => s.tone({ type: 'square', freq, duration: 0.09, volume: 0.09, delay: i * 0.07 }));
    },
  },
  hurt: {
    minGap: 0.1,
    play: (s) => {
      s.tone({ type: 'sawtooth', freq: 300, endFreq: 70, duration: 0.25, volume: 0.18 });
      s.noise({ duration: 0.12, volume: 0.15, filter: 1200 });
    },
  },
  shieldBlock: {
    minGap: 0.1,
    play: (s) => {
      s.tone({ type: 'triangle', freq: 1400, endFreq: 700, duration: 0.18, volume: 0.15 });
      s.tone({ type: 'square', freq: 2100, endFreq: 1800, duration: 0.08, volume: 0.04 });
    },
  },
  // A low, bubbly hiss when a Toxic Slime pops.
  gas: {
    minGap: 0.1,
    play: (s) => {
      s.noise({ duration: 0.5, volume: 0.16, filter: 700, endFilter: 250 });
      s.tone({ type: 'triangle', freq: 180, endFreq: 260, duration: 0.25, volume: 0.06, delay: 0.05 });
    },
  },
  // A warm little rising chime for picking up a heart.
  heal: {
    minGap: 0.1,
    play: (s) => {
      [523, 784, 1047].forEach((freq, i) => s.tone({ type: 'triangle', freq, duration: 0.12, volume: 0.12, delay: i * 0.06 }));
    },
  },
  shieldReady: { minGap: 0.2, play: (s) => s.tone({ type: 'triangle', freq: 900, endFreq: 1500, duration: 0.12, volume: 0.08 }) },
  dash: { minGap: 0.1, play: (s) => s.noise({ duration: 0.12, volume: 0.12, filter: 600, endFilter: 3500 }) },
  enemyShoot: { minGap: 0.08, play: (s) => s.tone({ type: 'triangle', freq: 330, endFreq: 180, duration: 0.12, volume: 0.08 }) },
  alarm: {
    minGap: 0.5,
    play: (s) => {
      [0, 0.16].forEach((delay) => s.tone({ type: 'square', freq: 660, endFreq: 440, duration: 0.12, volume: 0.08, delay }));
    },
  },
  death: {
    minGap: 0.5,
    play: (s) => {
      s.noise({ duration: 0.6, volume: 0.35, filter: 1500, endFilter: 100 });
      s.tone({ type: 'sawtooth', freq: 440, endFreq: 30, duration: 0.6, volume: 0.15 });
    },
  },
  gameOver: {
    minGap: 0.5,
    play: (s) => {
      [392, 330, 262, 196].forEach((freq, i) => s.tone({ type: 'square', freq, duration: 0.16, volume: 0.09, delay: i * 0.16 }));
    },
  },
  newBest: {
    minGap: 0.5,
    play: (s) => {
      [523, 659, 784, 659, 784, 1047].forEach((freq, i) => s.tone({ type: 'square', freq, duration: 0.08, volume: 0.08, delay: 0.7 + i * 0.08 }));
    },
  },
  uiMove: { minGap: 0.03, play: (s) => s.tone({ type: 'square', freq: 660, duration: 0.03, volume: 0.05 }) },
  uiSelect: {
    minGap: 0.05,
    play: (s) => {
      s.tone({ type: 'square', freq: 660, duration: 0.05, volume: 0.07 });
      s.tone({ type: 'square', freq: 990, duration: 0.07, volume: 0.07, delay: 0.05 });
    },
  },
};

const Sound = {
  context: null, // the Web Audio "engine" (created on the first input)
  master: null, // one volume knob that every sound goes through
  noiseBuffer: null,
  muted: false,
  lastPlayed: {}, // when each sound last played, for `minGap`

  init() {
    this.muted = Save.loadMuted();
    const unlock = () => this.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
  },

  unlock() {
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return; // very old browser: play silently
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
      this.master.connect(this.context.destination);
      this.noiseBuffer = this.createNoiseBuffer();
    }
    if (this.context.state === 'suspended') this.context.resume();
  },

  toggleMute() {
    this.muted = !this.muted;
    Save.saveMuted(this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
    if (!this.muted) this.play('uiSelect');
  },

  play(name, option) {
    if (!this.context || this.muted) return;
    const recipe = SOUND_RECIPES[name];
    if (!recipe) return;
    const now = this.context.currentTime;
    if (now - (this.lastPlayed[name] ?? -1) < recipe.minGap) return;
    this.lastPlayed[name] = now;
    recipe.play(this, option);
  },

  // A random multiplier near 1, so repeated sounds aren't identical.
  vary(amount) {
    return 1 + randomRange(-amount, amount);
  },

  // One beep: a wave that can slide from `freq` to `endFreq`, with a
  // quick fade-out so it doesn't click.
  tone({ type, freq, endFreq = freq, duration, volume, delay = 0 }) {
    const start = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  },

  // A burst of static, shaped by a filter: good for explosions and hits.
  noise({ duration, volume, filter, endFilter = filter, delay = 0 }) {
    const start = this.context.currentTime + delay;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const lowpass = this.context.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(filter, start);
    lowpass.frequency.exponentialRampToValueAtTime(Math.max(20, endFilter), start + duration);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(lowpass);
    lowpass.connect(gain);
    gain.connect(this.master);
    source.start(start);
    source.stop(start + duration + 0.02);
  },

  // One second of random values, reused by every noise sound.
  createNoiseBuffer() {
    const length = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  },
};
