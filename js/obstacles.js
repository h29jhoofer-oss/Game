// =============================================================
// obstacles.js — Obstacle TYPES and the obstacle manager.
//
// To add a new obstacle type:
//   1. Add an entry to OMJ.ObstacleTypes below (size, hitbox, draw).
//   2. Use it in a pattern in spawner.js.
// =============================================================

(function () {
  const P = OMJ.PALETTE;
  const C = OMJ.CONFIG;

  // ---- Sprites (built once) ----------------------------------
  const SPIKE = OMJ.Sprites.fromStrings([
    '...OO...',
    '...OH...',
    '..OHFO..',
    '..OHFO..',
    '.OHFFDO.',
    '.OHFFDO.',
    'OHFFFDDO',
    'OHFFFDDO',
    'OOOOOOOO',
  ], { O: P.ink, H: P.metalLight, F: P.metal, D: P.metalDark });

  const CRATE = OMJ.Sprites.fromStrings([
    'OOOOOOOOOOOOOOOO',
    'OLLLLLLLLLLLLLLO',
    'OLDDDDDDDDDDDDLO',
    'OLDWD......DWDLO',
    'OLD.WD....DW.DLO',
    'OLD..WD..DW..DLO',
    'OLD...WDDW...DLO',
    'OLD....WW....DLO',
    'OLD....WW....DLO',
    'OLD...WDDW...DLO',
    'OLD..WD..DW..DLO',
    'OLD.WD....DW.DLO',
    'OLDWD......DWDLO',
    'OLDDDDDDDDDDDDLO',
    'OLLLLLLLLLLLLLLO',
    'OOOOOOOOOOOOOOOO',
  ], { O: P.ink, L: P.woodLight, D: P.woodDark, W: P.woodLight, '.': P.wood });
  // ('.' is normally transparent; here we map it to the crate's wood color.)

  // ---- Obstacle types ----------------------------------------
  // size(variant)  -> { w, h }  how big this obstacle is
  // hitbox         -> how many pixels to shrink the deadly box on each side
  //                   (smaller hitboxes feel fairer)
  // solidTop       -> true if the player can land and stand on it
  // isGap          -> true for holes in the ground
  // deathLines     -> funny lines shown when this obstacle gets you
  OMJ.ObstacleTypes = {
    spike: {
      size: (count) => ({ w: 8 * count, h: 9 }),
      hitbox: { left: 2, right: 2, top: 4 },
      deathLines: ['Pointy end first. Ouch.', 'Spikes: 1, You: 0.', 'That one had your name on it.'],
      draw(ctx, o) {
        for (let i = 0; i < o.variant; i++) ctx.drawImage(SPIKE, o.drawX + i * 8, o.y);
      },
    },

    crate: {
      // variant = how many crates are stacked
      size: (stack) => ({ w: 16, h: 16 * stack }),
      hitbox: { left: 1, right: 1, top: 0 },
      solidTop: true,
      deathLines: ['Bonk! Crates: 1, You: 0.', 'You tried to hug a crate.', 'Wood you believe it?'],
      draw(ctx, o) {
        for (let i = 0; i < o.variant; i++) ctx.drawImage(CRATE, o.drawX, o.y + i * 16);
      },
    },

    barrier: {
      // variant = height in pixels
      size: (height) => ({ w: 8, h: height }),
      hitbox: { left: 1, right: 1, top: 2 },
      deathLines: ['That wall came out of nowhere. (It didn\'t.)', 'Face, meet barrier.', 'Tall things are tall.'],
      draw(ctx, o) {
        const x = o.drawX;
        ctx.fillStyle = P.ink;
        ctx.fillRect(x, o.y, o.w, o.h);
        // Red/white warning stripes
        for (let y = o.y + 1; y < o.y + o.h - 1; y++) {
          const stripe = Math.floor((y - o.y) / 4) % 2 === 0;
          ctx.fillStyle = stripe ? P.danger : P.white;
          ctx.fillRect(x + 1, y, o.w - 2, 1);
        }
        ctx.fillStyle = P.dangerDark;
        ctx.fillRect(x + o.w - 2, o.y + 1, 1, o.h - 2);
        // Cap on top
        ctx.fillStyle = P.ink;
        ctx.fillRect(x - 1, o.y - 2, o.w + 2, 3);
        ctx.fillStyle = P.gold;
        ctx.fillRect(x, o.y - 1, o.w, 1);
      },
    },

    gap: {
      // variant = width in pixels
      size: (width) => ({ w: width, h: 0 }),
      isGap: true,
      deathLines: ['You found the void. It found you back.', 'Mind the gap!', 'Down you go! Wheee...'],
      draw(ctx, o) {
        const x = o.drawX;
        const depth = C.VIEW_H - C.GROUND_Y;
        ctx.fillStyle = P.pit;
        ctx.fillRect(x, C.GROUND_Y, o.w, depth);
        ctx.fillStyle = P.pitTop;
        ctx.fillRect(x, C.GROUND_Y, o.w, 3);
        // Dirt walls on both sides
        ctx.fillStyle = P.dirtDark;
        ctx.fillRect(x, C.GROUND_Y + 2, 2, depth);
        ctx.fillRect(x + o.w - 2, C.GROUND_Y + 2, 2, depth);
        // Little grass lips hanging over the edge
        ctx.fillStyle = P.grassDark;
        ctx.fillRect(x, C.GROUND_Y, 1, 3);
        ctx.fillRect(x + o.w - 1, C.GROUND_Y, 1, 3);
      },
    },
  };

  // ---- Obstacle manager --------------------------------------
  // Obstacles are kept in a fixed-size "pool" and re-used, so the
  // game never creates new objects while you play (smoother).
  OMJ.Obstacles = class {
    constructor(poolSize) {
      this.pool = [];
      for (let i = 0; i < poolSize; i++) {
        this.pool.push({
          active: false, typeName: '', type: null, variant: 0,
          x: 0, y: 0, w: 0, h: 0, drawX: 0, passed: false,
        });
      }
    }

    reset() {
      for (let i = 0; i < this.pool.length; i++) this.pool[i].active = false;
    }

    // Create an obstacle with its LEFT edge at x. Returns its width.
    spawn(typeName, x, variant) {
      const type = OMJ.ObstacleTypes[typeName];
      for (let i = 0; i < this.pool.length; i++) {
        const o = this.pool[i];
        if (o.active) continue;
        const size = type.size(variant);
        o.active = true;
        o.typeName = typeName;
        o.type = type;
        o.variant = variant;
        o.x = x;
        o.w = size.w;
        o.h = size.h;
        o.y = C.GROUND_Y - size.h;
        o.drawX = Math.round(x);
        o.passed = false;
        return size.w;
      }
      return 0; // pool full (should never happen with a sensible pool size)
    }

    update(dt, speed) {
      for (let i = 0; i < this.pool.length; i++) {
        const o = this.pool[i];
        if (!o.active) continue;
        o.x -= speed * dt;
        o.drawX = Math.round(o.x);
        if (o.x + o.w < -24) o.active = false; // off screen: recycle it
      }
    }

    // Gaps are drawn first (they're part of the ground), then everything else.
    draw(ctx) {
      for (let i = 0; i < this.pool.length; i++) {
        const o = this.pool[i];
        if (o.active && o.type.isGap) o.type.draw(ctx, o);
      }
      for (let i = 0; i < this.pool.length; i++) {
        const o = this.pool[i];
        if (o.active && !o.type.isGap) o.type.draw(ctx, o);
      }
    }
  };
})();
