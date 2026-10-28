// =============================================================
// obstacles.js — Obstacle TYPES and the obstacle manager.
//
// To add a new obstacle type:
//   1. Add an entry to OMJ.ObstacleTypes below (size, hitbox, draw).
//   2. Use it in a pattern in spawner.js.
//
// Moving obstacles (crusher, saw, crossbow...) also have an
// update(o, dt, game, speed) function that runs every step.
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

  // Gunmetal colors for the crusher
  const GUN = '#4a525e';
  const GUN_LIGHT = '#6e7886';
  const GUN_DARK = '#2f343d';
  const SPIKE_STEEL = '#a3acb9';

  // ---- Obstacle types ----------------------------------------
  // size(variant)  -> { w, h }  how big this obstacle is
  // hitbox         -> how many pixels to shrink the deadly box on each side
  //                   (smaller hitboxes feel fairer)
  // solidTop       -> true if the player can land and stand on it
  // isGap          -> true for holes in the ground
  // harmless       -> scenery that can't hurt you (e.g. the crossbow tower)
  // debris         -> colors of the pieces when it gets smashed
  // init(o)        -> optional: set up a new obstacle's own values
  // update(o, dt, game, speed) -> optional: make it move or act
  // deathLines     -> funny lines shown when this obstacle gets you
  //
  // Each obstacle `o` has a body box used for collisions: it starts at
  // o.x + o.bx, is o.bw wide, and spans o.y to o.y + o.h. Moving
  // obstacles change these (the saw slides its body along its rail).
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
      debris: [P.wood, P.woodLight, P.woodDark],
      deathLines: ['Bonk! Crates: 1, You: 0.', 'You tried to hug a crate.', 'Wood you believe it?'],
      draw(ctx, o) {
        for (let i = 0; i < o.variant; i++) ctx.drawImage(CRATE, o.drawX, o.y + i * 16);
      },
    },

    barrier: {
      // variant = height in pixels
      size: (height) => ({ w: 8, h: height }),
      hitbox: { left: 1, right: 1, top: 2 },
      debris: [P.danger, P.white],
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

    // ---- CRUSHER: a gunmetal block floating high up that slams down ----
    // Its yellow eyes turn red just before it drops. It is always out of
    // reach while floating, and slams while still ~90 px
    // ahead of you, so it can never land on you. Once down, jump over it
    // (or stand on it, like a crate).
    crusher: {
      size: () => ({ w: 20, h: 26 }),
      hitbox: { left: 1, right: 1, top: 0 },
      debris: [GUN, GUN_LIGHT, GUN_DARK, P.gold],
      deathLines: ['Flat as a pancake.', 'The crusher crushed it. You were "it".', 'Squish!'],
      init(o) {
        o.phase = 0;                       // 0 hanging, 1 slamming, 2 down
        o.y = C.GROUND_Y - o.h - 78;       // hangs above the highest normal jump
        o.solid = false;
      },
      update(o, dt, g) {
        const gapToPlayer = o.x - (g.player.x + g.player.w);
        if (o.phase === 0 && gapToPlayer <= 90) {
          o.phase = 1;
          o.vy = 400;
        } else if (o.phase === 1) {
          o.vy += 3000 * dt;
          o.y += o.vy * dt;
          if (o.y >= C.GROUND_Y - o.h) {
            o.y = C.GROUND_Y - o.h;
            o.phase = 2;
            o.solid = true;                // now you can stand on it
            g.onCrusherSlam(o);
          }
        }
      },
      draw(ctx, o, g) {
        const gapToPlayer = o.x - (g.player.x + g.player.w);
        // Rattle a little when you're getting close (a warning)...
        const shaking = o.phase === 0 && gapToPlayer < 160;
        // ...and the eyes go red right before it falls.
        const aboutToFall = (o.phase === 0 && gapToPlayer < 140) || o.phase === 1;
        const x = o.drawX + (shaking && Math.floor(g.time * 30) % 2 ? 1 : 0);
        const y = Math.round(o.y);

        // Block body (gunmetal)
        ctx.fillStyle = P.ink;
        ctx.fillRect(x, y, 20, 22);
        ctx.fillStyle = GUN;
        ctx.fillRect(x + 1, y + 1, 18, 20);
        ctx.fillStyle = GUN_LIGHT;
        ctx.fillRect(x + 1, y + 1, 18, 2);            // top edge catches the light
        ctx.fillRect(x + 1, y + 3, 1, 14);            // left edge
        ctx.fillStyle = GUN_DARK;
        ctx.fillRect(x + 1, y + 17, 18, 4);           // heavy bottom plate
        ctx.fillRect(x + 18, y + 3, 1, 14);           // right edge in shadow
        ctx.fillStyle = GUN_LIGHT;                     // bolts
        ctx.fillRect(x + 3, y + 4, 1, 1); ctx.fillRect(x + 16, y + 4, 1, 1);
        ctx.fillRect(x + 3, y + 18, 1, 1); ctx.fillRect(x + 16, y + 18, 1, 1);

        // Glowing eyes: yellow while waiting, red right before the drop.
        const eye = aboutToFall ? P.danger : P.gold;
        ctx.fillStyle = P.ink;
        ctx.fillRect(x + 4, y + 8, 5, 4); ctx.fillRect(x + 11, y + 8, 5, 4);
        ctx.fillStyle = eye;
        ctx.fillRect(x + 5, y + 9, 3, 2); ctx.fillRect(x + 12, y + 9, 3, 2);
        ctx.fillStyle = aboutToFall ? '#ff9aa6' : '#fff2a8';   // bright glint
        ctx.fillRect(x + 5, y + 9, 1, 1); ctx.fillRect(x + 12, y + 9, 1, 1);
        // Brows tilt into a frown when it's about to drop.
        ctx.fillStyle = P.ink;
        if (aboutToFall) {
          ctx.fillRect(x + 4, y + 6, 2, 1); ctx.fillRect(x + 6, y + 7, 3, 1);
          ctx.fillRect(x + 14, y + 6, 2, 1); ctx.fillRect(x + 11, y + 7, 3, 1);
        } else {
          ctx.fillRect(x + 4, y + 7, 5, 1); ctx.fillRect(x + 11, y + 7, 5, 1);
        }

        // Little spikes along the bottom
        for (let i = 0; i < 5; i++) {
          const sx = x + i * 4;
          ctx.fillStyle = P.ink;
          ctx.fillRect(sx, y + 22, 4, 1);
          ctx.fillRect(sx + 1, y + 23, 2, 2);
          ctx.fillStyle = SPIKE_STEEL;
          ctx.fillRect(sx + 1, y + 22, 2, 1);
          ctx.fillRect(sx + 1, y + 23, 1, 1);
        }
      },
    },

    // ---- SAW: a spinning blade sliding back and forth on a rail ----
    // variant = rail length. The blade never moves faster than the world
    // scrolls, so it always comes toward you and can't chase you from behind.
    saw: {
      size: (rail) => ({ w: rail + 15, h: 15 }),
      hitbox: { left: 2, right: 2, top: 3 },
      debris: [P.metal, P.metalLight, P.danger],
      deathLines: ['Sliced and diced.', 'You saw that coming. Right?', 'That blade had a schedule. You didn\'t.'],
      init(o) {
        o.bw = 15;
        o.phase = Math.random() * Math.PI * 2;  // where on the rail it starts
        o.y = C.GROUND_Y - 12;
        o.bx = 0;
      },
      update(o, dt) {
        o.timer += dt;
        const rail = o.w - 15;
        o.bx = (rail / 2) * (1 - Math.cos(o.timer * 2.6 + o.phase));
      },
      draw(ctx, o, g) {
        const x = o.drawX;
        // Rail with end posts
        ctx.fillStyle = P.ink;
        ctx.fillRect(x + 2, C.GROUND_Y - 1, o.w - 4, 3);
        ctx.fillStyle = P.metalDark;
        ctx.fillRect(x + 3, C.GROUND_Y, o.w - 6, 1);
        ctx.fillStyle = P.ink;
        ctx.fillRect(x, C.GROUND_Y - 4, 3, 5);
        ctx.fillRect(x + o.w - 3, C.GROUND_Y - 4, 3, 5);
        // Blade
        const cx = Math.round(o.x + o.bx) + 7;
        const cy = C.GROUND_Y - 5;
        OMJ.Sprites.circle(ctx, cx, cy, 7, P.ink);
        OMJ.Sprites.circle(ctx, cx, cy, 6, P.metal);
        ctx.fillStyle = P.metalLight;
        const spin = Math.floor(g.time * 24) % 2;
        // Teeth flicker between two positions so it looks like it spins.
        if (spin) {
          ctx.fillRect(cx - 1, cy - 8, 2, 2); ctx.fillRect(cx - 1, cy + 6, 2, 2);
          ctx.fillRect(cx - 8, cy - 1, 2, 2); ctx.fillRect(cx + 6, cy - 1, 2, 2);
        } else {
          ctx.fillRect(cx - 6, cy - 6, 2, 2); ctx.fillRect(cx + 4, cy - 6, 2, 2);
          ctx.fillRect(cx - 6, cy + 4, 2, 2); ctx.fillRect(cx + 4, cy + 4, 2, 2);
        }
        OMJ.Sprites.circle(ctx, cx, cy, 2, P.metalDark);
        ctx.fillStyle = P.ink;
        ctx.fillRect(cx, cy, 1, 1);
      },
    },

    // ---- CROSSBOW: a tower that fires a bolt along the ground at you ----
    // The tower itself is harmless; jump the bolt. It only fires once
    // nothing else is between you and it, and the bolt always gives you
    // at least BOLT_WARNING seconds to react.
    crossbow: {
      size: () => ({ w: 14, h: 34 }),
      hitbox: { left: 0, right: 0, top: 0 },
      harmless: true,
      debris: [P.wood, P.woodDark, P.metal],
      deathLines: ['Tower down. (You, not the tower.)'],
      init(o) { o.fired = false; },
      update(o, dt, g) {
        if (o.timer > 0) o.timer -= dt;    // recoil animation after firing
        if (o.fired || o.x > C.VIEW_W - 16 || g.hasDangerBefore(o.x)) return;
        o.fired = true;
        const BOLT_WARNING = 0.75;
        const distance = o.x - (g.player.x + g.player.w);
        // Extra speed so it arrives in BOLT_WARNING seconds, but never
        // sooner than a still obstacle at the tower's spot would.
        const extra = Math.max(0, distance / BOLT_WARNING - g.worldSpeed);
        const bolt = g.obstacles.spawn('bolt', o.x - 6, 0);
        if (bolt) bolt.extra = extra;
        o.timer = 0.15;
        g.sound.play('crossbow');
      },
      draw(ctx, o, g) {
        const x = o.drawX;
        const top = C.GROUND_Y - 34;
        // Tower legs (dark so they read as scenery, not something to jump)
        ctx.fillStyle = '#3d2a35';
        ctx.fillRect(x + 2, top + 8, 2, 26);
        ctx.fillRect(x + 10, top + 8, 2, 26);
        ctx.fillRect(x + 3, top + 16, 8, 1);
        ctx.fillRect(x + 3, top + 25, 8, 1);
        // Platform
        ctx.fillStyle = P.ink;
        ctx.fillRect(x, top + 6, 14, 3);
        ctx.fillStyle = P.woodDark;
        ctx.fillRect(x + 1, top + 7, 12, 1);
        // Crossbow (faces left, toward you)
        const bx = x + (o.timer > 0 ? 1 : 0);   // kicks back when it fires
        ctx.fillStyle = P.ink;
        ctx.fillRect(bx + 3, top + 2, 10, 3);
        ctx.fillStyle = P.wood;
        ctx.fillRect(bx + 4, top + 3, 8, 1);
        ctx.fillStyle = P.ink;                       // the bow
        ctx.fillRect(bx + 2, top - 3, 2, 13);
        ctx.fillStyle = P.metal;
        ctx.fillRect(bx + 2, top - 2, 1, 11);
        ctx.fillStyle = P.white;                     // the string
        ctx.fillRect(o.fired ? bx + 4 : bx + 8, top - 2, 1, 1);
        ctx.fillRect(o.fired ? bx + 4 : bx + 8, top + 8, 1, 1);
        if (!o.fired) {
          // Loaded bolt, with a blinking red tip: "I'm about to shoot!"
          ctx.fillStyle = P.woodLight;
          ctx.fillRect(bx + 1, top + 3, 8, 1);
          ctx.fillStyle = Math.floor(g.time * 8) % 2 ? P.danger : P.white;
          ctx.fillRect(bx, top + 3, 2, 1);
        }
      },
    },

    // The crossbow's bolt: fires from the tower and dips to ground level.
    bolt: {
      size: () => ({ w: 12, h: 3 }),
      hitbox: { left: 1, right: 1, top: 0 },
      debris: [P.woodLight, P.metal],
      deathLines: ['Bullseye. Unfortunately, you were the bullseye.', 'Arrow-dynamic? Not quite.', 'You took an arrow to the... everything.'],
      init(o) {
        o.y = C.GROUND_Y - 32;
        o.extra = 0;
      },
      update(o, dt) {
        o.x -= o.extra * dt;
        o.y = Math.min(C.GROUND_Y - 8, o.y + 160 * dt);
      },
      draw(ctx, o) {
        const x = o.drawX;
        const y = Math.round(o.y);
        ctx.fillStyle = P.woodLight;
        ctx.fillRect(x + 2, y + 1, 9, 1);
        ctx.fillStyle = P.metalLight;
        ctx.fillRect(x, y + 1, 2, 1);
        ctx.fillRect(x + 1, y, 1, 3);
        ctx.fillStyle = P.danger;
        ctx.fillRect(x + 10, y, 2, 1);
        ctx.fillRect(x + 10, y + 2, 2, 1);
      },
    },

    // ---- BOSS ATTACKS (launched by boss.js) ----

    // A bomb that drops straight down, then rolls toward you.
    bomb: {
      size: () => ({ w: 10, h: 10 }),
      hitbox: { left: 2, right: 2, top: 2 },
      debris: ['#2a2540', P.danger, P.gold],
      deathLines: ['Kaboom! Bonk sends regards.', 'Bomb voyage!', 'Should have jumped. Big Bonk is laughing.'],
      init(o) { o.phase = 0; o.vy = 0; },
      update(o, dt, g, speed) {
        if (o.phase === 0) {
          o.x += speed * dt;                 // fall straight down on screen
          o.vy += 900 * dt;
          o.y += o.vy * dt;
          if (o.y >= C.GROUND_Y - o.h) { o.y = C.GROUND_Y - o.h; o.phase = 1; g.sound.play('bombLand'); }
        } else {
          o.x -= 30 * dt;                    // rolls toward you
        }
        o.timer += dt;
      },
      draw(ctx, o, g) {
        const cx = o.drawX + 5;
        const cy = Math.round(o.y) + 5;
        OMJ.Sprites.circle(ctx, cx, cy, 5, P.ink);
        OMJ.Sprites.circle(ctx, cx, cy, 4, '#2a2540');
        ctx.fillStyle = '#5a5480';
        ctx.fillRect(cx - 2, cy - 3, 2, 1);
        ctx.fillStyle = P.woodDark;
        ctx.fillRect(cx + 2, cy - 6, 1, 2);
        ctx.fillStyle = Math.floor(g.time * 16) % 2 ? P.gold : P.danger;
        ctx.fillRect(cx + 2, cy - 7, 2, 1);
      },
    },

    // A spiky ball that drops and then sits still.
    spikeball: {
      size: () => ({ w: 12, h: 12 }),
      hitbox: { left: 2, right: 2, top: 2 },
      debris: [P.metal, P.metalDark],
      deathLines: ['Spiky AND round. The worst combo.', 'Big Bonk dropped that just for you.'],
      init(o) { o.phase = 0; o.vy = 0; },
      update(o, dt, g, speed) {
        if (o.phase === 0) {
          o.x += speed * dt;
          o.vy += 900 * dt;
          o.y += o.vy * dt;
          if (o.y >= C.GROUND_Y - o.h) { o.y = C.GROUND_Y - o.h; o.phase = 1; g.sound.play('bombLand'); }
        }
      },
      draw(ctx, o) {
        const cx = o.drawX + 6;
        const cy = Math.round(o.y) + 6;
        ctx.fillStyle = P.ink;
        ctx.fillRect(cx - 1, cy - 7, 2, 14);
        ctx.fillRect(cx - 7, cy - 1, 14, 2);
        ctx.fillRect(cx - 5, cy - 5, 2, 2); ctx.fillRect(cx + 3, cy - 5, 2, 2);
        ctx.fillRect(cx - 5, cy + 3, 2, 2); ctx.fillRect(cx + 3, cy + 3, 2, 2);
        OMJ.Sprites.circle(ctx, cx, cy, 4, P.ink);
        OMJ.Sprites.circle(ctx, cx, cy, 3, P.metal);
        ctx.fillStyle = P.metalLight;
        ctx.fillRect(cx - 2, cy - 2, 2, 1);
      },
    },

    // A fireball that swoops down to ground level and flies at you.
    fireball: {
      size: () => ({ w: 10, h: 6 }),
      hitbox: { left: 1, right: 2, top: 1 },
      debris: [P.danger, P.gold, '#ff8a3d'],
      deathLines: ['Toasty!', 'Well done. (Like a steak.)', 'Hot hot hot!'],
      init(o) { o.extra = 150; },
      update(o, dt, g) {
        o.x -= o.extra * dt;
        o.y = Math.min(C.GROUND_Y - 8, o.y + 170 * dt);
        o.timer += dt;
        if (Math.random() < 0.5) g.particles.spawn(o.x + 9, o.y + 3, 30, OMJ.rand(-15, 15), 0.25, 1, Math.random() < 0.5 ? P.gold : P.danger, 0);
      },
      draw(ctx, o) {
        const x = o.drawX;
        const y = Math.round(o.y);
        ctx.fillStyle = P.danger;
        ctx.fillRect(x + 1, y, 7, 6);
        ctx.fillRect(x + 8, y + 1, 2, 4);
        ctx.fillStyle = '#ff8a3d';
        ctx.fillRect(x + 1, y + 1, 5, 4);
        ctx.fillStyle = P.gold;
        ctx.fillRect(x + 1, y + 2, 3, 2);
        ctx.fillStyle = P.ink;
        ctx.fillRect(x, y + 1, 1, 4);
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
          bx: 0, bw: 0, solid: false,                 // body box & standable?
          phase: 0, timer: 0, vy: 0, extra: 0, fired: false,  // for moving types
        });
      }
    }

    reset() {
      for (let i = 0; i < this.pool.length; i++) this.pool[i].active = false;
    }

    // Create an obstacle with its LEFT edge at x.
    // Returns the obstacle (or null if the pool is full).
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
        o.bx = 0;
        o.bw = size.w;
        o.solid = !!type.solidTop;
        o.phase = 0; o.timer = 0; o.vy = 0; o.extra = 0; o.fired = false;
        if (type.init) type.init(o);
        return o;
      }
      return null; // pool full (should never happen with a sensible pool size)
    }

    update(dt, speed, game) {
      for (let i = 0; i < this.pool.length; i++) {
        const o = this.pool[i];
        if (!o.active) continue;
        o.x -= speed * dt;
        if (o.type.update) o.type.update(o, dt, game, speed);
        o.drawX = Math.round(o.x);
        if (o.x + o.w < -24) o.active = false; // off screen: recycle it
      }
    }

    // Gaps are drawn first (they're part of the ground), then everything else.
    draw(ctx, game) {
      for (let i = 0; i < this.pool.length; i++) {
        const o = this.pool[i];
        if (o.active && o.type.isGap) o.type.draw(ctx, o, game);
      }
      for (let i = 0; i < this.pool.length; i++) {
        const o = this.pool[i];
        if (o.active && !o.type.isGap) o.type.draw(ctx, o, game);
      }
    }
  };
})();
