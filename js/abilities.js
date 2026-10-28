// =============================================================
// abilities.js — Each skin's ACTIVE ability (key 1 / right-click)
// and the system that runs every ability during a run.
//
// You can have up to four abilities at once, each in its own "slot":
//   skin   1 (or right-click)   from your skin (OMJ.ABILITIES)
//   sword  2                     from your sword (gear.js)
//   scarf  3                     from your scarf (gear.js)
//   bonus  4                     a rare boost card (boosts.js)
//
// To add an ability, add an entry to OMJ.ABILITIES:
//   name, desc        shown on the start screen
//   cooldown          seconds before you can use it again
//   duration          how long it lasts (0 = instant)
//   canUse(game)      optional: return false to refuse (e.g. "only in the air")
//   activate(game, a) what it does; `a` is the AbilitySystem below
// Then give a skin `active: 'yourAbility'` in skins.js.
//
// All abilities only ever HELP, so the spawner's "never impossible"
// promise still holds no matter which skin you pick.
// =============================================================

OMJ.ABILITIES = {
  doubleJump: {
    name: 'Double Jump', desc: 'Jump again in mid-air', cooldown: 4, duration: 0,
    canUse(g) { return !g.player.grounded; },
    activate(g) {
      const p = g.player;
      p.smashing = false;
      p.vy = -OMJ.Physics.jumpVelocity * 0.9;
      p.squash = -1;
      g.particles.burst(p.x + 5, p.bottom, 10, 30, 70, 0, Math.PI * 2, 0.4, [g.skin.light, OMJ.PALETTE.white], 0);
      g.sound.play('doubleJump');
    },
  },

  dash: {
    name: 'Dash', desc: 'Zoom ahead, smashing through obstacles', cooldown: 9, duration: 0.45,
    activate(g, a) {
      a.giveInvulnerability(0.45);
      g.sound.play('dash');
    },
  },

  slowmo: {
    name: 'Slow-Mo', desc: 'Slow down time for 3 seconds', cooldown: 15, duration: 3,
    activate(g) { g.sound.play('slowmo'); },
  },

  phase: {
    name: 'Phase', desc: 'Float through anything for 1.2 seconds', cooldown: 10, duration: 1.2,
    activate(g, a) {
      a.giveInvulnerability(1.2);
      g.sound.play('phase');
    },
  },

  shuriken: {
    name: 'Shuriken', desc: 'Throw a star that breaks the next obstacle', cooldown: 6, duration: 0,
    canUse(g) { return g.nextObstacleAhead() !== null || g.boss.fighting; },
    activate(g, a) {
      a.throwStar(g.player.x + g.player.w, g.player.y + 5);
      g.sound.play('throw');
    },
  },

  shield: {
    name: 'Shield', desc: 'A bubble that blocks one crash (10 s)', cooldown: 20, duration: 10,
    activate(g) { g.sound.play('shield'); },
  },

  supernova: {
    name: 'Supernova', desc: 'Blast away everything on screen', cooldown: 25, duration: 0,
    activate(g) {
      g.clearScreen();
      g.sound.play('nova');
    },
  },
};

