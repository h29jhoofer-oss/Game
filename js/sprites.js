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

// Chaser enemy: a red slime with angry white eyes.
const CHASER_COLORS = {
  k: PALETTE.void,
  r: PALETTE.red,
  m: '#a3173a', // darker red for shading
  p: '#ff8a9a', // highlight
  w: PALETTE.white,
};

const CHASER_SPRITE_DATA = {
  // Stretched tall...
  hopA: [
    '...kk...',
    '..krrk..',
    '.kprrrk.',
    'krwrrwrk',
    'krkrrkrk',
    'krrrrrrk',
    'kmrrrrmk',
    '.kmmmmk.',
  ],
  // ...then squashed flat, which makes it look like it's bouncing.
  hopB: [
    '........',
    '........',
    '..kkkk..',
    '.kprrrk.',
    'krwrrwrk',
    'krkrrkrk',
    'kmrrrrmk',
    'kkmmmmkk',
  ],
};

// Toxic Slime: the chaser's shape in neon green, with darker sick spots
// and a little bubble of gas floating off its head.
const TOXIC_COLORS = {
  k: PALETTE.void,
  g: PALETTE.green,
  d: '#139a3c', // dark green spots and shading
  l: '#b6ffc8', // highlight and bubble
  w: PALETTE.white,
};

const TOXIC_SPRITE_DATA = {
  hopA: [
    '...kk.l.',
    '..kggk..',
    '.klgggk.',
    'kgwggwgk',
    'kgkggkgk',
    'kggdgggk',
    'kdggdgdk',
    '.kddddk.',
  ],
  hopB: [
    '......l.',
    '........',
    '..kkkk..',
    '.klgggk.',
    'kgwggwgk',
    'kgkggkgk',
    'kdgdggdk',
    'kkddddkk',
  ],
};

// Heart icons for the health display.
const HEART_COLORS = {
  k: PALETTE.void,
  r: PALETTE.red,
  p: '#ff8a9a',
  e: PALETTE.wallDark, // empty heart fill
};

const HEART_SPRITE_DATA = {
  full: [
    '.kk.kk.',
    'kprkrrk',
    'krrrrrk',
    '.krrrk.',
    '..krk..',
    '...k...',
  ],
  empty: [
    '.kk.kk.',
    'keekeek',
    'keeeeek',
    '.keeek.',
    '..kek..',
    '...k...',
  ],
};

// Energy orb: a glowing yellow gem with a shimmering center.
const ORB_COLORS = {
  o: '#b07a12', // dark gold edge
  y: PALETTE.yellow,
  l: '#fffbd0', // bright core
};

const ORB_SPRITE_DATA = {
  bright: [
    '.oyo.',
    'oylyo',
    'yllly',
    'oylyo',
    '.oyo.',
  ],
  dim: [
    '.oyo.',
    'oyyyo',
    'yylyy',
    'oyyyo',
    '.oyo.',
  ],
};

// Shooter enemy: a floating purple eye-drone with little thrusters.
const SHOOTER_COLORS = {
  k: PALETTE.void,
  p: PALETTE.purple,
  d: '#5a1a9a', // shadow purple
  l: '#d08aff', // highlight
  w: PALETTE.white, // eye
};

// While charging a shot, its eye turns pink: same picture, different colors.
const SHOOTER_CHARGE_COLORS = { ...SHOOTER_COLORS, w: PALETTE.pink, l: PALETTE.pink };

const SHOOTER_SPRITE_DATA = {
  floatA: [
    '..kkkkk..',
    '.kpplppk.',
    'kpplllppk',
    'kplwwwlpk',
    'kplwkwlpk',
    'kplwwwlpk',
    'kpplllppk',
    '.kdpppdk.',
    '..k.k.k..',
  ],
  floatB: [
    '..kkkkk..',
    '.kpplppk.',
    'kpplllppk',
    'kplwwwlpk',
    'kplwkwlpk',
    'kplwwwlpk',
    'kpplllppk',
    '.kdpppdk.',
    '.k.k.k.k.',
  ],
};

