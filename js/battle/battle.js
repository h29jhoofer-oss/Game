// Battle controller: owns all battle state, runs the simulation tick, resolves damage,
// deaths, tower destruction, elixir, the match clock, overtime and victory conditions.
(function (RR) {
  'use strict';
  const U = RR.U, M = RR.Map, Cards = RR.Cards;

  const REGULATION = 180, OVERTIME = 60, DOUBLE_AT = 60, ELIXIR_RATE = 1 / 2.8, INTRO = 1.6;

  const FORMATION = {
    1: [[0, 0]],
    2: [[-0.45, 0], [0.45, 0]],
    3: [[0, -0.45], [-0.55, 0.35], [0.55, 0.35]],
    4: [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]],
  };

  class Battle {
    constructor(cfg) {
      this.cfg = cfg;
      this.entities = [];
      this.projectiles = [];
      this.zones = [];
      this.fx = new RR.Effects();
      this.events = [];
      this.time = REGULATION;
      this.elapsed = 0;
      this.phase = 'intro';
      this.introT = INTRO;
      this.winner = null;
      this.speedMul = 1;
      this.stats = { cardsPlayed: [0, 0], towersDestroyed: [0, 0], elixirSpent: [0, 0], spellsCast: [0, 0] };
      this.towers = [[], []];
      for (let team = 0; team < 2; team++) {
        for (const t of M.TOWERS[team]) {
          const e = new RR.Entity(this, { kind: 'tower', towerKind: t.kind, team, x: t.x, y: t.y, lane: t.lane, level: cfg.kingLevels[team] });
          this.towers[team].push(e);
        }
      }
      this.players = [0, 1].map((team) => {
        const deck = U.shuffle(cfg.decks[team]);
        return { team, elixir: 5, hand: deck.slice(0, 4), queue: deck.slice(4), crowns: 0, lastPlayed: null };
      });
      this.controllers = cfg.controllers || [null, null];
      this._enemies = [[], []];
      this.refreshEnemyCache();
    }

    get doubleElixir() { return this.phase === 'overtime' || (this.phase === 'regular' && this.time <= DOUBLE_AT); }
    get elixirMul() { return this.phase === 'overtime' ? 3 : this.doubleElixir ? 2 : 1; }
    get over() { return this.phase === 'ended'; }

    emit(ev) { this.events.push(ev); }

    refreshEnemyCache() {
      for (let team = 0; team < 2; team++) {
        const other = 1 - team;
        const arr = this._enemies[team];
        arr.length = 0;
        for (const e of this.entities) if (!e.dead && e.team === other) arr.push(e);
        for (const t of this.towers[other]) if (!t.dead) arr.push(t);
      }
    }
    enemiesOf(team) { return this._enemies[team]; }
    alliesOf(team) { return this.entities.filter((e) => !e.dead && e.team === team); }

    // ------------------------------------------------------------- deploy
    canPlay(team, handIdx, x, y) {
      const p = this.players[team];
      const slot = p.hand[handIdx];
      if (!slot || this.phase === 'ended' || this.phase === 'intro') return false;
      const card = Cards.get(slot.id);
      if (p.elixir < card.cost) return false;
      return M.canDeploy(this, team, card, x, y);
    }

    playCard(team, handIdx, x, y) {
      if (!this.canPlay(team, handIdx, x, y)) return false;
      const p = this.players[team];
      const slot = p.hand[handIdx];
      const card = Cards.get(slot.id);
      p.elixir -= card.cost;
      p.hand[handIdx] = p.queue.shift();
      p.queue.push(slot);
      p.lastPlayed = slot.id;
      this.stats.cardsPlayed[team]++;
      this.stats.elixirSpent[team] += card.cost;
      this.deploy(team, card, x, y, slot.level);
      this.emit({ type: 'cardPlayed', team, card: card.id, x, y });
      return true;
    }

    deploy(team, card, x, y, level) {
      if (card.type === 'spell') {
        this.zones.push(new RR.Zone(this, team, card, x, y, level));
        this.stats.spellsCast[team]++;
        RR.Audio.play('spellcast');
        return;
      }
      if (card.type === 'building') {
        const e = new RR.Entity(this, { kind: 'building', cardId: card.id, team, x, y, level });
        this.entities.push(e);
        if (!card.trap) this.fx.dust(x, y, 1.2);
        RR.Audio.play('deploy');
        return;
      }
      const n = card.count;
      const form = FORMATION[n] || FORMATION[1];
      const flip = team === 0 ? 1 : -1;
      for (let i = 0; i < n; i++) {
        const [ox, oy] = form[i];
        this.spawnUnit(card.id, team, x + ox, y + oy * flip, level, { burrow: !!card.deployAnywhere });
      }
      if (!card.deployAnywhere) this.fx.dust(x, y, card.radius > 0.7 ? 1.4 : 1);
      RR.Audio.play('deploy');
    }

    spawnUnit(cardId, team, x, y, level, opts) {
      opts = opts || {};
      const e = new RR.Entity(this, { kind: 'troop', cardId, team, x, y, level, deployTimer: opts.deployTimer, burrow: opts.burrow });
      if (!e.flying && !e.burrow) M.clampRiver(e);
      M.clampBounds(e);
      this.entities.push(e);
      return e;
    }

    // ------------------------------------------------------------- damage
    dealDamage(v, amount, src, opts) {
      if (!v || v.dead || amount <= 0) return;
      opts = opts || {};
      amount = Math.round(amount);
      v.hp -= amount;
      v.flash = 1;
      if (v.kind === 'tower') {
        if (v.towerKind === 'king' && !v.active) this.activateKing(v.team);
        if (!opts.quiet) RR.Audio.play('towerHit', 120);
      }
      if (!opts.quiet || Math.random() < 0.25) {
        const z = v.flying ? 2.1 : v.kind === 'tower' ? 3.4 : 1.5 + (v.card.size || 1) * 0.3;
        const big = amount >= 300;
        this.fx.text(v.x + U.rand(-0.3, 0.3), v.y, String(amount), v.team === 0 ? '#ffb0aa' : '#ffffff', big ? 0.62 : 0.46, z);
      }
      if (v.hp <= 0) { v.hp = 0; this.kill(v); }
    }

    areaDamage(team, x, y, r, dmg, opts) {
      opts = opts || {};
      const filter = opts.filter || 'both';
      for (const v of this.enemiesOf(team).slice()) {
        if (v.dead || v.untargetable) continue;
        if (filter === 'ground' && v.flying) continue;
        const d = Math.hypot(v.x - x, v.y - y);
        if (d > r + v.radius * 0.6) continue;
        const amt = v.kind === 'tower' ? dmg * (opts.crownMul == null ? 1 : opts.crownMul) : dmg;
        this.dealDamage(v, amt, opts.source, { spell: true, quiet: opts.quiet });
        if (v.dead) continue;
        if (opts.stun) this.stunEntity(v, opts.stun);
        if (opts.knockback && v.kind === 'troop') {
          const dx = v.x - opts.kx, dy = v.y - opts.ky;
          const dl = Math.hypot(dx, dy) || 1;
          this.knockback(v, dx / dl, dy / dl, opts.knockback);
        }
      }
    }

    stunEntity(v, dur) {
      if (v.dead) return;
      v.stun = Math.max(v.stun || 0, dur);
      v.target = v.kind === 'troop' ? null : v.target;
      v.locked = false;
      v.rampT = 0;
      this.fx.burst('spark', v.x, v.y, 4, { z: v.flying ? 1.4 : 0.8, speed: 1.5, vz: 1, life: 0.3, size: 0.06, color: '#bff8ff', grav: 0 });
    }

    knockback(v, dx, dy, amt) {
      if (v.dead || v.kind !== 'troop' || v.burrow) return;
      const k = amt / (1 + v.mass / 12);
      v.x += dx * k; v.y += dy * k;
      M.clampBounds(v);
      M.clampRiver(v);
      v.locked = false;
    }

    activateKing(team) {
      const k = this.towers[team][0];
      if (k.dead || k.active) return;
      k.active = true;
      this.fx.text(k.x, k.y, 'KING AWAKENS!', '#ffd23f', 0.5, 4.2);
      this.emit({ type: 'kingActive', team });
    }

    kill(e, silent) {
      if (e.dead) return;
      e.dead = true;
      e.hp = 0;
      if (e.kind === 'tower') return this.towerDestroyed(e);
      const c = e.card;
      if (!silent) {
        if (e.kind === 'building') { this.fx.explosion(e.x, e.y, 1.0, { shake: 0.1, flash: '#ffffff', ring: '#d6c8a8' }); RR.Audio.play('bomb', 150); }
        else { this.fx.poof(e.x, e.y, e.flying); RR.Audio.play('death', 80); }
      }
      if (c.deathDamage) {
        const dd = c.deathDamage;
        const dmg = Math.round(dd.dmg * Cards.levelMul(e.level));
        this.areaDamage(e.team, e.x, e.y, dd.radius, dmg, { filter: 'ground', crownMul: 1 });
        this.fx.explosion(e.x, e.y, dd.radius * 0.8, { shake: 0.2 });
        RR.Audio.play('bomb', 0);
      }
      if (c.deathSpawn) {
        const ds = c.deathSpawn;
        for (let i = 0; i < ds.count; i++) {
          const u = this.spawnUnit(ds.card, e.team, e.x + (i - (ds.count - 1) / 2) * 1.0, e.y, e.level, { deployTimer: 0.5 });
          u.face = e.face;
        }
        this.fx.burst('debris', e.x, e.y, 16, { speed: 3, vz: 5, life: 1, size: 0.16, color: ['#8d96a3', '#6d7480'] });
      }
    }

    towerDestroyed(t) {
      const other = 1 - t.team;
      this.stats.towersDestroyed[other]++;
      this.fx.explosion(t.x, t.y, 2.4, { shake: 0.6 });
      this.fx.burst('debris', t.x, t.y, 30, { speed: 4, vz: 7, life: 1.4, size: 0.2, color: ['#9aa1ad', '#83899a', '#6d6f78'] });
      RR.Audio.play('towerDestroy', 0);
      if (t.towerKind === 'king') {
        this.players[other].crowns = 3;
        this.emit({ type: 'crown', team: other, tower: t });
        this.end(other, 'king');
        return;
      }
      this.players[other].crowns++;
      this.emit({ type: 'crown', team: other, tower: t });
      this.activateKing(t.team);
      if (this.phase === 'overtime' && this.players[0].crowns !== this.players[1].crowns) {
        this.end(this.players[0].crowns > this.players[1].crowns ? 0 : 1, 'suddendeath');
      }
    }

    end(winner, reason) {
      if (this.phase === 'ended') return;
      this.phase = 'ended';
      this.winner = winner;
      this.endReason = reason;
      // destroy the loser's remaining towers for the dramatic finish? No: keep them; show crowns.
      this.emit({ type: 'end', winner, reason });
    }

    towerHealthRatio(team) {
      // lowest remaining tower hp ratio (used for overtime tiebreak)
      let min = Infinity;
      for (const t of this.towers[team]) if (!t.dead) min = Math.min(min, t.hp / t.maxHp);
      return min === Infinity ? 0 : min;
    }

    // ------------------------------------------------------------- tick
    update(dtRaw) {
      const dt = Math.min(0.05, dtRaw) * this.speedMul;
      this.fx.update(dt);
      if (this.phase === 'ended') {
        for (const e of this.entities) { e.t += dt; if (e.flash > 0) e.flash -= dt * 6; }
        for (const t of this.towers[0].concat(this.towers[1])) t.t += dt;
        return;
      }
      if (this.phase === 'intro') {
        this.introT -= dt;
        for (const t of this.towers[0].concat(this.towers[1])) t.t += dt;
        if (this.introT <= 0) { this.phase = 'regular'; this.emit({ type: 'start' }); }
        return;
      }
      this.elapsed += dt;
      // ---- clock
      const prevTime = this.time;
      this.time -= dt;
      if (this.phase === 'regular') {
        if (prevTime > DOUBLE_AT && this.time <= DOUBLE_AT) this.emit({ type: 'double' });
        if (this.time <= 10 && Math.ceil(prevTime) !== Math.ceil(this.time)) this.emit({ type: 'countdown', n: Math.ceil(this.time) });
        if (this.time <= 0) {
          const c0 = this.players[0].crowns, c1 = this.players[1].crowns;
          if (c0 !== c1) { this.end(c0 > c1 ? 0 : 1, 'time'); return; }
          this.phase = 'overtime'; this.time = OVERTIME;
          this.emit({ type: 'overtime' });
        }
      } else if (this.phase === 'overtime') {
        if (this.time <= 10 && Math.ceil(prevTime) !== Math.ceil(this.time)) this.emit({ type: 'countdown', n: Math.ceil(this.time) });
        if (this.time <= 0) {
          const h0 = this.towerHealthRatio(0), h1 = this.towerHealthRatio(1);
          if (Math.abs(h0 - h1) < 0.0005) this.end(-1, 'draw');
          else this.end(h0 > h1 ? 0 : 1, 'tiebreak');
          return;
        }
      }
      // ---- elixir
      for (const p of this.players) p.elixir = Math.min(10, p.elixir + dt * ELIXIR_RATE * this.elixirMul);

      // ---- controllers (AI)
      for (const ctl of this.controllers) if (ctl) ctl.update(dt, this);

      // ---- reset modifiers, apply auras & zones
      for (const e of this.entities) { e.slowMul = 1; e.buffMul = 1; }
      for (const t of this.towers[0].concat(this.towers[1])) { t.slowMul = 1; t.buffMul = 1; }
      for (const e of this.entities) {
        if (e.dead || !e.card.aura || e.deploying || e.stun > 0) continue;
        const a = e.card.aura;
        for (const o of this.entities) {
          if (o.dead || o.team !== e.team || o.kind !== 'troop') continue;
          if (Math.hypot(o.x - e.x, o.y - e.y) <= a.radius) o.buffMul = Math.max(o.buffMul, a.mul);
        }
      }
      this.refreshEnemyCache();
      for (const z of this.zones) z.update(dt);
      this.zones = this.zones.filter((z) => !z.dead);

      // ---- entities
      for (const t of this.towers[0].concat(this.towers[1])) t.update(dt);
      const list = this.entities.slice();
      for (const e of list) if (!e.dead) e.update(dt);
      for (const p of this.projectiles) p.update(dt);
      this.projectiles = this.projectiles.filter((p) => !p.dead);

      this.resolveCollisions();
      this.entities = this.entities.filter((e) => !e.dead);
    }

    resolveCollisions() {
      const ents = this.entities;
      const n = ents.length;
      for (let i = 0; i < n; i++) {
        const a = ents[i];
        if (a.dead || a.kind !== 'troop' || a.burrow) continue;
        for (let j = i + 1; j < n; j++) {
          const b = ents[j];
          if (b.dead || b.kind !== 'troop' || b.burrow || a.flying !== b.flying) continue;
          const dx = b.x - a.x, dy = b.y - a.y;
          const minD = (a.radius + b.radius) * 0.9;
          const d2 = dx * dx + dy * dy;
          if (d2 >= minD * minD) continue;
          const d = Math.sqrt(d2) || 0.001;
          const overlap = (minD - d);
          const nx = d > 0.001 ? dx / d : Math.random() - 0.5, ny = d > 0.001 ? dy / d : Math.random() - 0.5;
          const wa = b.mass / (a.mass + b.mass), wb = a.mass / (a.mass + b.mass);
          const k = Math.min(1, 0.6);
          a.x -= nx * overlap * wa * k; a.y -= ny * overlap * wa * k;
          b.x += nx * overlap * wb * k; b.y += ny * overlap * wb * k;
        }
        if (!a.flying) {
          // push out of structures
          for (const s of this.towers[0].concat(this.towers[1])) {
            if (s.dead) continue;
            this.pushOut(a, s);
          }
          for (const s of ents) {
            if (s.dead || s.kind !== 'building' || s.card.trap) continue;
            this.pushOut(a, s);
          }
        }
        M.clampBounds(a);
        M.clampRiver(a);
      }
    }

    pushOut(a, s) {
      const dx = a.x - s.x, dy = a.y - s.y;
      const minD = a.radius + s.radius * 0.95;
      const d = Math.hypot(dx, dy);
      if (d >= minD) return;
      if (d < 0.001) { a.x += 0.1; return; }
      a.x = s.x + dx / d * minD;
      a.y = s.y + dy / d * minD;
    }
  }

  Battle.REGULATION = REGULATION;
  RR.Battle = Battle;
})(window.RR);
