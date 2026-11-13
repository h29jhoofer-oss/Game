// Renders (and caches) the portrait artwork for every card using the same sprite artist
// the battlefield uses, framed in a little themed backdrop.
(function (RR) {
  'use strict';
  const S = RR.Sprites;
  const cache = new Map();

  // per-sprite framing: [scale, offsetY] relative to art height
  const FRAME = {
    squire: [0.44, 0.9], archer: [0.42, 0.9], gremlin: [0.44, 0.88], skeleton: [0.44, 0.88], brute: [0.5, 0.93],
    gnome: [0.46, 0.9], imp: [0.5, 0.78], steamknight: [0.44, 0.9], berserker: [0.42, 0.9], druid: [0.44, 0.92],
    drake: [0.37, 0.9], wizard: [0.42, 0.93], ramrider: [0.42, 0.9], necro: [0.43, 0.92], zeppelin: [0.38, 0.96],
    paladin: [0.35, 0.92], drummer: [0.46, 0.9], storm: [0.43, 0.93], mole: [0.46, 0.9], titan: [0.44, 0.93], pebble: [0.46, 0.92],
    turret: [0.42, 0.8], den: [0.33, 0.9], trap: [0.62, 0.66], inferno: [0.28, 0.94], ballista: [0.46, 0.8], well: [0.33, 0.9],
  };

  const BG = {
    troop: ['#8fd3ff', '#d9f2ff', '#79c24a', '#5ea838'],
    building: ['#ffcf8a', '#fff1d6', '#b0a08a', '#8f7f69'],
    spell: ['#6a5acd', '#b9a8ff', '#4a3a9a', '#3a2a7a'],
  };

  function draw(card, w, h) {
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    const bg = BG[card.type];
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, bg[0]); g.addColorStop(0.62, bg[1]); g.addColorStop(0.62, bg[2]); g.addColorStop(1, bg[3]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    // background flourishes
    ctx.globalAlpha = 0.35;
    if (card.type === 'spell') {
      for (let i = 0; i < 14; i++) {
        const r = RR.U.seeded(card.id.length * 31 + i)();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(r * w, ((i * 37) % 100) / 100 * h * 0.6, 1 + (i % 3), 0, Math.PI * 2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.ellipse(w * 0.25, h * 0.2, w * 0.18, h * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(w * 0.75, h * 0.32, w * 0.15, h * 0.04, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // radial light behind subject
    const rg = ctx.createRadialGradient(w / 2, h * 0.55, 2, w / 2, h * 0.55, w * 0.6);
    rg.addColorStop(0, 'rgba(255,255,230,0.55)'); rg.addColorStop(1, 'rgba(255,255,230,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, w, h);

    if (card.type === 'spell') {
      ctx.save(); ctx.translate(w / 2, h * 0.5); ctx.scale(w * 0.42, w * 0.42);
      S.drawSpell(ctx, card.sprite, 0.4);
      ctx.restore();
    } else {
      const f = FRAME[card.sprite] || [0.45, 0.9];
      const sc = h * f[0];
      const a = { t: 1.3, walk: 0, moving: false, atk: -1, face: 1, team: 0, flash: 0, seed: 1, aim: -0.25, extra: { visible: 1, fill: 0.7, heat: 0.3 } };
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath(); ctx.ellipse(w / 2, h * f[1], w * 0.3, h * 0.05, 0, 0, Math.PI * 2); ctx.fill();
      const n = card.type === 'troop' ? Math.min(card.count, 3) : 1;
      const offs = n === 1 ? [[0, 0, 1]] : n === 2 ? [[-0.2, -0.04, 0.85], [0.18, 0.02, 0.95]] : [[-0.25, -0.05, 0.75], [0.25, -0.05, 0.75], [0, 0.03, 0.9]];
      for (const o of offs) {
        ctx.save();
        ctx.translate(w / 2 + o[0] * w, h * f[1] + o[1] * h);
        const s2 = sc * o[2];
        ctx.scale(s2, s2);
        if (card.type === 'troop') {
          if (card.flying) ctx.translate(0, -0.25);
          S.drawTroop(ctx, card.sprite, Object.assign({}, a));
        } else S.drawBuilding(ctx, card.sprite, Object.assign({}, a));
        ctx.restore();
      }
      ctx.restore();
    }
    // vignette
    const vg = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
    return cv;
  }

  RR.CardArt = {
    // returns a dataURL so the art can be dropped into <img>/<div> backgrounds anywhere
    url(cardId) {
      if (cache.has(cardId)) return cache.get(cardId);
      const card = RR.Cards.get(cardId);
      const cv = draw(card, 200, 240);
      const u = cv.toDataURL();
      cache.set(cardId, u);
      return u;
    },
  };
})(window.RR);
