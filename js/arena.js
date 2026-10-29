// =====================================================================
// arena.js — draws the background, the floor and the arena walls.
//
// Most of the arena never changes, so we draw it ONCE into an off-screen
// canvas at startup. Each frame we copy that image to the screen and then
// draw the few animated parts (glowing tiles, twinkling stars) on top.
// =====================================================================

// Colors a glowing floor tile steps through. We jump between these
// colors instead of fading smoothly, which keeps the pixel-art look.
const GLOW_STEPS_CYAN = [PALETTE.navy, PALETTE.speck, PALETTE.darkBlue, PALETTE.blue, PALETTE.cyanDim];
const GLOW_STEPS_PINK = [PALETTE.navy, PALETTE.speck, '#3a1a6b', '#7a2a9a', PALETTE.pink];

const GLOW_TILE_COUNT = 10;
const STAR_COUNT = 40;

const Arena = {
  staticImage: null, // the pre-drawn background + floor + walls
  glowTiles: [],
  stars: [],

  init() {
    this.staticImage = this.drawStaticLayer();
    this.glowTiles = [];
    for (let i = 0; i < GLOW_TILE_COUNT; i++) this.glowTiles.push(this.makeGlowTile());
    this.stars = this.makeStars();
  },

  // ---------------------------------------------------------------
  // Static layer (drawn once)
  // ---------------------------------------------------------------
  drawStaticLayer() {
    const { canvas, ctx } = createOffscreenCanvas(VIEW_WIDTH, VIEW_HEIGHT);

    // 1. Space outside the arena: near-black with darker navy tiles.
    ctx.fillStyle = PALETTE.black;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    for (let ty = 0; ty < VIEW_HEIGHT / TILE_SIZE; ty++) {
      for (let tx = 0; tx < VIEW_WIDTH / TILE_SIZE; tx++) {
        if ((tx + ty) % 2 === 0) {
          ctx.fillStyle = PALETTE.void;
          ctx.fillRect(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        }
      }
    }

    // 2. Arena floor: one tile at a time.
    const cols = ARENA.width / TILE_SIZE;
    const rows = ARENA.height / TILE_SIZE;
    for (let ty = 0; ty < rows; ty++) {
      for (let tx = 0; tx < cols; tx++) {
        this.drawFloorTile(ctx, ARENA.x + tx * TILE_SIZE, ARENA.y + ty * TILE_SIZE, tx, ty);
      }
    }

    // 3. Walls around the arena.
    this.drawWalls(ctx);
    return canvas;
  },

  drawFloorTile(ctx, x, y, tx, ty) {
    // A very subtle checkerboard so the floor isn't one flat color.
    ctx.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.navy : PALETTE.navyAlt;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Grid lines along the top and left edge of each tile.
    ctx.fillStyle = PALETTE.gridLine;
    ctx.fillRect(x, y, TILE_SIZE, 1);
    ctx.fillRect(x, y, 1, TILE_SIZE);

    // A brighter "plus" where four big 4x4-tile panels meet.
    if (tx % 4 === 0 && ty % 4 === 0) {
      ctx.fillStyle = PALETTE.speck;
      ctx.fillRect(x - 1, y, 3, 1);
      ctx.fillRect(x, y - 1, 1, 3);
    }

    // A few random specks for texture.
    if (Math.random() < 0.25) {
      ctx.fillStyle = PALETTE.speck;
      ctx.fillRect(x + randomInt(2, 6), y + randomInt(2, 6), 1, 1);
    }
  },

  drawWalls(ctx) {
    const left = ARENA.x;
    const top = ARENA.y;
    const right = ARENA.x + ARENA.width;
    const bottom = ARENA.y + ARENA.height;

    // Three rings of color from the outside in: outline, wall, neon trim.
    const rings = [
      { offset: 4, color: PALETTE.void },
      { offset: 3, color: PALETTE.wallDark },
      { offset: 2, color: PALETTE.wallDark },
      { offset: 1, color: PALETTE.cyanDim },
    ];
    for (const ring of rings) {
      ctx.fillStyle = ring.color;
      const o = ring.offset;
      ctx.fillRect(left - o, top - o, ARENA.width + o * 2, 1); // top
      ctx.fillRect(left - o, bottom + o - 1, ARENA.width + o * 2, 1); // bottom
      ctx.fillRect(left - o, top - o, 1, ARENA.height + o * 2); // left
      ctx.fillRect(right + o - 1, top - o, 1, ARENA.height + o * 2); // right
    }

    // Bright neon dashes along the trim every 16 pixels.
    ctx.fillStyle = PALETTE.cyan;
    for (let x = left + 8; x < right - 8; x += 16) {
      ctx.fillRect(x, top - 1, 4, 1);
      ctx.fillRect(x, bottom, 4, 1);
    }
    for (let y = top + 8; y < bottom - 8; y += 16) {
      ctx.fillRect(left - 1, y, 1, 4);
      ctx.fillRect(right, y, 1, 4);
    }

    // Little pink "bolts" on each corner.
    const corners = [
      [left - 4, top - 4],
      [right, top - 4],
      [left - 4, bottom],
      [right, bottom],
    ];
    for (const [cx, cy] of corners) {
      ctx.fillStyle = PALETTE.void;
      ctx.fillRect(cx, cy, 4, 4);
      ctx.fillStyle = PALETTE.pink;
      ctx.fillRect(cx + 1, cy + 1, 2, 2);
    }
  },

  // ---------------------------------------------------------------
  // Animated parts
  // ---------------------------------------------------------------
  makeGlowTile() {
    const cols = ARENA.width / TILE_SIZE;
    const rows = ARENA.height / TILE_SIZE;
    return {
      tx: randomInt(0, cols - 1),
      ty: randomInt(0, rows - 1),
      steps: Math.random() < 0.8 ? GLOW_STEPS_CYAN : GLOW_STEPS_PINK,
      time: randomRange(0, 3), // where it starts in its pulse
      duration: randomRange(2, 4), // seconds for one full pulse
    };
  },

  makeStars() {
    // Stars only appear in the space around the arena, not on the floor.
    const stars = [];
    while (stars.length < STAR_COUNT) {
      const x = randomInt(0, VIEW_WIDTH - 1);
      const y = randomInt(0, VIEW_HEIGHT - 1);
      const insideArena =
        x >= ARENA.x - 5 && x <= ARENA.x + ARENA.width + 5 &&
        y >= ARENA.y - 5 && y <= ARENA.y + ARENA.height + 5;
      if (!insideArena) stars.push({ x, y, phase: randomRange(0, 10) });
    }
    return stars;
  },

  update(dt) {
    for (let i = 0; i < this.glowTiles.length; i++) {
      const tile = this.glowTiles[i];
      tile.time += dt;
      // When a tile finishes its pulse, it moves somewhere new.
      if (tile.time >= tile.duration) this.glowTiles[i] = this.makeGlowTile();
    }
  },

  draw(ctx, time) {
    ctx.drawImage(this.staticImage, 0, 0);

    // Twinkling stars: each one blinks on and off in hard steps.
    for (const star of this.stars) {
      const level = Math.floor((time * 2 + star.phase) % 4);
      if (level === 0) continue;
      ctx.fillStyle = level === 3 ? PALETTE.cyanDim : PALETTE.speck;
      ctx.fillRect(star.x, star.y, 1, 1);
    }

    // Glowing floor tiles: brighten then dim through a few fixed colors.
    for (const tile of this.glowTiles) {
      const progress = tile.time / tile.duration; // 0 -> 1
      const triangle = 1 - Math.abs(progress * 2 - 1); // 0 -> 1 -> 0
      const stepIndex = Math.min(tile.steps.length - 1, Math.floor(triangle * tile.steps.length));
      if (stepIndex === 0) continue;

      const x = ARENA.x + tile.tx * TILE_SIZE;
      const y = ARENA.y + tile.ty * TILE_SIZE;
      // Fill the inside of the tile, leaving its grid lines visible.
      ctx.fillStyle = tile.steps[stepIndex];
      ctx.fillRect(x + 2, y + 2, TILE_SIZE - 3, TILE_SIZE - 3);
      // At the brightest step, add a tiny white core.
      if (stepIndex === tile.steps.length - 1) {
        ctx.fillStyle = PALETTE.white;
        ctx.fillRect(x + 4, y + 4, 1, 1);
      }
    }
  },
};
