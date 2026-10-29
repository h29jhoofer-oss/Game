// =====================================================================
// sprites.js — the pixel-art images, written as text.
//
// Each sprite is a list of rows. Each character is one pixel:
//   '.'  = transparent
//   any other letter = a color from the sprite's color key
//
// At startup, every sprite is "baked" into a small canvas once.
// During the game we simply copy those canvases to the screen.
// =====================================================================

// Color key shared by the player sprites.
const PLAYER_COLORS = {
  k: PALETTE.void, // dark outline
  c: PALETTE.cyan, // bright body
  b: PALETTE.blue, // suit
  d: PALETTE.darkBlue, // suit shading
  w: PALETTE.white, // eyes
};

// The eyes sit on the right side of the face so the player clearly
// "looks" to the right. We flip the sprite to make it face left.
const PLAYER_SPRITE_DATA = {
  idle: [
    '..kkkk..',
    '.kcccck.',
    'kcccwcwk',
    'kcccccck',
    '.kkbbkk.',
    'kcbbbbck',
    'kcbddbck',
    '.kbbbbk.',
    '.kb..bk.',
    '.kk..kk.',
  ],
  // Breathing frame: head dips one pixel, feet stay planted.
  idleBreath: [
    '........',
    '..kkkk..',
    '.kcccck.',
    'kcccwcwk',
    'kcccccck',
    'kcbbbbck',
    'kcbddbck',
    '.kbbbbk.',
    '.kb..bk.',
    '.kk..kk.',
  ],
  // Same as idle but with the eyes closed.
  blink: [
    '..kkkk..',
    '.kcccck.',
    'kcccbcbk',
    'kcccccck',
    '.kkbbkk.',
    'kcbbbbck',
    'kcbddbck',
    '.kbbbbk.',
    '.kb..bk.',
    '.kk..kk.',
  ],
  // Walking: one foot lifted, then the other.
  walkA: [
    '..kkkk..',
    '.kcccck.',
    'kcccwcwk',
    'kcccccck',
    '.kkbbkk.',
    'kcbbbbck',
    'kcbddbck',
    '.kbbbbk.',
    '.kb.kbk.',
    '.kk.....',
  ],
  walkB: [
    '..kkkk..',
    '.kcccck.',
    'kcccwcwk',
    'kcccccck',
    '.kkbbkk.',
    'kcbbbbck',
    'kcbddbck',
    '.kbbbbk.',
    '.kbk.bk.',
    '.....kk.',
  ],
};

// Turn a list of text rows into a canvas.
// If `solidColor` is given, every pixel uses that color (a silhouette).
function bakeSprite(rows, colors, solidColor = null) {
  const height = rows.length;
  const width = rows[0].length;
  const { canvas, ctx } = createOffscreenCanvas(width, height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = rows[y][x];
      if (key === '.') continue;
      ctx.fillStyle = solidColor || colors[key];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

// Make a mirrored copy of a canvas (so a right-facing sprite can face left).
function flipCanvas(source) {
  const { canvas, ctx } = createOffscreenCanvas(source.width, source.height);
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  return canvas;
}

// Bake one sprite into all the versions we need:
//   right / left : normal, facing each way
//   ghost[0] / ghost[1]... : solid-color silhouettes for the dash trail,
//                            one per color in ghostColors (bright -> dim)
function bakeSpriteSet(rows, colors, ghostColors) {
  const right = bakeSprite(rows, colors);
  const ghosts = ghostColors.map((color) => {
    const ghostRight = bakeSprite(rows, colors, color);
    return { right: ghostRight, left: flipCanvas(ghostRight) };
  });
  return {
    width: right.width,
    height: right.height,
    right,
    left: flipCanvas(right),
    ghosts,
  };
}

// Filled in by Sprites.init() once the page has loaded.
const Sprites = {
  player: {},

  init() {
    for (const name in PLAYER_SPRITE_DATA) {
      this.player[name] = bakeSpriteSet(PLAYER_SPRITE_DATA[name], PLAYER_COLORS, [
        PALETTE.cyanDim,
        PALETTE.blue,
        PALETTE.darkBlue,
      ]);
    }
  },
};
