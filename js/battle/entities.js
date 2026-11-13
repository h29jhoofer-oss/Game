// Battlefield entities: troops, buildings, crown towers and projectiles.
// All behaviour (targeting, movement, attacks, abilities) lives here; the Battle object
// owns the lists and resolves damage / deaths.
(function (RR) {
  'use strict';
  const U = RR.U, M = RR.Map, Cards = RR.Cards;
  let NEXT_ID = 1;

  const TOWER_CARDS = {
    princess: { id: 'tower_princess', name: 'Princess Tower', type: 'tower', targets: 'both', projectile: { type: 'arrow', speed: 14 }, sound: 'bow' },
    king: { id: 'tower_king', name: 'King Tower', type: 'tower', targets: 'both', projectile: { type: 'cannonball', speed: 12 }, sound: 'cannon' },
  };

  function edgeDist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y) - a.radius - b.radius; }

  class Entity {
    constructor(B, o) {
      this.B = B;
      this.id = NEXT_ID++;
      this.team = o.team;
      this.kind = o.kind;
      this.x = o.x; this.y = o.y;
      this.level = o.level || 1;
      this.seed = Math.random() * 10;
      this.t = 0;
      this.dead = false;
      this.flash = 0;
      this.face = o.team === 0 ? 1 : -1;
      this.walk = 0; this.moving = false;
      this.atkCd = 0; this.atkAnim = -1;
      this.target = null; this.locked = false; this.retarget = 0;
      this.stun = 0; this.slowMul = 1; this.buffMul = 1;
      this.z = 0;
      if (o.kind === 'tower') {
        const td = Cards.TOWERS[o.towerKind];
        this.towerKind = o.towerKind; this.lane = o.lane;
        this.card = TOWER_CARDS[o.towerKind];
        const km = Math.pow(1.07, (o.level || 1) - 1);
        this.maxHp = Math.round(td.hp * km);
        this.dmg = Math.round(td.dmg * km);
        this.hitSpeed = td.hitSpeed; this.range = td.range; this.radius = td.radius;
        this.mass = 1000; this.speed = 0; this.flying = false; this.targets = 'both';
        this.active = o.towerKind !== 'king';
        this.deployTimer = 0;
        this.aim = this.team === 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        const c = Cards.get(o.cardId);
        this.card = c;
        const lv = this.level;
        this.maxHp = Cards.stat(c, 'hp', lv);
        this.dmg = Cards.stat(c, 'dmg', lv);
        this.hitSpeed = c.hitSpeed; this.range = c.range; this.radius = c.radius; this.mass = c.mass;
        this.speed = c.speed || 0; this.flying = !!c.flying; this.targets = c.targets;
        this.deployTimer = o.deployTimer != null ? o.deployTimer : c.deployTime;
        this.deployTotal = Math.max(0.01, this.deployTimer);
        this.lifetime = c.lifetime || 0;
        this.spawnTimer = c.spawner ? c.spawner.interval : 0;
        this.healTimer = c.heal ? c.heal.interval * 0.5 : 0;
        this.genTimer = c.elixirGen ? c.elixirGen.interval : 0;
        this.chargeDist = 0; this.charging = false;
        this.rampT = 0; this.rampTarget = null;
        this.atkCd = c.hitSpeed ? c.hitSpeed * 0.3 : 0; // first-hit wind-up
        this.aim = this.team === 0 ? -Math.PI / 2 : Math.PI / 2;
        this.spawnAnim = 0;
        if (c.deployAnywhere && o.burrow) {
          // tunnel from own king tower to the destination
          const king = B.towers[this.team][0];
          this.burrow = { tx: o.x, ty: o.y };
          this.x = king.x; this.y = king.y + (this.team === 0 ? -2.3 : 2.3);
          this.untargetable = true;
          this.deployTimer = 0.9; this.deployTotal = 0.9;
        }
        if (c.trap) this.untargetable = true;
        if (o.kind === 'building') this.face = 1;
      }
      this.hp = this.maxHp;
    }

    get isStructure() { return this.kind === 'building' || this.kind === 'tower'; }
    get deploying() { return this.deployTimer > 0 || !!this.burrow; }

    canTarget(v) {
      if (!v || v.dead || v.untargetable || v.team === this.team) return false;
      const t = this.targets;
      if (t === 'none') return false;
      if (t === 'ground') return !v.flying;
      if (t === 'buildings') return v.kind === 'building' || v.kind === 'tower';
      return true;
    }

    findTarget(maxDist) {
      let best = null, bestD = Infinity;
      const enemies = this.B.enemiesOf(this.team);
      for (const v of enemies) {
        if (!this.canTarget(v)) continue;
        const d = edgeDist(this, v);
        if (d <= maxDist && d < bestD) { bestD = d; best = v; }
      }
      return best;
    }

    defaultTarget() {
      const enemyTowers = this.B.towers[1 - this.team];
      const lane = this.x < M.W / 2 ? 0 : 1;
      const pt = enemyTowers.find((t) => t.kind === 'tower' && t.towerKind === 'princess' && t.lane === lane && !t.dead);
      if (pt) return pt;
      const king = enemyTowers[0];
      if (!king.dead) return king;
      return null;
    }

    update(dt) {
      this.t += dt;
      if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 6);
      if (this.atkAnim >= 0) { this.atkAnim += dt / Math.max(0.35, Math.min(0.7, this.hitSpeed * 0.6)); if (this.atkAnim > 1) this.atkAnim = -1; }
      if (this.spawnAnim > 0) this.spawnAnim = Math.max(0, this.spawnAnim - dt * 2);
      if (this.kind === 'tower') return this.updateTower(dt);

      // ---- burrowing travel (Tunneling Mole)
      if (this.burrow) {
        const dx = this.burrow.tx - this.x, dy = this.burrow.ty - this.y;
        const d = Math.hypot(dx, dy);
        const step = 5.5 * dt;
        if (d <= step) {
          this.x = this.burrow.tx; this.y = this.burrow.ty; this.burrow = null; this.untargetable = false;
          this.B.fx.burst('debris', this.x, this.y, 12, { speed: 2.5, vz: 4, life: 0.8, size: 0.12, color: ['#8a6a4a', '#6b4a3a'] });
          this.B.fx.dust(this.x, this.y, 1);
          RR.Audio.play('deploy');
        } else {
          this.x += dx / d * step; this.y += dy / d * step;
          if (Math.random() < 0.6) this.B.fx.add({ type: 'debris', x: this.x + U.rand(-0.3, 0.3), y: this.y, vz: U.rand(1, 2.5), life: 0.5, size: 0.09, color: '#7a5a3a', grav: 9 });
        }
        return;
      }
      // ---- deploying
      if (this.deployTimer > 0) {
        this.deployTimer -= dt;
        if (this.deployTimer <= 0) this.onDeployed();
        return;
      }
      // ---- lifetime decay for buildings
      if (this.kind === 'building' && this.lifetime > 0) {
        this.hp -= (this.maxHp / this.lifetime) * dt;
        if (this.hp <= 0) { this.B.kill(this); return; }
      }
      if (this.stun > 0) {
        this.stun -= dt;
        this.moving = false;
        this.atkCd = Math.max(this.atkCd, this.hitSpeed * 0.4);
        this.rampT = 0; this.chargeDist = 0; this.charging = false;
        return;
      }
      const c = this.card;
      const rate = this.buffMul * this.slowMul;
      // ---- passive abilities
      if (c.spawner) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) { this.spawnTimer = c.spawner.interval; this.doSpawn(); }
      }
      if (c.heal) {
        this.healTimer -= dt;
        if (this.healTimer <= 0) { this.healTimer = c.heal.interval; this.doHeal(); }
      }
      if (c.elixirGen) {
        this.genTimer -= dt;
        if (this.genTimer <= 0) {
          this.genTimer = c.elixirGen.interval;
          const p = this.B.players[this.team];
          p.elixir = Math.min(10, p.elixir + 1);
          this.B.fx.add({ type: 'elixir', x: this.x, y: this.y, z: 1.6, vz: 1.5, life: 1.0, size: 0.22, color: '#e04ad0', grav: 0 });
          if (this.team === 0) { this.B.fx.text(this.x, this.y, '+1', '#ff7ae6', 0.55, 2.2); RR.Audio.play('elixir'); }
        }
      }
      if (c.trap) return this.updateTrap();
      if (c.aura && Math.random() < dt * 3) this.B.fx.add({ type: 'note', x: this.x + U.rand(-0.6, 0.6), y: this.y, z: 1.4, vz: 1.2, vx: U.rand(-0.5, 0.5), life: 0.9, size: 0.18, color: '#ffd23f', grav: 0 });

      if (this.atkCd > 0) this.atkCd -= dt * rate;

      if (this.kind === 'building') return this.updateStructureCombat(dt);

      // ---- troop targeting
      if (this.target && (this.target.dead || this.target.untargetable)) { this.target = null; this.locked = false; }
      this.retarget -= dt;
      if (!this.locked && this.retarget <= 0) {
        this.retarget = 0.25;
        const t = this.findTarget(c.sight);
        this.target = t || this.defaultTarget();
      }
      const tgt = this.target;
      if (!tgt) { this.moving = false; return; }
      const d = edgeDist(this, tgt);
      if (d <= this.range + 0.05) {
        this.locked = true;
        this.moving = false;
        this.faceTo(tgt.x);
        if (c.charge && this.charging) { this.atkCd = Math.min(this.atkCd, 0); }
        if (this.atkCd <= 0) {
          this.attack(tgt);
          this.atkCd = this.hitSpeed;
        }
        this.chargeDist = 0;
      } else {
        // if we were locked on but target moved away (pushed), keep chasing
        if (this.locked && d > this.range + 1.5) this.locked = false;
        let sp = this.speed * rate;
        if (c.charge) {
          if (this.charging) sp *= c.charge.speedMul;
          else if (this.chargeDist >= c.charge.distance) { this.charging = true; RR.Audio.play('whoosh'); }
        }
        const [wx, wy] = M.route(this, tgt.x, tgt.y);
        this.moveToward(wx, wy, sp, dt);
        if (c.charge) this.chargeDist += sp * dt;
        // first-hit delay after moving
        this.atkCd = Math.max(this.atkCd, this.hitSpeed * 0.35);
      }
    }

    faceTo(x) { if (Math.abs(x - this.x) > 0.05) this.face = x > this.x ? 1 : -1; }

    moveToward(tx, ty, sp, dt) {
      const dx = tx - this.x, dy = ty - this.y;
      const d = Math.hypot(dx, dy);
      if (d < 0.01) { this.moving = false; return; }
      const step = Math.min(d, sp * dt);
      this.x += (dx / d) * step; this.y += (dy / d) * step;
      this.moving = true;
      this.walk += dt * (6 + sp * 4);
      if (Math.abs(dx) > 0.08) this.face = dx > 0 ? 1 : -1;
    }

    updateStructureCombat(dt) {
      const c = this.card;
      if (c.targets === 'none') return;
      if (this.target && (!this.canTarget(this.target) || edgeDist(this, this.target) > this.range)) { this.target = null; this.rampT = 0; }
      if (!this.target) { this.target = this.findTarget(this.range); this.rampT = 0; }
      const tgt = this.target;
      if (!tgt) return;
      const want = Math.atan2((tgt.y - this.y) * 0.82, tgt.x - this.x);
      this.aim = want;
      if (c.ramp) {
        this.rampT += dt;
        if (Math.random() < dt * 4) RR.Audio.play('beam', 300);
      }
      if (this.atkCd <= 0) {
        this.attack(tgt);
        this.atkCd = this.hitSpeed;
      }
    }

    updateTower(dt) {
      if (this.dead) return;
      if (!this.active) return;
      if (this.stun > 0) { this.stun -= dt; return; }
      if (this.atkCd > 0) this.atkCd -= dt;
      if (this.target && (!this.canTarget(this.target) || edgeDist(this, this.target) > this.range)) this.target = null;
      if (!this.target) this.target = this.findTarget(this.range);
      const tgt = this.target;
      if (!tgt) return;
      this.face = tgt.x >= this.x ? 1 : -1;
      this.aim = Math.atan2((tgt.y - this.y) * 0.82, tgt.x - this.x);
      if (this.atkCd <= 0) { this.attack(tgt); this.atkCd = this.hitSpeed; }
    }

    updateTrap() {
      const c = this.card;
      for (const v of this.B.enemiesOf(this.team)) {
        if (v.dead || v.flying || v.kind !== 'troop' || v.untargetable) continue;
        if (Math.hypot(v.x - this.x, v.y - this.y) < c.trap.trigger + v.radius) {
          const dmg = Cards.stat(c, 'dmg', this.level);
          this.B.areaDamage(this.team, this.x, this.y, c.trap.radius, dmg, { filter: 'ground', stun: c.trap.stun, crownMul: 1 });
          this.B.fx.explosion(this.x, this.y, c.trap.radius * 0.8, { flash: '#fff6a0', ring: '#ffd23f' });
          this.B.fx.burst('spark', this.x, this.y, 20, { speed: 4, vz: 4, life: 0.5, size: 0.08, color: ['#ffd23f', '#ffffff', '#ffb347'] });
          RR.Audio.play('explode');
          this.B.kill(this, true);
          return;
        }
      }
    }

    onDeployed() {
      const c = this.card;
      if (c.deployZap) {
        const dz = c.deployZap;
        const dmg = Math.round(dz.dmg * Cards.levelMul(this.level));
        this.B.areaDamage(this.team, this.x, this.y, dz.radius, dmg, { filter: 'both', stun: dz.stun, crownMul: 0.35 });
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * Math.PI * 2;
          this.B.fx.bolt(this.x, this.y, 1, this.x + Math.cos(a) * dz.radius, this.y + Math.sin(a) * dz.radius, 0, '#7ff6ff', 0.3);
        }
        this.B.fx.ring(this.x, this.y, dz.radius, '#7ff6ff', 0.4, 0.14);
        RR.Audio.play('zap');
      }
      if (c.spawner && c.spawner.onDeploy) this.doSpawn();
    }

    doSpawn() {
      const sp = this.card.spawner;
      const fwd = M.forward(this.team);
      for (let i = 0; i < sp.count; i++) {
        const ang = (i / sp.count) * Math.PI * 2 + 0.3;
        let x, y;
        if (this.kind === 'building') { x = this.x + (i - (sp.count - 1) / 2) * 0.6; y = this.y + fwd * (this.radius + 0.5); }
        else { x = this.x + Math.cos(ang) * 1.0; y = this.y + Math.sin(ang) * 0.8; }
        const u = this.B.spawnUnit(sp.card, this.team, x, y, this.level, { deployTimer: 0.35, silent: true });
        if (u) this.B.fx.burst('smoke', u.x, u.y, 4, { speed: 1, vz: 0.5, life: 0.4, size: 0.25, color: this.card.id === 'necromancer' ? '#7a5aa0' : '#e8dcc0', grav: 0 });
      }
      this.spawnAnim = 1;
      RR.Audio.play('spawn', 150);
    }

    doHeal() {
      const h = this.card.heal;
      const amt = Math.round(h.amount * Cards.levelMul(this.level));
      let healed = false;
      for (const e of this.B.entities) {
        if (e.dead || e.team !== this.team || e.kind !== 'troop' || e.deploying) continue;
        if (Math.hypot(e.x - this.x, e.y - this.y) > h.radius) continue;
        if (e.hp < e.maxHp) {
          e.hp = Math.min(e.maxHp, e.hp + amt);
          healed = true;
          this.B.fx.add({ type: 'heal', x: e.x + U.rand(-0.3, 0.3), y: e.y, z: 1.2, vz: 1.4, life: 0.7, size: 0.12, color: '#7dff6a', grav: 0 });
        }
      }
      this.B.fx.ring(this.x, this.y, h.radius, '#7dff6a', 0.6, 0.06);
      for (let i = 0; i < 5; i++) this.B.fx.add({ type: 'leaf', x: this.x + U.rand(-h.radius, h.radius) * 0.7, y: this.y + U.rand(-h.radius, h.radius) * 0.5, z: 0.3, vz: 1, life: 0.9, size: 0.12, color: '#8fe36a', grav: 0 });
      if (healed) RR.Audio.play('heal', 300);
    }

    attack(tgt) {
      const c = this.card;
      const B = this.B;
      this.atkAnim = 0;
      let dmg = this.dmg;
      if (c.charge && this.charging) {
        dmg *= c.charge.dmgMul; this.charging = false; this.chargeDist = 0;
        B.fx.text(tgt.x, tgt.y, 'CHARGE!', '#ffd23f', 0.45, 2.2);
        B.fx.shake = Math.max(B.fx.shake, 0.15);
      }
      if (c.ramp) {
        const stage = this.rampT < c.rampTime[0] ? 0 : this.rampT < c.rampTime[1] ? 1 : 2;
        dmg = this.dmg * c.ramp[stage];
        B.dealDamage(tgt, dmg, this, { quiet: true });
        if (Math.random() < 0.5) B.fx.burst('fire', tgt.x, tgt.y, 1, { z: tgt.flying ? 1.4 : 0.6, speed: 1, vz: 1.5, life: 0.4, size: 0.18, color: ['#ffb347', '#ff5e2e'], grav: 0 });
        return;
      }
      if (c.sound && c.sound !== 'none') RR.Audio.play(c.sound);
      if (c.chain) return this.chainAttack(tgt, dmg);
      if (c.projectile) {
        const startZ = this.kind === 'tower' ? (this.towerKind === 'king' ? 2.6 : 2.9) : this.flying ? 1.5 : 0.8;
        let sx = this.x, sy = this.y;
        if (this.kind === 'tower' && this.towerKind === 'king') { sx = this.x - 0.6; }
        B.projectiles.push(new Projectile(B, {
          team: this.team, x: sx, y: sy, z: startZ, target: tgt, dmg, splash: c.splash || 0,
          type: c.projectile.type, speed: c.projectile.speed, arc: c.projectile.arc, filter: this.targets === 'ground' ? 'ground' : 'both',
          source: this,
        }));
        return;
      }
      if (c.id === 'gas_zeppelin') {
        B.projectiles.push(new Projectile(B, { team: this.team, x: this.x, y: this.y, z: 1.4, target: null, tx: tgt.x, ty: tgt.y, dmg, splash: 1.2, type: 'dropbomb', speed: 4, filter: 'ground', source: this }));
        return;
      }
      if (c.selfSplash) {
        B.areaDamage(this.team, this.x, this.y, c.selfSplash + this.radius, dmg, { filter: 'ground', source: this, crownMul: 1 });
        B.fx.ring(this.x, this.y, c.selfSplash + this.radius, '#ffffff', 0.3, 0.1);
        return;
      }
      B.dealDamage(tgt, dmg, this);
      const hz = tgt.flying ? 1.4 : tgt.kind === 'tower' ? 1.2 : 0.6;
      B.fx.hitSpark((tgt.x + this.x) / 2, (tgt.y + this.y) / 2, hz);
    }

    chainAttack(first, dmg) {
      const c = this.card, B = this.B;
      const hit = [first];
      let cur = first;
      for (let i = 1; i < c.chain.count; i++) {
        let best = null, bd = Infinity;
        for (const v of B.enemiesOf(this.team)) {
          if (hit.includes(v) || !this.canTarget(v)) continue;
          const d = Math.hypot(v.x - cur.x, v.y - cur.y);
          if (d < c.chain.range && d < bd) { bd = d; best = v; }
        }
        if (!best) break;
        hit.push(best); cur = best;
      }
      let px = this.x, py = this.y, pz = 1.1;
      for (const v of hit) {
        const vz = v.flying ? 1.4 : v.kind === 'tower' ? 2 : 0.6;
        B.fx.bolt(px, py, pz, v.x, v.y, vz, '#7ff6ff', 0.25);
        B.dealDamage(v, dmg, this);
        if (v.kind !== 'tower') B.stunEntity(v, c.chain.stun);
        px = v.x; py = v.y; pz = vz;
      }
    }
  }

  class Projectile {
    constructor(B, o) {
      Object.assign(this, o);
      this.B = B;
      this.dead = false;
      this.tz = 0;
      if (this.target) { this.tx = this.target.x; this.ty = this.target.y; }
      this.sx = this.x; this.sy = this.y; this.sz = this.z;
      this.total = Math.max(0.5, Math.hypot(this.tx - this.x, this.ty - this.y));
      this.trail = [];
      this.age = 0;
    }
    update(dt) {
      this.age += dt;
      if (this.target && !this.target.dead) {
        this.tx = this.target.x; this.ty = this.target.y;
        this.tz = this.target.flying ? 1.4 : this.target.kind === 'tower' ? 1.6 : 0.5;
      }
      if (this.type === 'dropbomb') { this.tz = 0; }
      const dx = this.tx - this.x, dy = this.ty - this.y;
      const d = Math.hypot(dx, dy);
      const step = this.speed * dt;
      this.trail.push([this.x, this.y, this.z]);
      if (this.trail.length > 7) this.trail.shift();
      if (this.type === 'dropbomb') {
        this.z -= this.speed * dt * 1.2;
        if (this.z <= 0) return this.impact();
        return;
      }
      if (d <= step + 0.05) { this.x = this.tx; this.y = this.ty; this.z = this.tz; return this.impact(); }
      this.x += dx / d * step; this.y += dy / d * step;
      const prog = U.clamp(1 - d / this.total, 0, 1);
      const baseZ = U.lerp(this.sz, this.tz, prog);
      this.z = this.arc ? baseZ + Math.sin(prog * Math.PI) * Math.min(2.5, this.total * 0.35) : baseZ;
      if (this.type === 'fireball' || this.type === 'flame') {
        if (Math.random() < 0.7) this.B.fx.add({ type: 'fire', x: this.x, y: this.y, z: this.z, vz: 0.3, life: 0.35, size: this.type === 'fireball' ? 0.22 : 0.16, color: U.pick(['#ffb347', '#ff7a1a', '#ffd23f']), grav: 0 });
      } else if (this.type === 'darkorb') {
        if (Math.random() < 0.6) this.B.fx.add({ type: 'fire', x: this.x, y: this.y, z: this.z, life: 0.35, size: 0.14, color: U.pick(['#9a5ae0', '#3cff8a']), grav: 0 });
      } else if (this.type === 'bomb' && Math.random() < 0.5) {
        this.B.fx.add({ type: 'spark', x: this.x, y: this.y, z: this.z + 0.15, vz: 0.5, life: 0.2, size: 0.05, color: '#ffd23f', grav: 0 });
      }
    }
    impact() {
      this.dead = true;
      const B = this.B;
      if (this.splash > 0) {
        B.areaDamage(this.team, this.x, this.y, this.splash, this.dmg, { filter: this.filter, source: this.source, crownMul: 1 });
        if (this.type === 'bomb' || this.type === 'dropbomb') {
          B.fx.explosion(this.x, this.y, this.splash * (this.type === 'dropbomb' ? 1.0 : 0.8), { shake: this.type === 'dropbomb' ? 0.25 : 0.08 });
          RR.Audio.play('bomb');
        } else if (this.type === 'darkorb') {
          B.fx.burst('fire', this.x, this.y, 10, { z: this.z, speed: 2, vz: 1, life: 0.4, size: 0.18, color: ['#9a5ae0', '#3cff8a', '#c08aff'], grav: 0 });
          B.fx.ring(this.x, this.y, this.splash, '#9a5ae0', 0.3, 0.08);
        } else {
          B.fx.burst('fire', this.x, this.y, 12, { z: this.z, speed: 2.4, vz: 1.5, life: 0.45, size: 0.22, color: ['#ffb347', '#ff7a1a', '#ffd23f'], grav: 1 });
          B.fx.ring(this.x, this.y, this.splash, '#ffb347', 0.3, 0.1);
          RR.Audio.play('fire', 80);
        }
      } else if (this.target && !this.target.dead) {
        B.dealDamage(this.target, this.dmg, this.source);
        const col = this.type === 'spit' ? ['#c08aff', '#ff9af0'] : this.type === 'leaf' ? ['#8fe36a', '#d4ff9a'] : this.type === 'cannonball' ? ['#ffffff', '#c8c8c8'] : null;
        B.fx.hitSpark(this.x, this.y, this.z, col);
        if (this.type === 'cannonball') B.fx.burst('smoke', this.x, this.y, 3, { z: this.z, speed: 0.8, vz: 0.5, life: 0.4, size: 0.2, color: '#c8c0b8', grav: 0 });
      }
    }
  }

  RR.Entity = Entity;
  RR.Projectile = Projectile;
  RR.edgeDist = edgeDist;
})(window.RR);
