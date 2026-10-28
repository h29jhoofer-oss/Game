// =============================================================
// music.js — Background music: a tiny chiptune sequencer.
//
// Songs are written as text. Each word is one "step" (an eighth note):
//   C5, F#4 ...  play that note (letter, optional #, octave)
//   -            keep holding the previous note
//   .            silence
//   |            just a bar line to make it readable (ignored)
// Drums use: K = kick, S = snare, h = hi-hat, . = nothing.
//
// To write your own song, copy one below and change the notes.
// =============================================================

OMJ.SONGS = {
  // Calm tune for the start screen.
  menu: {
    bpm: 92,
    leadWave: 'triangle', leadVolume: 0.09,
    lead: `E5 - G5 - C6 - G5 . | A5 - E5 - C5 - E5 . | F5 - A5 - C6 - A5 . | G5 - - - D5 - . .
           E5 - D5 - C5 - E5 . | C5 - E5 - A5 - G5 . | F5 - E5 - D5 - C5 . | D5 - - - G4 - . .`,
    bass: `C3 . G2 . C3 . G2 . | A2 . E2 . A2 . E2 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 .
           C3 . G2 . C3 . G2 . | A2 . E2 . A2 . E2 . | F2 . C3 . F2 . C3 . | G2 . D3 . G2 . D3 .`,
    drums: `. . h . . . h . | . . h . . . h . | . . h . . . h . | . . h . . . h .
            . . h . . . h . | . . h . . . h . | . . h . . . h . | . . h . h . h h`,
  },

  // Upbeat tune while running. It speeds up as the game gets harder.
  run: {
    bpm: 132,
    leadWave: 'square', leadVolume: 0.045,
    lead: `E5 . C5 . A4 . C5 E5 | F5 . E5 . C5 . A4 . | G5 . E5 . C5 . E5 G5 | D5 . B4 . G4 . B4 D5
           A5 . G5 E5 . C5 E5 . | F5 . A5 . F5 E5 C5 . | E5 . G5 . C6 . G5 E5 | D5 - - B4 G4 . D5 .`,
    bass: `A2 . A3 . A2 . A3 A2 | F2 . F3 . F2 . F3 F2 | C3 . C4 . C3 . C4 C3 | G2 . G3 . G2 . G3 G2
           A2 . A3 . A2 . A3 A2 | F2 . F3 . F2 . F3 F2 | C3 . C4 . C3 . C4 C3 | G2 . G3 . G2 . G3 G2`,
    drums: `K h S h K K S h | K h S h K K S h | K h S h K K S h | K h S h K K S h
            K h S h K K S h | K h S h K K S h | K h S h K K S h | K h S h S S S S`,
  },

  // Tense, driving tune for the Big Bonk boss fight.
  boss: {
    bpm: 150,
    leadWave: 'square', leadVolume: 0.045,
    lead: `A4 . C5 . E5 . A5 . | G5 - E5 . D5 . E5 . | F5 . E5 . D5 . C5 . | B4 - G#4 . E4 . B4 .
           A5 . G5 . A5 . E5 . | G5 . F5 . G5 . D5 . | F5 . A5 . C6 . A5 . | G#5 - - - B5 - - -`,
    bass: `A2 A2 A3 A2 A2 A3 A2 A3 | A2 A2 A3 A2 G2 G3 G2 G3 | F2 F2 F3 F2 F2 F3 F2 F3 | E2 E2 E3 E2 E2 E3 G#2 G#3
           A2 A2 A3 A2 A2 A3 A2 A3 | A2 A2 A3 A2 G2 G3 G2 G3 | F2 F2 F3 F2 F2 F3 F2 F3 | E2 E2 E3 E2 E2 E3 G#2 G#3`,
    drums: `K h S h K S S h | K h S h K S S h | K h S h K S S h | K h S h K S S h
            K h S h K S S h | K h S h K S S h | K h S h K S S h | S S S S S S K K`,
  },

  // Spooky, swooping tune for the Gloomwing fight.
  boss2: {
    bpm: 144,
    leadWave: 'triangle', leadVolume: 0.08,
    lead: `D5 . F5 . A5 . G#5 . | A5 - - . F5 . D5 . | C#5 . E5 . G5 . F5 . | E5 - - . C#5 . A4 .
           D5 . F5 . A5 . D6 . | C6 . A5 . F5 . A5 . | A#5 . A5 . G5 . F5 . | E5 - - - C#5 - - -`,
    bass: `D2 D3 D2 D3 D2 D3 D2 D3 | D2 D3 D2 D3 D2 D3 D2 D3 | A1 A2 A1 A2 A1 A2 A1 A2 | A1 A2 A1 A2 C#2 C#3 E2 E3
           D2 D3 D2 D3 D2 D3 D2 D3 | F2 F3 F2 F3 F2 F3 F2 F3 | A#1 A#2 A#1 A#2 G1 G2 G1 G2 | A1 A2 A1 A2 A1 A2 C#2 E2`,
    drums: `K . h S . K S h | K . h S . K S h | K . h S . K S h | K . h S K K S S
            K . h S . K S h | K . h S . K S h | K . h S . K S h | S S S S K S K S`,
  },
};

