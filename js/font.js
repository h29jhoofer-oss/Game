// =====================================================================
// font.js — a tiny hand-made 3x5 pixel font.
//
// Normal web fonts are smooth (anti-aliased), which would look wrong in
// a pixel-art game. Instead, every letter is drawn from a 3x5 grid:
//   '#' = filled pixel, '.' = empty pixel
// =====================================================================

const GLYPH_WIDTH = 3;
const GLYPH_HEIGHT = 5;
const GLYPH_SPACING = 1; // empty pixels between letters

const GLYPHS = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  0: ['###', '#.#', '#.#', '#.#', '###'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  2: ['##.', '..#', '.#.', '#..', '###'],
  3: ['##.', '..#', '.#.', '..#', '##.'],
  4: ['#.#', '#.#', '###', '..#', '..#'],
  5: ['###', '#..', '##.', '..#', '##.'],
  6: ['.##', '#..', '###', '#.#', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '##.'],
  ':': ['...', '.#.', '...', '.#.', '...'],
  '.': ['...', '...', '...', '...', '.#.'],
  ',': ['...', '...', '...', '.#.', '#..'],
  '-': ['...', '...', '###', '...', '...'],
  '+': ['...', '.#.', '###', '.#.', '...'],
  '!': ['.#.', '.#.', '.#.', '...', '.#.'],
  '?': ['##.', '..#', '.#.', '...', '.#.'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  "'": ['.#.', '.#.', '...', '...', '...'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  ' ': ['...', '...', '...', '...', '...'],
};

// Drawing each letter pixel-by-pixel every frame would be slow, so the
// first time we need a letter in a color we draw it once and remember it.
const glyphCache = new Map();

function getGlyphImage(char, color) {
  const key = char + color;
  if (glyphCache.has(key)) return glyphCache.get(key);

  const rows = GLYPHS[char] || GLYPHS['?'];
  const { canvas, ctx } = createOffscreenCanvas(GLYPH_WIDTH, GLYPH_HEIGHT);
  ctx.fillStyle = color;
  for (let y = 0; y < GLYPH_HEIGHT; y++) {
    for (let x = 0; x < GLYPH_WIDTH; x++) {
      if (rows[y][x] === '#') ctx.fillRect(x, y, 1, 1);
    }
  }
  glyphCache.set(key, canvas);
  return canvas;
}

// How wide a piece of text will be, in pixels.
function measureText(text, scale = 1) {
  if (text.length === 0) return 0;
  return (text.length * (GLYPH_WIDTH + GLYPH_SPACING) - GLYPH_SPACING) * scale;
}

// Draw text on the canvas.
//   options.align  : 'left' (default), 'center' or 'right'
//   options.scale  : 1, 2, 3... makes letters bigger (whole numbers only!)
//   options.shadow : a color for a 1-pixel drop shadow, or null
function drawText(ctx, text, x, y, color, options = {}) {
  const scale = options.scale || 1;
  const align = options.align || 'left';
  const shadow = options.shadow || null;
  text = String(text).toUpperCase();

  let startX = x;
  const width = measureText(text, scale);
  if (align === 'center') startX = x - Math.floor(width / 2);
  if (align === 'right') startX = x - width;

  // Round so letters always sit exactly on the pixel grid.
  startX = Math.round(startX);
  const startY = Math.round(y);

  if (shadow) drawTextRaw(ctx, text, startX + scale, startY + scale, shadow, scale);
  drawTextRaw(ctx, text, startX, startY, color, scale);
}

function drawTextRaw(ctx, text, x, y, color, scale) {
  const step = (GLYPH_WIDTH + GLYPH_SPACING) * scale;
  for (let i = 0; i < text.length; i++) {
    const image = getGlyphImage(text[i], color);
    ctx.drawImage(image, x + i * step, y, GLYPH_WIDTH * scale, GLYPH_HEIGHT * scale);
  }
}
