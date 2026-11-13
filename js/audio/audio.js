// Fully synthesized audio: every SFX and both music tracks are generated with WebAudio,
// so the game ships with zero audio assets.
(function (RR) {
  'use strict';
  const A = {
    ctx: null, master: null, sfxGain: null, musicGain: null, noiseBuf: null,
    sfxVol: 0.8, musicVol: 0.5, muted: false, lastPlay: {}, track: null, musicTimer: null,
  };

  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    A.ctx = new AC();
    A.master = A.ctx.createGain();
    A.master.connect(A.ctx.destination);
    const comp = A.ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(A.master);
    A.sfxGain = A.ctx.createGain(); A.sfxGain.connect(comp);
    A.musicGain = A.ctx.createGain(); A.musicGain.connect(comp);
    const len = A.ctx.sampleRate * 1.5;
    A.noiseBuf = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = A.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    A.applyVolumes();
    if (A.pendingTrack) { const t = A.pendingTrack; A.pendingTrack = null; A.music(t); }
  };

  A.applyVolumes = function () {
    if (!A.ctx) return;
    A.sfxGain.gain.value = A.muted ? 0 : A.sfxVol * 0.9;
    A.musicGain.gain.value = A.muted ? 0 : A.musicVol * 0.35;
  };
  A.setVolumes = function (sfx, music) { A.sfxVol = sfx; A.musicVol = music; A.applyVolumes(); };

  // ---------- primitives ----------
  function tone(freq, dur, opts) {
    const o = opts || {};
    const c = A.ctx, t0 = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + dur);
    if (o.detune) osc.detune.value = o.detune;
    const vol = (o.vol == null ? 0.3 : o.vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node = osc;
    if (o.filter) {
      const f = c.createBiquadFilter();
      f.type = o.filter; f.frequency.value = o.ffreq || 1200; f.Q.value = o.q || 1;
      osc.connect(f); node = f;
    }
    node.connect(g); g.connect(o.dest || A.sfxGain);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }
  function noise(dur, opts) {
    const o = opts || {};
    const c = A.ctx, t0 = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = A.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    f.frequency.setValueAtTime(o.freq || 2000, t0);
    if (o.slide) f.frequency.exponentialRampToValueAtTime(Math.max(30, o.slide), t0 + dur);
    f.Q.value = o.q || 0.8;
    const g = c.createGain();
    const vol = o.vol == null ? 0.3 : o.vol;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || A.sfxGain);
    src.start(t0, Math.random() * 1.0); src.stop(t0 + dur + 0.05);
  }

  // ---------- sound effects ----------
  const SFX = {
    click() { tone(880, 0.06, { type: 'triangle', vol: 0.18 }); tone(1320, 0.05, { type: 'sine', vol: 0.1, delay: 0.02 }); },
    tab() { tone(660, 0.05, { type: 'triangle', vol: 0.12 }); },
    error() { tone(220, 0.12, { type: 'square', vol: 0.08, filter: 'lowpass', ffreq: 900 }); tone(180, 0.15, { type: 'square', vol: 0.08, delay: 0.08, filter: 'lowpass', ffreq: 900 }); },
    select() { tone(523, 0.07, { type: 'triangle', vol: 0.15 }); tone(784, 0.09, { type: 'triangle', vol: 0.12, delay: 0.04 }); },
    deploy() {
      noise(0.25, { filter: 'lowpass', freq: 600, slide: 120, vol: 0.35 });
      tone(160, 0.2, { type: 'sine', slide: 60, vol: 0.4 });
      tone(784, 0.12, { type: 'triangle', vol: 0.08, delay: 0.02 });
    },
    spellcast() { tone(400, 0.25, { type: 'sine', slide: 1200, vol: 0.12 }); noise(0.2, { filter: 'highpass', freq: 3000, vol: 0.08 }); },
    sword() { noise(0.12, { filter: 'bandpass', freq: 3500, slide: 1500, q: 2, vol: 0.22 }); tone(1800 + Math.random() * 400, 0.08, { type: 'square', vol: 0.035, filter: 'highpass', ffreq: 1500 }); },
    stab() { noise(0.08, { filter: 'bandpass', freq: 2500, q: 3, vol: 0.18 }); },
    punch() { tone(110, 0.15, { type: 'sine', slide: 50, vol: 0.45 }); noise(0.1, { filter: 'lowpass', freq: 800, vol: 0.25 }); },
    heavy() { noise(0.18, { filter: 'bandpass', freq: 1800, slide: 600, q: 1.5, vol: 0.3 }); tone(90, 0.2, { type: 'sine', slide: 45, vol: 0.35 }); },
    whoosh() { noise(0.3, { filter: 'bandpass', freq: 600, slide: 2400, q: 1.2, vol: 0.25 }); },
    lance() { noise(0.15, { filter: 'bandpass', freq: 2200, q: 2, vol: 0.25 }); tone(140, 0.2, { type: 'sine', slide: 60, vol: 0.35 }); },
    bow() { tone(300 + Math.random() * 60, 0.09, { type: 'triangle', slide: 120, vol: 0.12 }); noise(0.1, { filter: 'highpass', freq: 4000, vol: 0.06 }); },
    hit() { noise(0.06, { filter: 'bandpass', freq: 1500, q: 2, vol: 0.12 }); },
    throw() { noise(0.15, { filter: 'bandpass', freq: 900, slide: 1800, vol: 0.12 }); },
    bomb() { noise(0.45, { filter: 'lowpass', freq: 1400, slide: 80, vol: 0.5 }); tone(90, 0.4, { type: 'sine', slide: 30, vol: 0.5 }); },
    explode() { noise(0.8, { filter: 'lowpass', freq: 2000, slide: 60, vol: 0.6 }); tone(70, 0.6, { type: 'sine', slide: 25, vol: 0.6 }); },
    fire() { noise(0.3, { filter: 'bandpass', freq: 900, slide: 300, q: 0.7, vol: 0.22 }); tone(200, 0.2, { type: 'sawtooth', slide: 90, vol: 0.05, filter: 'lowpass', ffreq: 600 }); },
    spit() { tone(500, 0.08, { type: 'square', slide: 200, vol: 0.06, filter: 'lowpass', ffreq: 1500 }); },
    magic() { tone(660, 0.18, { type: 'sine', slide: 990, vol: 0.1 }); tone(990, 0.15, { type: 'triangle', vol: 0.06, delay: 0.05 }); },
    zap() {
      noise(0.25, { filter: 'highpass', freq: 2500, vol: 0.3 });
      tone(1200, 0.2, { type: 'sawtooth', slide: 200, vol: 0.08 });
      tone(80, 0.2, { type: 'square', vol: 0.06, filter: 'lowpass', ffreq: 400 });
    },
    cannon() { tone(120, 0.25, { type: 'sine', slide: 40, vol: 0.45 }); noise(0.2, { filter: 'lowpass', freq: 1000, slide: 200, vol: 0.3 }); },
    beam() { tone(220 + Math.random() * 40, 0.12, { type: 'sawtooth', vol: 0.04, filter: 'bandpass', ffreq: 900 }); },
    arrows() { for (let i = 0; i < 6; i++) noise(0.12, { filter: 'highpass', freq: 3000 + i * 300, vol: 0.1, delay: i * 0.05 }); },
    frost() { for (let i = 0; i < 5; i++) tone(1500 + i * 350, 0.3, { type: 'sine', vol: 0.06, delay: i * 0.04 }); noise(0.5, { filter: 'highpass', freq: 5000, vol: 0.1 }); },
    wind() { noise(0.9, { filter: 'bandpass', freq: 400, slide: 1600, q: 0.6, vol: 0.35, attack: 0.1 }); },
    horn() { tone(220, 0.7, { type: 'sawtooth', vol: 0.12, filter: 'lowpass', ffreq: 1400, attack: 0.05 }); tone(330, 0.6, { type: 'sawtooth', vol: 0.08, filter: 'lowpass', ffreq: 1400, delay: 0.15, attack: 0.05 }); },
    heal() { tone(880, 0.2, { type: 'sine', vol: 0.06 }); tone(1320, 0.25, { type: 'sine', vol: 0.05, delay: 0.06 }); },
    spawn() { tone(300, 0.12, { type: 'triangle', slide: 600, vol: 0.08 }); },
    elixir() { tone(1046, 0.12, { type: 'sine', vol: 0.1 }); tone(1568, 0.15, { type: 'sine', vol: 0.08, delay: 0.06 }); },
    death() { tone(400, 0.2, { type: 'triangle', slide: 120, vol: 0.08 }); noise(0.15, { filter: 'lowpass', freq: 900, vol: 0.12 }); },
    step() { noise(0.05, { filter: 'lowpass', freq: 300, vol: 0.06 }); },
    towerHit() { noise(0.08, { filter: 'bandpass', freq: 700, vol: 0.1 }); },
    towerDestroy() {
      noise(1.6, { filter: 'lowpass', freq: 1200, slide: 40, vol: 0.7 });
      tone(55, 1.2, { type: 'sine', slide: 25, vol: 0.7 });
      for (let i = 0; i < 4; i++) noise(0.2, { filter: 'lowpass', freq: 600, vol: 0.3, delay: 0.3 + i * 0.18 });
    },
    crown() { [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.15, delay: i * 0.07 })); },
    countdown() { tone(880, 0.12, { type: 'square', vol: 0.07, filter: 'lowpass', ffreq: 2000 }); },
    double() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.14, delay: i * 0.08 })); },
    victory() {
      const n = [523, 659, 784, 1046, 784, 1046, 1318];
      n.forEach((f, i) => { tone(f, 0.4, { type: 'triangle', vol: 0.18, delay: i * 0.13 }); tone(f / 2, 0.4, { type: 'sine', vol: 0.12, delay: i * 0.13 }); });
      noise(0.3, { filter: 'highpass', freq: 6000, vol: 0.1, delay: 0.9 });
    },
    defeat() {
      const n = [392, 370, 349, 262];
      n.forEach((f, i) => tone(f, 0.55, { type: 'sawtooth', vol: 0.08, filter: 'lowpass', ffreq: 900, delay: i * 0.3 }));
    },
    chest() { noise(0.3, { filter: 'lowpass', freq: 500, vol: 0.3 }); [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.3, { type: 'triangle', vol: 0.12, delay: 0.15 + i * 0.06 })); },
    reveal() { tone(1046, 0.15, { type: 'sine', vol: 0.12 }); tone(1568, 0.25, { type: 'triangle', vol: 0.08, delay: 0.05 }); },
    legendary() { [523, 784, 1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.12, delay: i * 0.06 })); },
    upgrade() { [392, 494, 587, 784].forEach((f, i) => tone(f, 0.3, { type: 'square', vol: 0.06, filter: 'lowpass', ffreq: 2400, delay: i * 0.08 })); noise(0.4, { filter: 'highpass', freq: 5000, vol: 0.08, delay: 0.3 }); },
    coin() { tone(1318, 0.08, { type: 'square', vol: 0.05 }); tone(1760, 0.12, { type: 'square', vol: 0.05, delay: 0.07 }); },
  };

  A.play = function (name, minGap) {
    if (!A.ctx || A.muted || A.sfxVol <= 0) return;
    const fn = SFX[name];
    if (!fn) return;
    const now = performance.now();
    const gap = minGap == null ? 45 : minGap;
    if (A.lastPlay[name] && now - A.lastPlay[name] < gap) return;
    A.lastPlay[name] = now;
    try { fn(); } catch (e) { /* ignore audio errors */ }
  };

  // ---------- music sequencer ----------
  const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
  const TRACKS = {
    menu: {
      bpm: 96,
      // I - vi - IV - V in C (lute-ish ballad)
      chords: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]],
      melody: [72, -1, 76, 79, 77, -1, 76, 74, 72, -1, 69, 72, 74, -1, -1, -1, 69, -1, 72, 76, 74, -1, 72, 69, 71, -1, 74, 79, 77, 76, 74, -1],
      drums: false, lead: 'triangle',
    },
    battle: {
      bpm: 132,
      // i - VI - III - VII in D minor (heroic march)
      chords: [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]],
      melody: [74, 74, 77, 81, 79, 77, 76, 74, 70, -1, 74, 77, 76, 74, 72, -1, 72, 76, 77, 79, 81, 79, 77, 76, 72, 74, 76, 79, 76, 74, 72, 71],
      drums: true, lead: 'square',
    },
  };

  A.music = function (name, fast) {
    if (!A.ctx) { A.pendingTrack = name; return; }
    if (A.track === name && !!A.fast === !!fast) return;
    A.stopMusic();
    if (!name) return;
    A.track = name; A.fast = !!fast;
    const tr = TRACKS[name];
    const bpm = tr.bpm * (fast ? 1.18 : 1);
    const step = 60 / bpm / 2; // eighth notes
    let stepIdx = 0;
    let nextTime = A.ctx.currentTime + 0.1;
    const dest = A.musicGain;
    const schedule = () => {
      if (!A.ctx) return;
      while (nextTime < A.ctx.currentTime + 0.25) {
        const bar = Math.floor(stepIdx / 8) % tr.chords.length;
        const beat = stepIdx % 8;
        const chord = tr.chords[bar];
        const delay = nextTime - A.ctx.currentTime;
        // bass on beats
        if (beat % 2 === 0) tone(NOTE(chord[0] - 12), step * 1.8, { type: 'triangle', vol: 0.32, delay, dest });
        // chord pad pluck
        if (beat === 0 || beat === 4) chord.forEach((n) => tone(NOTE(n + 12), step * 3.5, { type: 'sine', vol: 0.07, delay, dest, attack: 0.02 }));
        if (tr.drums) {
          if (beat % 4 === 0) tone(110, 0.15, { type: 'sine', slide: 40, vol: 0.4, delay, dest });
          if (beat % 4 === 2) noise(0.12, { filter: 'bandpass', freq: 1800, vol: 0.18, delay, dest });
          noise(0.03, { filter: 'highpass', freq: 7000, vol: beat % 2 ? 0.04 : 0.07, delay, dest });
        } else if (beat % 4 === 2) {
          tone(NOTE(chord[2] + 12), step * 0.9, { type: 'triangle', vol: 0.06, delay, dest });
        }
        const m = tr.melody[stepIdx % tr.melody.length];
        if (m > 0) {
          tone(NOTE(m), step * 1.6, { type: tr.lead, vol: tr.lead === 'square' ? 0.045 : 0.12, delay, dest, filter: 'lowpass', ffreq: 2200 });
        }
        stepIdx++;
        nextTime += step;
      }
    };
    schedule();
    A.musicTimer = setInterval(schedule, 60);
  };
  A.stopMusic = function () {
    if (A.musicTimer) clearInterval(A.musicTimer);
    A.musicTimer = null; A.track = null;
  };

  RR.Audio = A;
})(window.RR);
