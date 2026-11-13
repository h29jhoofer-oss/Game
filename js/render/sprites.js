// Procedural cartoon sprites. Every unit, building, tower and spell icon is drawn with
// layered vector shapes + ink outlines, animated from a small "anim" state object:
//   a = { t, walk, moving, atk (0..1 swing progress or -1), face (+1/-1), team, flash (0..1), extra }
// Coordinates: 1 unit = 1 tile * sprite size; origin = point on the ground under the unit.
(function (RR) {
  'use strict';
  const U = RR.U;
  const OL = '#1c1a2b';
  const LW = 0.045;
  const TEAM = [
    { main: '#3d8bff', dark: '#1d4fb8', light: '#a8ccff', name: 'blue' },
    { main: '#ff4d4d', dark: '#a81e2a', light: '#ffb0aa', name: 'red' },
  ];
  const PI = Math.PI;

  // --------------------------------------------------------------- primitives
  function begin(ctx) { ctx.beginPath(); }
  function finish(ctx, fill, stroke, lw) {
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke !== false) { ctx.strokeStyle = stroke || OL; ctx.lineWidth = lw || LW; ctx.stroke(); }
  }
  function circ(ctx, x, y, r, fill, stroke, lw) { ctx.beginPath(); ctx.arc(x, y, r, 0, PI * 2); finish(ctx, fill, stroke, lw); }
  function ell(ctx, x, y, rx, ry, fill, stroke, lw, rot) { ctx.beginPath(); ctx.ellipse(x, y, Math.abs(rx), Math.abs(ry), rot || 0, 0, PI * 2); finish(ctx, fill, stroke, lw); }
  function rrect(ctx, x, y, w, h, r, fill, stroke, lw) {
    ctx.beginPath();
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    finish(ctx, fill, stroke, lw);
  }
  function poly(ctx, pts, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.closePath();
    finish(ctx, fill, stroke, lw);
  }
  function line(ctx, x1, y1, x2, y2, color, w) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = color; ctx.lineWidth = w; ctx.lineCap = 'round'; ctx.stroke();
  }
  // thick outlined limb
  function limb(ctx, x1, y1, x2, y2, color, w) {
    line(ctx, x1, y1, x2, y2, OL, w + LW * 2);
    line(ctx, x1, y1, x2, y2, color, w);
  }

  // colour accessor that applies hit-flash tint
  function mkC(a) { return a.flash > 0.02 ? (h) => U.mix(h, '#ffffff', Math.min(0.85, a.flash)) : (h) => h; }

  function eyes(ctx, a, x, y, o) {
    o = o || {};
    const c = a.c;
    const sp = o.spacing || 0.13, rx = o.rx || 0.052, ry = o.ry || 0.068;
    const blink = (Math.sin(a.t * 0.9 + (a.seed || 0)) > 0.985);
    for (let i = 0; i < 2; i++) {
      const ex = x + i * sp;
      if (blink) { line(ctx, ex - rx, y, ex + rx, y, OL, 0.03); continue; }
      ell(ctx, ex, y, rx, ry, c(o.white || '#ffffff'), OL, 0.025);
      circ(ctx, ex + rx * 0.35, y + 0.008, rx * 0.62, c(o.pupil || '#1c1a2b'), false);
      circ(ctx, ex + rx * 0.55, y - ry * 0.35, rx * 0.22, '#ffffff', false);
    }
    if (o.angry) {
      line(ctx, x - rx, y - ry - 0.05, x + rx + 0.01, y - ry - 0.01, OL, 0.035);
      line(ctx, x + sp - rx - 0.01, y - ry - 0.01, x + sp + rx, y - ry - 0.06, OL, 0.035);
    }
  }
  function mouth(ctx, x, y, w, kind) {
    ctx.beginPath();
    if (kind === 'grin') { ctx.arc(x, y - 0.02, w, 0.15 * PI, 0.85 * PI); ctx.strokeStyle = OL; ctx.lineWidth = 0.03; ctx.stroke(); }
    else if (kind === 'open') { ell(ctx, x, y, w * 0.6, w * 0.5, '#7a1f2b', OL, 0.025); }
    else if (kind === 'teeth') { rrect(ctx, x - w, y - 0.03, w * 2, 0.06, 0.02, '#ffffff', OL, 0.022); }
    else { ctx.moveTo(x - w, y); ctx.lineTo(x + w, y); ctx.strokeStyle = OL; ctx.lineWidth = 0.03; ctx.stroke(); }
  }

  // ------------------------------------------------------------- weapons
  // All weapons are drawn pointing "up" (-y) from the grip at the origin.
  const W = {
    sword(ctx, c, len) {
      len = len || 0.62;
      poly(ctx, [-0.05, -0.08, 0.05, -0.08, 0.045, -len, 0, -len - 0.08, -0.045, -len], c('#e8eef5'));
      line(ctx, 0, -0.1, 0, -len + 0.02, c('#b7c3d0'), 0.02);
      rrect(ctx, -0.13, -0.11, 0.26, 0.06, 0.02, c('#f2c14e'));
      rrect(ctx, -0.035, -0.06, 0.07, 0.16, 0.02, c('#7a4a2a'));
      circ(ctx, 0, 0.12, 0.04, c('#f2c14e'));
    },
    cleaver(ctx, c) {
      rrect(ctx, -0.035, -0.05, 0.07, 0.2, 0.02, c('#5a3a22'));
      poly(ctx, [-0.06, -0.06, 0.2, -0.12, 0.26, -0.95, -0.02, -0.9], c('#cfd8e0'));
      line(ctx, 0.0, -0.1, 0.02, -0.86, c('#ff8a3d'), 0.03);
      rrect(ctx, -0.12, -0.1, 0.3, 0.07, 0.02, c('#6b7380'));
    },
    axe(ctx, c, big) {
      const L = big ? 0.85 : 0.6;
      rrect(ctx, -0.035, -L, 0.07, L + 0.12, 0.03, c('#7a4a2a'));
      ctx.beginPath();
      ctx.moveTo(0.02, -L + 0.02);
      ctx.quadraticCurveTo(0.42, -L - 0.12, 0.38, -L + 0.3);
      ctx.quadraticCurveTo(0.2, -L + 0.22, 0.02, -L + 0.26);
      ctx.closePath(); finish(ctx, c('#d6dde6'));
      if (big) {
        ctx.beginPath();
        ctx.moveTo(-0.02, -L + 0.02);
        ctx.quadraticCurveTo(-0.42, -L - 0.12, -0.38, -L + 0.3);
        ctx.quadraticCurveTo(-0.2, -L + 0.22, -0.02, -L + 0.26);
        ctx.closePath(); finish(ctx, c('#d6dde6'));
      }
    },
    dagger(ctx, c) {
      poly(ctx, [-0.04, -0.05, 0.04, -0.05, 0, -0.32], c('#dfe6ee'));
      rrect(ctx, -0.08, -0.07, 0.16, 0.04, 0.015, c('#8a6a3a'));
      rrect(ctx, -0.025, -0.04, 0.05, 0.1, 0.015, c('#5a3a22'));
    },
    staff(ctx, c, top, glow) {
      rrect(ctx, -0.035, -0.95, 0.07, 1.15, 0.03, c('#8a5a2c'));
      if (top === 'skull') {
        circ(ctx, 0, -1.02, 0.12, c('#ece6d6'));
        circ(ctx, -0.04, -1.03, 0.025, c('#3cff8a'), false); circ(ctx, 0.04, -1.03, 0.025, c('#3cff8a'), false);
      } else if (top === 'antler') {
        line(ctx, 0, -0.95, -0.15, -1.15, c('#8a5a2c'), 0.05); line(ctx, 0, -0.95, 0.15, -1.18, c('#8a5a2c'), 0.05);
        line(ctx, -0.08, -1.05, -0.2, -1.05, c('#8a5a2c'), 0.04);
        circ(ctx, 0, -1.02, 0.07, c('#7dff6a'));
      } else {
        circ(ctx, 0, -1.0, 0.1, c(glow || '#7fd8ff'));
      }
      if (glow) { ctx.globalAlpha = 0.35; circ(ctx, 0, -1.0, 0.2, glow, false); ctx.globalAlpha = 1; }
    },
    lance(ctx, c, tm) {
      rrect(ctx, -0.04, -1.25, 0.08, 1.4, 0.03, c('#d9c7a0'));
      poly(ctx, [-0.08, -1.2, 0.08, -1.2, 0, -1.55], c('#e8eef5'));
      poly(ctx, [0.04, -1.1, 0.3, -1.0, 0.04, -0.9], c(tm.main));
      poly(ctx, [-0.15, -0.05, 0.15, -0.05, 0.08, -0.3, -0.08, -0.3], c('#c9d3de'));
    },
    hammer(ctx, c) {
      rrect(ctx, -0.035, -0.6, 0.07, 0.75, 0.03, c('#7a4a2a'));
      rrect(ctx, -0.17, -0.78, 0.34, 0.2, 0.05, c('#8f98a6'));
    },
    pick(ctx, c) {
      rrect(ctx, -0.03, -0.6, 0.06, 0.7, 0.03, c('#7a4a2a'));
      ctx.beginPath(); ctx.moveTo(-0.3, -0.48); ctx.quadraticCurveTo(0, -0.72, 0.3, -0.48);
      ctx.lineTo(0.28, -0.53); ctx.quadraticCurveTo(0, -0.66, -0.28, -0.53); ctx.closePath(); finish(ctx, c('#aeb7c2'));
    },
    bomb(ctx, c, t) {
      circ(ctx, 0, -0.12, 0.15, c('#3a3046'));
      circ(ctx, -0.05, -0.17, 0.04, '#ffffff', false);
      line(ctx, 0.06, -0.24, 0.12, -0.34, '#8a6a3a', 0.03);
      circ(ctx, 0.12, -0.36, 0.035 + Math.sin(t * 30) * 0.015, '#ffd23f', false);
    },
  };

  // --------------------------------------------------------- humanoid base
  // o: { skin, body, trim, pants, boots, head(fn), weapon(fn|null), armIdle, shield, cape, belly }
  function humanoid(ctx, a, o) {
    const c = a.c;
    const mv = a.moving;
    const bob = mv ? -Math.abs(Math.sin(a.walk)) * 0.06 : Math.sin(a.t * 3 + (a.seed || 0)) * 0.012;
    const sw = mv ? Math.sin(a.walk) : 0;
    // ---- legs
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const lx = side * 0.1 + sw * 0.1 * side;
      const lift = mv ? Math.max(0, Math.sin(a.walk + (i ? PI : 0))) * 0.07 : 0;
      rrect(ctx, lx - 0.065, -0.4 - lift, 0.13, 0.32, 0.05, c(o.pants || '#5a4636'));
      rrect(ctx, lx - 0.07, -0.12 - lift, 0.18, 0.12, 0.05, c(o.boots || '#3b2a20'));
    }
    ctx.save();
    ctx.translate(0, bob);
    if (o.cape) {
      const flutter = Math.sin(a.t * 6) * 0.04 + (mv ? 0.06 : 0);
      poly(ctx, [-0.16, -0.78, 0.1, -0.78, -0.02 - flutter, -0.22, -0.42 - flutter, -0.25], c(o.cape));
    }
    // ---- back arm
    const shX = -0.17, shY = -0.66;
    limb(ctx, shX, shY, shX - 0.06 - sw * 0.08, shY + 0.28, c(o.sleeve || o.body), 0.11);
    circ(ctx, shX - 0.06 - sw * 0.08, shY + 0.3, 0.065, c(o.skin));
    if (o.shield) o.shield(ctx, a, shX - 0.04, shY + 0.18);
    // ---- torso
    if (o.robe) {
      poly(ctx, [-0.22, -0.8, 0.22, -0.8, 0.32, -0.14, -0.32, -0.14], c(o.body));
      line(ctx, 0.0, -0.78, 0.0, -0.16, c(o.trim || U.shade(o.body, -0.25)), 0.05);
    } else {
      rrect(ctx, -0.25, -0.82, 0.5, 0.5, 0.15, c(o.body));
      rrect(ctx, -0.25, -0.44, 0.5, 0.08, 0.03, c(o.trim || '#5a3a22'));
      circ(ctx, 0.0, -0.4, 0.04, c('#f2c14e'), OL, 0.02);
    }
    if (o.belly) o.belly(ctx, a);
    // ---- head
    ctx.save();
    ctx.translate(0.03, -1.04);
    if (o.head) o.head(ctx, a);
    ctx.restore();
    // ---- front arm + weapon
    let fwd = o.armIdle == null ? 0.55 : o.armIdle;
    fwd += Math.sin(a.t * 2.5 + (a.seed || 0)) * 0.05 - sw * 0.25;
    let wTilt = 0;
    if (a.atk >= 0) {
      const p = a.atk;
      const style = o.swing || 'chop';
      if (style === 'chop') {
        if (p < 0.4) fwd = U.lerp(fwd, 2.7, U.easeOutCubic(p / 0.4));
        else if (p < 0.62) fwd = U.lerp(2.7, 0.15, (p - 0.4) / 0.22);
        else fwd = U.lerp(0.15, o.armIdle || 0.55, (p - 0.62) / 0.38);
      } else if (style === 'thrust') {
        if (p < 0.35) { fwd = U.lerp(fwd, 1.2, p / 0.35); wTilt = -0.2; }
        else if (p < 0.55) { fwd = 1.57; wTilt = 0; }
        else fwd = U.lerp(1.57, o.armIdle || 0.55, (p - 0.55) / 0.45);
      } else if (style === 'cast') {
        fwd = p < 0.5 ? U.lerp(fwd, 2.2, p / 0.5) : U.lerp(2.2, 1.3, (p - 0.5) / 0.5);
      } else if (style === 'throw') {
        fwd = p < 0.45 ? U.lerp(fwd, 3.0, p / 0.45) : U.lerp(3.0, 0.9, Math.min(1, (p - 0.45) / 0.25));
      } else if (style === 'bow') {
        fwd = 1.57;
      }
    }
    const fx = 0.17, fy = -0.66, L = 0.3;
    const hx = fx + Math.sin(fwd) * L, hy = fy + Math.cos(fwd) * L;
    limb(ctx, fx, fy, hx, hy, c(o.sleeve || o.body), 0.11);
    if (o.weapon) {
      ctx.save();
      ctx.translate(hx, hy);
      const rigid = o.rigid !== false;
      ctx.rotate(rigid ? PI / 2 - fwd + 0.35 + wTilt : (o.wAngle || 0) + wTilt);
      o.weapon(ctx, a, fwd);
      ctx.restore();
    }
    circ(ctx, hx, hy, 0.07, c(o.skin));
    ctx.restore();
  }

  // ---------------------------------------------------------------- heads
  function headBase(ctx, a, skin, r) {
    r = r || 0.29;
    circ(ctx, 0, 0, r, a.c(skin));
    ctx.globalAlpha = 0.35; circ(ctx, 0.14, 0.08, 0.05, '#ff7a8a', false); ctx.globalAlpha = 1;
  }
  const HEADS = {
    squire(ctx, a) {
      const c = a.c;
      headBase(ctx, a, '#f5c49c');
      eyes(ctx, a, 0.04, 0.02, {});
      mouth(ctx, 0.12, 0.14, 0.05, 'line');
      // steel helm + plume
      ctx.beginPath(); ctx.arc(0, -0.02, 0.31, PI * 1.02, PI * 1.98); ctx.lineTo(0.31, 0.02); ctx.lineTo(-0.31, 0.02); ctx.closePath();
      finish(ctx, c('#c5ceda'));
      rrect(ctx, 0.07, -0.08, 0.05, 0.2, 0.02, c('#9aa6b5'));
      ctx.beginPath(); ctx.moveTo(-0.05, -0.3); ctx.quadraticCurveTo(-0.3, -0.55, -0.45, -0.3);
      ctx.quadraticCurveTo(-0.25, -0.38, -0.05, -0.22); finish(ctx, c(a.tm.main));
    },
    archer(ctx, a) {
      const c = a.c;
      // hood
      circ(ctx, -0.02, -0.02, 0.33, c(a.tm.dark));
      headBase(ctx, a, '#f7cfa8', 0.25);
      eyes(ctx, a, 0.04, 0.02, { rx: 0.045, ry: 0.06 });
      mouth(ctx, 0.12, 0.13, 0.04, 'grin');
      ctx.beginPath(); ctx.arc(-0.02, -0.02, 0.33, PI * 1.05, PI * 1.85); ctx.lineTo(0.15, -0.15); ctx.quadraticCurveTo(-0.05, -0.28, -0.3, -0.05); ctx.closePath();
      finish(ctx, c(a.tm.main));
      poly(ctx, [-0.3, -0.05, -0.55, 0.15, -0.28, 0.12], c(a.tm.main));
      // hair tuft
      ctx.beginPath(); ctx.moveTo(0.0, -0.2); ctx.quadraticCurveTo(0.2, -0.22, 0.24, -0.06); ctx.quadraticCurveTo(0.12, -0.12, 0.0, -0.12); finish(ctx, c('#e2a23a'));
    },
    gremlin(ctx, a) {
      const c = a.c;
      poly(ctx, [-0.2, -0.05, -0.55, -0.25, -0.22, 0.1], c('#6fcf4a'));
      poly(ctx, [0.2, -0.05, 0.5, -0.3, 0.24, 0.08], c('#6fcf4a'));
      circ(ctx, 0, 0, 0.27, c('#7ddc55'));
      eyes(ctx, a, 0.02, -0.02, { angry: true, white: '#fff6a0', rx: 0.055, ry: 0.06 });
      mouth(ctx, 0.11, 0.13, 0.08, 'teeth');
      ctx.beginPath(); ctx.arc(0, -0.05, 0.28, PI * 1.1, PI * 1.9); ctx.closePath(); finish(ctx, c(a.tm.main));
    },
    skeleton(ctx, a) {
      const c = a.c;
      circ(ctx, 0, 0, 0.27, c('#f1ecdc'));
      rrect(ctx, -0.1, 0.12, 0.26, 0.14, 0.05, c('#f1ecdc'));
      ell(ctx, 0.05, 0.0, 0.07, 0.08, '#1c1a2b', false); ell(ctx, 0.19, 0.0, 0.06, 0.08, '#1c1a2b', false);
      circ(ctx, 0.06, 0.0, 0.025, c(a.tm.light), false); circ(ctx, 0.19, 0.0, 0.022, c(a.tm.light), false);
      for (let i = 0; i < 4; i++) line(ctx, -0.04 + i * 0.06, 0.15, -0.04 + i * 0.06, 0.24, OL, 0.015);
    },
    brute(ctx, a) {
      const c = a.c;
      headBase(ctx, a, '#e9a77c', 0.3);
      eyes(ctx, a, 0.04, -0.03, { angry: true, rx: 0.045, ry: 0.05 });
      // big beard
      ctx.beginPath(); ctx.moveTo(-0.22, 0.02); ctx.quadraticCurveTo(-0.2, 0.42, 0.1, 0.42); ctx.quadraticCurveTo(0.34, 0.38, 0.3, 0.02);
      ctx.quadraticCurveTo(0.12, 0.14, -0.22, 0.02); finish(ctx, c('#8a4a22'));
      mouth(ctx, 0.12, 0.13, 0.06, 'teeth');
      ctx.beginPath(); ctx.arc(0, -0.05, 0.3, PI * 1.15, PI * 1.85); finish(ctx, null, c('#8a4a22'), 0.05);
    },
    gnome(ctx, a) {
      const c = a.c;
      headBase(ctx, a, '#f5c49c', 0.26);
      ctx.beginPath(); ctx.moveTo(-0.15, 0.08); ctx.quadraticCurveTo(-0.05, 0.4, 0.12, 0.38); ctx.quadraticCurveTo(0.3, 0.3, 0.25, 0.08); ctx.closePath(); finish(ctx, c('#f4f1ea'));
      // goggles
      rrect(ctx, -0.26, -0.08, 0.52, 0.06, 0.02, c('#5a3a22'));
      circ(ctx, 0.04, -0.04, 0.08, c('#ffd27a')); circ(ctx, 0.2, -0.04, 0.07, c('#ffd27a'));
      circ(ctx, 0.06, -0.04, 0.035, '#1c1a2b', false); circ(ctx, 0.21, -0.04, 0.03, '#1c1a2b', false);
      circ(ctx, 0.17, 0.08, 0.06, c('#ff9a8a'));
      poly(ctx, [-0.26, -0.12, 0.26, -0.12, -0.1, -0.7], c(a.tm.main));
      circ(ctx, -0.1, -0.7, 0.05, c('#ffffff'));
    },
    steamknight(ctx, a) {
      const c = a.c;
      rrect(ctx, -0.3, -0.3, 0.6, 0.58, 0.2, c('#5d6675'));
      rrect(ctx, -0.18, -0.02, 0.44, 0.08, 0.03, '#1c1a2b');
      const g = 0.6 + Math.sin(a.t * 8) * 0.3;
      ctx.globalAlpha = g; rrect(ctx, -0.12, -0.005, 0.36, 0.05, 0.02, '#ff9b3d', false); ctx.globalAlpha = 1;
      rrect(ctx, -0.05, -0.42, 0.1, 0.16, 0.03, c('#8b95a5'));
      poly(ctx, [-0.32, -0.15, -0.46, -0.45, -0.24, -0.25], c(a.tm.main));
      for (let i = 0; i < 3; i++) circ(ctx, -0.2 + i * 0.2, 0.2, 0.025, c('#b8c2cf'), false);
    },
    berserker(ctx, a) {
      const c = a.c;
      // braids
      ctx.beginPath(); ctx.moveTo(-0.2, 0); ctx.quadraticCurveTo(-0.45, 0.35, -0.3, 0.6); finish(ctx, null, c('#e0622c'), 0.12);
      headBase(ctx, a, '#f5c49c', 0.28);
      eyes(ctx, a, 0.04, 0.02, { angry: true });
      mouth(ctx, 0.12, 0.15, 0.05, 'open');
      ctx.beginPath(); ctx.arc(0, -0.02, 0.3, PI * 1.0, PI * 2.0); ctx.closePath(); finish(ctx, c('#b8c2cf'));
      rrect(ctx, -0.31, -0.06, 0.62, 0.07, 0.02, c(a.tm.main));
      ctx.beginPath(); ctx.moveTo(-0.24, -0.2); ctx.quadraticCurveTo(-0.5, -0.35, -0.42, -0.6); ctx.quadraticCurveTo(-0.32, -0.38, -0.16, -0.28); finish(ctx, c('#f4ecd8'));
      ctx.beginPath(); ctx.moveTo(0.24, -0.2); ctx.quadraticCurveTo(0.5, -0.35, 0.42, -0.6); ctx.quadraticCurveTo(0.32, -0.38, 0.16, -0.28); finish(ctx, c('#f4ecd8'));
    },
    druid(ctx, a) {
      const c = a.c;
      circ(ctx, -0.02, -0.02, 0.33, c('#3f7d3a'));
      headBase(ctx, a, '#e8c39a', 0.25);
      eyes(ctx, a, 0.04, 0.0, { rx: 0.045, ry: 0.055 });
      ctx.beginPath(); ctx.moveTo(-0.15, 0.08); ctx.quadraticCurveTo(-0.08, 0.5, 0.1, 0.48); ctx.quadraticCurveTo(0.3, 0.36, 0.25, 0.08); ctx.closePath(); finish(ctx, c('#e9e6dc'));
      ctx.beginPath(); ctx.arc(-0.02, -0.02, 0.33, PI * 1.05, PI * 1.9); ctx.lineTo(0.12, -0.12); ctx.quadraticCurveTo(-0.08, -0.25, -0.3, -0.02); ctx.closePath(); finish(ctx, c('#3f7d3a'));
      for (let i = 0; i < 3; i++) ell(ctx, -0.2 + i * 0.15, -0.32 - (i === 1 ? 0.06 : 0), 0.07, 0.04, c(i === 1 ? a.tm.main : '#7ed957'), OL, 0.02, i - 1);
    },
    wizard(ctx, a) {
      const c = a.c;
      headBase(ctx, a, '#f2c29a', 0.27);
      eyes(ctx, a, 0.04, 0.02, { angry: true, rx: 0.045, ry: 0.055 });
      ctx.beginPath(); ctx.moveTo(-0.18, 0.08); ctx.quadraticCurveTo(-0.1, 0.42, 0.1, 0.4); ctx.quadraticCurveTo(0.3, 0.34, 0.26, 0.08); ctx.closePath(); finish(ctx, c('#d9d4ca'));
      ell(ctx, 0, -0.14, 0.42, 0.09, c(a.tm.dark));
      ctx.beginPath(); ctx.moveTo(-0.24, -0.16); ctx.quadraticCurveTo(-0.05, -0.65, -0.32, -0.85); ctx.quadraticCurveTo(0.15, -0.6, 0.24, -0.16); ctx.closePath(); finish(ctx, c(a.tm.main));
      rrect(ctx, -0.23, -0.24, 0.46, 0.08, 0.02, c('#f2c14e'));
      circ(ctx, -0.32, -0.85, 0.05, c('#ffd23f'));
    },
    necro(ctx, a) {
      const c = a.c;
      circ(ctx, -0.02, -0.02, 0.34, c('#3a2a4a'));
      circ(ctx, 0.02, 0.02, 0.24, c('#c7d4c0'));
      const gl = 0.7 + Math.sin(a.t * 5) * 0.3;
      ctx.globalAlpha = gl;
      circ(ctx, 0.06, 0.0, 0.045, '#3cff8a', false); circ(ctx, 0.19, 0.0, 0.04, '#3cff8a', false);
      ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(-0.02, -0.02, 0.34, PI * 1.0, PI * 1.92); ctx.lineTo(0.16, -0.14); ctx.quadraticCurveTo(-0.06, -0.26, -0.3, 0.05); ctx.closePath(); finish(ctx, c('#4a3560'));
      poly(ctx, [-0.05, -0.34, -0.3, -0.62, -0.25, -0.3], c('#4a3560'));
      rrect(ctx, -0.3, 0.18, 0.5, 0.06, 0.02, c(a.tm.main));
    },
    drummer(ctx, a) {
      const c = a.c;
      headBase(ctx, a, '#d99a6c', 0.28);
      eyes(ctx, a, 0.04, 0.0, {});
      mouth(ctx, 0.13, 0.14, 0.07, 'open');
      ctx.beginPath(); ctx.moveTo(-0.15, 0.1); ctx.quadraticCurveTo(0.05, 0.05, 0.3, 0.12); finish(ctx, null, c('#4a2a1a'), 0.06);
      ctx.beginPath(); ctx.arc(0, -0.04, 0.3, PI * 1.05, PI * 1.95); ctx.closePath(); finish(ctx, c(a.tm.main));
      poly(ctx, [-0.05, -0.3, 0.05, -0.62, 0.12, -0.3], c('#ffd23f'));
    },
    storm(ctx, a) {
      const c = a.c;
      // floating hair crackling
      ctx.beginPath(); ctx.moveTo(-0.28, 0.05);
      for (let i = 0; i < 7; i++) ctx.lineTo(-0.3 + i * 0.1, -0.35 - ((i % 2) ? 0.18 : 0) - Math.sin(a.t * 10 + i) * 0.04);
      ctx.lineTo(0.3, 0.05); ctx.closePath(); finish(ctx, c('#f0f6ff'));
      headBase(ctx, a, '#cfe0ff', 0.26);
      ctx.globalAlpha = 0.8 + Math.sin(a.t * 12) * 0.2;
      ell(ctx, 0.06, 0.0, 0.05, 0.05, '#7ff6ff', false); ell(ctx, 0.19, 0.0, 0.045, 0.05, '#7ff6ff', false);
      ctx.globalAlpha = 1;
      mouth(ctx, 0.13, 0.13, 0.04, 'line');
      rrect(ctx, -0.27, -0.14, 0.54, 0.07, 0.02, c(a.tm.main));
      circ(ctx, 0, -0.11, 0.05, c('#7ff6ff'));
    },
    mole(ctx, a) {
      const c = a.c;
      circ(ctx, 0, 0.02, 0.3, c('#7a5a4a'));
      ell(ctx, 0.25, 0.08, 0.12, 0.09, c('#e8a0a8'));
      circ(ctx, 0.34, 0.06, 0.04, c('#c46a7a'), false);
      eyes(ctx, a, 0.02, -0.04, { rx: 0.03, ry: 0.035, spacing: 0.12 });
      rrect(ctx, 0.12, 0.16, 0.08, 0.08, 0.02, '#ffffff');
      // mining helmet + lamp
      ctx.beginPath(); ctx.arc(0, -0.05, 0.31, PI * 1.05, PI * 1.95); ctx.closePath(); finish(ctx, c('#f2c14e'));
      rrect(ctx, -0.33, -0.1, 0.66, 0.07, 0.02, c(a.tm.main));
      circ(ctx, 0.1, -0.26, 0.07, c('#fff6c0'));
      ctx.globalAlpha = 0.25; circ(ctx, 0.1, -0.26, 0.15, '#fff6a0', false); ctx.globalAlpha = 1;
    },
    king(ctx, a) {
      const c = a.c;
      headBase(ctx, a, '#f5c49c', 0.3);
      eyes(ctx, a, 0.03, 0.0, { angry: a.extra && a.extra.angry });
      ctx.beginPath(); ctx.moveTo(-0.24, 0.05); ctx.quadraticCurveTo(-0.2, 0.5, 0.06, 0.5); ctx.quadraticCurveTo(0.32, 0.44, 0.28, 0.05); ctx.quadraticCurveTo(0.05, 0.18, -0.24, 0.05); finish(ctx, c('#f1f1f1'));
      mouth(ctx, 0.08, 0.17, 0.05, 'line');
      poly(ctx, [-0.26, -0.18, -0.26, -0.48, -0.13, -0.32, 0, -0.52, 0.13, -0.32, 0.26, -0.48, 0.26, -0.18], c('#ffcf33'));
      circ(ctx, 0, -0.3, 0.045, c(a.tm.main), OL, 0.02);
    },
    paladin(ctx, a) {
      const c = a.c;
      rrect(ctx, -0.27, -0.3, 0.54, 0.56, 0.22, c('#e0e6ee'));
      rrect(ctx, 0.04, -0.12, 0.23, 0.06, 0.02, '#1c1a2b');
      rrect(ctx, 0.1, -0.12, 0.05, 0.25, 0.02, '#1c1a2b');
      ctx.beginPath(); ctx.moveTo(-0.08, -0.3); ctx.quadraticCurveTo(-0.2, -0.75, -0.55, -0.5); ctx.quadraticCurveTo(-0.3, -0.48, -0.15, -0.22); finish(ctx, c(a.tm.main));
      circ(ctx, -0.05, 0.12, 0.05, c('#f2c14e'));
    },
  };

  // --------------------------------------------------------------- troops
  const T = {};
  T.squire = (ctx, a) => humanoid(ctx, a, {
    skin: '#f5c49c', body: a.tm.main, trim: '#6b4a2a', pants: '#6b7280', boots: '#4b3a2a',
    head: HEADS.squire, weapon: (c2) => W.sword(c2, a.c), swing: 'chop',
    shield: (ctx2, a2, x, y) => {
      rrect(ctx2, x - 0.2, y - 0.25, 0.32, 0.45, 0.12, a2.c('#c5ceda'));
      rrect(ctx2, x - 0.14, y - 0.19, 0.2, 0.33, 0.08, a2.c(a2.tm.main));
      poly(ctx2, [x - 0.04, y - 0.12, x + 0.0, y + 0.05, x - 0.08, y + 0.05], a2.c('#ffd23f'), false);
    },
  });
  T.archer = (ctx, a) => humanoid(ctx, a, {
    skin: '#f7cfa8', body: '#5f8f3a', trim: '#6b4a2a', pants: '#4f5a3a', boots: '#5a3a22',
    head: HEADS.archer, swing: 'bow', armIdle: 1.1, rigid: false, wAngle: 0,
    weapon: (c2, a2, fwd) => {
      // bow drawn vertical at the hand, string pulled during attack
      const pull = a2.atk >= 0 && a2.atk < 0.6 ? a2.atk / 0.6 * 0.18 : 0;
      ctx.save();
      ctx.beginPath(); ctx.arc(-0.25, 0, 0.42, -0.95, 0.95); ctx.strokeStyle = OL; ctx.lineWidth = 0.1; ctx.stroke();
      ctx.strokeStyle = a2.c('#a8733e'); ctx.lineWidth = 0.06; ctx.stroke();
      line(ctx, -0.25 + Math.cos(-0.95) * 0.42, Math.sin(-0.95) * 0.42, -0.05 - pull, 0, '#eeeeee', 0.015);
      line(ctx, -0.25 + Math.cos(0.95) * 0.42, Math.sin(0.95) * 0.42, -0.05 - pull, 0, '#eeeeee', 0.015);
      if (a2.atk < 0 || a2.atk < 0.6) line(ctx, -0.05 - pull, 0, 0.4 - pull, 0, a2.c('#8a5a2c'), 0.03);
      ctx.restore();
    },
    quiver: true,
  });
  T.gremlin = (ctx, a) => humanoid(ctx, a, {
    skin: '#7ddc55', body: '#7ddc55', sleeve: '#7ddc55', trim: a.tm.dark, pants: '#7ddc55', boots: '#4f9a2c',
    head: HEADS.gremlin, weapon: (c2) => W.dagger(c2, a.c), swing: 'thrust',
    belly: (ctx2, a2) => { poly(ctx2, [-0.25, -0.42, 0.25, -0.42, 0.18, -0.22, -0.18, -0.22], a2.c(a2.tm.main)); },
  });
  T.skeleton = (ctx, a) => {
    const c = a.c;
    humanoid(ctx, a, {
      skin: '#f1ecdc', body: '#e8e2d0', sleeve: '#f1ecdc', trim: a.tm.main, pants: '#e8e2d0', boots: '#d6cfb8',
      head: HEADS.skeleton, weapon: (c2) => W.sword(c2, c, 0.42), swing: 'chop',
      belly: (ctx2) => { for (let i = 0; i < 3; i++) line(ctx2, -0.17, -0.74 + i * 0.1, 0.17, -0.74 + i * 0.1, OL, 0.025); },
    });
  };
  T.brute = (ctx, a) => humanoid(ctx, a, {
    skin: '#e9a77c', body: '#8a5a32', sleeve: '#e9a77c', trim: a.tm.main, pants: '#6b4a2a', boots: '#3b2a20',
    head: HEADS.brute, swing: 'chop', armIdle: 0.3,
    weapon: (c2, a2) => { circ(c2, 0, -0.03, 0.12, a2.c('#e9a77c')); },
    belly: (ctx2, a2) => {
      rrect(ctx2, -0.2, -0.8, 0.12, 0.38, 0.04, a2.c(a2.tm.main));
      rrect(ctx2, 0.08, -0.8, 0.12, 0.38, 0.04, a2.c(a2.tm.main));
    },
  });
  T.gnome = (ctx, a) => humanoid(ctx, a, {
    skin: '#f5c49c', body: '#5a7bd6', trim: '#5a3a22', pants: '#6b4a2a', boots: '#3b2a20',
    head: HEADS.gnome, swing: 'throw', armIdle: 0.8, rigid: false,
    weapon: (c2, a2) => { if (a2.atk < 0 || a2.atk < 0.55) W.bomb(c2, a2.c, a2.t); },
    belly: (ctx2, a2) => rrect(ctx2, -0.25, -0.82, 0.5, 0.22, 0.1, a2.c(a2.tm.main)),
  });
  T.steamknight = (ctx, a) => {
    humanoid(ctx, a, {
      skin: '#8b95a5', body: '#6d7686', sleeve: '#5d6675', trim: a.tm.main, pants: '#4d5563', boots: '#3a404a',
      head: HEADS.steamknight, weapon: (c2) => W.cleaver(c2, a.c), swing: 'chop',
      belly: (ctx2, a2) => {
        circ(ctx2, 0, -0.6, 0.1, a2.c('#b87333'));
        circ(ctx2, 0, -0.6, 0.05, a2.c('#ffd27a'), false);
        // exhaust pipes
        rrect(ctx2, -0.36, -0.95, 0.08, 0.3, 0.03, a2.c('#8b6a3a'));
      },
    });
    if (Math.random() < 0.03) a.extra.puff = true;
  };
  T.berserker = (ctx, a) => {
    const spin = a.atk >= 0 && a.atk < 0.5;
    if (spin) {
      // spinning blur ring
      ctx.globalAlpha = 0.35 * (1 - a.atk * 2);
      ell(ctx, 0, -0.5, 1.3, 0.55, null, '#ffffff', 0.08);
      ctx.globalAlpha = 1;
      ctx.save(); ctx.scale(Math.cos(a.atk * PI * 4) >= 0 ? 1 : -1, 1);
    }
    humanoid(ctx, a, {
      skin: '#f5c49c', body: a.tm.main, sleeve: '#f5c49c', trim: '#6b4a2a', pants: '#7a5a3a', boots: '#4a2e1c',
      head: HEADS.berserker, weapon: (c2) => W.axe(c2, a.c, true), swing: spin ? 'thrust' : 'chop', armIdle: spin ? 1.57 : 0.5,
      belly: (ctx2, a2) => { poly(ctx2, [-0.25, -0.82, -0.05, -0.82, 0.25, -0.5, 0.25, -0.38], a2.c('#e0c79a')); },
    });
    if (spin) ctx.restore();
  };
  T.druid = (ctx, a) => humanoid(ctx, a, {
    skin: '#e8c39a', body: '#4f8f45', trim: a.tm.main, pants: '#3f6f35', boots: '#4a3a22', robe: true,
    head: HEADS.druid, weapon: (c2) => W.staff(c2, a.c, 'antler', null), swing: 'cast', rigid: false, armIdle: 0.6,
  });
  T.wizard = (ctx, a) => humanoid(ctx, a, {
    skin: '#f2c29a', body: a.tm.dark, trim: '#f2c14e', pants: '#3a2a4a', boots: '#3b2a20', robe: true, sleeve: a.tm.main,
    head: HEADS.wizard, swing: 'cast', rigid: false, armIdle: 0.9,
    weapon: (c2, a2) => {
      const f = 0.12 + Math.sin(a2.t * 15) * 0.02 + (a2.atk >= 0 && a2.atk < 0.5 ? 0.06 : 0);
      ctx.globalAlpha = 0.4; circ(c2, 0, -0.12, f * 1.8, '#ffb347', false); ctx.globalAlpha = 1;
      circ(c2, 0, -0.12, f, '#ff7a1a', false); circ(c2, 0, -0.14, f * 0.55, '#ffe08a', false);
    },
  });
  T.necro = (ctx, a) => humanoid(ctx, a, {
    skin: '#c7d4c0', body: '#3a2a4a', trim: a.tm.main, pants: '#2a1f36', boots: '#1f1626', robe: true, sleeve: '#4a3560',
    head: HEADS.necro, weapon: (c2) => W.staff(c2, a.c, 'skull', '#3cff8a'), swing: 'cast', rigid: false, armIdle: 0.6,
    cape: '#2a1f36',
  });
  T.drummer = (ctx, a) => {
    const beat = Math.abs(Math.sin(a.t * 5));
    humanoid(ctx, a, {
      skin: '#d99a6c', body: '#7a3a2a', trim: '#f2c14e', pants: '#5a3a22', boots: '#3b2a20',
      head: HEADS.drummer, swing: 'chop', armIdle: 0.9 + beat * 0.8,
      weapon: (c2, a2) => { line(c2, 0, 0, 0, -0.35, a2.c('#d9c7a0'), 0.05); circ(c2, 0, -0.37, 0.05, a2.c('#f4ecd8')); },
      belly: (ctx2, a2) => {
        ell(ctx2, 0.1, -0.48, 0.28, 0.2, a2.c(a2.tm.main));
        ell(ctx2, 0.1, -0.6, 0.28, 0.08, a2.c('#f4ecd8'));
        for (let i = 0; i < 4; i++) line(ctx2, -0.12 + i * 0.15, -0.55, -0.05 + i * 0.15, -0.32, a2.c('#f2c14e'), 0.025);
      },
    });
  };
  T.storm = (ctx, a) => {
    humanoid(ctx, a, {
      skin: '#cfe0ff', body: '#2a3f8f', trim: '#7ff6ff', pants: '#1f2a5a', boots: '#1a1f3a', robe: true, sleeve: a.tm.main,
      head: HEADS.storm, swing: 'cast', rigid: false, armIdle: 1.0,
      weapon: (c2, a2) => {
        ctx.globalAlpha = 0.5 + Math.random() * 0.5;
        ctx.beginPath(); ctx.moveTo(0, 0);
        for (let i = 1; i < 5; i++) ctx.lineTo((Math.random() - 0.5) * 0.25, -i * 0.08);
        ctx.strokeStyle = '#bff8ff'; ctx.lineWidth = 0.03; ctx.stroke();
        ctx.globalAlpha = 1;
        circ(c2, 0, -0.05, 0.08, '#7ff6ff', false);
      },
    });
  };
  T.mole = (ctx, a) => humanoid(ctx, a, {
    skin: '#7a5a4a', body: '#7a5a4a', sleeve: '#7a5a4a', trim: a.tm.main, pants: '#5a3f32', boots: '#4a3228',
    head: HEADS.mole, weapon: (c2) => W.pick(c2, a.c), swing: 'chop',
    belly: (ctx2, a2) => { rrect(ctx2, -0.18, -0.8, 0.36, 0.4, 0.06, a2.c('#5a7bd6')); line(ctx2, -0.12, -0.8, -0.12, -0.95, a2.c('#5a7bd6'), 0.05); line(ctx2, 0.12, -0.8, 0.12, -0.95, a2.c('#5a7bd6'), 0.05); },
  });

  T.imp = (ctx, a) => {
    const c = a.c;
    const flap = Math.sin(a.t * 18 + (a.seed || 0));
    for (let s = -1; s <= 1; s += 2) {
      ctx.save(); ctx.translate(-0.05, -0.55); ctx.scale(s, 1); ctx.rotate(flap * 0.4 * s);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.4, -0.5, 0.75, -0.25); ctx.quadraticCurveTo(0.55, -0.15, 0.6, 0.05);
      ctx.quadraticCurveTo(0.4, -0.05, 0.38, 0.12); ctx.quadraticCurveTo(0.2, 0.0, 0, 0.05); ctx.closePath();
      finish(ctx, c(a.tm.dark));
      ctx.restore();
    }
    ctx.beginPath(); ctx.moveTo(-0.15, -0.35); ctx.quadraticCurveTo(-0.5, -0.2, -0.45, 0.05); finish(ctx, null, c('#7a3fb0'), 0.05);
    poly(ctx, [-0.45, 0.05, -0.55, -0.02, -0.48, 0.14], c('#7a3fb0'));
    ell(ctx, 0, -0.5, 0.24, 0.27, c('#9a5ae0'));
    poly(ctx, [-0.14, -0.72, -0.2, -0.95, -0.04, -0.76], c('#f4ecd8'));
    poly(ctx, [0.1, -0.74, 0.14, -0.97, 0.2, -0.72], c('#f4ecd8'));
    eyes(ctx, a, -0.02, -0.55, { angry: true, white: '#fff28a', rx: 0.05, ry: 0.055, spacing: 0.13 });
    mouth(ctx, 0.08, -0.4, 0.06, 'teeth');
    ell(ctx, 0, -0.3, 0.12, 0.06, c(a.tm.main));
  };
  T.drake = (ctx, a) => {
    const c = a.c;
    const flap = Math.sin(a.t * 9 + (a.seed || 0));
    for (let s = -1; s <= 1; s += 2) {
      ctx.save(); ctx.translate(-0.1, -0.75); ctx.scale(s, 1); ctx.rotate(-flap * 0.35 * s);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(0.5, -0.8, 1.0, -0.5);
      ctx.lineTo(0.85, -0.3); ctx.lineTo(0.9, -0.1); ctx.lineTo(0.65, -0.05); ctx.lineTo(0.6, 0.12); ctx.quadraticCurveTo(0.3, 0.05, 0, 0.12); ctx.closePath();
      finish(ctx, c(a.tm.main));
      line(ctx, 0, 0, 0.95, -0.48, c(a.tm.dark), 0.04);
      ctx.restore();
    }
    // tail
    ctx.beginPath(); ctx.moveTo(-0.3, -0.5); ctx.quadraticCurveTo(-0.75, -0.4, -0.8, -0.75); finish(ctx, null, OL, 0.18);
    ctx.beginPath(); ctx.moveTo(-0.3, -0.5); ctx.quadraticCurveTo(-0.75, -0.4, -0.8, -0.75); finish(ctx, null, c('#58b947'), 0.11);
    poly(ctx, [-0.8, -0.75, -0.95, -0.85, -0.78, -0.95, -0.7, -0.8], c(a.tm.main));
    ell(ctx, -0.05, -0.55, 0.42, 0.34, c('#58b947'));
    ell(ctx, 0.05, -0.45, 0.25, 0.2, c('#f7d774'), OL, 0.03);
    for (let i = 0; i < 3; i++) line(ctx, -0.12 + i * 0.1, -0.58, -0.08 + i * 0.1, -0.32, c('#e2b64e'), 0.02);
    // head
    ell(ctx, 0.35, -0.95, 0.3, 0.26, c('#58b947'));
    ell(ctx, 0.58, -0.88, 0.17, 0.12, c('#6ccf5a'));
    circ(ctx, 0.66, -0.92, 0.02, OL, false);
    poly(ctx, [0.2, -1.15, 0.1, -1.38, 0.3, -1.18], c('#f4ecd8'));
    poly(ctx, [0.36, -1.18, 0.4, -1.4, 0.48, -1.16], c('#f4ecd8'));
    eyes(ctx, a, 0.3, -1.0, { angry: true, rx: 0.05, ry: 0.06, spacing: 0.12, white: '#fff6a0' });
    if (a.atk >= 0 && a.atk < 0.4) { ctx.globalAlpha = 1 - a.atk * 2; circ(ctx, 0.8, -0.86, 0.12, '#ffb347', false); ctx.globalAlpha = 1; }
  };
  T.zeppelin = (ctx, a) => {
    const c = a.c;
    const sway = Math.sin(a.t * 2 + (a.seed || 0)) * 0.05;
    ctx.save(); ctx.rotate(sway);
    // ropes
    line(ctx, -0.3, -0.75, -0.2, -0.32, OL, 0.025); line(ctx, 0.3, -0.75, 0.2, -0.32, OL, 0.025);
    // basket
    rrect(ctx, -0.28, -0.35, 0.56, 0.3, 0.06, c('#a8733e'));
    for (let i = 0; i < 4; i++) line(ctx, -0.2 + i * 0.13, -0.32, -0.2 + i * 0.13, -0.08, c('#7a4a2a'), 0.02);
    // gnome pilot
    circ(ctx, 0.05, -0.42, 0.12, c('#f5c49c'));
    rrect(ctx, -0.08, -0.56, 0.26, 0.06, 0.02, c('#5a3a22'));
    circ(ctx, 0.1, -0.5, 0.04, c('#ffd27a'));
    // bomb hanging
    if (!(a.atk >= 0 && a.atk < 0.4)) { circ(ctx, 0, 0.05, 0.12, c('#3a3046')); circ(ctx, -0.04, 0.01, 0.03, '#fff', false); }
    // envelope
    ell(ctx, 0, -1.25, 0.62, 0.55, c(a.tm.main));
    ctx.save(); ctx.beginPath(); ctx.ellipse(0, -1.25, 0.62, 0.55, 0, 0, PI * 2); ctx.clip();
    for (let i = -2; i <= 2; i += 2) { ctx.beginPath(); ctx.ellipse(i * 0.15, -1.25, 0.12, 0.6, 0, 0, PI * 2); ctx.fillStyle = c('#f4ecd8'); ctx.fill(); }
    ctx.restore();
    ell(ctx, 0, -1.25, 0.62, 0.55, null);
    ell(ctx, -0.2, -1.5, 0.12, 0.07, 'rgba(255,255,255,0.6)', false);
    rrect(ctx, -0.35, -0.82, 0.7, 0.1, 0.04, c('#7a4a2a'));
    ctx.restore();
  };
  T.ramrider = (ctx, a) => {
    const c = a.c;
    const mv = a.moving;
    const gal = mv ? Math.sin(a.walk * 1.3) : 0;
    // legs
    for (let i = 0; i < 4; i++) {
      const lx = -0.4 + i * 0.25;
      const off = mv ? Math.sin(a.walk * 1.3 + i * 1.6) * 0.1 : 0;
      rrect(ctx, lx - 0.05 + off, -0.38, 0.1, 0.38, 0.04, c('#d9d2c2'));
      rrect(ctx, lx - 0.06 + off, -0.08, 0.12, 0.08, 0.03, c('#3b2a20'));
    }
    ctx.save(); ctx.translate(0, -gal * 0.04);
    // wool body
    for (let i = 0; i < 6; i++) circ(ctx, -0.45 + i * 0.18, -0.55 + (i % 2) * 0.06, 0.2, c('#f7f3ea'));
    ell(ctx, 0, -0.55, 0.55, 0.25, c('#f7f3ea'), false);
    // head
    ell(ctx, 0.58, -0.62, 0.17, 0.2, c('#c9b9a0'), OL, LW, 0.3);
    circ(ctx, 0.66, -0.66, 0.025, OL, false);
    ctx.beginPath(); ctx.arc(0.5, -0.76, 0.14, -PI * 0.9, PI * 0.5); finish(ctx, null, OL, 0.11);
    ctx.beginPath(); ctx.arc(0.5, -0.76, 0.14, -PI * 0.9, PI * 0.5); finish(ctx, null, c('#a8733e'), 0.07);
    // saddle cloth
    poly(ctx, [-0.25, -0.75, 0.2, -0.75, 0.25, -0.45, -0.3, -0.45], c(a.tm.main));
    ctx.restore();
    // rider
    ctx.save(); ctx.translate(-0.05, -0.55 - gal * 0.04); ctx.scale(0.8, 0.8);
    humanoid(ctx, Object.assign({}, a, { moving: false }), {
      skin: '#f5c49c', body: a.tm.dark, trim: '#6b4a2a', pants: '#6b4a2a', boots: '#3b2a20',
      head: HEADS.berserker, weapon: (c2) => W.hammer(c2, a.c), swing: 'chop',
    });
    ctx.restore();
  };
  T.paladin = (ctx, a) => {
    const c = a.c;
    const mv = a.moving;
    const charge = a.extra && a.extra.charging;
    const sp = charge ? 1.8 : 1.2;
    for (let i = 0; i < 4; i++) {
      const lx = -0.45 + i * 0.28;
      const off = mv ? Math.sin(a.walk * sp + i * 1.7) * 0.13 : 0;
      rrect(ctx, lx - 0.05 + off, -0.5, 0.1, 0.5, 0.04, c('#8a5a3a'));
      rrect(ctx, lx - 0.06 + off, -0.08, 0.12, 0.08, 0.03, c('#2a1f18'));
    }
    const bob = mv ? Math.sin(a.walk * sp * 2) * 0.03 : 0;
    ctx.save(); ctx.translate(0, bob);
    // tail
    ctx.beginPath(); ctx.moveTo(-0.55, -0.75); ctx.quadraticCurveTo(-0.85, -0.6, -0.75, -0.3); finish(ctx, null, c('#3a2418'), 0.1);
    ell(ctx, 0, -0.72, 0.6, 0.28, c('#9a6a46'));
    // neck & head
    poly(ctx, [0.35, -0.85, 0.55, -1.25, 0.72, -1.15, 0.6, -0.7], c('#9a6a46'));
    ell(ctx, 0.75, -1.18, 0.22, 0.12, c('#9a6a46'), OL, LW, 0.5);
    circ(ctx, 0.7, -1.24, 0.025, OL, false);
    poly(ctx, [0.5, -1.25, 0.56, -1.4, 0.62, -1.24], c('#9a6a46'));
    ctx.beginPath(); ctx.moveTo(0.45, -1.25); ctx.quadraticCurveTo(0.3, -1.0, 0.35, -0.8); finish(ctx, null, c('#3a2418'), 0.08);
    // caparison
    poly(ctx, [-0.5, -0.92, 0.4, -0.92, 0.5, -0.45, -0.55, -0.45], c(a.tm.main));
    for (let i = 0; i < 4; i++) poly(ctx, [-0.5 + i * 0.25, -0.45, -0.37 + i * 0.25, -0.33, -0.25 + i * 0.25, -0.45], c(a.tm.dark));
    circ(ctx, 0, -0.68, 0.08, c('#ffd23f'));
    ctx.restore();
    ctx.save(); ctx.translate(-0.05, -0.82 + bob); ctx.scale(0.75, 0.75);
    humanoid(ctx, Object.assign({}, a, { moving: false }), {
      skin: '#f5c49c', body: '#d6dde6', trim: a.tm.main, pants: '#9aa6b5', boots: '#6b7280',
      head: HEADS.paladin, weapon: (c2) => W.lance(c2, a.c, a.tm), swing: 'thrust', armIdle: charge ? 1.45 : 1.2, rigid: false, wAngle: charge ? 1.45 : 1.1,
    });
    ctx.restore();
    if (charge) {
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < 3; i++) line(ctx, -0.7 - i * 0.2, -0.9 + i * 0.25, -1.2 - i * 0.2, -0.9 + i * 0.25, '#ffffff', 0.04);
      ctx.globalAlpha = 1;
    }
  };
  function rockBody(ctx, a, s, seed) {
    const c = a.c;
    const rnd = U.seeded(seed);
    const mv = a.moving;
    const sw = mv ? Math.sin(a.walk) : 0;
    // legs
    rrect(ctx, -0.32 + sw * 0.08, -0.45, 0.24, 0.45, 0.08, c('#7d8591'));
    rrect(ctx, 0.08 - sw * 0.08, -0.45, 0.24, 0.45, 0.08, c('#6d7480'));
    const bob = mv ? -Math.abs(sw) * 0.04 : 0;
    ctx.save(); ctx.translate(0, bob);
    // arms
    const ap = a.atk >= 0 ? (a.atk < 0.4 ? -a.atk * 1.5 : -0.6 + (a.atk - 0.4) * 2) : 0;
    rrect(ctx, -0.65, -1.0 + ap * 0.3, 0.28, 0.7, 0.12, c('#6d7480'));
    // torso: irregular polygon
    const pts = [];
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * PI * 2;
      const r = 0.48 + rnd() * 0.08;
      pts.push(Math.cos(ang) * r, -0.85 + Math.sin(ang) * r * 0.85);
    }
    poly(ctx, pts, c('#8d96a3'));
    // cracks + moss
    line(ctx, -0.2, -1.1, -0.05, -0.85, OL, 0.025); line(ctx, 0.1, -0.6, 0.25, -0.75, OL, 0.025);
    ell(ctx, -0.15, -1.25, 0.2, 0.07, c('#6aa84f'), false);
    // crystals
    poly(ctx, [-0.25, -1.25, -0.18, -1.55, -0.1, -1.25], c(a.tm.light));
    poly(ctx, [0.05, -1.28, 0.15, -1.62, 0.24, -1.25], c(a.tm.main));
    // face
    const gl = 0.7 + Math.sin(a.t * 4) * 0.3;
    rrect(ctx, 0.0, -1.0, 0.36, 0.14, 0.05, '#2a2a36');
    ctx.globalAlpha = gl; circ(ctx, 0.1, -0.93, 0.04, a.tm.light, false); circ(ctx, 0.27, -0.93, 0.04, a.tm.light, false); ctx.globalAlpha = 1;
    rrect(ctx, 0.35, -0.95 - ap * 0.3, 0.3, 0.65, 0.12, c('#7d8591'));
    circ(ctx, 0.5, -0.3 - ap * 0.3, 0.17, c('#8d96a3'));
    ctx.restore();
  }
  T.titan = (ctx, a) => rockBody(ctx, a, 1, 7);
  T.pebble = (ctx, a) => rockBody(ctx, a, 1, 13);

  // ------------------------------------------------------------ buildings
  const B = {};
  B.turret = (ctx, a) => {
    const c = a.c;
    ell(ctx, 0, -0.1, 0.85, 0.42, c('#8a8f99'));
    rrect(ctx, -0.75, -0.6, 1.5, 0.5, 0.15, c('#a5acb8'));
    for (let i = 0; i < 4; i++) line(ctx, -0.75 + i * 0.5, -0.6, -0.75 + i * 0.5, -0.12, OL, 0.02);
    rrect(ctx, -0.8, -0.68, 1.6, 0.14, 0.05, c(a.tm.main));
    ctx.save(); ctx.translate(0, -0.8);
    const ang = a.aim || 0;
    const recoil = a.atk >= 0 && a.atk < 0.3 ? (0.3 - a.atk) * 0.4 : 0;
    ell(ctx, 0, 0, 0.42, 0.3, c('#6b4a2a'));
    ctx.rotate(ang);
    rrect(ctx, -0.05 - recoil, -0.14, 0.75, 0.28, 0.08, c('#3e4450'));
    rrect(ctx, 0.6 - recoil, -0.17, 0.14, 0.34, 0.04, c('#2c3038'));
    circ(ctx, 0, 0, 0.2, c('#525a68'));
    ctx.restore();
  };
  B.inferno = (ctx, a) => {
    const c = a.c;
    poly(ctx, [-0.75, 0, 0.75, 0, 0.45, -1.6, -0.45, -1.6], c('#3a3346'));
    for (let i = 0; i < 4; i++) line(ctx, -0.62 + i * 0.05, -0.35 - i * 0.35, 0.62 - i * 0.05, -0.35 - i * 0.35, '#2a2436', 0.04);
    poly(ctx, [-0.75, 0, -0.45, -1.6, -0.6, -1.6, -0.9, 0], c(a.tm.dark));
    poly(ctx, [0.75, 0, 0.45, -1.6, 0.6, -1.6, 0.9, 0], c(a.tm.dark));
    rrect(ctx, -0.6, -1.75, 1.2, 0.2, 0.06, c('#5a5068'));
    const heat = a.extra && a.extra.heat || 0;
    const glow = 0.6 + Math.sin(a.t * 10) * 0.2 + heat * 0.3;
    ctx.globalAlpha = 0.45 * glow; circ(ctx, 0, -2.15, 0.5 + heat * 0.2, '#ff7a1a', false); ctx.globalAlpha = 1;
    poly(ctx, [0, -2.65, 0.25, -2.15, 0, -1.75, -0.25, -2.15], c(U.mix('#ffb347', '#ff2a1a', heat)));
    poly(ctx, [0, -2.5, 0.12, -2.15, 0, -1.9, -0.12, -2.15], '#fff1b0', false);
  };
  B.den = (ctx, a) => {
    const c = a.c;
    rrect(ctx, -0.85, -0.95, 1.7, 0.95, 0.12, c('#a8733e'));
    for (let i = 0; i < 4; i++) line(ctx, -0.85, -0.75 + i * 0.22, 0.85, -0.75 + i * 0.22, c('#7a4a2a'), 0.025);
    rrect(ctx, -0.25, -0.6, 0.5, 0.6, 0.25, '#2a1a12');
    const peek = (a.extra && a.extra.spawnAnim) || 0;
    if (peek > 0) { circ(ctx, 0, -0.35, 0.15 * peek, c('#7ddc55')); }
    poly(ctx, [-1.05, -0.85, 1.05, -0.85, 0, -1.9], c('#d9b45a'));
    for (let i = 0; i < 6; i++) line(ctx, -0.9 + i * 0.36, -0.88, -0.2 + i * 0.08, -1.7, c('#b8923e'), 0.025);
    poly(ctx, [-0.05, -1.85, 0.4, -2.1, 0.05, -1.75], c(a.tm.main));
    line(ctx, 0, -1.9, 0, -2.25, OL, 0.03);
    poly(ctx, [0, -2.25, 0.35, -2.15, 0, -2.05], c(a.tm.main));
    circ(ctx, 0.5, -0.5, 0.08, c('#ffd23f'));
  };
  B.ballista = (ctx, a) => {
    const c = a.c;
    rrect(ctx, -0.8, -0.45, 1.6, 0.45, 0.1, c('#8a5a2c'));
    line(ctx, -0.7, 0, -0.5, -0.45, OL, 0.04); line(ctx, 0.7, 0, 0.5, -0.45, OL, 0.04);
    rrect(ctx, -0.85, -0.5, 1.7, 0.12, 0.04, c(a.tm.main));
    ctx.save(); ctx.translate(0, -0.75);
    ctx.rotate(a.aim || 0);
    rrect(ctx, -0.6, -0.1, 1.3, 0.2, 0.05, c('#a8733e'));
    ctx.beginPath(); ctx.moveTo(0.3, -0.75); ctx.quadraticCurveTo(0.65, 0, 0.3, 0.75); finish(ctx, null, OL, 0.13);
    ctx.beginPath(); ctx.moveTo(0.3, -0.75); ctx.quadraticCurveTo(0.65, 0, 0.3, 0.75); finish(ctx, null, c('#6b4a2a'), 0.08);
    const pull = a.atk >= 0 && a.atk < 0.5 ? 0 : 0.25;
    line(ctx, 0.3, -0.75, 0.1 - pull, 0, '#eeeeee', 0.02); line(ctx, 0.3, 0.75, 0.1 - pull, 0, '#eeeeee', 0.02);
    if (pull > 0) { line(ctx, 0.1 - pull, 0, 0.8, 0, c('#5a3a22'), 0.05); poly(ctx, [0.8, -0.06, 0.95, 0, 0.8, 0.06], c('#cfd8e0')); }
    ctx.restore();
  };
  B.trap = (ctx, a) => {
    const vis = a.extra && a.extra.visible != null ? a.extra.visible : 1;
    ctx.globalAlpha = vis * (0.55 + Math.sin(a.t * 3) * 0.2);
    ctx.save(); ctx.scale(1, 0.55);
    circ(ctx, 0, 0, 0.6, null, a.tm.main, 0.06);
    circ(ctx, 0, 0, 0.42, null, '#ffd23f', 0.04);
    ctx.rotate(a.t * 0.8);
    for (let i = 0; i < 6; i++) { const an = i * PI / 3; line(ctx, Math.cos(an) * 0.2, Math.sin(an) * 0.2, Math.cos(an) * 0.5, Math.sin(an) * 0.5, '#ffd23f', 0.04); }
    ctx.restore();
    ctx.globalAlpha = 1;
  };
  B.well = (ctx, a) => {
    const c = a.c;
    ell(ctx, 0, -0.2, 0.8, 0.4, c('#8a8f99'));
    rrect(ctx, -0.8, -0.65, 1.6, 0.45, 0.1, c('#a5acb8'));
    for (let i = 0; i < 5; i++) line(ctx, -0.8 + i * 0.4, -0.65, -0.8 + i * 0.4, -0.22, OL, 0.02);
    ell(ctx, 0, -0.65, 0.8, 0.3, c('#b6bcc8'));
    const lvl = (a.extra && a.extra.fill) || 0;
    ell(ctx, 0, -0.66, 0.62, 0.2, c(U.mix('#c03aa8', '#ff6ae6', lvl)));
    for (let i = 0; i < 3; i++) {
      const p = ((a.t * 0.9 + i * 0.33) % 1);
      ctx.globalAlpha = 1 - p;
      circ(ctx, -0.25 + i * 0.25, -0.7 - p * 0.5, 0.06, '#ff9af0', false);
      ctx.globalAlpha = 1;
    }
    line(ctx, -0.7, -0.65, -0.7, -1.6, OL, 0.13); line(ctx, -0.7, -0.65, -0.7, -1.6, c('#7a4a2a'), 0.08);
    line(ctx, 0.7, -0.65, 0.7, -1.6, OL, 0.13); line(ctx, 0.7, -0.65, 0.7, -1.6, c('#7a4a2a'), 0.08);
    poly(ctx, [-0.95, -1.5, 0.95, -1.5, 0, -2.1], c(a.tm.main));
    poly(ctx, [-0.95, -1.5, 0.95, -1.5, 0.8, -1.42, -0.8, -1.42], c(a.tm.dark));
  };

  // --------------------------------------------------------------- towers
  function stoneWall(ctx, a, x, y, w, h, color) {
    const c = a.c;
    rrect(ctx, x, y, w, h, 0.12, c(color));
    const rows = Math.round(h / 0.32);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    for (let r = 1; r < rows; r++) line(ctx, x, y + r * (h / rows), x + w, y + r * (h / rows), 'rgba(28,26,43,0.35)', 0.025);
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * 0.25;
      for (let bx = x + off; bx < x + w; bx += 0.5) line(ctx, bx, y + r * (h / rows), bx, y + (r + 1) * (h / rows), 'rgba(28,26,43,0.3)', 0.022);
    }
    ctx.restore();
    rrect(ctx, x, y, w, h, 0.12, null);
  }
  function cracks(ctx, hpPct, w, top) {
    if (hpPct > 0.6) return;
    ctx.strokeStyle = 'rgba(28,26,43,0.8)'; ctx.lineWidth = 0.035;
    ctx.beginPath(); ctx.moveTo(-w * 0.3, top + 0.3); ctx.lineTo(-w * 0.15, top + 0.7); ctx.lineTo(-w * 0.28, top + 1.0); ctx.stroke();
    if (hpPct < 0.35) {
      ctx.beginPath(); ctx.moveTo(w * 0.35, top + 0.5); ctx.lineTo(w * 0.15, top + 0.9); ctx.lineTo(w * 0.3, top + 1.3); ctx.lineTo(w * 0.1, top + 1.6); ctx.stroke();
    }
  }
  function rubble(ctx, a, w) {
    const c = a.c;
    const rnd = U.seeded(w * 100);
    ell(ctx, 0, -0.1, w * 0.62, w * 0.3, c('#6d6f78'));
    for (let i = 0; i < 9; i++) {
      const x = (rnd() - 0.5) * w * 1.0, y = -0.1 - rnd() * 0.45;
      rrect(ctx, x - 0.15, y - 0.12, 0.3 + rnd() * 0.15, 0.22, 0.06, c(rnd() > 0.5 ? '#9aa1ad' : '#83899a'));
    }
    line(ctx, -0.2, -0.3, 0.1, -0.9, OL, 0.07); line(ctx, -0.2, -0.3, 0.1, -0.9, c('#7a4a2a'), 0.04);
    poly(ctx, [0.1, -0.9, 0.45, -0.75, 0.05, -0.62], c(a.tm.dark));
  }
  function tower(ctx, kind, a) {
    const c = a.c;
    const king = kind === 'king';
    const w = king ? 3.3 : 2.5;
    if (a.destroyed) { rubble(ctx, a, w); return; }
    const h = king ? 2.4 : 2.5;
    const top = -h;
    // base / foundation
    ell(ctx, 0, -0.05, w * 0.58, w * 0.25, c('#6d717c'));
    stoneWall(ctx, a, -w / 2, top, w, h, king ? '#c4c9d4' : '#b9bfcb');
    // team banners
    for (const s of [-1, 1]) {
      const bx = s * w * 0.3;
      poly(ctx, [bx - 0.22, top + 0.35, bx + 0.22, top + 0.35, bx + 0.22, top + 1.35, bx, top + 1.15, bx - 0.22, top + 1.35], c(a.tm.main));
      poly(ctx, [bx - 0.1, top + 0.6, bx + 0.1, top + 0.6, bx, top + 0.85], c('#ffd23f'), false);
    }
    // door
    if (king) { rrect(ctx, -0.35, -0.75, 0.7, 0.75, 0.33, c('#5a3a22')); line(ctx, 0, -0.72, 0, 0, OL, 0.025); }
    else { rrect(ctx, -0.25, -0.55, 0.5, 0.55, 0.24, c('#5a3a22')); }
    cracks(ctx, a.hpPct, w, top);
    // battlements
    rrect(ctx, -w / 2 - 0.15, top - 0.2, w + 0.3, 0.32, 0.08, c(king ? '#d6dbe4' : '#cbd1dc'));
    const n = king ? 6 : 5;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 - 0.15 + (i + 0.5) * ((w + 0.3) / n);
      rrect(ctx, x - 0.17, top - 0.48, 0.34, 0.32, 0.06, c(king ? '#d6dbe4' : '#cbd1dc'));
    }
    rrect(ctx, -w / 2 - 0.15, top - 0.05, w + 0.3, 0.08, 0.03, c(a.tm.dark), false);
    // occupant
    ctx.save();
    ctx.translate(king ? 0.15 : 0, top - 0.15);
    const scale = king ? 0.95 : 0.8;
    ctx.scale(scale, scale);
    const occ = Object.assign({}, a, { moving: false });
    if (king) {
      if (!a.active) occ.extra = { angry: false };
      else occ.extra = { angry: true };
      humanoid(ctx, occ, {
        skin: '#f5c49c', body: a.tm.main, trim: '#ffd23f', pants: '#5a3a22', boots: '#3b2a20', cape: '#b3202a',
        head: HEADS.king, swing: 'cast', rigid: false, armIdle: 0.5,
        weapon: (c2, a2) => { rrect(c2, -0.03, -0.4, 0.06, 0.5, 0.02, a2.c('#ffd23f')); circ(c2, 0, -0.45, 0.08, a2.c(a2.tm.light)); },
      });
    } else {
      humanoid(ctx, Object.assign(occ, { face: occ.face }), {
        skin: '#f7cfa8', body: '#ffffff', trim: a.tm.main, pants: '#5a3a22', boots: '#3b2a20',
        head: HEADS.archer, swing: 'bow', armIdle: 1.1, rigid: false,
        weapon: T.archerBow,
      });
    }
    ctx.restore();
    if (king) {
      // cannon in front of the king
      ctx.save(); ctx.translate(-0.75, top - 0.1);
      const recoil = a.atk >= 0 && a.atk < 0.3 ? (0.3 - a.atk) * 0.5 : 0;
      ctx.rotate(a.aim || 0);
      rrect(ctx, -0.1 - recoil, -0.16, 0.85, 0.32, 0.1, c('#3e4450'));
      rrect(ctx, 0.65 - recoil, -0.2, 0.14, 0.4, 0.05, c('#2c3038'));
      ctx.restore();
      circ(ctx, -0.75, top - 0.1, 0.18, c('#6b4a2a'));
      if (!a.active) {
        ctx.font = 'bold 0.4px sans-serif'; ctx.fillStyle = '#ffffff';
        const zt = (a.t % 2) / 2;
        ctx.globalAlpha = 1 - zt; ctx.fillText('z', 0.6 + zt * 0.3, top - 1.4 - zt * 0.5); ctx.globalAlpha = 1;
      }
    }
  }
  // archer bow reused on princess towers
  T.archerBow = function (ctx, a2) {
    const pull = a2.atk >= 0 && a2.atk < 0.6 ? a2.atk / 0.6 * 0.18 : 0;
    ctx.beginPath(); ctx.arc(-0.25, 0, 0.42, -0.95, 0.95); ctx.strokeStyle = OL; ctx.lineWidth = 0.1; ctx.stroke();
    ctx.strokeStyle = a2.c('#a8733e'); ctx.lineWidth = 0.06; ctx.stroke();
    line(ctx, -0.25 + Math.cos(-0.95) * 0.42, Math.sin(-0.95) * 0.42, -0.05 - pull, 0, '#eeeeee', 0.015);
    line(ctx, -0.25 + Math.cos(0.95) * 0.42, Math.sin(0.95) * 0.42, -0.05 - pull, 0, '#eeeeee', 0.015);
  };

  // ---------------------------------------------------------- spell icons
  const S = {};
  S.sp_meteor = (ctx, t) => {
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.7 - i * 0.12;
      circ(ctx, -0.35 - i * 0.18, -0.35 - i * 0.18, 0.42 - i * 0.05, i < 2 ? '#ffb347' : '#ff6a1a', false);
    }
    ctx.globalAlpha = 1;
    circ(ctx, 0.1, 0.1, 0.48, '#6b4a3a');
    circ(ctx, -0.05, -0.02, 0.12, '#4a3228', false); circ(ctx, 0.25, 0.2, 0.09, '#4a3228', false); circ(ctx, 0.2, -0.15, 0.06, '#4a3228', false);
    ctx.beginPath(); ctx.arc(0.1, 0.1, 0.48, PI * 0.9, PI * 1.6); ctx.strokeStyle = '#ffd27a'; ctx.lineWidth = 0.08; ctx.stroke();
  };
  S.sp_arrows = (ctx) => {
    for (let i = -1; i <= 1; i++) {
      ctx.save(); ctx.translate(i * 0.35, i === 0 ? -0.15 : 0.05); ctx.rotate(0.6);
      line(ctx, 0, -0.65, 0, 0.55, OL, 0.11); line(ctx, 0, -0.65, 0, 0.55, '#a8733e', 0.06);
      poly(ctx, [-0.12, 0.45, 0.12, 0.45, 0, 0.75], '#d6dde6');
      poly(ctx, [0, -0.45, -0.15, -0.7, -0.15, -0.5], '#ff4d4d'); poly(ctx, [0, -0.45, 0.15, -0.7, 0.15, -0.5], '#ff4d4d');
      ctx.restore();
    }
  };
  S.sp_thunder = (ctx) => {
    ctx.globalAlpha = 0.35; circ(ctx, 0, 0, 0.75, '#7ff6ff', false); ctx.globalAlpha = 1;
    poly(ctx, [0.15, -0.8, -0.35, 0.05, -0.02, 0.05, -0.2, 0.8, 0.38, -0.12, 0.05, -0.12, 0.3, -0.8], '#ffe14d');
  };
  S.sp_frost = (ctx, t) => {
    ctx.globalAlpha = 0.3; circ(ctx, 0, 0, 0.75, '#bfe9ff', false); ctx.globalAlpha = 1;
    ctx.save(); ctx.rotate((t || 0) * 0.3);
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.rotate(i * PI / 3);
      line(ctx, 0, 0, 0, -0.7, OL, 0.15); line(ctx, 0, 0, 0, -0.7, '#e6f7ff', 0.09);
      line(ctx, 0, -0.42, -0.18, -0.58, OL, 0.11); line(ctx, 0, -0.42, -0.18, -0.58, '#e6f7ff', 0.06);
      line(ctx, 0, -0.42, 0.18, -0.58, OL, 0.11); line(ctx, 0, -0.42, 0.18, -0.58, '#e6f7ff', 0.06);
      ctx.restore();
    }
    ctx.restore();
    circ(ctx, 0, 0, 0.14, '#7fd3f5');
  };
  S.sp_rage = (ctx) => {
    ctx.globalAlpha = 0.35; circ(ctx, 0, 0, 0.75, '#ff7a3d', false); ctx.globalAlpha = 1;
    ctx.save(); ctx.rotate(-0.5);
    ctx.beginPath(); ctx.moveTo(-0.6, 0.25); ctx.quadraticCurveTo(-0.1, 0.35, 0.45, -0.1); ctx.lineTo(0.62, -0.42); ctx.lineTo(0.3, -0.35);
    ctx.quadraticCurveTo(-0.15, 0.0, -0.6, 0.05); ctx.closePath(); finish(ctx, '#f4ecd8');
    rrect(ctx, -0.15, -0.02, 0.1, 0.22, 0.03, '#f2c14e'); rrect(ctx, 0.15, -0.15, 0.1, 0.2, 0.03, '#f2c14e');
    ctx.restore();
    for (let i = 0; i < 3; i++) line(ctx, 0.4 + i * 0.12, -0.55 + i * 0.05, 0.6 + i * 0.12, -0.7 + i * 0.05, '#ffd23f', 0.05);
  };
  S.sp_gale = (ctx, t) => {
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(0, 0.1 - i * 0.05, 0.25 + i * 0.2, PI * (0.9 + i * 0.1), PI * (2.2 + i * 0.1));
      ctx.strokeStyle = OL; ctx.lineWidth = 0.14; ctx.stroke();
      ctx.strokeStyle = ['#e6f7ff', '#bfe9ff', '#9fd4ff'][i]; ctx.lineWidth = 0.08; ctx.stroke();
    }
    ell(ctx, 0.5, 0.45, 0.12, 0.06, '#7ed957', OL, 0.03, 0.6);
    ell(ctx, -0.5, 0.35, 0.1, 0.05, '#a8d957', OL, 0.03, -0.4);
  };
  S.sp_lance = (ctx) => {
    ctx.save(); ctx.rotate(0.75);
    for (let i = 0; i < 4; i++) { ctx.globalAlpha = 0.5 - i * 0.1; line(ctx, 0, 0.5 + i * 0.12, 0, 0.8 + i * 0.12, '#bff8ff', 0.2 - i * 0.03); }
    ctx.globalAlpha = 1;
    rrect(ctx, -0.07, -0.4, 0.14, 1.2, 0.05, '#d9c7a0');
    poly(ctx, [-0.18, -0.35, 0.18, -0.35, 0, -0.9], '#e8f4ff');
    line(ctx, 0, -0.4, 0, -0.8, '#7fd3f5', 0.04);
    rrect(ctx, -0.22, -0.42, 0.44, 0.1, 0.04, '#ffd23f');
    ctx.restore();
  };

  RR.Sprites = {
    TEAM, OL, circ, ell, rrect, poly, line, limb, mkC, W, HEADS,
    troop: T, building: B, spell: S,
    drawTroop(ctx, sprite, a) {
      a.c = mkC(a); a.tm = TEAM[a.team || 0]; a.extra = a.extra || {};
      const fn = T[sprite];
      if (!fn) return;
      ctx.save();
      ctx.lineJoin = 'round';
      if (a.face < 0) ctx.scale(-1, 1);
      fn(ctx, a);
      ctx.restore();
    },
    drawBuilding(ctx, sprite, a) {
      a.c = mkC(a); a.tm = TEAM[a.team || 0]; a.extra = a.extra || {};
      const fn = B[sprite];
      if (!fn) return;
      ctx.save(); ctx.lineJoin = 'round'; fn(ctx, a); ctx.restore();
    },
    drawTower(ctx, kind, a) {
      a.c = mkC(a); a.tm = TEAM[a.team || 0]; a.extra = a.extra || {};
      ctx.save(); ctx.lineJoin = 'round'; tower(ctx, kind, a); ctx.restore();
    },
    drawSpell(ctx, sprite, t) {
      const fn = S[sprite];
      if (!fn) return;
      ctx.save(); ctx.lineJoin = 'round'; fn(ctx, t || 0); ctx.restore();
    },
  };
})(window.RR);