// Brute enemy: a horned orange monster that stomps along.
const BRUTE_COLORS = {
  k: PALETTE.void,
  o: PALETTE.orange,
  d: '#a34a0a', // dark orange
  y: '#ffc23d', // horns
  r: PALETTE.red, // eyes
  w: PALETTE.white,
};

const BRUTE_BODY = [
  '.kk......kk.',
  '.kyk....kyk.',
  '..kykkkkyk..',
  '.kooooooook.',
  'koddooooddok',
  'kowroooorwok',
  'kooooooooook',
  'kodkwkkwkdok',
  'koddddddddok',
  '.kooddddook.',
];

const BRUTE_SPRITE_DATA = {
  // Standing tall on its legs...
  stepA: [...BRUTE_BODY, '.kook..kook.', '.kkkk..kkkk.'],
  // ...then stomping down (body drops a pixel, legs squash).
  stepB: ['............', ...BRUTE_BODY, '.kkkk..kkkk.'],
};

// Small shield icon for the HUD.
const SHIELD_ICON_COLORS = { k: PALETTE.void, c: PALETTE.cyan, w: PALETTE.white, b: PALETTE.blue };
const SHIELD_ICON_DATA = {
  ready: [
    'kkkkkkk',
    'kcwccck',
    'kwcccck',
    'kccccck',
    '.kccck.',
    '..kck..',
    '...k...',
  ],
  // Recharging: the same shape in dark blue.
  empty: [
    'kkkkkkk',
    'kbbbbbk',
    'kbbbbbk',
    'kbbbbbk',
    '.kbbbk.',
    '..kbk..',
    '...k...',
  ],
};

// Turn a list of text rows into a canvas.
// If `solidColor` is given, every pixel uses that color (a silhouette).
function bakeSprite(rows, colors, solidColor = null) {
  const height = rows.length;
  const width = rows[0].length;
  // Catch typos early: every row of a sprite must be the same length.
  rows.forEach((row, i) => {
    if (row.length !== width) throw new Error('Sprite row ' + i + ' is ' + row.length + ' wide, expected ' + width + ': ' + row);
  });
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
  chaser: {},
  toxic: {},
  heart: {},
  orb: {},
  shooter: {},
  shooterCharge: {},
  brute: {},
  shieldIcon: {},

  init() {
    for (const name in CHASER_SPRITE_DATA) {
      // The white silhouette is used to flash enemies when they get hit.
      this.chaser[name] = bakeSpriteSet(CHASER_SPRITE_DATA[name], CHASER_COLORS, [PALETTE.white]);
    }
    for (const name in TOXIC_SPRITE_DATA) {
      this.toxic[name] = bakeSpriteSet(TOXIC_SPRITE_DATA[name], TOXIC_COLORS, [PALETTE.white]);
    }
    for (const name in SHOOTER_SPRITE_DATA) {
      this.shooter[name] = bakeSpriteSet(SHOOTER_SPRITE_DATA[name], SHOOTER_COLORS, [PALETTE.white]);
      this.shooterCharge[name] = bakeSpriteSet(SHOOTER_SPRITE_DATA[name], SHOOTER_CHARGE_COLORS, [PALETTE.white]);
    }
    for (const name in BRUTE_SPRITE_DATA) {
      this.brute[name] = bakeSpriteSet(BRUTE_SPRITE_DATA[name], BRUTE_COLORS, [PALETTE.white]);
    }
    for (const name in SHIELD_ICON_DATA) {
      this.shieldIcon[name] = bakeSprite(SHIELD_ICON_DATA[name], SHIELD_ICON_COLORS);
    }
    for (const name in ORB_SPRITE_DATA) {
      this.orb[name] = bakeSprite(ORB_SPRITE_DATA[name], ORB_COLORS);
    }
    for (const name in HEART_SPRITE_DATA) {
      this.heart[name] = bakeSprite(HEART_SPRITE_DATA[name], HEART_COLORS);
    }
    for (const name in PLAYER_SPRITE_DATA) {
      this.player[name] = bakeSpriteSet(PLAYER_SPRITE_DATA[name], PLAYER_COLORS, [
        PALETTE.cyanDim,
        PALETTE.blue,
        PALETTE.darkBlue,
        PALETTE.white, // last one: the white "I got hit" flash
      ]);
    }
  },
};
