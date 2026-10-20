'use strict';

// ---------------------------------------------------------------------------
// Tower Ascent — a small top-down dungeon crawler.
// Clear every monster on a floor to unlock the stairs, then climb higher.
// ---------------------------------------------------------------------------

const TILE = 32;
const COLS = 20;
const ROWS = 15;
const W = COLS * TILE;
const H = ROWS * TILE;
const MAX_HP = 6;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// Map legend:
//   #  wall          .  floor        P  player start   S  stairs up
//   s  slime         b  bat          o  orc            k  skeleton archer
//   h  health potion
const LEVELS = [
  {
    name: 'Floor 1 — The Cellar',
    palette: { floor: '#3b3530', floorAlt: '#36302b', wall: '#5a4e44', wallDark: '#3f362f', mortar: '#2e2722' },
    map: [
      '####################',
      '#P.......#.........#',
      '#........#....s....#',
      '#...##...#.........#',
      '#...##.........##..#',
      '#..............##..#',
      '#####...s..........#',
      '#.......####...#####',
      '#..s....#..#.......#',
      '#.......#..#...s...#',
      '#...h..........#...#',
      '#.......####...#...#',
      '#..##.......s..#.S.#',
      '#..##..........#...#',
      '####################',
    ],
  },
  {
    name: 'Floor 2 — The Barracks',
    palette: { floor: '#2f3540', floorAlt: '#2b313b', wall: '#4b5566', wallDark: '#353d4a', mortar: '#232933' },
    map: [
      '####################',
      '#S.....#......b....#',
      '#......#...........#',
      '#..o...#...####....#',
      '#......#...#..#..b.#',
      '###.####...#..#....#',
      '#..........#h.#....#',
      '#....b.....##.###.##',
      '#..................#',
      '#.####....s....###.#',
      '#.#..#.........#...#',
      '#.#..#...o.....#.s.#',
      '#.#h.#.........#...#',
      '#........P.........#',
      '####################',
    ],
  },
  {
    name: 'Floor 3 — The Armory',
    palette: { floor: '#3a2a2e', floorAlt: '#35262a', wall: '#6b3f45', wallDark: '#4a2b30', mortar: '#2a1a1d' },
    map: [
      '####################',
      '#........#S#.......#',
      '#..k.....#.#....k..#',
      '#........#.#.......#',
      '#...##...#.#...##..#',
      '#...##.............#',
      '#..........b.......#',
      '####.####...####.###',
      '#..o.....#.#.....b.#',
      '#........#.#.......#',
      '#..b.....#h#...o...#',
      '#...............k..#',
      '#....##......##....#',
      '#h.......P.........#',
      '####################',
    ],
  },
];

const ENEMY_TYPES = {
  slime:    { hp: 2, speed: 60,  size: 11, damage: 1, range: 220 },
  bat:      { hp: 1, speed: 120, size: 9,  damage: 1, range: 300 },
  orc:      { hp: 4, speed: 78,  size: 13, damage: 2, range: 260 },
  skeleton: { hp: 3, speed: 50,  size: 11, damage: 1, range: 360 },
};
const SPAWNS = { s: 'slime', b: 'bat', o: 'orc', k: 'skeleton' };

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

const keys = {};
const pressed = {};
const GAME_KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];

window.addEventListener('keydown', (e) => {
  if (GAME_KEYS.includes(e.code)) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
});

const held = (...codes) => codes.some((c) => keys[c]);
const tapped = (...codes) => codes.some((c) => pressed[c]);

// ---------------------------------------------------------------------------
// Game state
// ---------------------------------------------------------------------------

let state = 'title'; // title | playing | paused | climbing | dead | victory
let levelIndex = 0;
let map = [];
let player = null;
let enemies = [];
let projectiles = [];
let pickups = [];
let particles = [];
let floatTexts = [];
let stairs = null;
let fade = 0;
let shake = 0;
let banner = 0;
let time = 0;
let hpAtFloorStart = MAX_HP;

