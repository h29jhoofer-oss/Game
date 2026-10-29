// =====================================================================
// storage.js — remembers your personal best and sound setting.
//
// localStorage keeps small pieces of text in the browser, even after it
// closes. It can be unavailable (private windows, blocked cookies), so
// every read and write is wrapped in try/catch: if saving fails, the
// game simply keeps working without remembering.
// =====================================================================

const SAVE_PREFIX = 'neonSurvivor.';

const Save = {
  read(key, fallback) {
    try {
      const text = window.localStorage.getItem(SAVE_PREFIX + key);
      return text === null ? fallback : JSON.parse(text);
    } catch (error) {
      return fallback;
    }
  },

  write(key, value) {
    try {
      window.localStorage.setItem(SAVE_PREFIX + key, JSON.stringify(value));
    } catch (error) {
      // Storage unavailable: nothing to do, the game still works.
    }
  },

  // Personal best: { score, time, kills, level }
  loadBest() {
    const best = this.read('best', null);
    if (!best || typeof best.score !== 'number') return { score: 0, time: 0, kills: 0, level: 1 };
    return best;
  },

  // Saves the run if it beats the record. Returns true for a new best.
  submitRun(run) {
    const best = this.loadBest();
    if (run.score <= best.score) return false;
    this.write('best', run);
    return true;
  },

  // The last hero you picked, so the select screen remembers it.
  loadCharacter() {
    return this.read('character', 'runner');
  },

  saveCharacter(id) {
    this.write('character', id);
  },

  loadMuted() {
    return this.read('muted', false) === true;
  },

  saveMuted(muted) {
    this.write('muted', muted);
  },
};
