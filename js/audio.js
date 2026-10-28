// =============================================================
// audio.js — Retro sound effects made with the Web Audio API.
// No sound files needed: every sound is a short synthesized beep.
// Browsers only allow sound after the player clicks or presses a
// key, so unlock() is called on the first input.
//
// Volume chain:   effects ─┐
//                          ├─> master (mute button) ─> speakers
//                 music  ──┘
// =============================================================

OMJ.Sound = class {
  constructor(muted, musicMuted) {
    this.muted = muted;
    this.musicMuted = musicMuted;
    this.ctx = null;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.noiseBuffer = null;
    this.lastPassTime = 0;
  }

  unlock() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
      } catch (err) {
        return;
      }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.connect(this.master);
      this.applyVolumes();

      // White noise, created once, for thuds, drums and crashes.
      const length = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  get ready() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  applyVolumes() {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.sfxBus.gain.value = 1;
    this.musicBus.gain.value = this.musicMuted ? 0 : 0.55;
  }

  setMuted(muted) {
    this.muted = muted;
    this.applyVolumes();
  }

  setMusicMuted(muted) {
    this.musicMuted = muted;
    this.applyVolumes();
  }

  // A single beep that slides from freqStart to freqEnd.
  //   when: seconds from now (or an exact audio time if `absolute` is true)
  //   bus:  where it goes (effects by default)
  tone(freqStart, freqEnd, duration, type, volume, when, bus, absolute) {
    const t = absolute ? when : this.ctx.currentTime + (when || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    if (freqEnd !== freqStart) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(bus || this.sfxBus);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  // A burst of noise. filterType 'lowpass' = thud, 'highpass' = hiss.
  noise(duration, volume, filterFreq, filterType, when, bus, absolute) {
    const t = absolute ? when : this.ctx.currentTime + (when || 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = filterType || 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(bus || this.sfxBus);
    src.start(t);
    src.stop(t + duration);
  }

  // Play several notes one after another: [frequency, length] pairs.
  melody(notes, type, volume) {
    let t = 0;
    for (let i = 0; i < notes.length; i += 2) {
      this.tone(notes[i], notes[i], notes[i + 1] * 1.3, type, volume, t);
      t += notes[i + 1];
    }
  }

  play(name) {
    if (this.muted || !this.ready) return;
    switch (name) {
      // ---- Movement ----
      case 'jump':
        this.tone(260, 620, 0.12, 'square', 0.07);
        break;
      case 'land':
        this.noise(0.06, 0.12, 500);
        break;
      case 'fall':                       // dropping into a pit: falling whistle
        this.tone(900, 120, 0.6, 'triangle', 0.08);
        break;
      case 'smashDown':                  // starting a ground smash
        this.tone(700, 200, 0.12, 'square', 0.05);
        break;
      case 'groundSmash':                // landing a ground smash
        this.noise(0.2, 0.25, 400);
        this.tone(140, 40, 0.25, 'sine', 0.25);
        break;

      // ---- Obstacles ----
      case 'crusher':
        this.noise(0.3, 0.3, 300);
        this.tone(90, 30, 0.3, 'square', 0.1);
        break;
      case 'crossbow':                   // twang + a fiery whoosh
        this.tone(1400, 300, 0.08, 'triangle', 0.08);
        this.noise(0.05, 0.08, 3000, 'highpass');
        this.noise(0.35, 0.1, 900, 'bandpass', 0.03);
        break;

      // ---- Boss ----
      case 'bossAlarm':
        this.melody([880, 0.15, 660, 0.15, 880, 0.15, 660, 0.15], 'square', 0.06);
        break;
      case 'bossThrow':
        this.tone(400, 200, 0.12, 'triangle', 0.07);
        break;
      case 'bombLand':
        this.noise(0.08, 0.1, 600);
        break;
      case 'fireball':
        this.noise(0.3, 0.12, 900, 'bandpass');
        this.tone(300, 120, 0.3, 'sawtooth', 0.03);
        break;
      case 'bossHit':
        this.tone(220, 110, 0.15, 'square', 0.1);
        this.noise(0.12, 0.15, 2000);
        break;
      case 'bossDefeated':
        this.noise(0.9, 0.3, 800);
        this.melody([523, 0.1, 659, 0.1, 784, 0.1, 1047, 0.1, 784, 0.1, 1047, 0.3], 'square', 0.07);
        break;
      case 'bossEscape':
        this.melody([784, 0.12, 659, 0.12, 523, 0.25], 'triangle', 0.07);
        break;

      // ---- Progress ----
      case 'pass': {
        // Throttled so quick obstacle clusters don't machine-gun beeps.
        const now = this.ctx.currentTime;
        if (now - this.lastPassTime < 0.2) return;
        this.lastPassTime = now;
        this.tone(880, 990, 0.05, 'triangle', 0.05);
        break;
      }
      case 'milestone':
        this.melody([523, 0.08, 659, 0.08, 784, 0.08, 1047, 0.16], 'square', 0.05);
        break;
      case 'newBest':
        this.melody([784, 0.07, 784, 0.07, 1047, 0.07, 1319, 0.2], 'triangle', 0.09);
        break;
      case 'unlock':
        this.melody([784, 0.1, 988, 0.1, 1319, 0.25], 'triangle', 0.09);
        break;
      case 'hit':
        this.noise(0.25, 0.25, 1200);
        this.tone(420, 70, 0.45, 'square', 0.08);
        break;
      case 'gameOver':                   // sad little jingle after a crash
        this.melody([392, 0.16, 370, 0.16, 349, 0.16, 330, 0.4], 'triangle', 0.08);
        break;

      // ---- Abilities ----
      case 'ready':                      // ability recharged
        this.tone(1320, 1760, 0.08, 'sine', 0.06);
        this.tone(1760, 1760, 0.12, 'sine', 0.04, 0.08);
        break;
      case 'denied':                     // can't use the ability right now
        this.tone(160, 120, 0.1, 'square', 0.05);
        break;
      case 'doubleJump':
        this.tone(500, 1100, 0.14, 'square', 0.06);
        this.noise(0.08, 0.05, 3000, 'highpass');
        break;
      case 'dash':
        this.noise(0.35, 0.18, 1800, 'bandpass');
        this.tone(200, 800, 0.25, 'sawtooth', 0.04);
        break;
      case 'slowmo':
        this.tone(700, 180, 0.6, 'sine', 0.1);
        break;
      case 'phase':
        this.tone(300, 900, 0.3, 'sine', 0.07);
        this.tone(310, 920, 0.3, 'sine', 0.05);
        break;
      case 'throw':
        this.noise(0.12, 0.1, 4000, 'highpass');
        this.tone(1200, 600, 0.1, 'triangle', 0.04);
        break;
      case 'smash':
        this.noise(0.15, 0.2, 900);
        this.tone(300, 90, 0.15, 'square', 0.05);
        break;
      case 'shield':
        this.melody([523, 0.06, 784, 0.06, 1047, 0.12], 'sine', 0.08);
        break;
      case 'shieldBreak':
        this.noise(0.3, 0.2, 2500, 'highpass');
        this.tone(1400, 300, 0.3, 'triangle', 0.07);
        break;
      case 'secondChance':
        this.melody([330, 0.1, 262, 0.1, 196, 0.2], 'sine', 0.1);   // "boo!"
        break;
      case 'nova':
        this.noise(0.8, 0.25, 600);
        this.tone(80, 1600, 0.5, 'sawtooth', 0.05);
        break;

      // ---- Menus ----
      case 'click':
        this.tone(600, 800, 0.04, 'square', 0.04);
        break;
      case 'pause':
        this.tone(660, 440, 0.08, 'triangle', 0.06);
        break;
      case 'resume':
        this.tone(440, 660, 0.08, 'triangle', 0.06);
        break;
    }
  }
};