function makePlayer(x, y, hp) {
  return {
    x, y, h: 10, hp,
    fx: 0, fy: 1,          // facing direction
    attack: 0,             // time left in current swing
    cooldown: 0,
    swing: 0,              // swing id, so each swing hits an enemy once
    inv: 0,                // invulnerability after taking damage
    kx: 0, ky: 0,          // knockback velocity
    walk: 0,
  };
}

function makeEnemy(type, x, y) {
  const t = ENEMY_TYPES[type];
  return {
    type, t, x, y, h: t.size,
    hp: t.hp,
    kx: 0, ky: 0,
    stun: 0, hurt: 0,
    wx: 0, wy: 0, wander: 0,
    shoot: 1 + Math.random() * 1.5,
    seed: Math.random() * 100,
    lastSwing: -1,
  };
}

function loadLevel(index, hp) {
  const level = LEVELS[index];
  levelIndex = index;
  hpAtFloorStart = hp;
  map = [];
  enemies = [];
  projectiles = [];
  pickups = [];
  particles = [];
  floatTexts = [];
  stairs = null;

  for (let r = 0; r < ROWS; r++) {
    const row = [];
    for (let c = 0; c < COLS; c++) {
      const ch = level.map[r][c] || '#';
      const x = c * TILE + TILE / 2;
      const y = r * TILE + TILE / 2;
      if (ch === '#') {
        row.push('#');
        continue;
      }
      row.push(ch === 'S' ? 'S' : '.');
      if (ch === 'P') player = makePlayer(x, y, hp);
      else if (ch === 'S') stairs = { c, r, x, y };
      else if (ch === 'h') pickups.push({ x, y, bob: Math.random() * 6 });
      else if (SPAWNS[ch]) enemies.push(makeEnemy(SPAWNS[ch], x, y));
    }
    map.push(row);
  }
  banner = 2.5;
}

function startGame() {
  loadLevel(0, MAX_HP);
  state = 'playing';
  fade = 1;
}

// ---------------------------------------------------------------------------
// Collision helpers
// ---------------------------------------------------------------------------

function solidAt(px, py) {
  const c = Math.floor(px / TILE);
  const r = Math.floor(py / TILE);
  if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
  return map[r][c] === '#';
}

function boxHitsWall(x, y, h) {
  return solidAt(x - h, y - h) || solidAt(x + h - 0.01, y - h) ||
         solidAt(x - h, y + h - 0.01) || solidAt(x + h - 0.01, y + h - 0.01);
}

// Moves an entity, sliding along walls one axis at a time.
function move(e, dx, dy) {
  if (!boxHitsWall(e.x + dx, e.y, e.h)) e.x += dx;
  else {
    const step = Math.sign(dx);
    for (let i = 0; i < Math.abs(dx) && !boxHitsWall(e.x + step, e.y, e.h); i++) e.x += step;
  }
  if (!boxHitsWall(e.x, e.y + dy, e.h)) e.y += dy;
  else {
    const step = Math.sign(dy);
    for (let i = 0; i < Math.abs(dy) && !boxHitsWall(e.x, e.y + step, e.h); i++) e.y += step;
  }
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------------------------------------------------------------------
// Effects
// ---------------------------------------------------------------------------

function burst(x, y, color, count, speed = 120) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.3 + Math.random() * 0.7);
    particles.push({
      x, y,
      vx: Math.cos(a) * s,
      vy: Math.sin(a) * s,
      life: 0.4 + Math.random() * 0.4,
      max: 0.8,
      color,
      size: 2 + Math.random() * 3,
    });
  }
}

