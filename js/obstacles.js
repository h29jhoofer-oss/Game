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

  // ---- Saw blade (shared by both saw types) ------------------
  const SAW_SIZE = 23;        // blade diameter in pixels
  const SAW_R = 11;
  const SAW_LINES = ['Sliced and diced.', 'You saw that coming. Right?', 'That blade had a schedule. You didn\'t.'];
  // Tooth positions for two spin frames, worked out once.
  const SAW_TEETH = [[], []];
  for (let f = 0; f < 2; f++) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + f * (Math.PI / 8);
      SAW_TEETH[f].push(Math.round(Math.cos(a) * (SAW_R - 1)), Math.round(Math.sin(a) * (SAW_R - 1)));
    }
  }

  function drawSaw(ctx, o, g) {
    const cx = Math.round(o.x + o.bx) + SAW_R;
    const cy = Math.round(o.y) + SAW_R;
    // Only the part above the ground shows (the rest is "inside" the ground).
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - SAW_R - 2, 0, SAW_SIZE + 4, C.GROUND_Y);
    ctx.clip();
    const teeth = SAW_TEETH[Math.floor(g.time * 24) % 2];
    ctx.fillStyle = P.ink;
    for (let i = 0; i < teeth.length; i += 2) ctx.fillRect(cx + teeth[i] - 2, cy + teeth[i + 1] - 2, 4, 4);
    OMJ.Sprites.circle(ctx, cx, cy, SAW_R - 1, P.ink);
    ctx.fillStyle = P.metalLight;
    for (let i = 0; i < teeth.length; i += 2) ctx.fillRect(cx + teeth[i] - 1, cy + teeth[i + 1] - 1, 2, 2);
    OMJ.Sprites.circle(ctx, cx, cy, SAW_R - 2, P.metal);
    OMJ.Sprites.circle(ctx, cx, cy, 6, P.metalDark);
    OMJ.Sprites.circle(ctx, cx, cy, 5, P.metal);
    ctx.fillStyle = P.metalLight;                       // shine
    ctx.fillRect(cx - 6, cy - 6, 3, 1);
    ctx.fillRect(cx - 7, cy - 5, 1, 2);
    OMJ.Sprites.circle(ctx, cx, cy, 2, P.ink);          // hub
    ctx.fillStyle = P.metalLight;
    ctx.fillRect(cx, cy - 1, 1, 1);
    ctx.restore();
    // Thin slot in the ground where the blade comes out
    ctx.fillStyle = P.ink;
    ctx.fillRect(cx - SAW_R + 1, C.GROUND_Y, SAW_SIZE - 2, 2);
  }

  // A few sparks where the blade meets the ground.
  function sawSparks(o, g) {
    if (Math.random() > 0.08) return;
    const cx = o.x + o.bx + SAW_R;
    g.particles.spawn(cx + OMJ.rand(-8, 8), C.GROUND_Y - 1, OMJ.rand(-60, 60), OMJ.rand(-90, -40), 0.25, 1,
      Math.random() < 0.5 ? P.gold : P.white, 300);
  }

  // ---- Shellback colors and its shell -------------------------
  const SHELL_GREEN = '#4caf50';
  const SHELL_DARK = '#2e7d32';
  const SHELL_LIGHT = '#8bd88f';
  const SHELL_RIM = '#f3e3b5';
  const SHELL_SKIN = '#e8b45c';
  const SHELL_BEAK = '#c98a2e';

  // The domed shell (11 x 11) with a hex pattern; `spin` shifts the pattern.
  function drawShell(ctx, x, y, spin) {
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + 2, y, 7, 1);
    ctx.fillRect(x + 1, y + 1, 9, 1);
    ctx.fillRect(x, y + 2, 11, 8);
    ctx.fillStyle = SHELL_GREEN;
    ctx.fillRect(x + 2, y + 1, 7, 1);
    ctx.fillRect(x + 1, y + 2, 9, 6);
    ctx.fillStyle = SHELL_LIGHT;
    ctx.fillRect(x + 2, y + 2, 3, 1);
    ctx.fillStyle = SHELL_DARK;                         // hex plates
    const s = spin % 3;
    for (let i = 0; i < 3; i++) {
      const px = x + 1 + ((i * 3 + s) % 9);
      ctx.fillRect(px, y + 4, 1, 3);
      ctx.fillRect(px, y + 4, 2, 1);
    }
    ctx.fillStyle = SHELL_RIM;                          // cream rim along the bottom
    ctx.fillRect(x + 1, y + 8, 9, 1);
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + 1, y + 9, 9, 1);
  }

  // A defeated Shellback becomes this: a spinning shell sliding forward.
  // Harmless to you; it smashes what it hits (and bonks the boss).
  OMJ.SHELL = {
    harmless: true,
    debris: [SHELL_GREEN, SHELL_DARK, SHELL_RIM],
    deathLines: [''],
    update(o, dt, g, speed) {
      o.x += (speed + 300) * dt;                       // zooms off to the right
      o.timer += dt;
      o.y = Math.min(C.GROUND_Y - 10, o.y + 120 * dt);
      if (Math.random() < 0.4) g.particles.spawn(o.x, C.GROUND_Y - 1, -40, -20, 0.2, 1, P.dust, 200);
      if (g.boss.fighting && o.x >= g.boss.leftEdge) { g.boss.hit(2, g); o.active = false; return; }
      if (o.x > C.VIEW_W + 10) { o.active = false; return; }
      const pool = g.obstacles.pool;
      for (let i = 0; i < pool.length; i++) {
        const t = pool[i];
        if (t === o || !t.active || t.type.isGap || t.type.harmless) continue;
        const left = t.x + t.bx;
        if (o.x + 11 < left || o.x > left + t.bw || o.y + 10 < t.y || o.y > t.y + t.h) continue;
        g.smash(t);                                    // knocks out whatever it hits...
        if (!t.type.enemy && !(t.type.toughness <= 2)) { // ...but breaks on very tough things
          g.smash(o);
          return;
        }
      }
    },
    draw(ctx, o) {
      const x = o.drawX;
      const y = Math.round(o.y);
      drawShell(ctx, x, y, Math.floor(o.timer * 30));
      ctx.fillStyle = P.white;                          // speed lines
      ctx.fillRect(x - 6, y + 3, 4, 1);
      ctx.fillRect(x - 9, y + 6, 6, 1);
    },
  };

  // ---- Ice (Frosty's Frost Nova) ------------------------------
  // A frozen obstacle: harmless, and you can stand on top of it.
  // It keeps the old type in o.origType so it can be drawn inside.
  const ICE = '#bdefff';
  const ICE_DARK = '#4fa8d8';
  function drawIce(ctx, x, y, w, h) {
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = ICE;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = ICE_DARK;                 // outline
    ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y + h - 1, w, 1);
    ctx.fillRect(x, y, 1, h); ctx.fillRect(x + w - 1, y, 1, h);
    ctx.fillStyle = P.white;                  // shine
    ctx.fillRect(x + 1, y + 1, Math.max(1, w - 3), 1);
    ctx.fillRect(x + 1, y + 2, 1, Math.max(1, Math.min(h - 3, 4)));
    if (w > 6 && h > 6) ctx.fillRect(x + w - 3, y + h - 4, 1, 2);
  }
  OMJ.ICE = {
    harmless: true,
    solidTop: true,
    oneWay: true,
    debris: [ICE, P.white, ICE_DARK],
    deathLines: [''],
    update(o, dt) {
      // Frozen things in mid-air drop to the ground.
      if (o.y + o.h < C.GROUND_Y) {
        o.vy += 900 * dt;
        o.y = Math.min(C.GROUND_Y - o.h, o.y + o.vy * dt);
      }
    },
    draw(ctx, o, g) {
      o.origType.draw(ctx, o, g);
      const top = Math.round(o.y);
      const h = Math.min(o.h, C.GROUND_Y - top);
      drawIce(ctx, o.drawX + o.bx - 1, top - 1, o.bw + 2, h + 1);
    },
  };
  // A pit with ice over it: safe to run across.
  OMJ.ICE_BRIDGE = {
    harmless: true,
    debris: [ICE, P.white],
    deathLines: [''],
    draw(ctx, o, g) {
      o.origType.draw(ctx, o, g);
      drawIce(ctx, o.drawX - 2, C.GROUND_Y, o.w + 4, 5);
    },
  };

  // ---- Fire (for the crossbow's flaming arrows) --------------
  const FIRE_ORANGE = '#ff8a3d';

  // A small flickering flame centered on (x, y), leaning back as if moving.
  function drawFlame(ctx, x, y, time) {
    const f = Math.floor(time * 14) % 3;          // three flicker frames
    ctx.fillStyle = P.danger;
    ctx.fillRect(x - 1, y - 3 - (f === 1 ? 1 : 0), 5, 5);
    ctx.fillRect(x + 3, y - 4 + f, 3, 3);
    ctx.fillStyle = FIRE_ORANGE;
    ctx.fillRect(x, y - 2 - (f === 2 ? 1 : 0), 4, 3);
    ctx.fillRect(x + 3, y - 3 + (f === 0 ? 1 : 0), 2, 2);
    ctx.fillStyle = P.gold;
    ctx.fillRect(x, y - 1, 2, 2);
    ctx.fillStyle = P.white;
    ctx.fillRect(x, y, 1, 1);
  }

  // ---- Obstacle types ----------------------------------------
  // size(variant)  -> { w, h }  how big this obstacle is
  // hitbox         -> how many pixels to shrink the deadly box on each side
  //                   (smaller hitboxes feel fairer)
  // solidTop       -> true if the player can land and stand on it
  // oneWay         -> a platform: jump up through it from below, land on
  //                   top, press DOWN to drop through
  // isGap          -> true for holes in the ground
  // harmless       -> scenery that can't hurt you (e.g. the crossbow tower)
  // toughness      -> a sword with `cut` >= this can cut it (gear.js).
  //                   No toughness = a sword can never cut it.
  // reflectable    -> a sword swing knocks it back at the boss
  // enemy          -> a monster: any sword hit (or a stomp, if `stompable`)
  //                   defeats it. Touching it any other way still hurts.
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
      toughness: 2,
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
      toughness: 1,
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
        // Time Freeze holds it in the air (but never mid-slam).
        if (g.frozen && o.phase === 0) return;
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

    // ---- SAWS: big spinning blades half-sunk in the ground ----
    // Two kinds share the same blade drawing (drawSaw, below):
    //   saw     slides side to side. variant = how far it slides.
    //           It never moves faster than the world scrolls, so it
    //           always comes toward you and can't chase you.
    //   sawLift pops up and down out of the ground. Even at its highest
    //           a normal jump clears it, so jumping is always safe.
    saw: {
      size: (range) => ({ w: range + SAW_SIZE, h: 17 }),
      hitbox: { left: 4, right: 4, top: 2 },
      debris: [P.metal, P.metalLight, P.danger],
      deathLines: SAW_LINES,
      init(o) {
        o.bw = SAW_SIZE;
        o.phase = Math.random() * Math.PI * 2;  // where in its slide it starts
        o.y = C.GROUND_Y - 17;
        o.bx = 0;
      },
      update(o, dt, g) {
        if (g.frozen) return;                       // Time Freeze
        o.timer += dt;
        const range = o.w - SAW_SIZE;
        o.bx = (range / 2) * (1 - Math.cos(o.timer * 2.6 + o.phase));
        sawSparks(o, g);
      },
      draw(ctx, o, g) { drawSaw(ctx, o, g); },
    },

    sawLift: {
      size: () => ({ w: SAW_SIZE, h: 26 }),
      hitbox: { left: 4, right: 4, top: 2 },
      debris: [P.metal, P.metalLight, P.danger],
      deathLines: SAW_LINES,
      init(o) {
        o.bw = SAW_SIZE;
        o.phase = Math.random() * Math.PI * 2;
      },
      update(o, dt, g) {
        if (g.frozen) return;                       // Time Freeze
        o.timer += dt;
        // Blade top goes from 7 px (mostly hidden) to 26 px above the ground.
        const lift = (1 - Math.cos(o.timer * 3.4 + o.phase)) / 2;   // 0..1
        o.y = C.GROUND_Y - 7 - Math.round(19 * lift);
        o.h = C.GROUND_Y - o.y;
        sawSparks(o, g);
      },
      draw(ctx, o, g) { drawSaw(ctx, o, g); },
    },

    // ---- CROSSBOW: a big tower that fires FLAMING arrows at you ----
    // The tower itself is harmless; jump the arrow. It only fires once
    // nothing else is between you and it, and the arrow always gives you
    // at least BOLT_WARNING seconds to react.
    crossbow: {
      size: () => ({ w: 22, h: 48 }),
      hitbox: { left: 0, right: 0, top: 0 },
      harmless: true,
      debris: [P.wood, P.woodDark, P.metal, P.gold],
      deathLines: ['Tower down. (You, not the tower.)'],
      init(o) { o.fired = false; },
      update(o, dt, g) {
        if (g.frozen) return;              // Time Freeze: holds its fire
        if (o.timer > 0) o.timer -= dt;    // recoil animation after firing
        // Embers drift up from the loaded arrow's flame.
        if (!o.fired && Math.random() < 0.12) {
          g.particles.spawn(o.x - 1, o.y + 6, OMJ.rand(-10, 10), OMJ.rand(-40, -20), 0.4, 1, Math.random() < 0.5 ? P.gold : FIRE_ORANGE, -20);
        }
        if (o.fired || o.x > C.VIEW_W - 16 || g.hasDangerBefore(o.x)) return;
        o.fired = true;
        const BOLT_WARNING = 0.75;
        const distance = o.x - (g.player.x + g.player.w);
        // Extra speed so it arrives in BOLT_WARNING seconds, but never
        // sooner than a still obstacle at the tower's spot would.
        const extra = Math.max(0, distance / BOLT_WARNING - g.worldSpeed);
        const bolt = g.obstacles.spawn('bolt', o.x - 2, 0);
        if (bolt) bolt.extra = extra;
        o.timer = 0.15;
        g.sound.play('crossbow');
      },
      draw(ctx, o, g) {
        const x = o.drawX;
        const top = Math.round(o.y);
        // Tower legs (dark so they read as scenery, not something to jump)
        ctx.fillStyle = '#3d2a35';
        ctx.fillRect(x + 3, top + 14, 2, 34);
        ctx.fillRect(x + 17, top + 14, 2, 34);
        ctx.fillRect(x + 4, top + 22, 14, 1);
        ctx.fillRect(x + 4, top + 32, 14, 1);
        ctx.fillRect(x + 4, top + 41, 14, 1);
        // Platform
        ctx.fillStyle = P.ink;
        ctx.fillRect(x, top + 12, 22, 4);
        ctx.fillStyle = P.woodDark;
        ctx.fillRect(x + 1, top + 13, 20, 2);

        // Crossbow (faces left, toward you); kicks back when it fires
        const bx = x + (o.timer > 0 ? 2 : 0);
        ctx.fillStyle = P.ink;                       // stock
        ctx.fillRect(bx + 5, top + 5, 16, 5);
        ctx.fillStyle = P.wood;
        ctx.fillRect(bx + 6, top + 6, 14, 3);
        ctx.fillStyle = P.woodLight;
        ctx.fillRect(bx + 6, top + 6, 14, 1);
        ctx.fillStyle = P.ink;                       // grip
        ctx.fillRect(bx + 15, top + 10, 3, 2);
        // The bow: a tall steel arc with tips curving back
        ctx.fillStyle = P.ink;
        ctx.fillRect(bx + 3, top - 3, 3, 19);
        ctx.fillRect(bx + 6, top - 6, 2, 4);
        ctx.fillRect(bx + 6, top + 15, 2, 4);
        ctx.fillStyle = P.metal;
        ctx.fillRect(bx + 4, top - 2, 1, 17);
        ctx.fillStyle = P.metalLight;
        ctx.fillRect(bx + 4, top - 2, 1, 3);
        // The string: pulled back to the arrow when loaded, slack after firing
        ctx.fillStyle = P.white;
        const nock = o.fired ? bx + 7 : bx + 17;
        for (let i = 0; i <= 10; i++) {
          const sx = Math.round(bx + 7 + (nock - bx - 7) * (i / 10));
          ctx.fillRect(sx, top - 4 + Math.round(i * 1.1), 1, 1);   // top half
          ctx.fillRect(sx, top + 18 - Math.round(i * 1.1), 1, 1);  // bottom half
        }
        if (!o.fired) {
          // Loaded flaming arrow
          ctx.fillStyle = P.woodLight;
          ctx.fillRect(bx + 2, top + 7, 16, 1);
          ctx.fillStyle = P.danger;                  // fletching
          ctx.fillRect(bx + 15, top + 6, 3, 1);
          ctx.fillRect(bx + 15, top + 8, 3, 1);
          drawFlame(ctx, bx - 1, top + 7, g.time);
        }
      },
    },

    // The crossbow's flaming arrow: fires from the tower and dips to ground
    // level. The deadly part is just the shaft and head; the flames are
    // drawn mostly above and behind it.
    bolt: {
      size: () => ({ w: 16, h: 4 }),
      hitbox: { left: 1, right: 2, top: 0 },
      toughness: 1,
      debris: [P.woodLight, P.metal, P.gold, FIRE_ORANGE],
      deathLines: [
        'Bullseye. Unfortunately, you were the bullseye.',
        'Roasted by a flaming arrow. Crispy!',
        'Hot delivery! Signature required: yours.',
        'You took a fire arrow to the... everything.',
      ],
      init(o) {
        o.y = C.GROUND_Y - 43;
        o.extra = 0;
      },
      update(o, dt, g) {
        o.x -= o.extra * dt;
        o.y = Math.min(C.GROUND_Y - 9, o.y + 220 * dt);
        // Fire and smoke trail
        if (Math.random() < 0.6) {
          const ember = Math.random();
          g.particles.spawn(o.x + OMJ.rand(2, 8), o.y + OMJ.rand(-1, 3), OMJ.rand(20, 60), OMJ.rand(-30, -5), 0.3, ember < 0.3 ? 2 : 1,
            ember < 0.4 ? P.gold : ember < 0.8 ? FIRE_ORANGE : '#5a4a5a', -30);
        }
      },
      draw(ctx, o, g) {
        const x = o.drawX;
        const y = Math.round(o.y);
        ctx.fillStyle = P.ink;                       // outline so it pops on any sky
        ctx.fillRect(x + 3, y + 1, 12, 3);
        ctx.fillStyle = P.woodLight;                 // shaft
        ctx.fillRect(x + 3, y + 2, 11, 1);
        ctx.fillStyle = P.danger;                    // fletching
        ctx.fillRect(x + 12, y, 4, 1);
        ctx.fillRect(x + 12, y + 4, 4, 1);
        ctx.fillStyle = P.ink;                       // head
        ctx.fillRect(x, y + 1, 4, 3);
        ctx.fillStyle = P.metalLight;
        ctx.fillRect(x + 1, y + 2, 2, 1);
        drawFlame(ctx, x + 1, y + 2, g.time);
      },
    },

    // ---- MONSTERS ----

    // SHELLBACK: a grumpy little turtle that waddles toward you.
    // Jump over it, stomp on its head, or hit it with your sword: then it
    // hides in its shell, which shoots forward and smashes what's ahead.
    // Like the crossbow, it only starts walking once nothing else is
    // between you, so it never arrives at an unfair moment.
    shellback: {
      size: () => ({ w: 14, h: 13 }),
      hitbox: { left: 2, right: 2, top: 3 },
      enemy: true,
      stompable: true,
      debris: [SHELL_GREEN, SHELL_DARK, SHELL_SKIN],
      deathLines: ['Turtled.', 'A Shellback got the jump on you.', 'Shell shocked!', 'Slow and steady... got you.'],
      init(o) { o.phase = 0; o.timer = Math.random(); },
      update(o, dt, g) {
        if (g.frozen) return;                          // Time Freeze
        o.timer += dt;
        o.phase = 0;
        if (o.x < C.VIEW_W - 4 && !g.hasDangerBefore(o.x)) {
          o.x -= 40 * dt;                              // waddle toward you
          o.phase = 1;
        }
      },
      draw(ctx, o) {
        const x = o.drawX;
        const y = Math.round(o.y);
        const step = o.phase ? Math.floor(o.timer * 10) % 2 : 0;
        // Feet
        ctx.fillStyle = P.ink;
        ctx.fillRect(x + 4 - step, y + 10, 3, 3);
        ctx.fillRect(x + 9 + step, y + 10, 3, 3);
        ctx.fillStyle = SHELL_SKIN;
        ctx.fillRect(x + 5 - step, y + 11, 1, 1);
        ctx.fillRect(x + 10 + step, y + 11, 1, 1);
        // Head (facing you, on the left), bobbing as it walks
        const hy = y + 3 + step;
        ctx.fillStyle = P.ink;
        ctx.fillRect(x, hy, 6, 6);
        ctx.fillStyle = SHELL_SKIN;
        ctx.fillRect(x + 1, hy + 1, 4, 4);
        ctx.fillStyle = P.white;
        ctx.fillRect(x + 1, hy + 1, 2, 2);
        ctx.fillStyle = P.ink;
        ctx.fillRect(x + 1, hy + 2, 1, 1);             // pupil
        ctx.fillRect(x + 1, hy, 3, 1);                  // angry brow
        ctx.fillStyle = SHELL_BEAK;
        ctx.fillRect(x, hy + 4, 2, 1);                  // beak
        drawShell(ctx, x + 3, y, 0);
      },
    },

    // ---- WOODEN PLATFORM: a floating plank you can stand on ----
    // Jump up through it from underneath and land on top. Press DOWN while
    // standing on it to drop through. It never hurts you, and whatever is
    // under it can always be jumped normally, so it's an optional high road.
    // variant = width in pixels.
    platform: {
      size: (width) => ({ w: width, h: 6 }),
      hitbox: { left: 0, right: 0, top: 0 },
      solidTop: true,
      oneWay: true,
      harmless: true,
      debris: [P.wood, P.woodLight, P.woodDark],
      deathLines: ['Splinters!'],
      init(o) {
        o.y = C.GROUND_Y - OMJ.randInt(32, 40);   // the top you stand on
      },
      draw(ctx, o) {
        const x = o.drawX;
        const y = Math.round(o.y);
        const w = o.w;
        // Little support brackets hanging under each end
        ctx.fillStyle = P.ink;
        ctx.fillRect(x + 3, y + 6, 4, 3); ctx.fillRect(x + w - 7, y + 6, 4, 3);
        ctx.fillStyle = P.woodDark;
        ctx.fillRect(x + 4, y + 6, 2, 2); ctx.fillRect(x + w - 6, y + 6, 2, 2);
        // The plank
        ctx.fillStyle = P.ink;
        ctx.fillRect(x, y, w, 6);
        ctx.fillStyle = P.wood;
        ctx.fillRect(x + 1, y + 1, w - 2, 4);
        ctx.fillStyle = P.woodLight;
        ctx.fillRect(x + 1, y + 1, w - 2, 1);
        ctx.fillStyle = P.woodDark;
        ctx.fillRect(x + 1, y + 4, w - 2, 1);
        // Board seams with a nail on each side
        for (let sx = x + 16; sx < x + w - 4; sx += 16) {
          ctx.fillStyle = P.ink;
          ctx.fillRect(sx, y + 1, 1, 4);
          ctx.fillStyle = P.metalLight;
          ctx.fillRect(sx - 2, y + 2, 1, 1);
          ctx.fillRect(sx + 2, y + 2, 1, 1);
        }
        // Wood grain
        ctx.fillStyle = P.woodDark;
        for (let gx = x + 5; gx < x + w - 4; gx += 11) ctx.fillRect(gx, y + 3, 3, 1);
      },
    },

    // ---- BOSS ATTACKS (launched by boss.js) ----

    // A bomb that drops straight down, then rolls toward you.
    bomb: {
      size: () => ({ w: 10, h: 10 }),
      hitbox: { left: 2, right: 2, top: 2 },
      reflectable: true,
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
      toughness: 2,
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

    // Ground Pound: a wave of rock and dust rolling along the ground.
    quake: {
      size: () => ({ w: 14, h: 10 }),
      hitbox: { left: 2, right: 2, top: 2 },
      debris: [P.dirt, P.dirtLight, P.dust],
      deathLines: ['The ground itself turned on you.', 'Earthquake! (Well, a Bonk-quake.)', 'Should have jumped the rumble.'],
      init(o) { o.extra = 140; },
      update(o, dt, g) {
        o.x -= o.extra * dt;
        o.timer += dt;
        if (Math.random() < 0.5) {
          g.particles.spawn(o.x + OMJ.rand(0, 14), C.GROUND_Y - 2, OMJ.rand(20, 80), OMJ.rand(-80, -30), 0.35, OMJ.randInt(1, 2),
            Math.random() < 0.5 ? P.dust : P.dirtLight, 400);
        }
      },
      draw(ctx, o, g) {
        const x = o.drawX;
        const gy = C.GROUND_Y;
        const f = Math.floor(g.time * 20) % 2;
        // A hump of cracked earth with rocks flying off the top
        ctx.fillStyle = P.ink;
        ctx.fillRect(x + 2, gy - 6, 10, 6);
        ctx.fillRect(x + 4, gy - 9, 6, 3);
        ctx.fillRect(x, gy - 3, 14, 3);
        ctx.fillStyle = P.dirt;
        ctx.fillRect(x + 3, gy - 5, 8, 5);
        ctx.fillRect(x + 5, gy - 8, 4, 3);
        ctx.fillRect(x + 1, gy - 2, 12, 2);
        ctx.fillStyle = P.dirtLight;
        ctx.fillRect(x + 5, gy - 8, 2, 1);
        ctx.fillRect(x + 3, gy - 5, 2, 1);
        ctx.fillStyle = P.grass;
        ctx.fillRect(x + 4, gy - 9 + f, 2, 1);
        ctx.fillRect(x + 9, gy - 7 - f, 2, 1);
      },
    },

    // A fireball that swoops down to ground level and flies at you.
    fireball: {
      size: () => ({ w: 10, h: 6 }),
      hitbox: { left: 1, right: 2, top: 1 },
      reflectable: true,
      debris: [P.danger, P.gold, '#ff8a3d'],
      deathLines: ['Toasty!', 'Well done. (Like a steak.)', 'Hot hot hot!'],
      init(o) { o.extra = 150; },
      update(o, dt, g) {
        o.x -= o.extra * dt;
        o.y = Math.min(C.GROUND_Y - 8, o.y + 260 * dt);
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

    // ---- Gloomwing's attacks ----

    // A shadow orb: dropped, then rolls at you. Swing it back!
    shadowOrb: {
      size: () => ({ w: 10, h: 10 }),
      hitbox: { left: 2, right: 2, top: 2 },
      reflectable: true,
      debris: ['#c77dff', '#3b2a5c', P.white],
      deathLines: ['Swallowed by the dark.', 'That orb had your name on it.', 'Gloomwing: 1. You: 0.'],
      init(o) { o.phase = 0; o.vy = 0; },
      update(o, dt, g, speed) {
        o.timer += dt;
        if (o.phase === 0) {
          o.x += speed * dt;                 // fall straight down on screen
          o.vy += 900 * dt;
          o.y += o.vy * dt;
          if (o.y >= C.GROUND_Y - o.h) { o.y = C.GROUND_Y - o.h; o.phase = 1; g.sound.play('bombLand'); }
        } else {
          o.x -= 60 * dt;                    // rolls toward you, quickly
          if (Math.random() < 0.4) g.particles.spawn(o.x + 9, o.y + OMJ.rand(2, 8), 40, OMJ.rand(-20, 0), 0.3, 1, '#c77dff', 0);
        }
      },
      draw(ctx, o, g) {
        const cx = o.drawX + 5;
        const cy = Math.round(o.y) + 5;
        const pulse = Math.floor(g.time * 10) % 2;
        OMJ.Sprites.circle(ctx, cx, cy, 5, P.ink);
        OMJ.Sprites.circle(ctx, cx, cy, 4, '#3b2a5c');
        OMJ.Sprites.circle(ctx, cx, cy, 2 + pulse, '#7a4fc2');
        ctx.fillStyle = '#c77dff';
        ctx.fillRect(cx - 1, cy - 1, 2, 2);
        ctx.fillStyle = P.white;
        ctx.fillRect(cx - 3, cy - 3, 1, 1);
      },
    },

    // A purple hex bolt: swoops down to ground level like a fireball.
    hexBolt: {
      size: () => ({ w: 10, h: 6 }),
      hitbox: { left: 1, right: 2, top: 1 },
      reflectable: true,
      debris: ['#c77dff', '#7a4fc2', P.white],
      deathLines: ['Hexed!', 'You have been cursed. (Mostly with losing.)', 'Spooky AND fast.'],
      init(o) { o.extra = 150; },
      update(o, dt, g) {
        o.x -= o.extra * dt;
        o.y = Math.min(C.GROUND_Y - 8, o.y + 260 * dt);
        o.timer += dt;
        if (Math.random() < 0.5) g.particles.spawn(o.x + 9, o.y + 3, 30, OMJ.rand(-15, 15), 0.3, 1, Math.random() < 0.5 ? '#c77dff' : P.white, 0);
      },
      draw(ctx, o, g) {
        const x = o.drawX;
        const y = Math.round(o.y);
        const spin = Math.floor(g.time * 16) % 2;
        ctx.fillStyle = P.ink;
        ctx.fillRect(x, y + 1, 9, 4);
        ctx.fillRect(x + 2, y, 5, 6);
        ctx.fillStyle = '#7a4fc2';
        ctx.fillRect(x + 1, y + 2, 7, 2);
        ctx.fillRect(x + 3, y + 1, 3, 4);
        ctx.fillStyle = '#c77dff';                // a little spinning star in the middle
        if (spin) ctx.fillRect(x + 4, y + 1, 1, 4);
        else ctx.fillRect(x + 2, y + 3, 5, 1);
        ctx.fillStyle = P.white;
        ctx.fillRect(x + 4, y + 3, 1, 1);
      },
    },

    // A little bat that flaps along just above the ground. Jump it or cut it.
    bat: {
      size: () => ({ w: 12, h: 8 }),
      hitbox: { left: 2, right: 2, top: 2 },
      toughness: 1,
      debris: ['#3b2a5c', '#2a1d45', P.gold],
      deathLines: ['Batted down.', 'Nibbled by a tiny bat.', 'It was small but it was angry.'],
      init(o) { o.extra = 90; o.phase = 0; },
      update(o, dt, g) {
        o.timer += dt;
        o.x -= o.extra * dt;
        if (o.phase === 0) {
          // Flutter down from Gloomwing's mouth to just above the ground...
          o.y = Math.min(C.GROUND_Y - o.h - 1, o.y + 220 * dt);
          if (o.y >= C.GROUND_Y - o.h - 1) o.phase = 1;
        } else {
          // ...then bob a little as it flaps.
          o.y = C.GROUND_Y - o.h - 1 - (Math.floor(o.timer * 10) % 2);
        }
      },
      draw(ctx, o) {
        const x = o.drawX;
        const y = Math.round(o.y);
        const up = Math.floor(o.timer * 12) % 2;
        ctx.fillStyle = P.ink;
        ctx.fillRect(x + 4, y + 2, 5, 5);                    // body
        if (up) { ctx.fillRect(x, y, 4, 4); ctx.fillRect(x + 9, y, 3, 4); }
        else { ctx.fillRect(x, y + 3, 4, 4); ctx.fillRect(x + 9, y + 3, 3, 4); }
        ctx.fillStyle = '#3b2a5c';
        ctx.fillRect(x + 5, y + 3, 3, 3);
        if (up) { ctx.fillRect(x + 1, y + 1, 3, 2); ctx.fillRect(x + 9, y + 1, 2, 2); }
        else { ctx.fillRect(x + 1, y + 4, 3, 2); ctx.fillRect(x + 9, y + 4, 2, 2); }
        ctx.fillStyle = P.ink;
        ctx.fillRect(x + 4, y + 1, 1, 1); ctx.fillRect(x + 8, y + 1, 1, 1);   // ears
        ctx.fillStyle = P.gold;
        ctx.fillRect(x + 5, y + 3, 1, 1);                    // eye (looking at you)
      },
    },

    // Gloomwing's Swoop: a gust of wind racing along the ground.
    gust: {
      size: () => ({ w: 14, h: 10 }),
      hitbox: { left: 2, right: 2, top: 2 },
      debris: [P.white, '#c9c2ff', '#7a4fc2'],
      deathLines: ['Blown away!', 'Gone with the wind.', 'Should have jumped the whoosh.'],
      init(o) { o.extra = 140; },
      update(o, dt, g) {
        o.x -= o.extra * dt;
        o.timer += dt;
        if (Math.random() < 0.5) {
          g.particles.spawn(o.x + OMJ.rand(0, 14), C.GROUND_Y - OMJ.rand(1, 9), OMJ.rand(30, 90), OMJ.rand(-30, 10), 0.3, 1,
            Math.random() < 0.5 ? P.white : '#c9c2ff', 0);
        }
      },
      draw(ctx, o, g) {
        const x = o.drawX;
        const gy = C.GROUND_Y;
        const f = Math.floor(g.time * 20) % 3;
        // Three curling wind streaks, the tallest in front
        ctx.fillStyle = '#c9c2ff';
        ctx.fillRect(x + 1, gy - 9, 6, 1); ctx.fillRect(x, gy - 8, 1, 3); ctx.fillRect(x + 1, gy - 5, 3, 1);
        ctx.fillRect(x + 4 + f, gy - 6, 9, 1);
        ctx.fillRect(x + 2, gy - 3, 11 - f, 1);
        ctx.fillStyle = P.white;
        ctx.fillRect(x + 7 - f, gy - 9, 6, 1);
        ctx.fillRect(x + 3, gy - 1, 10, 1);
        ctx.fillRect(x + 2, gy - 7, 1, 1);
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
          dropping: false,                            // falling from the boss
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
        o.dropping = false;
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
        if (o.dropping) {
          // Dropped by the boss: fall straight down, then sit on the ground.
          o.x += speed * dt;
          o.vy += 900 * dt;
          o.y += o.vy * dt;
          if (o.y >= C.GROUND_Y - o.h) {
            o.y = C.GROUND_Y - o.h;
            o.dropping = false;
            game.sound.play('bombLand');
          }
        } else if (o.type.update) {
          o.type.update(o, dt, game, speed);
        }
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