OMJ.Music = class {
  constructor(sound) {
    this.sound = sound;
    this.songs = {};
    for (const name in OMJ.SONGS) this.songs[name] = this.parseSong(OMJ.SONGS[name]);
    this.current = null;       // the song that should be playing
    this.step = 0;
    this.nextTime = 0;         // audio-clock time of the next step
    this.paused = false;
    this.tempoScale = 1;
  }

  // ---- Turning the text above into numbers (done once) ----
  parseTrack(text) {
    const words = text.split(/\s+/).filter((w) => w && w !== '|');
    const notes = [];   // frequency per step (0 = nothing starts here)
    const lengths = []; // how many steps each note lasts
    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w === '-' || w === '.') { notes.push(0); lengths.push(0); continue; }
      notes.push(this.noteToFrequency(w));
      let len = 1;
      while (words[i + len] === '-') len++;
      lengths.push(len);
    }
    return { notes, lengths };
  }

  noteToFrequency(name) {
    const match = /^([A-G])(#?)(\d)$/.exec(name);
    if (!match) return 0;
    const semis = { C: -9, D: -7, E: -5, F: -4, G: -2, A: 0, B: 2 }[match[1]] + (match[2] ? 1 : 0);
    const octave = parseInt(match[3], 10);
    return 440 * Math.pow(2, (semis + (octave - 4) * 12) / 12);
  }

  parseSong(song) {
    return {
      bpm: song.bpm,
      leadWave: song.leadWave,
      leadVolume: song.leadVolume,
      lead: this.parseTrack(song.lead),
      bass: this.parseTrack(song.bass),
      drums: song.drums.split(/\s+/).filter((w) => w && w !== '|'),
    };
  }

  // ---- Controls used by the game ----
  play(name) {
    const song = this.songs[name] || null;
    if (song === this.current && !this.paused) return;
    this.current = song;
    this.step = 0;
    this.nextTime = 0;
    this.paused = false;
  }

  stop() {
    this.current = null;
  }

  pause() { this.paused = true; }

  resume() {
    this.paused = false;
    this.nextTime = 0; // restart timing from "now"
  }

  setTempoScale(scale) {
    this.tempoScale = scale;
  }

  // Called every frame. Schedules notes a little ahead of time so the
  // music stays perfectly in rhythm even if a frame is late.
  update() {
    const s = this.sound;
    if (!this.current || this.paused || !s.ready || s.musicMuted || s.muted) {
      this.nextTime = 0;
      return;
    }
    const now = s.ctx.currentTime;
    if (this.nextTime < now) this.nextTime = now + 0.05;
    while (this.nextTime < now + 0.15) {
      this.playStep(this.current, this.step, this.nextTime);
      this.nextTime += this.stepLength(this.current);
      this.step = (this.step + 1) % this.current.lead.notes.length;
    }
  }

  stepLength(song) {
    return 60 / (song.bpm * this.tempoScale) / 2; // eighth notes
  }

  playStep(song, i, t) {
    const s = this.sound;
    const bus = s.musicBus;
    const len = this.stepLength(song);

    const lead = song.lead.notes[i];
    if (lead) s.tone(lead, lead, song.lead.lengths[i] * len * 0.95, song.leadWave, song.leadVolume, t, bus, true);

    const bass = song.bass.notes[i];
    if (bass) s.tone(bass, bass, song.bass.lengths[i] * len * 0.9, 'triangle', 0.12, t, bus, true);

    switch (song.drums[i]) {
      case 'K': s.tone(150, 45, 0.14, 'sine', 0.3, t, bus, true); break;
      case 'S': s.noise(0.1, 0.1, 1500, 'highpass', t, bus, true); break;
      case 'h': s.noise(0.03, 0.04, 7000, 'highpass', t, bus, true); break;
    }
  }
};