function floatText(x, y, text, color) {
  floatTexts.push({ x, y, text, color, life: 1.2 });
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

function update(dt) {
  time += dt;

  if (state === 'title') {
    if (tapped('Enter', 'Space')) startGame();
    return;
  }
  if (state === 'dead') {
    if (tapped('Enter', 'Space')) {
      loadLevel(levelIndex, Math.max(hpAtFloorStart, 3));
      state = 'playing';
      fade = 1;
    }
    return;
  }
  if (state === 'victory') {
    if (tapped('Enter')) state = 'title';
    return;
  }
  if (state === 'paused') {
    if (tapped('KeyP', 'Escape')) state = 'playing';
    return;
  }
  if (state === 'climbing') {
    fade += dt * 1.6;
    if (fade >= 1) {
      fade = 1;
      if (levelIndex + 1 < LEVELS.length) {
        loadLevel(levelIndex + 1, Math.min(MAX_HP, player.hp + 2));
        state = 'playing';
      } else {
        state = 'victory';
      }
    }
    return;
  }

  // playing
  if (tapped('KeyP', 'Escape')) {
    state = 'paused';
    return;
  }
  fade = Math.max(0, fade - dt * 1.6);
  banner = Math.max(0, banner - dt);
  shake = Math.max(0, shake - dt);

  updatePlayer(dt);
  for (const e of enemies) updateEnemy(e, dt);
  separateEnemies();
  updateProjectiles(dt);
  updateParticles(dt);
}

function updatePlayer(dt) {
  const p = player;
  let mx = 0;
  let my = 0;
  if (held('KeyA', 'ArrowLeft')) mx -= 1;
  if (held('KeyD', 'ArrowRight')) mx += 1;
  if (held('KeyW', 'ArrowUp')) my -= 1;
  if (held('KeyS', 'ArrowDown')) my += 1;

  if (mx || my) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    if (p.attack <= 0) {
      p.fx = mx;
      p.fy = my;
    }
    p.walk += dt;
  }

  const speed = p.attack > 0 ? 95 : 155;
  move(p, (mx * speed + p.kx) * dt, (my * speed + p.ky) * dt);
  const decay = Math.max(0, 1 - 10 * dt);
  p.kx *= decay;
  p.ky *= decay;

  p.inv = Math.max(0, p.inv - dt);
  p.cooldown = Math.max(0, p.cooldown - dt);
  p.attack = Math.max(0, p.attack - dt);

  if (tapped('Space', 'KeyJ') && p.cooldown <= 0) {
    p.attack = 0.18;
    p.cooldown = 0.32;
    p.swing++;
  }

  if (p.attack > 0) {
    const hx = p.x + p.fx * 20;
    const hy = p.y + p.fy * 20;
    for (const e of enemies) {
      if (e.lastSwing !== p.swing && Math.hypot(e.x - hx, e.y - hy) < 20 + e.h) {
        e.lastSwing = p.swing;
        damageEnemy(e);
      }
    }
    // Swords can knock arrows out of the air.
    for (const a of projectiles) {
      if (Math.hypot(a.x - hx, a.y - hy) < 22) {
        a.dead = true;
        burst(a.x, a.y, '#e8e2cf', 5, 80);
      }
    }
  }
  enemies = enemies.filter((e) => e.hp > 0);

  for (const k of pickups) {
    if (!k.taken && dist(p, k) < 18) {
      if (p.hp >= MAX_HP) continue;
      k.taken = true;
      p.hp = Math.min(MAX_HP, p.hp + 2);
      burst(k.x, k.y, '#ff5d73', 12, 90);
      floatText(k.x, k.y - 10, '+1 ♥', '#ff8da0');
    }
  }
  pickups = pickups.filter((k) => !k.taken);

  if (enemies.length === 0 && stairs && dist(p, stairs) < 14) {
    state = 'climbing';
  }
}

function damageEnemy(e) {
  const p = player;
  e.hp -= 1;
  e.hurt = 0.15;
  e.stun = 0.25;
  e.kx = p.fx * 280;
  e.ky = p.fy * 280;
  burst(e.x, e.y, enemyColor(e.type), 8);
  if (e.hp <= 0) {
    burst(e.x, e.y, enemyColor(e.type), 22, 160);
    if (Math.random() < 0.2) pickups.push({ x: e.x, y: e.y, bob: 0 });
    const remaining = enemies.filter((o) => o.hp > 0).length;
    if (remaining === 0) {
      floatText(p.x, p.y - 24, 'The stairs are unlocked!', '#ffd76a');
      burst(stairs.x, stairs.y, '#ffd76a', 30, 140);
    }
  }
}

