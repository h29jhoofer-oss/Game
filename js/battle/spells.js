// Spell behaviour: each cast creates a "zone" object that updates over time
// (falling meteor, arrow waves, lingering frost, rolling gale...) and knows how to draw itself.
(function (RR) {
  'use strict';
  const U = RR.U, M = RR.Map, Cards = RR.Cards;

  class Zone {
    constructor(B, team, card, x, y, level) {
      this.B = B; this.team = team; this.card = card; this.x = x; this.y = y; this.level = level;
      this.t = 0; this.dead = false;
      this.dmg = Cards.stat(card, 'dmg', level);
      const king = B.towers[team][0];
      this.ox = king.x; this.oy = king.y;
      const id = card.id;
      if (id === 'meteor' || id === 'sky_lance') {
        this.travel = Math.max(0.6, Math.hypot(x - this.ox, y - this.oy) / card.travel);
      }
      if (id === 'gale_blast') {
        this.dir = M.forward(team);
        this.hit = new Set();
        this.gy = y;
        this.dist = 0;
      }
      if (id === 'thunder_strike') this.strike();
      if (id === 'frost_mist') {
        B.areaDamage(team, x, y, card.radius, this.dmg, { filter: 'both', crownMul: card.crownMul });
        RR.Audio.play('frost');
      }
      if (id === 'battle_cry') RR.Audio.play('horn');
      if (id === 'arrow_volley') { this.wave = 0; RR.Audio.play('arrows'); }
      if (id === 'gale_blast') RR.Audio.play('wind');
      if (id === 'meteor' || id === 'sky_lance') RR.Audio.play('whoosh');
    }

    strike() {
      const c = this.card, B = this.B;
      B.areaDamage(this.team, this.x, this.y, c.radius, this.dmg, { filter: 'both', stun: c.stun, crownMul: c.crownMul });
      for (let i = 0; i < 3; i++) B.fx.bolt(this.x + U.rand(-0.4, 0.4), this.y - 0.2, 9, this.x + U.rand(-0.6, 0.6), this.y + U.rand(-0.3, 0.3), 0, '#bff8ff', 0.35);
      B.fx.flash(this.x, this.y, c.radius * 1.3, '#d8fbff', 0.3);
      B.fx.ring(this.x, this.y, c.radius, '#7ff6ff', 0.45, 0.15);
      B.fx.burst('spark', this.x, this.y, 18, { speed: 4, vz: 3, life: 0.4, size: 0.07, color: ['#ffffff', '#7ff6ff'] });
      B.fx.shake = Math.max(B.fx.shake, 0.12);
      RR.Audio.play('zap');
      this.dead = true;
    }

    update(dt) {
      this.t += dt;
      const c = this.card, B = this.B, id = c.id;
      if (id === 'meteor' || id === 'sky_lance') {
        if (this.t >= this.travel) {
          B.areaDamage(this.team, this.x, this.y, c.radius, this.dmg, { filter: 'both', crownMul: c.crownMul, knockback: c.knockback || 0, kx: this.x, ky: this.y });
          if (id === 'meteor') B.fx.explosion(this.x, this.y, c.radius, { shake: 0.3 });
          else {
            B.fx.explosion(this.x, this.y, c.radius * 1.2, { flash: '#e8fbff', ring: '#bff8ff', shake: 0.45 });
            B.fx.burst('spark', this.x, this.y, 30, { speed: 6, vz: 5, life: 0.6, size: 0.09, color: ['#ffffff', '#bff8ff', '#7fd3f5'] });
          }
          RR.Audio.play('explode');
          this.dead = true;
        }
      } else if (id === 'arrow_volley') {
        const waveT = [0.45, 0.75, 1.05];
        while (this.wave < c.waves && this.t >= waveT[this.wave]) {
          B.areaDamage(this.team, this.x, this.y, c.radius, this.dmg, { filter: 'both', crownMul: c.crownMul, quiet: this.wave > 0 });
          for (let i = 0; i < 6; i++) B.fx.hitSpark(this.x + U.rand(-c.radius, c.radius) * 0.7, this.y + U.rand(-c.radius, c.radius) * 0.6, 0.1, ['#d6c8a8', '#ffffff']);
          this.wave++;
          RR.Audio.play('hit', 0);
        }
        if (this.t > 1.3) this.dead = true;
      } else if (id === 'frost_mist') {
        for (const v of B.enemiesOf(this.team)) {
          if (v.dead || v.kind === 'tower') continue;
          if (Math.hypot(v.x - this.x, v.y - this.y) <= c.radius + v.radius * 0.5) v.slowMul = Math.min(v.slowMul, 1 - c.slow);
        }
        if (Math.random() < dt * 25) B.fx.add({ type: 'snow', x: this.x + U.rand(-c.radius, c.radius) * 0.8, y: this.y + U.rand(-c.radius, c.radius) * 0.6, z: 2.5, vz: -0.8, vx: U.rand(-0.3, 0.3), life: 1.5, size: 0.1, color: '#ffffff', grav: 0 });
        if (this.t >= c.duration) this.dead = true;
      } else if (id === 'battle_cry') {
        for (const e of B.entities) {
          if (e.dead || e.team !== this.team) continue;
          if (Math.hypot(e.x - this.x, e.y - this.y) <= c.radius + e.radius * 0.5) e.buffMul = Math.max(e.buffMul, c.buff);
        }
        if (Math.random() < dt * 12) B.fx.add({ type: 'fire', x: this.x + U.rand(-c.radius, c.radius) * 0.8, y: this.y + U.rand(-c.radius, c.radius) * 0.6, z: 0.1, vz: 1.4, life: 0.8, size: 0.12, color: U.pick(['#ff7a3d', '#ffb347', '#ff4d6a']), grav: 0 });
        if (this.t >= c.duration) this.dead = true;
      } else if (id === 'gale_blast') {
        const step = c.speed * dt;
        this.dist += step;
        this.gy += this.dir * step;
        for (const v of B.enemiesOf(this.team)) {
          if (v.dead || v.flying || this.hit.has(v) || v.untargetable) continue;
          if (Math.abs(v.x - this.x) <= c.width / 2 + v.radius * 0.5 && Math.abs(v.y - this.gy) <= 0.7 + v.radius) {
            this.hit.add(v);
            B.dealDamage(v, v.kind === 'tower' ? this.dmg * c.crownMul : this.dmg, null, { spell: true });
            if (v.kind === 'troop') B.knockback(v, 0, this.dir, c.knockback);
          }
        }
        if (Math.random() < dt * 30) B.fx.add({ type: 'leaf', x: this.x + U.rand(-c.width / 2, c.width / 2), y: this.gy, z: U.rand(0.1, 0.8), vy: this.dir * 3, vz: 1, life: 0.6, size: 0.1, color: U.pick(['#8fe36a', '#c8f09a', '#e6f7ff']), grav: 2 });
        if (this.dist >= c.length || this.gy < 0.5 || this.gy > M.H - 0.5) this.dead = true;
      }
    }

    // ---- drawing (V = view transform) ----
    drawGround(ctx, V) {
      const c = this.card, id = c.id;
      const sx = V.sx(this.x), sy = V.sy(this.y);
      if (id === 'frost_mist' || id === 'battle_cry') {
        const k = Math.min(1, this.t * 4) * (1 - Math.max(0, (this.t - c.duration + 0.4) / 0.4));
        const col = id === 'frost_mist' ? ['rgba(190,235,255,0.42)', 'rgba(120,200,255,0.12)', '#bfe9ff'] : ['rgba(255,110,60,0.38)', 'rgba(255,60,90,0.1)', '#ff9a5a'];
        const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, c.radius * V.T);
        g.addColorStop(0, col[1]); g.addColorStop(0.85, col[0]); g.addColorStop(1, col[0]);
        ctx.globalAlpha = k;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.ellipse(sx, sy, c.radius * V.T, c.radius * V.TY, 0, 0, Math.PI * 2); ctx.fill();
        ctx.setLineDash([V.T * 0.4, V.T * 0.25]);
        ctx.lineDashOffset = -this.t * V.T * 1.5;
        ctx.strokeStyle = col[2]; ctx.lineWidth = V.T * 0.1; ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      } else if ((id === 'meteor' || id === 'sky_lance') && !this.dead) {
        // target marker
        const k = this.t / this.travel;
        ctx.globalAlpha = 0.25 + k * 0.4;
        ctx.strokeStyle = id === 'meteor' ? '#ff7a1a' : '#7fd3f5'; ctx.lineWidth = V.T * 0.08;
        ctx.beginPath(); ctx.ellipse(sx, sy, c.radius * V.T * (1.2 - k * 0.2), c.radius * V.TY * (1.2 - k * 0.2), 0, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      } else if (id === 'arrow_volley') {
        ctx.globalAlpha = Math.max(0, 0.3 - this.t * 0.2);
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(sx, sy, c.radius * V.T, c.radius * V.TY, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    drawAir(ctx, V) {
      const c = this.card, id = c.id, T = V.T;
      if (id === 'meteor' || id === 'sky_lance') {
        const k = U.clamp(this.t / this.travel, 0, 1);
        const x = U.lerp(this.ox, this.x, k), y = U.lerp(this.oy, this.y, k);
        const z = 2 + Math.sin(k * Math.PI) * 5 * (1 - k * 0.3) - k * 2;
        const sx = V.sx(x), sy = V.sy(y) - z * T;
        // shadow
        ctx.globalAlpha = 0.25 * k; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(V.sx(x), V.sy(y), T * 0.6, T * 0.3, 0, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
        ctx.save(); ctx.translate(sx, sy);
        if (id === 'meteor') {
          ctx.scale(T * 0.7, T * 0.7);
          RR.Sprites.drawSpell(ctx, 'sp_meteor', this.t);
        } else {
          const dx = V.sx(this.x) - V.sx(this.ox), dy = (V.sy(this.y) - V.sy(this.oy));
          ctx.rotate(Math.atan2(dy, dx) + Math.PI / 2 + (k - 0.5) * 1.2 - 0.75);
          ctx.scale(T * 0.9, T * 0.9);
          RR.Sprites.drawSpell(ctx, 'sp_lance', this.t);
        }
        ctx.restore();
        if (Math.random() < 0.8) this.B.fx.add({ type: 'fire', x, y, z, life: 0.4, size: 0.3, color: id === 'meteor' ? U.pick(['#ffb347', '#ff7a1a', '#ffd23f']) : U.pick(['#bff8ff', '#ffffff', '#7fd3f5']), grav: 0 });
      } else if (id === 'arrow_volley') {
        // falling arrows
        const waveT = [0.45, 0.75, 1.05];
        for (let w = 0; w < 3; w++) {
          const k = (this.t - (waveT[w] - 0.4)) / 0.4;
          if (k < 0 || k > 1) continue;
          const rnd = U.seeded(w * 97 + Math.floor(this.x * 10));
          for (let i = 0; i < 12; i++) {
            const ax = this.x + (rnd() - 0.5) * c.radius * 1.6, ay = this.y + (rnd() - 0.5) * c.radius * 1.2;
            const z = (1 - k) * 7;
            const sx = V.sx(ax) - (1 - k) * T * 1.5, sy = V.sy(ay) - z * T;
            ctx.strokeStyle = '#1c1a2b'; ctx.lineWidth = T * 0.09; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - T * 0.25, sy - T * 0.6); ctx.stroke();
            ctx.strokeStyle = '#d6c8a8'; ctx.lineWidth = T * 0.05; ctx.stroke();
          }
        }
      } else if (id === 'gale_blast') {
        const sx = V.sx(this.x), sy = V.sy(this.gy);
        const w = c.width * T;
        ctx.save();
        for (let i = 0; i < 3; i++) {
          ctx.globalAlpha = 0.5 - i * 0.12;
          ctx.strokeStyle = i === 0 ? '#ffffff' : '#bfe9ff'; ctx.lineWidth = T * (0.16 - i * 0.03);
          ctx.beginPath();
          for (let j = 0; j <= 16; j++) {
            const px = sx - w / 2 + (j / 16) * w;
            const py = sy - T * (0.4 + i * 0.35) + Math.sin(j * 0.9 + this.t * 20 + i) * T * 0.15 - this.dir * i * T * 0.3;
            if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py);
          }
          ctx.stroke();
        }
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }

  RR.Zone = Zone;
})(window.RR);
