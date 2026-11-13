// Battlefield geometry: an 18 x 32 tile arena. Team 0 (player) lives at the bottom,
// team 1 (enemy) at the top. A river splits the arena at y = 15..17, crossable on two bridges.
(function (RR) {
  'use strict';
  const U = RR.U;
  const M = {
    W: 18, H: 32,
    RIVER_TOP: 15, RIVER_BOT: 17, RIVER_MID: 16,
    BRIDGES: [3.5, 14.5], BRIDGE_HALF: 1.0,
    TOWERS: [
      // team 0
      [{ kind: 'king', x: 9, y: 29.2 }, { kind: 'princess', x: 3.5, y: 25.5, lane: 0 }, { kind: 'princess', x: 14.5, y: 25.5, lane: 1 }],
      // team 1
      [{ kind: 'king', x: 9, y: 2.8 }, { kind: 'princess', x: 3.5, y: 6.5, lane: 0 }, { kind: 'princess', x: 14.5, y: 6.5, lane: 1 }],
    ],
  };

  M.sideOf = (y) => (y >= M.RIVER_MID ? 0 : 1);
  M.forward = (team) => (team === 0 ? -1 : 1);
  M.nearestBridge = (x) => (Math.abs(x - M.BRIDGES[0]) < Math.abs(x - M.BRIDGES[1]) ? M.BRIDGES[0] : M.BRIDGES[1]);
  M.onBridgeX = (x, margin) => M.BRIDGES.some((b) => Math.abs(x - b) <= M.BRIDGE_HALF - (margin || 0));
  M.inRiverBand = (y) => y > M.RIVER_TOP && y < M.RIVER_BOT;
  M.isRiver = (x, y) => M.inRiverBand(y) && !M.onBridgeX(x);

  // Where should a ground unit walk next to reach (tx, ty)? Routes over bridges.
  M.route = (e, tx, ty) => {
    if (e.flying || e.card.jumpsRiver) return [tx, ty];
    const se = M.sideOf(e.y), st = M.sideOf(ty);
    const inBand = M.inRiverBand(e.y);
    if (se === st && !inBand) return [tx, ty];
    let best = M.BRIDGES[0], bestD = Infinity;
    for (const b of M.BRIDGES) {
      const d = Math.abs(e.x - b) + Math.abs(tx - b) * 0.8 + (inBand ? Math.abs(e.x - b) * 5 : 0);
      if (d < bestD) { bestD = d; best = b; }
    }
    const exitY = st === 0 ? M.RIVER_BOT + 0.6 : M.RIVER_TOP - 0.6;
    const bx = best + U.clamp(e.x - best, -0.45, 0.45);
    if (inBand) return [bx, exitY];
    const entryY = se === 0 ? M.RIVER_BOT + 0.4 : M.RIVER_TOP - 0.4;
    if (Math.abs(e.x - best) < 0.6 && Math.abs(e.y - entryY) < 0.7) return [bx, exitY];
    return [best, entryY];
  };

  // Keep ground units out of the water.
  M.clampRiver = (e) => {
    if (e.flying || e.card.jumpsRiver) return;
    if (!M.inRiverBand(e.y)) return;
    const b = M.nearestBridge(e.x);
    const half = M.BRIDGE_HALF - Math.min(0.35, e.radius * 0.6);
    if (Math.abs(e.x - b) <= half) return;
    // push to bridge horizontally if close, else back to bank
    const dxNeeded = Math.abs(e.x - b) - half;
    const dyNeeded = Math.min(e.y - M.RIVER_TOP, M.RIVER_BOT - e.y);
    if (dxNeeded < dyNeeded) e.x = b + Math.sign(e.x - b) * half;
    else e.y = e.y < M.RIVER_MID ? M.RIVER_TOP : M.RIVER_BOT;
  };

  M.clampBounds = (e) => {
    e.x = U.clamp(e.x, 0.4, M.W - 0.4);
    e.y = U.clamp(e.y, 0.4, M.H - 0.4);
  };

  // Deploy validity. Returns true when `team` may place `card` at (x, y).
  M.canDeploy = (B, team, card, x, y) => {
    if (x < 0.5 || x > M.W - 0.5 || y < 0.5 || y > M.H - 0.5) return false;
    if (card.type === 'spell') return true;
    if (card.deployAnywhere) {
      if (M.isRiver(x, y)) return false;
      return !M.blockedByStructure(B, x, y, 0.3);
    }
    if (M.inRiverBand(y) || (y > M.RIVER_TOP - 0.01 && y < M.RIVER_BOT + 0.01)) return false;
    let ok = false;
    if (team === 0) {
      if (y >= M.RIVER_BOT) ok = true;
      else {
        // pockets: enemy princess destroyed -> may deploy up to y >= 10 in that half
        const lane = x < M.W / 2 ? 0 : 1;
        const pt = B.towers[1].find((t) => t.towerKind === 'princess' && t.lane === lane);
        if (pt && pt.dead && y >= 10) ok = true;
      }
    } else {
      if (y <= M.RIVER_TOP) ok = true;
      else {
        const lane = x < M.W / 2 ? 0 : 1;
        const pt = B.towers[0].find((t) => t.towerKind === 'princess' && t.lane === lane);
        if (pt && pt.dead && y <= M.H - 10) ok = true;
      }
    }
    if (!ok) return false;
    const pad = card.type === 'building' ? card.radius * 0.9 : 0.1;
    return !M.blockedByStructure(B, x, y, pad);
  };

  M.blockedByStructure = (B, x, y, pad) => {
    for (const t of B.towers[0].concat(B.towers[1])) {
      if (t.dead) continue;
      if (Math.abs(x - t.x) < t.radius + pad && Math.abs(y - t.y) < t.radius + pad) return true;
    }
    for (const e of B.entities) {
      if (e.dead || e.kind !== 'building' || e.card.trap) continue;
      if (U.dist(x, y, e.x, e.y) < e.radius + pad) return true;
    }
    return false;
  };

  // snap a deploy point to the nearest legal location (for AI / convenience)
  M.snapDeploy = (B, team, card, x, y) => {
    if (M.canDeploy(B, team, card, x, y)) return [x, y];
    for (let r = 0.5; r < 6; r += 0.5) {
      for (let a = 0; a < 16; a++) {
        const ang = (a / 16) * Math.PI * 2;
        const nx = x + Math.cos(ang) * r, ny = y + Math.sin(ang) * r;
        if (M.canDeploy(B, team, card, nx, ny)) return [nx, ny];
      }
    }
    return null;
  };

  RR.Map = M;
})(window.RR);