function hurtPlayer(amount, nx, ny) {
  const p = player;
  if (p.inv > 0 || state !== 'playing') return;
  p.hp -= amount;
  p.inv = 1;
  p.kx = nx * 260;
  p.ky = ny * 260;
  shake = 0.25;
  burst(p.x, p.y, '#ff4d4d', 12);
  if (p.hp <= 0) {
    p.hp = 0;
    state = 'dead';
  }
}

function updateEnemy(e, dt) {
  const p = player;
  const t = e.t;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  const d = Math.hypot(dx, dy) || 1;
  let vx = 0;
  let vy = 0;

  e.hurt = Math.max(0, e.hurt - dt);
  e.wander -= dt;

  if (e.stun > 0) {
    e.stun -= dt;
  } else if (d < t.range) {
    if (e.type === 'skeleton') {
      // Keep some distance and fire arrows.
      const want = d < 130 ? -1 : d > 200 ? 1 : 0;
      vx = (dx / d) * t.speed * want;
      vy = (dy / d) * t.speed * want;
      e.shoot -= dt;
      if (e.shoot <= 0) {
        e.shoot = 1.6 + Math.random() * 1.2;
        projectiles.push({ x: e.x, y: e.y, vx: (dx / d) * 210, vy: (dy / d) * 210, life: 3 });
      }
    } else {
      let speed = t.speed;
      if (e.type === 'slime') speed *= Math.sin(time * 6 + e.seed) > 0 ? 1.5 : 0.15; // hop
      vx = (dx / d) * speed;
      vy = (dy / d) * speed;
      if (e.type === 'bat') {
        // Erratic, swooping flight.
        const wobble = Math.sin(time * 7 + e.seed) * 90;
        vx += (-dy / d) * wobble;
        vy += (dx / d) * wobble;
      }
    }
  } else {
    if (e.wander <= 0) {
      const a = Math.random() * Math.PI * 2;
      const idle = Math.random() < 0.3;
      e.wx = idle ? 0 : Math.cos(a);
      e.wy = idle ? 0 : Math.sin(a);
      e.wander = 1 + Math.random() * 1.5;
    }
    vx = e.wx * t.speed * 0.4;
    vy = e.wy * t.speed * 0.4;
  }

  move(e, (vx + e.kx) * dt, (vy + e.ky) * dt);
  const decay = Math.max(0, 1 - 9 * dt);
  e.kx *= decay;
  e.ky *= decay;

  if (d < e.h + p.h + 2) hurtPlayer(t.damage, dx / d, dy / d);
}

function separateEnemies() {
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i];
      const b = enemies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      const overlap = a.h + b.h - d;
      if (overlap > 0) {
        const px = (dx / d) * overlap * 0.5;
        const py = (dy / d) * overlap * 0.5;
        move(a, -px, -py);
        move(b, px, py);
      }
    }
  }
}

function updateProjectiles(dt) {
  for (const a of projectiles) {
    a.x += a.vx * dt;
    a.y += a.vy * dt;
    a.life -= dt;
    if (solidAt(a.x, a.y) || a.life <= 0) {
      a.dead = true;
      burst(a.x, a.y, '#a89f8a', 4, 60);
    } else if (dist(a, player) < player.h + 3) {
      a.dead = true;
      const len = Math.hypot(a.vx, a.vy);
      hurtPlayer(1, a.vx / len, a.vy / len);
    }
  }
  projectiles = projectiles.filter((a) => !a.dead);
}

