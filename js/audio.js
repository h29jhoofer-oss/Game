// =============================================================
// audio.js — Retro sound effects made with the Web Audio API.
// No sound files needed: every sound is a short synthesized beep.
// Browsers only allow sound after the player clicks or presses a
// key, so unlock() is called on the first input.
// =============================================================

OMJ.Sound = class {
  constructor(muted) {
    this.muted = muted;
    this.ctx = null;
    this.master = null;
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
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);

      // White noise, created once, for thuds and crashes.
      const length = Math.floor(this.ctx.sampleRate * 0.5);
      this.noiseBuffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  // A single beep that slides from freqStart to freqEnd.
  tone(freqStart, freqEnd, duration, type, volume, delay) {
    const t = this.ctx.currentTime + (delay || 0);
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqStart, t);
    osc.frequency.exponentialRampToValueAtTime(freqEnd, t + duration);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  noise(duration, volume, filterFreq) {
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
    src.stop(t + duration);
  }

  play(name) {
    if (this.muted || !this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'jump':
        this.tone(260, 620, 0.12, 'square', 0.07);
        break;
      case 'land':
        this.noise(0.06, 0.12, 500);
        break;
      case 'pass': {
        // Throttled so quick obstacle clusters don't machine-gun beeps.
        const now = this.ctx.currentTime;
        if (now - this.lastPassTime < 0.2) return;
        this.lastPassTime = now;
        this.tone(880, 990, 0.05, 'triangle', 0.05);
        break;
      }
      case 'milestone':
        this.tone(523, 523, 0.08, 'square', 0.05, 0);
        this.tone(659, 659, 0.08, 'square', 0.05, 0.08);
        this.tone(784, 784, 0.08, 'square', 0.05, 0.16);
        this.tone(1047, 1047, 0.16, 'square', 0.05, 0.24);
        break;
      case 'unlock':
        this.tone(784, 784, 0.1, 'triangle', 0.09, 0);
        this.tone(988, 988, 0.1, 'triangle', 0.09, 0.1);
        this.tone(1319, 1319, 0.25, 'triangle', 0.09, 0.2);
        break;
      case 'hit':
        this.noise(0.25, 0.25, 1200);
        this.tone(420, 70, 0.45, 'square', 0.08);
        break;
      case 'click':
        this.tone(600, 800, 0.04, 'square', 0.04);
        break;
    }
  }
};
