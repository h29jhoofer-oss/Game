// Battlefield renderer: pre-renders the themed arena, then draws entities sorted by depth,
// projectiles, spell zones, effects, health bars and the drag-to-deploy preview.
(function (RR) {
  'use strict';
  const U = RR.U, M = RR.Map, S = RR.Sprites;
  const ASPECT = 0.8; // vertical squash for a 3/4 perspective feel
  const US = 1.3; // troop sprite scale (sprites are authored ~1.3 tiles tall)

  class Renderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.bg = null;
      this.theme = RR.Arenas.list[0].theme;
      this.preview = null;
      this.t = 0;
      this.V = { T: 20, TY: 16, ox: 0, oy: 0, sx: (x) => 0, sy: (y) => 0 };
    }

    setArena(arena) { this.arena = arena; this.theme = arena.theme; this.bg = null; }

    resize() {
      const cv = this.canvas;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const r = cv.getBoundingClientRect();
      const w = Math.max(50, Math.round(r.width * dpr)), h = Math.max(50, Math.round(r.height * dpr));
      if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; this.bg = null; }
      this.dpr = dpr;
      let T = Math.min(w / 18.4, h / (32 * ASPECT + 2.2));
      if (this.fixedView) T = w / this.fixedView.tiles;
      const TY = T * ASPECT;
      const ox = (w - 18 * T) / 2;
      const oy = this.fixedView ? h / 2 - this.fixedView.cy * TY : (h - 32 * TY) / 2 + TY * 0.7;
      const V = this.V;
      V.T = T; V.TY = TY; V.ox = ox; V.oy = oy; V.w = w; V.h = h; V.dpr = dpr;
      V.sx = (x) => V.ox + x * V.T;
      V.sy = (y) => V.oy + y * V.TY;
    }

    toWorld(clientX, clientY) {
      const r = this.canvas.getBoundingClientRect();
      const px = (clientX - r.left) * this.dpr, py = (clientY - r.top) * this.dpr;
      return [(px - this.V.ox) / this.V.T, (py - this.V.oy) / this.V.TY];
    }

    // ------------------------------------------------------------ backdrop
    buildBackground() {
      const V = this.V, th = this.theme;
      const cv = document.createElement('canvas');
      cv.width = V.w; cv.height = V.h;
      const g = cv.getContext('2d');
      const T = V.T, TY = V.TY;
      const sx = V.sx, sy = V.sy;
      const rnd = U.seeded(1234 + (this.arena ? this.arena.id * 77 : 0));
      // surroundings
      const sky = g.createLinearGradient(0, 0, 0, V.h);
      sky.addColorStop(0, U.shade(th.border, -0.15)); sky.addColorStop(0.5, th.border); sky.addColorStop(1, U.shade(th.border, -0.2));
      g.fillStyle = sky; g.fillRect(0, 0, V.w, V.h);
      // texture speckles outside
      for (let i = 0; i < 500; i++) {
        g.fillStyle = U.rgba(i % 2 ? '#ffffff' : '#000000', 0.05);
        g.beginPath(); g.arc(rnd() * V.w, rnd() * V.h, rnd() * T * 0.3, 0, 7); g.fill();
      }
      // arena slab shadow + border wall
      g.fillStyle = 'rgba(0,0,0,0.35)';
      this.roundRect(g, sx(-0.35), sy(-0.35) + TY * 0.35, 18.7 * T, 32.7 * TY, T * 0.6); g.fill();
      g.fillStyle = U.shade(th.grassEdge, -0.25);
      this.roundRect(g, sx(-0.35), sy(-0.35), 18.7 * T, 32.7 * TY, T * 0.6); g.fill();
      // checker grass
      for (let ty = 0; ty < 32; ty++) {
        for (let tx = 0; tx < 18; tx++) {
          g.fillStyle = (tx + ty) % 2 ? th.grassA : th.grassB;
          g.fillRect(Math.floor(sx(tx)), Math.floor(sy(ty)), Math.ceil(T) + 1, Math.ceil(TY) + 1);
        }
      }
      // soft lighting
      const lg = g.createRadialGradient(sx(9), sy(16), T * 2, sx(9), sy(16), T * 20);
      lg.addColorStop(0, 'rgba(255,255,230,0.12)'); lg.addColorStop(1, 'rgba(0,0,0,0.18)');
      g.fillStyle = lg; g.fillRect(sx(0), sy(0), 18 * T, 32 * TY);
      // grass tufts / texture
      for (let i = 0; i < 420; i++) {
        const x = rnd() * 18, y = rnd() * 32;
        if (M.inRiverBand(y)) continue;
        g.strokeStyle = U.rgba(U.shade(th.grassA, rnd() > 0.5 ? 0.25 : -0.25), 0.55);
        g.lineWidth = Math.max(1, T * 0.05);
        const bx = sx(x), by = sy(y);
        g.beginPath(); g.moveTo(bx, by); g.lineTo(bx - T * 0.08, by - T * 0.18); g.moveTo(bx, by); g.lineTo(bx + T * 0.06, by - T * 0.2); g.stroke();
      }
      // dirt paths (lanes)
      const pathRect = (x, y, w, h) => {
        g.fillStyle = th.pathEdge; this.roundRect(g, sx(x) - T * 0.08, sy(y) - TY * 0.08, w * T + T * 0.16, h * TY + TY * 0.16, T * 0.5); g.fill();
        g.fillStyle = th.path; this.roundRect(g, sx(x), sy(y), w * T, h * TY, T * 0.45); g.fill();
      };
      for (const bx of M.BRIDGES) {
        pathRect(bx - 0.8, 6.5, 1.6, 8.6);
        pathRect(bx - 0.8, 16.9, 1.6, 8.6);
      }
      pathRect(3.5 - 0.8, 2.2, 11 + 1.6, 1.4);
      pathRect(3.5 - 0.8, 28.4, 11 + 1.6, 1.4);
      pathRect(3.5 - 0.8, 2.2, 1.6, 5);
      pathRect(14.5 - 0.8, 2.2, 1.6, 5);
      pathRect(3.5 - 0.8, 25, 1.6, 4.8);
      pathRect(14.5 - 0.8, 25, 1.6, 4.8);
      // pebbles on paths
      for (let i = 0; i < 120; i++) {
        const lane = rnd() > 0.5 ? 3.5 : 14.5;
        const x = lane + (rnd() - 0.5) * 1.4, y = 6 + rnd() * 20;
        if (M.inRiverBand(y)) continue;
        g.fillStyle = U.rgba(th.pathEdge, 0.6);
        g.beginPath(); g.ellipse(sx(x), sy(y), T * 0.07, TY * 0.05, 0, 0, 7); g.fill();
      }
      // tower plazas
      for (let team = 0; team < 2; team++) for (const t of M.TOWERS[team]) {
        const r = t.kind === 'king' ? 2.3 : 1.8;
        g.fillStyle = 'rgba(0,0,0,0.18)';
        this.roundRect(g, sx(t.x - r), sy(t.y - r) + TY * 0.15, r * 2 * T, r * 2 * TY, T * 0.5); g.fill();
        g.fillStyle = '#a7a39b';
        this.roundRect(g, sx(t.x - r), sy(t.y - r), r * 2 * T, r * 2 * TY, T * 0.5); g.fill();
        g.strokeStyle = 'rgba(60,50,40,0.35)'; g.lineWidth = Math.max(1, T * 0.04);
        for (let i = 1; i < r * 2; i++) {
          g.beginPath(); g.moveTo(sx(t.x - r + i), sy(t.y - r)); g.lineTo(sx(t.x - r + i), sy(t.y + r)); g.stroke();
          g.beginPath(); g.moveTo(sx(t.x - r), sy(t.y - r + i)); g.lineTo(sx(t.x + r), sy(t.y - r + i)); g.stroke();
        }
        g.strokeStyle = S.TEAM[team].dark; g.lineWidth = T * 0.1;
        this.roundRect(g, sx(t.x - r), sy(t.y - r), r * 2 * T, r * 2 * TY, T * 0.5); g.stroke();
      }
      // river
      const ry = sy(M.RIVER_TOP), rh = 2 * TY;
      g.fillStyle = th.bank; g.fillRect(sx(-0.35), ry - TY * 0.2, 18.7 * T, rh + TY * 0.4);
      const wg = g.createLinearGradient(0, ry, 0, ry + rh);
      wg.addColorStop(0, th.waterDeep); wg.addColorStop(0.5, th.water); wg.addColorStop(1, th.waterDeep);
      g.fillStyle = wg; g.fillRect(sx(-0.35), ry, 18.7 * T, rh);
      // bank stones
      for (let i = 0; i < 70; i++) {
        const x = rnd() * 18.4 - 0.2;
        const top = rnd() > 0.5;
        g.fillStyle = U.shade(th.bank, (rnd() - 0.5) * 0.4);
        g.beginPath(); g.ellipse(sx(x), top ? ry - TY * 0.05 : ry + rh + TY * 0.05, T * (0.12 + rnd() * 0.12), TY * 0.1, 0, 0, 7); g.fill();
      }
      // bridges
      for (const bx of M.BRIDGES) {
        const x0 = sx(bx - 1.05), w = 2.1 * T, y0 = ry - TY * 0.45, h = rh + TY * 0.9;
        g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(x0 + T * 0.1, y0 + TY * 0.2, w, h);
        g.fillStyle = th.bridge; this.roundRect(g, x0, y0, w, h, T * 0.15); g.fill();
        g.strokeStyle = U.shade(th.bridge, -0.35); g.lineWidth = Math.max(1, T * 0.05);
        for (let p = 1; p < 9; p++) { const yy = y0 + (p / 9) * h; g.beginPath(); g.moveTo(x0, yy); g.lineTo(x0 + w, yy); g.stroke(); }
        g.fillStyle = U.shade(th.bridge, -0.3);
        g.fillRect(x0 - T * 0.08, y0, T * 0.16, h); g.fillRect(x0 + w - T * 0.08, y0, T * 0.16, h);
        for (const px of [x0, x0 + w]) for (let p = 0; p < 4; p++) {
          g.fillStyle = U.shade(th.bridge, -0.45);
          g.beginPath(); g.arc(px, y0 + (p / 3) * h, T * 0.13, 0, 7); g.fill();
        }
      }
      // decorations inside arena edges (flowers, rocks)
      for (let i = 0; i < 90; i++) {
        const x = rnd() < 0.5 ? rnd() * 1.6 : 18 - rnd() * 1.6;
        const y = rnd() * 32;
        if (M.inRiverBand(y) || (y > 14 && y < 18)) continue;
        if (rnd() < 0.6) {
          const c = th.flower[Math.floor(rnd() * th.flower.length)];
          g.fillStyle = c;
          for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(sx(x) + Math.cos(k * 1.57) * T * 0.07, sy(y) + Math.sin(k * 1.57) * T * 0.07, T * 0.06, 0, 7); g.fill(); }
          g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(sx(x), sy(y), T * 0.04, 0, 7); g.fill();
        } else {
          g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(sx(x), sy(y) + TY * 0.08, T * 0.22, TY * 0.1, 0, 0, 7); g.fill();
          g.fillStyle = U.shade('#9aa1ad', (rnd() - 0.5) * 0.3); g.beginPath(); g.ellipse(sx(x), sy(y), T * 0.2, TY * 0.16, 0, 0, 7); g.fill();
        }
      }
      // surrounding trees / scenery outside the arena
      const deco = th.deco;
      const trees = [];
      for (let i = 0; i < 140; i++) {
        const side = rnd();
        let x, y;
        if (side < 0.35) { x = -0.6 - rnd() * 4; y = rnd() * 33 - 0.5; }
        else if (side < 0.7) { x = 18.6 + rnd() * 4; y = rnd() * 33 - 0.5; }
        else if (side < 0.85) { x = rnd() * 18; y = -0.8 - rnd() * 3; }
        else { x = rnd() * 18; y = 32.8 + rnd() * 3; }
        trees.push([x, y, 0.6 + rnd() * 0.6, rnd()]);
      }
      trees.sort((a, b) => a[1] - b[1]);
      for (const [x, y, s, r] of trees) {
        const px = sx(x), py = sy(y);
        if (px < -T * 2 || px > V.w + T * 2 || py < -T * 3 || py > V.h + T * 2) continue;
        this.drawScenery(g, deco, px, py, T * s, r, th);
      }
      // midline markers
      g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = Math.max(1, T * 0.05);
      g.setLineDash([T * 0.3, T * 0.3]);
      g.beginPath(); g.moveTo(sx(0), sy(17.05)); g.lineTo(sx(18), sy(17.05)); g.stroke();
      g.beginPath(); g.moveTo(sx(0), sy(14.95)); g.lineTo(sx(18), sy(14.95)); g.stroke();
      g.setLineDash([]);
      this.bg = cv;
    }

    drawScenery(g, deco, px, py, s, r, th) {
      g.save(); g.translate(px, py);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.ellipse(0, 0, s * 0.7, s * 0.25, 0, 0, 7); g.fill();
      const OL = '#1c1a2b';
      const outline = () => { g.strokeStyle = OL; g.lineWidth = Math.max(1, s * 0.05); g.stroke(); };
      if (deco === 'snow' || (deco === 'forest' && r < 0.5)) {
        // pine
        g.fillStyle = '#6b4a2a'; g.fillRect(-s * 0.08, -s * 0.4, s * 0.16, s * 0.4);
        for (let i = 0; i < 3; i++) {
          g.beginPath(); g.moveTo(-s * (0.6 - i * 0.12), -s * (0.3 + i * 0.45)); g.lineTo(0, -s * (1.0 + i * 0.45)); g.lineTo(s * (0.6 - i * 0.12), -s * (0.3 + i * 0.45)); g.closePath();
          g.fillStyle = th.trees[i % th.trees.length]; g.fill(); outline();
          if (deco === 'snow') { g.beginPath(); g.moveTo(-s * (0.3 - i * 0.06), -s * (0.7 + i * 0.45)); g.lineTo(0, -s * (1.0 + i * 0.45)); g.lineTo(s * (0.3 - i * 0.06), -s * (0.7 + i * 0.45)); g.closePath(); g.fillStyle = '#ffffff'; g.fill(); }
        }
      } else if (deco === 'canyon') {
        if (r < 0.6) {
          g.beginPath(); g.moveTo(-s * 0.6, 0); g.lineTo(-s * 0.4, -s * 0.9); g.lineTo(s * 0.1, -s * 1.2); g.lineTo(s * 0.55, -s * 0.6); g.lineTo(s * 0.6, 0); g.closePath();
          g.fillStyle = r < 0.3 ? '#a0522d' : '#8b4a2a'; g.fill(); outline();
          g.fillStyle = 'rgba(255,200,150,0.25)'; g.beginPath(); g.moveTo(-s * 0.4, -s * 0.9); g.lineTo(s * 0.1, -s * 1.2); g.lineTo(0, -s * 0.5); g.closePath(); g.fill();
        } else {
          g.fillStyle = '#5f9a3a'; g.beginPath(); g.roundRect ? g.roundRect(-s * 0.12, -s * 1.0, s * 0.24, s, s * 0.12) : g.rect(-s * 0.12, -s, s * 0.24, s); g.fill(); outline();
          g.beginPath(); g.roundRect ? g.roundRect(-s * 0.4, -s * 0.7, s * 0.16, s * 0.35, s * 0.08) : g.rect(-s * 0.4, -s * 0.7, s * 0.16, s * 0.35); g.fill(); outline();
        }
      } else if (deco === 'sky') {
        g.fillStyle = '#ffffff';
        for (let i = 0; i < 4; i++) { g.beginPath(); g.arc((i - 1.5) * s * 0.35, -s * 0.3 - (i % 2) * s * 0.15, s * 0.38, 0, 7); g.fill(); }
        if (r < 0.4) {
          g.fillStyle = '#5fb48a'; g.beginPath(); g.arc(0, -s * 0.9, s * 0.45, 0, 7); g.fill(); outline();
          g.fillStyle = '#8a6a4a'; g.fillRect(-s * 0.06, -s * 0.6, s * 0.12, s * 0.3);
        }
      } else {
        // round leafy tree / bush
        if (r < 0.3) {
          g.fillStyle = th.trees[1]; g.beginPath(); g.arc(-s * 0.2, -s * 0.2, s * 0.32, 0, 7); g.arc(s * 0.2, -s * 0.22, s * 0.3, 0, 7); g.fill(); outline();
          if (deco !== 'royal') { g.fillStyle = th.flower[0]; g.beginPath(); g.arc(0, -s * 0.35, s * 0.06, 0, 7); g.fill(); }
        } else {
          g.fillStyle = '#7a4a2a'; g.fillRect(-s * 0.1, -s * 0.6, s * 0.2, s * 0.6);
          g.strokeStyle = OL; g.lineWidth = Math.max(1, s * 0.04); g.strokeRect(-s * 0.1, -s * 0.6, s * 0.2, s * 0.6);
          g.fillStyle = th.trees[Math.floor(r * 3) % 3];
          g.beginPath(); g.arc(0, -s * 1.0, s * 0.55, 0, 7); g.arc(-s * 0.35, -s * 0.75, s * 0.38, 0, 7); g.arc(s * 0.35, -s * 0.78, s * 0.38, 0, 7); g.fill(); outline();
          g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(-s * 0.15, -s * 1.15, s * 0.22, 0, 7); g.fill();
          if (deco === 'royal' && r > 0.8) { g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(s * 0.2, -s * 0.9, s * 0.07, 0, 7); g.fill(); }
        }
      }
      g.restore();
    }

    roundRect(g, x, y, w, h, r) {
      g.beginPath();
      g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
    }

    // ------------------------------------------------------------ frame
    render(B, dt) {
      this.t += dt;
      this.resize();
      if (!this.bg) this.buildBackground();
      const ctx = this.ctx, V = this.V, T = V.T;
      const shake = B.fx.shake;
      const ox0 = V.ox, oy0 = V.oy;
      if (shake > 0) { V.ox += (Math.random() - 0.5) * shake * T * 0.8; V.oy += (Math.random() - 0.5) * shake * T * 0.8; }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.drawImage(this.bg, V.ox - ox0, V.oy - oy0);
      this.drawWater(ctx, V);
      this.drawDeployOverlay(ctx, V, B);
      // ground layers
      for (const z of B.zones) z.drawGround(ctx, V);
      B.fx.drawGround(ctx, V);
      // shadows + team rings
      for (const e of B.entities) this.drawShadow(ctx, V, e);
      // depth sorted ground objects
      const list = [];
      for (const t of B.towers[0]) list.push(t);
      for (const t of B.towers[1]) list.push(t);
      for (const e of B.entities) if (!e.flying) list.push(e);
      list.sort((a, b) => a.y - b.y);
      for (const e of list) this.drawEntity(ctx, V, e, B);
      // beams
      for (const e of B.entities) if (e.card.ramp && e.target && !e.target.dead && !e.deploying && e.stun <= 0) this.drawBeam(ctx, V, e);
      // flying
      const air = B.entities.filter((e) => e.flying).sort((a, b) => a.y - b.y);
      for (const e of air) this.drawEntity(ctx, V, e, B);
      // projectiles
      for (const p of B.projectiles) this.drawProjectile(ctx, V, p);
      for (const z of B.zones) z.drawAir(ctx, V);
      B.fx.draw(ctx, V);
      // health bars on top
      for (const e of list) this.drawBars(ctx, V, e, B);
      for (const e of air) this.drawBars(ctx, V, e, B);
      this.drawPreview(ctx, V, B);
      V.ox = ox0; V.oy = oy0;
    }

    drawWater(ctx, V) {
      const T = V.T, TY = V.TY, th = this.theme;
      const ry = V.sy(M.RIVER_TOP);
      ctx.save();
      ctx.beginPath(); ctx.rect(V.sx(-0.35), ry, 18.7 * T, 2 * TY);
      for (const bx of M.BRIDGES) ctx.rect(V.sx(bx - 1.1), ry - TY, 2.2 * T, 4 * TY);
      ctx.clip('evenodd');
      ctx.strokeStyle = th.lava ? 'rgba(255,230,120,0.5)' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = Math.max(1, T * 0.06);
      for (let i = 0; i < 9; i++) {
        const yy = ry + ((i * 0.23 + 0.1) % 1) * 2 * TY;
        const off = ((this.t * (th.lava ? 0.3 : 0.8) + i * 0.37) % 1) * 4 * T;
        ctx.beginPath();
        for (let x = -4; x < 19; x += 4) {
          const px = V.sx(x) + off + (i % 2) * T * 1.5;
          ctx.moveTo(px, yy); ctx.quadraticCurveTo(px + T * 0.5, yy - TY * 0.12, px + T, yy);
        }
        ctx.stroke();
      }
      if (th.lava && Math.random() < 0.08) {
        // occasional lava bubble handled cheaply
      }
      ctx.restore();
    }

    drawDeployOverlay(ctx, V, B) {
      const p = this.preview;
      if (!p || !p.card || p.card.type === 'spell') return;
      const T = V.T, TY = V.TY;
      ctx.fillStyle = 'rgba(255,40,40,0.13)';
      for (let ty = 0; ty < 32; ty++) {
        for (let tx = 0; tx < 18; tx++) {
          if (!M.canDeploy(B, 0, p.card, tx + 0.5, ty + 0.5)) ctx.fillRect(V.sx(tx) + 1, V.sy(ty) + 1, T - 2, TY - 2);
        }
      }
    }

    drawShadow(ctx, V, e) {
      if (e.card.trap) return;
      const T = V.T;
      const sx = V.sx(e.x), sy = V.sy(e.y);
      const r = e.radius * (e.kind === 'building' ? 1.0 : 1.05);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.ellipse(sx, sy, r * T, r * T * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      if (e.kind === 'troop' && !e.burrow && !e.flying) {
        ctx.strokeStyle = U.rgba(S.TEAM[e.team].main, 0.65); ctx.lineWidth = Math.max(1, T * 0.06);
        ctx.beginPath(); ctx.ellipse(sx, sy, r * T * 0.9, r * T * 0.4, 0, 0, Math.PI * 2); ctx.stroke();
      }
      if (e.flying) {
        ctx.strokeStyle = U.rgba(S.TEAM[e.team].main, 0.45); ctx.lineWidth = Math.max(1, T * 0.05);
        ctx.beginPath(); ctx.ellipse(sx, sy, r * T * 0.7, r * T * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
      }
    }

    drawEntity(ctx, V, e, B) {
      const T = V.T;
      const sx = V.sx(e.x), sy = V.sy(e.y);
      if (e.kind === 'tower') {
        ctx.save(); ctx.translate(sx, sy); ctx.scale(T, T);
        S.drawTower(ctx, e.towerKind, {
          t: e.t, walk: 0, moving: false, atk: e.atkAnim, face: e.face, team: e.team, flash: e.flash * 0.6,
          hpPct: e.hp / e.maxHp, destroyed: e.dead, active: e.active, aim: e.aim, seed: e.seed,
        });
        ctx.restore();
        if (!e.dead && e.hp / e.maxHp < 0.3 && Math.random() < 0.12) B.fx.add({ type: 'smoke', x: e.x + U.rand(-0.8, 0.8), y: e.y, z: 2.5, vz: 1.2, life: 1.4, size: 0.35, color: '#4f4a55', grav: -0.3 });
        return;
      }
      if (e.burrow) {
        // moving dirt mound
        ctx.fillStyle = '#7a5a3a';
        ctx.beginPath(); ctx.ellipse(sx, sy, T * 0.45, T * 0.22, 0, Math.PI, 0); ctx.fill();
        ctx.strokeStyle = '#1c1a2b'; ctx.lineWidth = Math.max(1, T * 0.04); ctx.stroke();
        return;
      }
      const c = e.card;
      let z = 0, alpha = 1;
      if (e.kind === 'troop' && e.deployTimer > 0 && e.deployTotal > 0.2) {
        const p = e.deployTimer / e.deployTotal;
        if (p > 0.6) { const k = (p - 0.6) / 0.4; z = k * k * 3.5; alpha = 1 - k * 0.6; }
      }
      if (e.flying) z += 1.3 + Math.sin(e.t * 3 + e.seed) * 0.08;
      if (c.jumpsRiver && M.inRiverBand(e.y)) {
        const k = (e.y - M.RIVER_TOP) / (M.RIVER_BOT - M.RIVER_TOP);
        z += Math.sin(k * Math.PI) * 1.2;
      }
      let vis = 1;
      if (c.trap) vis = e.team === 0 ? 0.85 : 0.12;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(sx, sy - z * T);
      const s = T * (c.size || 1) * (e.kind === 'troop' ? US : 1);
      ctx.scale(s, s);
      const a = {
        t: e.t, walk: e.walk, moving: e.moving && e.stun <= 0, atk: e.atkAnim, face: e.face, team: e.team, flash: e.flash, seed: e.seed,
        aim: e.aim, extra: { charging: e.charging, heat: c.ramp ? Math.min(1, e.rampT / 4) : 0, visible: vis, spawnAnim: e.spawnAnim, fill: c.elixirGen ? 1 - e.genTimer / c.elixirGen.interval : 0 },
      };
      if (e.kind === 'building') {
        if (e.deployTimer > 0) ctx.globalAlpha = 0.5 + 0.5 * (1 - e.deployTimer / e.deployTotal);
        S.drawBuilding(ctx, c.sprite, a);
      } else S.drawTroop(ctx, c.sprite, a);
      ctx.restore();
      // status overlays
      if (e.stun > 0) {
        for (let i = 0; i < 3; i++) {
          const ang = e.t * 6 + i * 2.1;
          ctx.fillStyle = '#ffe14d';
          ctx.beginPath(); ctx.arc(sx + Math.cos(ang) * T * 0.35, sy - (z + 1.4 * US * (c.size || 1)) * T + Math.sin(ang) * T * 0.1, T * 0.07, 0, 7); ctx.fill();
        }
      }
      if (e.slowMul < 1) {
        ctx.fillStyle = 'rgba(150,220,255,0.35)';
        ctx.beginPath(); ctx.ellipse(sx, sy - z * T - T * 0.65 * (c.size || 1), T * 0.6 * (c.size || 1), T * 0.75 * (c.size || 1), 0, 0, 7); ctx.fill();
      }
      if (e.buffMul > 1 && Math.random() < 0.15) B.fx.add({ type: 'fire', x: e.x + U.rand(-0.3, 0.3), y: e.y, z: z + 0.2, vz: 1.5, life: 0.4, size: 0.08, color: '#ff7a3d', grav: 0 });
    }

    drawBeam(ctx, V, e) {
      const T = V.T;
      const tg = e.target;
      const x1 = V.sx(e.x), y1 = V.sy(e.y) - 2.15 * T * (e.card.size || 1) * 0.9;
      const x2 = V.sx(tg.x), y2 = V.sy(tg.y) - (tg.flying ? 1.6 : tg.kind === 'tower' ? 1.8 : 0.6) * T;
      const stage = e.rampT < e.card.rampTime[0] ? 0 : e.rampT < e.card.rampTime[1] ? 1 : 2;
      const w = T * (0.08 + stage * 0.08);
      ctx.lineCap = 'round';
      ctx.strokeStyle = stage === 2 ? 'rgba(255,60,30,0.6)' : 'rgba(255,150,40,0.5)'; ctx.lineWidth = w * 2.2;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.strokeStyle = '#fff1b0'; ctx.lineWidth = w * 0.7 * (0.8 + Math.random() * 0.4);
      ctx.stroke();
    }

    drawProjectile(ctx, V, p) {
      const T = V.T;
      const x = V.sx(p.x), y = V.sy(p.y) - p.z * T;
      const last = p.trail[p.trail.length - 2] || [p.sx, p.sy, p.sz];
      const lx = V.sx(last[0]), ly = V.sy(last[1]) - last[2] * T;
      const ang = Math.atan2(y - ly, x - lx);
      // ground shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(V.sx(p.x), V.sy(p.y), T * 0.12, T * 0.06, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(x, y);
      switch (p.type) {
        case 'arrow': case 'bolt': {
          ctx.rotate(ang);
          const L = p.type === 'bolt' ? T * 0.9 : T * 0.6;
          ctx.strokeStyle = '#1c1a2b'; ctx.lineWidth = T * 0.09; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(-L, 0); ctx.lineTo(0, 0); ctx.stroke();
          ctx.strokeStyle = p.type === 'bolt' ? '#5a3a22' : '#c8a46a'; ctx.lineWidth = T * 0.045; ctx.stroke();
          ctx.fillStyle = '#e8eef5'; ctx.beginPath(); ctx.moveTo(T * 0.15, 0); ctx.lineTo(-T * 0.05, -T * 0.07); ctx.lineTo(-T * 0.05, T * 0.07); ctx.closePath(); ctx.fill();
          ctx.fillStyle = S.TEAM[p.team].main; ctx.fillRect(-L, -T * 0.06, T * 0.15, T * 0.12);
          break;
        }
        case 'cannonball': case 'bomb': case 'dropbomb': {
          const r = T * (p.type === 'cannonball' ? 0.14 : 0.17);
          ctx.fillStyle = '#2c2838'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
          ctx.strokeStyle = '#1c1a2b'; ctx.lineWidth = Math.max(1, T * 0.03); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.35, r * 0.3, 0, 7); ctx.fill();
          if (p.type !== 'cannonball') { ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(r * 0.7, -r * 0.9, r * 0.3 + Math.random() * r * 0.2, 0, 7); ctx.fill(); }
          break;
        }
        case 'fireball': case 'flame': {
          const r = T * (p.type === 'fireball' ? 0.28 : 0.2);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.8);
          g.addColorStop(0, '#fff6c0'); g.addColorStop(0.35, '#ffb347'); g.addColorStop(0.7, 'rgba(255,90,20,0.7)'); g.addColorStop(1, 'rgba(255,60,0,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, 7); ctx.fill();
          break;
        }
        case 'spit': {
          ctx.fillStyle = '#c08aff'; ctx.beginPath(); ctx.arc(0, 0, T * 0.1, 0, 7); ctx.fill();
          ctx.fillStyle = '#ff9af0'; ctx.beginPath(); ctx.arc(-T * 0.03, -T * 0.03, T * 0.04, 0, 7); ctx.fill();
          break;
        }
        case 'leaf': {
          ctx.rotate(p.age * 15);
          ctx.fillStyle = '#7ed957'; ctx.strokeStyle = '#2f6b2a'; ctx.lineWidth = Math.max(1, T * 0.025);
          ctx.beginPath(); ctx.ellipse(0, 0, T * 0.14, T * 0.07, 0, 0, 7); ctx.fill(); ctx.stroke();
          break;
        }
        case 'darkorb': {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, T * 0.3);
          g.addColorStop(0, '#e8ffe8'); g.addColorStop(0.4, '#3cff8a'); g.addColorStop(0.75, 'rgba(120,60,200,0.7)'); g.addColorStop(1, 'rgba(120,60,200,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, T * 0.3, 0, 7); ctx.fill();
          break;
        }
        default:
          ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, T * 0.1, 0, 7); ctx.fill();
      }
      ctx.restore();
    }

    drawBars(ctx, V, e, B) {
      if (e.dead || e.burrow) return;
      const T = V.T;
      const c = e.card;
      if (c.trap) return;
      const pct = U.clamp(e.hp / e.maxHp, 0, 1);
      const tm = S.TEAM[e.team];
      if (e.kind === 'tower') {
        const king = e.towerKind === 'king';
        const w = T * (king ? 2.6 : 2.0), h = T * 0.32;
        const x = V.sx(e.x) - w / 2;
        const y = e.team === 0 ? V.sy(e.y) + T * (king ? 0.75 : 0.45) : V.sy(e.y) - T * (king ? 3.6 : 3.7);
        this.bar(ctx, x, y, w, h, pct, tm, true);
        ctx.font = '900 ' + Math.round(T * 0.3) + 'px "Lilita One", sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = Math.max(2, T * 0.08); ctx.strokeStyle = '#1c1a2b';
        ctx.strokeText(Math.ceil(e.hp), x + w / 2, y + h / 2 + 1);
        ctx.fillStyle = '#ffffff'; ctx.fillText(Math.ceil(e.hp), x + w / 2, y + h / 2 + 1);
        // level badge
        const bx = x - T * 0.25, by = y + h / 2;
        ctx.fillStyle = tm.dark; ctx.beginPath(); ctx.arc(bx, by, T * 0.26, 0, 7); ctx.fill();
        ctx.strokeStyle = '#1c1a2b'; ctx.lineWidth = Math.max(1, T * 0.04); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.font = '900 ' + Math.round(T * 0.26) + 'px "Lilita One", sans-serif';
        ctx.fillText(king ? '♛' : e.level, bx, by + 1);
        return;
      }
      const showAlways = e.kind === 'building';
      if (pct >= 0.999 && !showAlways && e.deployTimer <= 0) return;
      const size = c.size || 1;
      let z = e.flying ? 1.3 : 0;
      const top = e.kind === 'building' ? (c.sprite === 'inferno' ? 2.9 : 2.3) * size : 1.5 * size * US + 0.1;
      const w = T * Math.max(0.8, Math.min(1.6, e.radius * 2)), h = T * 0.16;
      const x = V.sx(e.x) - w / 2, y = V.sy(e.y) - (z + top) * T;
      if (e.deployTimer > 0 && e.kind === 'troop') {
        // deploy clock
        const k = 1 - e.deployTimer / e.deployTotal;
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(V.sx(e.x), y, T * 0.18, 0, 7); ctx.fill();
        ctx.fillStyle = tm.light; ctx.beginPath(); ctx.moveTo(V.sx(e.x), y); ctx.arc(V.sx(e.x), y, T * 0.15, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.closePath(); ctx.fill();
        return;
      }
      this.bar(ctx, x, y, w, h, pct, tm, false);
    }

    bar(ctx, x, y, w, h, pct, tm, big) {
      const r = h / 2;
      ctx.fillStyle = '#1c1a2b';
      this.roundRect(ctx, x - 1.5, y - 1.5, w + 3, h + 3, r + 1.5); ctx.fill();
      ctx.fillStyle = '#3a3646';
      this.roundRect(ctx, x, y, w, h, r); ctx.fill();
      if (pct > 0) {
        ctx.fillStyle = pct < 0.3 && big ? '#ff9a3d' : tm.main;
        this.roundRect(ctx, x, y, Math.max(h, w * pct), h, r); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        this.roundRect(ctx, x + 1, y + 1, Math.max(h, w * pct) - 2, h * 0.35, r * 0.5); ctx.fill();
      }
    }

    drawPreview(ctx, V, B) {
      const p = this.preview;
      if (!p || !p.card || p.x == null) return;
      const T = V.T, c = p.card;
      const sx = V.sx(p.x), sy = V.sy(p.y);
      const valid = p.valid;
      ctx.save();
      const col = valid ? '#ffffff' : '#ff4d4d';
      if (c.type === 'spell') {
        const r = c.radius || (c.width ? c.width / 2 : 2);
        ctx.fillStyle = valid ? 'rgba(255,255,255,0.18)' : 'rgba(255,60,60,0.2)';
        ctx.strokeStyle = col; ctx.lineWidth = T * 0.08;
        if (c.id === 'gale_blast') {
          const L = c.length * V.TY;
          ctx.fillRect(sx - r * T, sy - L, r * 2 * T, L);
          ctx.strokeRect(sx - r * T, sy - L, r * 2 * T, L);
        } else {
          ctx.beginPath(); ctx.ellipse(sx, sy, r * T, r * V.TY, 0, 0, 7); ctx.fill(); ctx.stroke();
        }
      } else {
        // range ring for buildings / ranged troops
        const range = c.type === 'building' ? c.range : (c.range > 2 ? c.range : 0);
        if (range > 0) {
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = T * 0.05; ctx.setLineDash([T * 0.2, T * 0.15]);
          ctx.beginPath(); ctx.ellipse(sx, sy, (range + c.radius) * T, (range + c.radius) * V.TY, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.fillStyle = valid ? 'rgba(255,255,255,0.25)' : 'rgba(255,60,60,0.3)';
        ctx.beginPath(); ctx.ellipse(sx, sy, Math.max(0.6, c.radius) * T * 1.2, Math.max(0.6, c.radius) * V.TY * 1.2, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.6;
        const n = c.type === 'troop' ? c.count : 1;
        const offs = { 1: [[0, 0]], 2: [[-0.45, 0], [0.45, 0]], 3: [[0, -0.45], [-0.55, 0.35], [0.55, 0.35]] }[Math.min(3, n)];
        for (const [ox, oy] of offs) {
          ctx.save();
          ctx.translate(sx + ox * T, sy + oy * V.TY - (c.flying ? 1.3 * T : 0));
          const ps = T * (c.size || 1) * (c.type === 'troop' ? US : 1);
          ctx.scale(ps, ps);
          const a = { t: this.t, walk: 0, moving: false, atk: -1, face: 1, team: 0, flash: valid ? 0 : 0.4, seed: 0, extra: { visible: 1 } };
          if (c.type === 'building') S.drawBuilding(ctx, c.sprite, a); else S.drawTroop(ctx, c.sprite, a);
          ctx.restore();
        }
      }
      ctx.restore();
    }
  }

  RR.Renderer = Renderer;
})(window.RR);