function updateParticles(dt) {
  for (const q of particles) {
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vx *= 0.92;
    q.vy *= 0.92;
    q.life -= dt;
  }
  particles = particles.filter((q) => q.life > 0);
  for (const f of floatTexts) {
    f.y -= 25 * dt;
    f.life -= dt;
  }
  floatTexts = floatTexts.filter((f) => f.life > 0);
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

function enemyColor(type) {
  return { slime: '#5fd35f', bat: '#9b6bd6', orc: '#7d9a3c', skeleton: '#e8e2cf' }[type];
}

function hash(c, r) {
  const n = Math.sin(c * 127.1 + r * 311.7 + levelIndex * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function drawMap() {
  const pal = LEVELS[levelIndex].palette;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const x = c * TILE;
      const y = r * TILE;
      const tile = map[r][c];
      if (tile === '#') {
        drawWall(x, y, c, r, pal);
      } else {
        const v = hash(c, r);
        ctx.fillStyle = (c + r) % 2 ? pal.floor : pal.floorAlt;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        if (v > 0.85) {
          ctx.strokeStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.moveTo(x + 6 + v * 10, y + 8);
          ctx.lineTo(x + 14, y + 16);
          ctx.lineTo(x + 12 + v * 8, y + 24);
          ctx.stroke();
        }
        // Shadow cast by a wall directly above.
        if (r > 0 && map[r - 1][c] === '#') {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x, y, TILE, 6);
        }
        if (tile === 'S') drawStairs(x, y);
      }
    }
  }
}

function drawWall(x, y, c, r, pal) {
  ctx.fillStyle = pal.wall;
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = pal.mortar;
  for (let row = 0; row < 4; row++) {
    const by = y + row * 8;
    ctx.fillRect(x, by + 7, TILE, 1);
    const off = (row + r) % 2 ? 0 : 8;
    ctx.fillRect(x + off, by, 1, 8);
    ctx.fillRect(x + off + 16, by, 1, 8);
  }
  // Darker front face where the wall meets open floor below.
  const below = r + 1 < ROWS ? map[r + 1][c] : '#';
  if (below !== '#') {
    ctx.fillStyle = pal.wallDark;
    ctx.fillRect(x, y + TILE - 8, TILE, 8);
  }
}

function drawStairs(x, y) {
  const open = enemies.length === 0;
  for (let i = 0; i < 4; i++) {
    const shade = open ? 200 - i * 35 : 110 - i * 20;
    ctx.fillStyle = `rgb(${shade},${shade - 10},${shade - 30})`;
    ctx.fillRect(x + 3 + i * 2, y + 4 + i * 6, TILE - 6 - i * 4, 6);
  }
  if (open) {
    const glow = 0.35 + Math.sin(time * 4) * 0.2;
    ctx.fillStyle = `rgba(255, 215, 106, ${glow})`;
    ctx.fillRect(x, y, TILE, TILE);
    // Bouncing arrow to point the way.
    const ay = y - 12 + Math.sin(time * 5) * 3;
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.moveTo(x + TILE / 2, ay - 8);
    ctx.lineTo(x + TILE / 2 + 7, ay);
    ctx.lineTo(x + TILE / 2 - 7, ay);
    ctx.fill();
  } else {
    // Padlock
    ctx.strokeStyle = '#c9b458';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + TILE / 2, y + 13, 4, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#c9b458';
    ctx.fillRect(x + TILE / 2 - 6, y + 13, 12, 9);
    ctx.lineWidth = 1;
  }
}

