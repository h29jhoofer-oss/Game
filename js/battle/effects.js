// Visual effects: particles, shockwaves, lightning, floating damage numbers, screen shake.
// Positions are in world tiles; z is height above ground (tiles).
(function (RR) {
  'use strict';
  const U = RR.U;

  class Effects {
    constructor() { this.list = []; this.shake = 0; this.flashes = []; }
    clear() { this.list.length = 0; this.shake = 0; }

    add(p) {
      p.age = 0;
      p.life = p.life || 0.6;
      p.z = p.z || 0; p.vx = p.vx || 0; p.vy = p.vy || 0; p.vz = p.vz || 0;
      p.size = p.size || 0.15;
      this.list.push(p);
      if (this.list.length > 900) this.list.splice(0, this.list.length - 900);
      return p;
    }
    burst(type, x, y, n, o) {
      o = o || {};
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2;
        const sp = U.rand(o.speedMin || 0.5, o.speed || 3);
        this.add({
          type, x, y, z: o.z != null ? o.z + U.rand(0, o.zr || 0) : U.rand(0, 0.3),
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp * 0.7, vz: U.rand(o.vzMin || 0.5, o.vz || 3),
          life: U.rand((o.life || 0.6) * 0.6, o.life || 0.6), size: U.rand((o.size || 0.15) * 0.6, o.size || 0.15),
          color: Array.isArray(o.color) ? U.pick(o.color) : o.color, grav: o.grav == null ? 9 : o.grav,
        });
      }
    }
    text(x, y, str, color, size, z) {
      this.add({ type: 'text', x, y, z: z || 1.6, vz: 1.4, life: 0.9, str, color: color || '#ffffff', size: size || 0.5, grav: 0 });
    }
    ring(x, y, r, color, life, w) { this.add({ type: 'ring', x, y, r, color: color || '#ffffff', life: life || 0.4, w: w || 0.12, grav: 0 }); }
    flash(x, y, r, color, life) { this.add({ type: 'flash', x, y, r, color: color || '#fff6c0', life: life || 0.25, grav: 0 }); }
    bolt(x1, y1, z1, x2, y2, z2, color, life) {
      const pts = [];
      const n = 8;
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const j = i === 0 || i === n ? 0 : 0.35;
        pts.push([U.lerp(x1, x2, t) + U.rand(-j, j), U.lerp(y1, y2, t) + U.rand(-j, j) * 0.5, U.lerp(z1, z2, t)]);
      }
      this.add({ type: 'bolt', x: x2, y: y2, pts, color: color || '#bff8ff', life: life || 0.22, grav: 0 });
    }

    // ---------- canned composite effects ----------
    explosion(x, y, r, opts) {
      opts = opts || {};
      this.flash(x, y, r * 1.1, opts.flash || '#fff1b0', 0.25);
      this.ring(x, y, r, opts.ring || '#ffe2a0', 0.45, 0.18);
      this.burst('fire', x, y, Math.round(10 + r * 8), { speed: r * 3.2, vz: 3, life: 0.55, size: 0.35 * Math.max(1, r * 0.5), color: ['#ffb347', '#ff7a1a', '#ffd23f'], grav: 2 });
      this.burst('smoke', x, y, Math.round(6 + r * 4), { speed: r * 1.6, vz: 1.5, life: 1.2, size: 0.45, color: ['#6b6470', '#857e8a', '#4f4a55'], grav: -0.5 });
      this.burst('debris', x, y, Math.round(4 + r * 3), { speed: r * 2.5, vz: 5, life: 0.9, size: 0.12, color: ['#6b4a3a', '#8a6a4a', '#4a3a2a'] });
      this.shake = Math.max(this.shake, opts.shake == null ? Math.min(0.5, 0.12 + r * 0.08) : opts.shake);
    }
    dust(x, y, r) {
      this.burst('smoke', x, y, 10, { speed: 2.4 * (r || 1), vz: 0.6, life: 0.6, size: 0.35, color: ['#e8dcc0', '#d6c8a8', '#f4ecd8'], grav: 0 });
      this.ring(x, y, 1.2 * (r || 1), '#ffffff', 0.35, 0.08);
    }
    poof(x, y, flying) {
      const z = flying ? 1.4 : 0.4;
      this.burst('smoke', x, y, 8, { z, speed: 1.6, vz: 1, life: 0.6, size: 0.3, color: ['#ffffff', '#dfe6ee', '#c8d0da'], grav: -0.5 });
      this.add({ type: 'ghost', x, y, z: z + 0.4, vz: 1.2, life: 1.0, grav: 0 });
    }
    hitSpark(x, y, z, color) {
      this.burst('spark', x, y, 5, { z, speed: 2.5, vz: 2, life: 0.25, size: 0.08, color: color || ['#ffffff', '#ffe9a0'], grav: 6 });
    }

    update(dt) {
      for (let i = this.list.length - 1; i >= 0; i--) {
        const p = this.list[i];
        p.age += dt;
        if (p.age >= p.life) { this.list.splice(i, 1); continue; }
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        p.vz -= (p.grav || 0) * dt;
        if (p.z < 0 && p.type !== 'smoke') {
          p.z = 0;
          if (p.type === 'debris') { p.vz = -p.vz * 0.35; p.vx *= 0.6; p.vy *= 0.6; } else { p.vz = 0; p.vx *= 0.8; p.vy *= 0.8; }
        }
        if (p.type === 'smoke') { p.vx *= 0.96; p.vy *= 0.96; }
      }
      this.shake = Math.max(0, this.shake - dt * 1.4);
    }

    // ground layer: rings, scorch
    drawGround(ctx, V) {
      for (const p of this.list) {
        if (p.type !== 'ring') continue;
        const k = p.age / p.life;
        ctx.globalAlpha = (1 - k) * 0.85;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.w * V.T * (1 - k * 0.5);
        ctx.beginPath(); ctx.ellipse(V.sx(p.x), V.sy(p.y), p.r * V.T * (0.3 + 0.7 * U.easeOutCubic(k)), p.r * V.TY * (0.3 + 0.7 * U.easeOutCubic(k)), 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    draw(ctx, V) {
      const T = V.T;
      for (const p of this.list) {
        const k = p.age / p.life;
        const sx = V.sx(p.x), sy = V.sy(p.y) - p.z * T;
        switch (p.type) {
          case 'spark': case 'fire': {
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = p.color;
            const s = p.size * T * (p.type === 'fire' ? (1 - k * 0.6) : 1);
            ctx.beginPath(); ctx.arc(sx, sy, s, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'smoke': {
            ctx.globalAlpha = (1 - k) * 0.55;
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(sx, sy, p.size * T * (0.6 + k * 1.2), 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'debris': {
            ctx.globalAlpha = Math.min(1, (1 - k) * 2);
            ctx.fillStyle = p.color;
            ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.age * 10);
            ctx.fillRect(-p.size * T, -p.size * T, p.size * 2 * T, p.size * 2 * T);
            ctx.restore();
            break;
          }
          case 'leaf': case 'snow': case 'heal': case 'elixir': case 'note': {
            ctx.globalAlpha = 1 - k;
            ctx.fillStyle = p.color || '#fff';
            if (p.type === 'heal') {
              const s = p.size * T;
              ctx.fillRect(sx - s, sy - s * 0.3, s * 2, s * 0.6); ctx.fillRect(sx - s * 0.3, sy - s, s * 0.6, s * 2);
            } else if (p.type === 'elixir') {
              ctx.beginPath(); ctx.arc(sx, sy, p.size * T, 0, Math.PI * 2); ctx.fill();
              ctx.strokeStyle = '#5a1050'; ctx.lineWidth = 1.5; ctx.stroke();
            } else if (p.type === 'note') {
              ctx.font = 'bold ' + Math.round(p.size * T * 2.4) + 'px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('♪', sx, sy);
            } else {
              ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.age * 4);
              ctx.beginPath(); ctx.ellipse(0, 0, p.size * T, p.size * T * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            }
            break;
          }
          case 'flash': {
            ctx.globalAlpha = (1 - k) * 0.7;
            const g = ctx.createRadialGradient(sx, sy, 0, sx, sy, p.r * T);
            g.addColorStop(0, p.color); g.addColorStop(1, U.rgba(p.color.length === 7 ? p.color : '#ffffff', 0));
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.ellipse(sx, sy, p.r * T, p.r * V.TY, 0, 0, Math.PI * 2); ctx.fill();
            break;
          }
          case 'bolt': {
            ctx.globalAlpha = 1 - k;
            for (let pass = 0; pass < 2; pass++) {
              ctx.beginPath();
              p.pts.forEach((q, i) => { const x = V.sx(q[0]), y = V.sy(q[1]) - q[2] * T; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
              ctx.strokeStyle = pass ? '#ffffff' : p.color; ctx.lineWidth = pass ? T * 0.05 : T * 0.16; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
              ctx.stroke();
            }
            break;
          }
          case 'ghost': {
            ctx.globalAlpha = (1 - k) * 0.8;
            ctx.fillStyle = '#ffffff';
            const s = T * 0.28;
            ctx.beginPath(); ctx.arc(sx, sy, s, Math.PI, 0); ctx.lineTo(sx + s, sy + s);
            ctx.lineTo(sx + s * 0.33, sy + s * 0.7); ctx.lineTo(sx - s * 0.33, sy + s); ctx.lineTo(sx - s, sy + s * 0.7); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#1c1a2b';
            ctx.beginPath(); ctx.arc(sx - s * 0.35, sy - s * 0.1, s * 0.15, 0, 7); ctx.arc(sx + s * 0.35, sy - s * 0.1, s * 0.15, 0, 7); ctx.fill();
            break;
          }
          case 'text': {
            const pop = k < 0.15 ? U.easeOutBack(k / 0.15) : 1;
            ctx.globalAlpha = k > 0.6 ? (1 - k) / 0.4 : 1;
            ctx.font = '900 ' + Math.round(p.size * T * pop) + 'px "Lilita One", "Arial Black", sans-serif';
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.lineWidth = Math.max(2, T * 0.12); ctx.strokeStyle = '#1c1a2b'; ctx.strokeText(p.str, sx, sy);
            ctx.fillStyle = p.color; ctx.fillText(p.str, sx, sy);
            break;
          }
          default: break;
        }
      }
      ctx.globalAlpha = 1;
    }
  }

  RR.Effects = Effects;
})(window.RR);