OMJ.AbilitySystem = class {
  constructor() {
    // Shuriken stars (small fixed pool, re-used)
    this.stars = [];
    for (let i = 0; i < 4; i++) this.stars.push({ active: false, x: 0, y: 0, age: 0 });

    // Points on the shield bubble's outline, worked out once.
    this.bubble = [];
    const seen = {};
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const x = Math.round(Math.cos(a) * 11);
      const y = Math.round(Math.sin(a) * 11);
      if (!seen[x + ',' + y]) { seen[x + ',' + y] = true; this.bubble.push(x, y); }
    }
    this.order = ['skin', 'sword', 'scarf', 'bonus'];
    this.slots = { skin: null, sword: null, scarf: null, bonus: null };
  }

  // One ability slot: which ability, its timers, and how the HUD shows it.
  makeSlot(id, def, keyLabel, color) {
    return { id, def, keyLabel, color, label: def.name.toUpperCase(), cooldown: 0, timer: 0 };
  }

  reset(skin, sword, scarf) {
    this.skin = skin;
    this.passive = OMJ.getPassive(skin);
    this.slots.skin = this.makeSlot(skin.active, OMJ.ABILITIES[skin.active], '1', skin.light);
    this.slots.sword = this.makeSlot(sword.power, OMJ.GEAR_ABILITIES[sword.power], '2', sword.edge);
    this.slots.scarf = this.makeSlot(scarf.power, OMJ.GEAR_ABILITIES[scarf.power], '3', scarf.color);
    this.slots.bonus = null;   // a rare boost card can fill this
    this.invulnTimer = 0;
    this.secondChanceUsed = false;
    this.rocketing = false;      // Rocket Jump: protected until you land
    for (let i = 0; i < this.stars.length; i++) this.stars[i].active = false;
  }

  setBonus(key) {
    this.slots.bonus = this.makeSlot(key, OMJ.BONUS_ABILITIES[key], '4', OMJ.PALETTE.gold);
  }

  get bonusDef() { return this.slots.bonus && this.slots.bonus.def; }

  // ---- What the game asks each step ----
  isActive(id) {
    for (let i = 0; i < this.order.length; i++) {
      const s = this.slots[this.order[i]];
      if (s && s.id === id && s.timer > 0) return true;
    }
    return false;
  }
  slotTimer(id) {
    for (let i = 0; i < this.order.length; i++) {
      const s = this.slots[this.order[i]];
      if (s && s.id === id && s.timer > 0) return s.timer;
    }
    return 0;
  }
  get timeScale() { return this.isActive('slowmo') ? 0.5 : 1; }
  get speedScale() { return this.isActive('dash') ? 2.2 : this.isActive('bulldozer') ? 1.6 : 1; }
  get smashing() { return this.isActive('dash') || this.isActive('bulldozer') || this.isActive('heroShield'); }
  get invulnerable() { return this.invulnTimer > 0; }
  isReady(slot) { return !!slot && slot.cooldown <= 0 && slot.timer <= 0; }
  get ready() { return this.isReady(this.slots.skin); }

  giveInvulnerability(seconds) {
    this.invulnTimer = Math.max(this.invulnTimer, seconds);
  }

  // Use the ability in a slot ('skin', 'sword', 'scarf' or 'bonus').
  tryActivate(g, slotName) {
    const slot = this.slots[slotName || 'skin'];
    if (!slot) return;
    if (!this.isReady(slot) || (slot.def.canUse && !slot.def.canUse(g))) {
      g.sound.play('denied');
      return;
    }
    slot.timer = slot.def.duration;
    slot.cooldown = slot.def.cooldown;
    slot.def.activate(g, this);
  }

  tryActivateBonus(g) { this.tryActivate(g, 'bonus'); }

  // Make an ability ready again right away (Rainbow Scarf).
  refresh(slotName) {
    const slot = this.slots[slotName];
    if (slot) slot.cooldown = 0;
  }

  // Shield, Second Chance or an Extra Life can save you from a crash.
  // Returns true if saved.
  tryRescue(g) {
    for (let i = 0; i < this.order.length; i++) {
      const s = this.slots[this.order[i]];
      if (s && s.id === 'shield' && s.timer > 0) {
        s.timer = 0;
        this.giveInvulnerability(0.8);
        g.sound.play('shieldBreak');
        g.announce('SHIELD BROKEN!', OMJ.PALETTE.gold);
        return true;
      }
    }
    if (this.passive.secondChance && !this.secondChanceUsed) {
      this.secondChanceUsed = true;
      this.giveInvulnerability(1.5);
      g.sound.play('secondChance');
      g.announce('BOO! SECOND CHANCE', '#7bd6ff');
      return true;
    }
    if (g.mods.extraLives > 0) {              // Extra Life boost
      g.mods.extraLives--;
      this.giveInvulnerability(1.5);
      g.sound.play('secondChance');
      g.announce('EXTRA LIFE USED!', OMJ.PALETTE.gold);
      return true;
    }
    return false;
  }

  // Timers run in REAL time (so Slow-Mo can't make itself last longer).
  update(dt, g) {
    const rechargeRate = this.passive.cooldownRate * g.mods.cooldownRate;
    for (let i = 0; i < this.order.length; i++) {
      const s = this.slots[this.order[i]];
      if (!s) continue;
      if (s.timer > 0) {
        s.timer -= dt;
      } else if (s.cooldown > 0) {
        s.cooldown -= dt * rechargeRate;
        if (s.cooldown <= 0) {
          s.cooldown = 0;
          g.sound.play('ready');
          const p = g.player;
          g.particles.burst(p.x + 5, p.y + 6, 6, 20, 50, 0, Math.PI * 2, 0.4, [s.color], 0);
        }
      }
    }
    // Rocket Jump keeps you safe until you're back on your feet.
    if (this.rocketing) {
      if (g.player.grounded) this.rocketing = false;
      else this.invulnTimer = Math.max(this.invulnTimer, 0.05);
    }
    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      // Never switch protection off over a pit or right in front of an
      // obstacle: that would be an unfair crash. (This runs before things
      // move this step, so it looks a little further ahead to be safe.)
      if (this.invulnTimer <= 0 && g.isDangerClose(0.45)) this.invulnTimer = 0.01;
    }
  }

  // Things that move with the world (use the slowed-down game time).
  updateWorld(dt, g) {
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      if (!s.active) continue;
      s.age += dt;
      s.x += 330 * dt;
      // Stars dive to ground level, so they hit spikes too.
      const targetY = OMJ.CONFIG.GROUND_Y - 6;
      s.y += OMJ.clamp(targetY - s.y, -200 * dt, 200 * dt);
      if (s.x > OMJ.CONFIG.VIEW_W + 8) { s.active = false; continue; }
      if (g.boss.fighting && s.x >= g.boss.leftEdge) { g.boss.hit(1, g); s.active = false; continue; }
      const pool = g.obstacles.pool;
      for (let j = 0; j < pool.length; j++) {
        const o = pool[j];
        if (!o.active || o.type.isGap || o.type.harmless) continue;
        const left = o.x + o.bx;
        if (s.x + 2 > left && s.x - 2 < left + o.bw && s.y + 2 > o.y - 2 && s.y - 2 < o.y + o.h) {
          g.smash(o);
          s.active = false;
          break;
        }
      }
    }
  }

  throwStar(x, y) {
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      if (s.active) continue;
      s.active = true; s.x = x; s.y = y; s.age = 0;
      return;
    }
  }

  // ---- Drawing ----

  // How see-through the player is right now (1 = solid, 0 = hidden).
  playerAlpha(time) {
    if (this.isActive('phase')) return 0.35 + 0.15 * Math.sin(time * 30);
    if (this.invulnTimer > 0 && !this.smashing) return Math.floor(time * 16) % 2 ? 0.25 : 1;
    return 1;
  }

  drawBehindPlayer(ctx, g) {
    // Dash afterimages
    if (this.isActive('dash')) {
      const p = g.player;
      const x0 = p.x;
      for (let i = 3; i >= 1; i--) {
        p.x = x0 - i * 7;               // draw ghost copies a little behind
        ctx.globalAlpha = 0.12 * (4 - i);
        p.draw(ctx, g.skin, g.time, g.scarf);
      }
      p.x = x0;
      ctx.globalAlpha = 1;
    }
    // Speed lines across the screen and motion streaks behind you
    // (white for Dash, fiery orange for Bulldozer).
    const dash = this.isActive('dash');
    if (dash || this.isActive('bulldozer')) {
      const p = g.player;
      ctx.fillStyle = dash ? OMJ.PALETTE.white : '#ff8a3d';
      for (let i = 0; i < 5; i++) {
        const y = 40 + ((i * 37 + Math.floor(g.time * 60) * 13) % 130);
        const x = (i * 97 + Math.floor(g.time * 900)) % OMJ.CONFIG.VIEW_W;
        ctx.fillRect(OMJ.CONFIG.VIEW_W - x, y, 18, 1);
      }
      for (let i = 0; i < 3; i++) {
        const len = 8 + ((Math.floor(g.time * 30) + i * 5) % 3) * 4;   // flicker in length
        ctx.fillRect(Math.round(p.x - 4 - len - i * 3), Math.round(p.y + 2 + i * 4), len, 1);
      }
    }
    // Shuriken stars (they spin between a + and an x shape)
    for (let i = 0; i < this.stars.length; i++) {
      const s = this.stars[i];
      if (!s.active) continue;
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      ctx.fillStyle = OMJ.PALETTE.ink;
      ctx.fillRect(x - 1, y - 1, 3, 3);
      ctx.fillStyle = OMJ.PALETTE.metalLight;
      if (Math.floor(s.age * 20) % 2) {
        ctx.fillRect(x - 2, y, 5, 1); ctx.fillRect(x, y - 2, 1, 5);
      } else {
        ctx.fillRect(x - 2, y - 2, 1, 1); ctx.fillRect(x + 2, y - 2, 1, 1);
        ctx.fillRect(x - 2, y + 2, 1, 1); ctx.fillRect(x + 2, y + 2, 1, 1);
        ctx.fillRect(x - 1, y - 1, 3, 3);
      }
    }
  }

  drawInFrontOfPlayer(ctx, g) {
    const shieldLeft = this.slotTimer('shield') || this.slotTimer('heroShield');
    if (shieldLeft <= 0) return;
    // Blink during the last 2 seconds so you know it's about to end.
    if (shieldLeft < 2 && Math.floor(g.time * 8) % 2) return;
    const p = g.player;
    const cx = Math.round(p.x + 5);
    const cy = Math.round(p.y + 6);
    ctx.fillStyle = this.isActive('heroShield') ? OMJ.PALETTE.white : OMJ.PALETTE.gold;
    for (let i = 0; i < this.bubble.length; i += 2) ctx.fillRect(cx + this.bubble[i], cy + this.bubble[i + 1], 1, 1);
    ctx.fillStyle = OMJ.PALETTE.white;
    ctx.fillRect(cx - 6, cy - 8, 2, 1);
    ctx.fillRect(cx - 8, cy - 6, 1, 2);
  }

  // Full-screen tints while Slow-Mo or Time Freeze is on.
  drawScreenEffects(ctx, g) {
    const C = OMJ.CONFIG;
    if (this.isActive('slowmo')) {
      ctx.globalAlpha = 0.16;
      ctx.fillStyle = '#7a2fc2';
      ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
      ctx.globalAlpha = 1;
    }
    if (g.frozen) {
      ctx.globalAlpha = 0.14;
      ctx.fillStyle = '#7bd6ff';
      ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
      ctx.globalAlpha = 1;
    }
  }

  // The ability meters along the bottom: one small box per slot,
  // with its number key (1-4) on the left.
  drawHud(ctx, g) {
    const F = OMJ.PixelFont;
    const P = OMJ.PALETTE;
    let x = 4;
    const y = 200;
    for (let i = 0; i < this.order.length; i++) {
      const s = this.slots[this.order[i]];
      if (!s) continue;
      this.drawSlot(ctx, g, s, x, y);
      x += 66;
    }
    // Spare lives (Ghost's Second Chance and Extra Life boosts)
    const lives = (this.passive.secondChance && !this.secondChanceUsed ? 1 : 0) + g.mods.extraLives;
    if (lives > 0) {
      F.drawShadowed(ctx, '+' + lives + (lives > 1 ? ' LIVES' : ' LIFE'), 5, y - 8, 1, '#7bd6ff', P.ink, 'left');
    }
  }

  drawSlot(ctx, g, s, x, y) {
    const F = OMJ.PixelFont;
    const P = OMJ.PALETTE;
    const W = 64;
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = P.ink;
    ctx.fillRect(x, y, W, 12);
    ctx.globalAlpha = 1;
    const ready = this.isReady(s);
    // Key box (blinks when ready)
    ctx.fillStyle = ready && Math.floor(g.time * 3) % 2 === 0 ? s.color : P.white;
    ctx.fillRect(x + 1, y + 1, 8, 10);
    F.draw(ctx, s.keyLabel, x + 4, y + 3, 1, P.ink, 'left');
    F.draw(ctx, s.label, x + 11, y + 2, 1, ready ? P.white : P.metal, 'left');
    // Bar: white = effect running, grey = recharging, slot color = ready
    let fill = 1;
    let color = s.color;
    if (s.timer > 0 && s.def.duration > 0) {
      fill = s.timer / s.def.duration;
      color = P.white;
    } else if (s.cooldown > 0) {
      fill = 1 - s.cooldown / s.def.cooldown;
      color = P.metalDark;
    }
    ctx.fillStyle = '#4a4570';
    ctx.fillRect(x + 11, y + 9, W - 13, 2);
    ctx.fillStyle = color;
    ctx.fillRect(x + 11, y + 9, Math.round((W - 13) * fill), 2);
  }
};