function drawPickups() {
  for (const k of pickups) {
    const y = k.y + Math.sin(time * 3 + k.bob) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(k.x, k.y + 10, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8e2cf';
    ctx.fillRect(k.x - 2, y - 9, 4, 4);
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath();
    ctx.arc(k.x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(k.x - 3, y - 3, 2, 2);
  }
}

function drawShadow(x, y, w) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(x, y, w, w * 0.35, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  const p = player;
  if (p.inv > 0 && Math.floor(p.inv * 15) % 2 === 0) return;
  const bob = Math.sin(p.walk * 14) * 1.5;

  drawShadow(p.x, p.y + 11, 9);

  // Sword swing
  if (p.attack > 0) {
    const base = Math.atan2(p.fy, p.fx);
    const progress = 1 - p.attack / 0.18;
    const a = base - 1.1 + progress * 2.2;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 22, base - 1.1, a);
    ctx.stroke();
    ctx.strokeStyle = '#dfe6f0';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(p.x + Math.cos(a) * 8, p.y + Math.sin(a) * 8);
    ctx.lineTo(p.x + Math.cos(a) * 30, p.y + Math.sin(a) * 30);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Body
  ctx.fillStyle = '#3d6fd1';
  ctx.fillRect(p.x - 8, p.y - 2 + bob, 16, 12);
  ctx.fillStyle = '#6b4a2b';
  ctx.fillRect(p.x - 8, p.y + 4 + bob, 16, 2);
  // Head
  ctx.fillStyle = '#f1c9a0';
  ctx.fillRect(p.x - 7, p.y - 13 + bob, 14, 12);
  // Hair
  ctx.fillStyle = '#7a4b25';
  ctx.fillRect(p.x - 7, p.y - 14 + bob, 14, 4);
  // Eyes look in the facing direction
  if (p.fy >= 0 || Math.abs(p.fx) > 0.3) {
    ctx.fillStyle = '#1b1b1b';
    const ex = p.x + p.fx * 3;
    ctx.fillRect(ex - 4, p.y - 8 + bob, 2, 3);
    ctx.fillRect(ex + 2, p.y - 8 + bob, 2, 3);
  }

  // Idle sword on the back/side when not swinging
  if (p.attack <= 0) {
    ctx.fillStyle = '#b8c2cf';
    ctx.fillRect(p.x + 8, p.y - 6 + bob, 3, 14);
    ctx.fillStyle = '#8a6a2a';
    ctx.fillRect(p.x + 6, p.y + 6 + bob, 7, 2);
  }
}

function drawEnemy(e) {
  const flash = e.hurt > 0;
  const col = flash ? '#ffffff' : enemyColor(e.type);
  const { x, y } = e;

  if (e.type === 'slime') {
    const squash = Math.sin(time * 6 + e.seed);
    const sw = 12 + squash * 2;
    const sh = 10 - squash * 2;
    drawShadow(x, y + 9, 11);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.ellipse(x, y + 8 - sh, sw, sh, 0, Math.PI, 0);
    ctx.lineTo(x + sw, y + 8);
    ctx.lineTo(x - sw, y + 8);
    ctx.fill();
    ctx.fillStyle = '#123312';
    ctx.fillRect(x - 5, y + 2 - sh, 3, 3);
    ctx.fillRect(x + 2, y + 2 - sh, 3, 3);
  } else if (e.type === 'bat') {
    const flap = Math.sin(time * 20 + e.seed) * 6;
    drawShadow(x, y + 14, 7);
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - 4, y);
    ctx.lineTo(x - 16, y - 4 + flap);
    ctx.lineTo(x - 10, y + 4);
    ctx.moveTo(x + 4, y);
    ctx.lineTo(x + 16, y - 4 + flap);
    ctx.lineTo(x + 10, y + 4);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(x - 3, y - 2, 2, 2);
    ctx.fillRect(x + 1, y - 2, 2, 2);
  } else if (e.type === 'orc') {
    drawShadow(x, y + 13, 12);
    ctx.fillStyle = flash ? '#fff' : '#5a3d22';
    ctx.fillRect(x - 11, y - 2, 22, 14);
    ctx.fillStyle = col;
    ctx.fillRect(x - 10, y - 16, 20, 15);
    ctx.fillStyle = '#ffeec2';
    ctx.fillRect(x - 7, y - 4, 3, 4);
    ctx.fillRect(x + 4, y - 4, 3, 4);
    ctx.fillStyle = '#c21f1f';
    ctx.fillRect(x - 6, y - 11, 3, 3);
    ctx.fillRect(x + 3, y - 11, 3, 3);
    // Club
    ctx.fillStyle = '#7a5530';
    ctx.fillRect(x + 11, y - 12, 5, 18);
  } else if (e.type === 'skeleton') {
    drawShadow(x, y + 11, 9);
    ctx.fillStyle = col;
    ctx.fillRect(x - 2, y - 2, 4, 12);
    ctx.fillRect(x - 7, y, 14, 2);
    ctx.fillRect(x - 7, y + 4, 14, 2);
    ctx.beginPath();
    ctx.arc(x, y - 9, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1b1b1b';
    ctx.fillRect(x - 4, y - 11, 3, 3);
    ctx.fillRect(x + 1, y - 11, 3, 3);
    // Bow aimed at the player
    const a = Math.atan2(player.y - y, player.x - x);
    ctx.strokeStyle = '#8a6a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * 6, y + Math.sin(a) * 6, 9, a - 1.2, a + 1.2);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  if (e.hp < e.t.hp) {
    const w = 20;
    ctx.fillStyle = '#000';
    ctx.fillRect(x - w / 2, y - e.h - 12, w, 3);
    ctx.fillStyle = '#e04848';
    ctx.fillRect(x - w / 2, y - e.h - 12, (w * e.hp) / e.t.hp, 3);
  }
}

function drawProjectiles() {
  for (const a of projectiles) {
    const ang = Math.atan2(a.vy, a.vx);
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(ang);
    ctx.fillStyle = '#a07a4a';
    ctx.fillRect(-9, -1, 14, 2);
    ctx.fillStyle = '#dfe6f0';
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(4, -3);
    ctx.lineTo(4, 3);
    ctx.fill();
    ctx.fillStyle = '#e8e2cf';
    ctx.fillRect(-10, -3, 3, 2);
    ctx.fillRect(-10, 1, 3, 2);
    ctx.restore();
  }
}

function drawParticles() {
  for (const q of particles) {
    ctx.globalAlpha = Math.max(0, q.life / q.max);
    ctx.fillStyle = q.color;
    ctx.fillRect(q.x - q.size / 2, q.y - q.size / 2, q.size, q.size);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  ctx.font = 'bold 14px "Courier New", monospace';
  for (const f of floatTexts) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = '#000';
    ctx.fillText(f.text, f.x + 1, f.y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

// Draws a heart; fill is 0 (empty), 0.5 (half) or 1 (full).
function drawHeart(x, y, fill) {
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x, y + 4);
    ctx.bezierCurveTo(x, y, x - 8, y - 2, x - 8, y + 4);
    ctx.bezierCurveTo(x - 8, y + 9, x, y + 12, x, y + 15);
    ctx.bezierCurveTo(x, y + 12, x + 8, y + 9, x + 8, y + 4);
    ctx.bezierCurveTo(x + 8, y - 2, x, y, x, y + 4);
  };
  path();
  ctx.fillStyle = '#2a1015';
  ctx.fill();
  if (fill > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 9, y - 3, fill === 1 ? 18 : 9, 20);
    ctx.clip();
    path();
    ctx.fillStyle = '#ff3b5c';
    ctx.fill();
    ctx.restore();
  }
  path();
  ctx.strokeStyle = '#000';
  ctx.stroke();
}

function drawHud() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, W, 28);

  for (let i = 0; i < MAX_HP / 2; i++) {
    const hp = player.hp - i * 2;
    drawHeart(18 + i * 22, 6, hp >= 2 ? 1 : hp === 1 ? 0.5 : 0);
  }

  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#d8d3c4';
  ctx.fillText(LEVELS[levelIndex].name, W / 2, 19);

  ctx.textAlign = 'right';
  if (enemies.length > 0) {
    ctx.fillStyle = '#ff9a7a';
    ctx.fillText(`Monsters: ${enemies.length}`, W - 12, 19);
  } else {
    ctx.fillStyle = '#ffd76a';
    ctx.fillText('Stairs open!', W - 12, 19);
  }
}

