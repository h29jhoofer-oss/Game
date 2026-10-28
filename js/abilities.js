// =============================================================
// abilities.js — Each skin's ACTIVE ability (S / DOWN / SHIFT /
// right-click) and the system that runs abilities during a run.
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
      p.vy = -OMJ.CONFIG.JUMP_VELOCITY * 0.9;
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
    canUse(g) { return g.nextObstacleAhead() !== null; },
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
  }

  reset(skin) {
    this.skin = skin;
    this.key = skin.active;
    this.def = OMJ.ABILITIES[skin.active];
    this.label = this.def.name.toUpperCase();
    this.passive = OMJ.getPassive(skin);
    this.cooldown = 0;           // 0 = ready (every run starts with it ready)
    this.activeTimer = 0;        // time left on a lasting effect
    this.invulnTimer = 0;
    this.secondChanceUsed = false;
    for (let i = 0; i < this.stars.length; i++) this.stars[i].active = false;
  }

  // ---- What the game asks each step ----
  isActive(key) { return this.key === key && this.activeTimer > 0; }
  get timeScale() { return this.isActive('slowmo') ? 0.5 : 1; }
  get speedScale() { return this.isActive('dash') ? 2.2 : 1; }
  get smashing() { return this.isActive('dash'); }
  get invulnerable() { return this.invulnTimer > 0; }
  get ready() { return this.cooldown <= 0 && this.activeTimer <= 0; }

  giveInvulnerability(seconds) {
    this.invulnTimer = Math.max(this.invulnTimer, seconds);
  }

  tryActivate(g) {
    if (!this.ready || (this.def.canUse && !this.def.canUse(g))) {
      g.sound.play('denied');
      return;
    }
    this.activeTimer = this.def.duration;
    this.cooldown = this.def.cooldown;
    this.def.activate(g, this);
  }

  // Shield or Second Chance can save you from a crash. Returns true if saved.
  tryRescue(g) {
    if (this.isActive('shield')) {
      this.activeTimer = 0;
      this.giveInvulnerability(0.8);
      g.sound.play('shieldBreak');
      g.announce('SHIELD BROKEN!', OMJ.PALETTE.gold);
      return true;
    }
    if (this.passive.secondChance && !this.secondChanceUsed) {
      this.secondChanceUsed = true;
      this.giveInvulnerability(1.5);
      g.sound.play('secondChance');
      g.announce('BOO! SECOND CHANCE', '#7bd6ff');
      return true;
    }
    return false;
  }

  // Timers run in REAL time (so Slow-Mo can't make itself last longer).
  update(dt, g) {
    if (this.activeTimer > 0) {
      this.activeTimer -= dt;
    } else if (this.cooldown > 0) {
      this.cooldown -= dt * this.passive.cooldownRate;
      if (this.cooldown <= 0) {
        this.cooldown = 0;
        g.sound.play('ready');
        const p = g.player;
        g.particles.burst(p.x + 5, p.y + 6, 6, 20, 50, 0, Math.PI * 2, 0.4, [this.skin.light], 0);
      }
    }
    if (this.invulnTimer > 0) {
      this.invulnTimer -= dt;
      // Never switch protection off over a pit or right in front of an
      // obstacle: that would be an unfair crash.
      if (this.invulnTimer <= 0 && g.isDangerClose()) this.invulnTimer = 0.01;
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
      const pool = g.obstacles.pool;
      for (let j = 0; j < pool.length; j++) {
        const o = pool[j];
        if (!o.active || o.type.isGap) continue;
        if (s.x + 2 > o.x && s.x - 2 < o.x + o.w && s.y + 2 > o.y - 2 && s.y - 2 < OMJ.CONFIG.GROUND_Y) {
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
    if (this.smashing) {
      const p = g.player;
      const x0 = p.x;
      for (let i = 3; i >= 1; i--) {
        p.x = x0 - i * 7;               // draw ghost copies a little behind
        ctx.globalAlpha = 0.12 * (4 - i);
        p.draw(ctx, g.skin, g.time);
      }
      p.x = x0;
      ctx.globalAlpha = 1;
      // Speed lines
      ctx.fillStyle = OMJ.PALETTE.white;
      for (let i = 0; i < 5; i++) {
        const y = 40 + ((i * 37 + Math.floor(g.time * 60) * 13) % 130);
        const x = (i * 97 + Math.floor(g.time * 900)) % OMJ.CONFIG.VIEW_W;
        ctx.fillRect(OMJ.CONFIG.VIEW_W - x, y, 18, 1);
      }
    }
    // Shuriken stars (they spin between a + and an x shape)
    ctx.fillStyle = OMJ.PALETTE.metalLight;
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
    if (!this.isActive('shield')) return;
    // Blink during the last 2 seconds so you know it's about to end.
    if (this.activeTimer < 2 && Math.floor(g.time * 8) % 2) return;
    const p = g.player;
    const cx = Math.round(p.x + 5);
    const cy = Math.round(p.y + 6);
    ctx.fillStyle = OMJ.PALETTE.gold;
    for (let i = 0; i < this.bubble.length; i += 2) ctx.fillRect(cx + this.bubble[i], cy + this.bubble[i + 1], 1, 1);
    ctx.fillStyle = OMJ.PALETTE.white;
    ctx.fillRect(cx - 6, cy - 8, 2, 1);
    ctx.fillRect(cx - 8, cy - 6, 1, 2);
  }

  // Full-screen tint while Slow-Mo is on.
  drawScreenEffects(ctx) {
    if (!this.isActive('slowmo')) return;
    const C = OMJ.CONFIG;
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#7a2fc2';
    ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
    ctx.globalAlpha = 1;
  }

  // The ability meter in the bottom-left corner.
  drawHud(ctx, g) {
    const F = OMJ.PixelFont;
    const P = OMJ.PALETTE;
    const x = 6;
    const y = 191;

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = P.ink;
    ctx.fillRect(x, y, 98, 19);
    ctx.globalAlpha = 1;

    F.draw(ctx, this.label, x + 3, y + 3, 1, P.white, 'left');

    // Bar: white = effect running, grey = recharging, skin color = ready
    let fill = 1;
    let color = this.skin.light;
    if (this.activeTimer > 0 && this.def.duration > 0) {
      fill = this.activeTimer / this.def.duration;
      color = P.white;
    } else if (this.cooldown > 0) {
      fill = 1 - this.cooldown / this.def.cooldown;
      color = P.metalDark;
    }
    ctx.fillStyle = '#4a4570';
    ctx.fillRect(x + 3, y + 11, 72, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x + 3, y + 11, Math.round(72 * fill), 4);

    if (this.ready && Math.floor(g.time * 3) % 2 === 0) {
      F.draw(ctx, 'READY', x + 75, y + 3, 1, color, 'right');
    }

    // Key hint
    ctx.fillStyle = P.white;
    ctx.fillRect(x + 81, y + 4, 11, 11);
    F.draw(ctx, 'S', x + 85, y + 7, 1, P.ink, 'left');

    // Ghost's spare life
    if (this.passive.secondChance && !this.secondChanceUsed) {
      F.drawShadowed(ctx, '+1 LIFE', x + 3, y - 9, 1, '#7bd6ff', P.ink, 'left');
    }
  }
};
