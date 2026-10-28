// =============================================================
// storage.js — Saves the personal best, chosen skin and mute
// setting in the browser (localStorage). Wrapped in try/catch
// because storage can be blocked (private mode, iframes, etc.).
// The game still works without it — it just won't remember.
// =============================================================

OMJ.Storage = {
  defaults() {
    return { best: 0, skin: 'classic', muted: false, musicMuted: false };
  },

  load() {
    const data = this.defaults();
    try {
      const raw = window.localStorage.getItem(OMJ.CONFIG.STORAGE_KEY);
      if (!raw) return data;
      const saved = JSON.parse(raw);
      // Only accept values of the right type, so a broken save can't crash the game.
      if (Number.isFinite(saved.best) && saved.best >= 0) data.best = Math.floor(saved.best);
      if (typeof saved.skin === 'string') data.skin = saved.skin;
      if (typeof saved.muted === 'boolean') data.muted = saved.muted;
      if (typeof saved.musicMuted === 'boolean') data.musicMuted = saved.musicMuted;
    } catch (err) {
      // Storage unavailable or corrupted: use defaults.
    }
    return data;
  },

  save(data) {
    try {
      window.localStorage.setItem(OMJ.CONFIG.STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      // Ignore: storage full or blocked.
    }
  },
};