function drawBanner() {
  if (banner <= 0) return;
  const a = Math.min(1, banner);
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, H / 2 - 36, W, 64);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 28px "Courier New", monospace';
  ctx.fillText(LEVELS[levelIndex].name, W / 2, H / 2);
  ctx.fillStyle = '#d8d3c4';
  ctx.font = '14px "Courier New", monospace';
  ctx.fillText('Defeat every monster to unlock the stairs', W / 2, H / 2 + 20);
  ctx.globalAlpha = 1;
}

function drawCenteredScreen(title, titleColor, lines) {
  ctx.fillStyle = 'rgba(5,4,10,0.82)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 40px "Courier New", monospace';
  ctx.fillText(title, W / 2, H / 2 - 50);
  ctx.font = '16px "Courier New", monospace';
  lines.forEach((line, i) => {
    ctx.fillStyle = i === lines.length - 1 && Math.sin(time * 4) < 0 ? '#6b6577' : '#d8d3c4';
    ctx.fillText(line, W / 2, H / 2 + i * 26);
  });
}

function drawTitle() {
  ctx.fillStyle = '#0b0a10';
  ctx.fillRect(0, 0, W, H);

  // A silhouette of the tower
  const tx = W / 2 - 60;
  ctx.fillStyle = '#1c1826';
  ctx.fillRect(tx, 150, 120, 330);
  for (let i = 0; i < 6; i++) ctx.fillRect(tx - 10 + i * 24, 135, 14, 18);
  for (let f = 0; f < 4; f++) {
    const lit = Math.sin(time * 2 + f) > 0.2;
    ctx.fillStyle = f === 3 ? '#b02a3a' : lit ? '#ffd76a' : '#5a4e2a';
    ctx.fillRect(W / 2 - 6, 420 - f * 72, 12, 18);
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = 'bold 48px "Courier New", monospace';
  ctx.fillText('TOWER ASCENT', W / 2, 90);
  ctx.font = '15px "Courier New", monospace';
  ctx.fillStyle = '#d8d3c4';
  ctx.fillText('Climb the tower. Slay what stands in your way.', W / 2, 118);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#b8b2a4';
  const controls = ['WASD / Arrows  move', 'Space / J      attack', 'P              pause'];
  controls.forEach((c, i) => ctx.fillText(c, 24, 360 + i * 22));

  ctx.textAlign = 'center';
  ctx.fillStyle = Math.sin(time * 4) > 0 ? '#ffffff' : '#6b6577';
  ctx.font = 'bold 18px "Courier New", monospace';
  ctx.fillText('Press ENTER to begin', W / 2 + 180, 400);
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (state === 'title') {
    drawTitle();
    return;
  }

  const s = shake > 0 ? shake * 16 : 0;
  ctx.setTransform(1, 0, 0, 1, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);

  drawMap();
  drawPickups();
  const actors = [...enemies, player].sort((a, b) => a.y - b.y);
  for (const a of actors) {
    if (a === player) drawPlayer();
    else drawEnemy(a);
  }
  drawProjectiles();
  drawParticles();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHud();
  drawBanner();

  if (fade > 0) {
    ctx.fillStyle = `rgba(0,0,0,${fade})`;
    ctx.fillRect(0, 0, W, H);
  }

  if (state === 'paused') {
    drawCenteredScreen('PAUSED', '#d8d3c4', ['Press P to resume']);
  } else if (state === 'dead') {
    drawCenteredScreen('YOU FELL', '#ff4d4d', [
      `You were defeated on ${LEVELS[levelIndex].name}.`,
      'Press ENTER to try this floor again',
    ]);
  } else if (state === 'victory') {
    drawCenteredScreen('FLOOR 3 CLEARED', '#ffd76a', [
      'You stand before the final staircase.',
      'Something terrible waits at the top of the tower...',
      'The boss awaits — coming soon!',
      'Press ENTER to return to the title',
    ]);
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  draw();
  for (const k in pressed) delete pressed[k];
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
