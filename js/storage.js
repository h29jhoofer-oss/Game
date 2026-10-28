// =============================================================
// storage.js — Saves the personal best, chosen skin, settings, your
// coin bank and the swords/scarves you own, in the browser (localStorage). Wrapped in try/catch
// because storage can be blocked (private mode, iframes, etc.).
// The game still works without it — it just won't remember.
// =============================================================

OMJ.Storage = {
  defaults() {
    return {
      best: 0, skin: 'classic', muted: false, musicMuted: false,
      bank: 0,                                   // coins to spend in the shop
      swords: ['wood'], scarves: ['blue'],       // what you own
      sword: 'wood', scarf: 'blue',              // what you're wearing
    };
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
      if (Number.isFinite(saved.bank) && saved.bank >= 0) data.bank = Math.floor(saved.bank);
      const isList = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string');
      if (isList(saved.swords)) data.swords = saved.swords.indexOf('wood') < 0 ? ['wood'].concat(saved.swords) : saved.swords;
      if (isList(saved.scarves)) data.scarves = saved.scarves.indexOf('blue') < 0 ? ['blue'].concat(saved.scarves) : saved.scarves;
      // Only wear things you actually own.
      if (typeof saved.sword === 'string' && data.swords.indexOf(saved.sword) >= 0) data.sword = saved.sword;
      if (typeof saved.scarf === 'string' && data.scarves.indexOf(saved.scarf) >= 0) data.scarf = saved.scarf;
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
