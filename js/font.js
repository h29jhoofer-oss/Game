// =============================================================
// font.js — A tiny pixel font (mostly 3x5) drawn with rectangles, so all
// text in the canvas stays perfectly crisp. '#' = filled pixel.
// Add a new character by adding one more line to GLYPHS.
// =============================================================

OMJ.PixelFont = (function () {
  const GLYPHS = {
    'A': '###|#.#|###|#.#|#.#', 'B': '##.|#.#|##.|#.#|##.', 'C': '###|#..|#..|#..|###',
    'D': '##.|#.#|#.#|#.#|##.', 'E': '###|#..|##.|#..|###', 'F': '###|#..|##.|#..|#..',
    'G': '###|#..|#.#|#.#|###', 'H': '#.#|#.#|###|#.#|#.#', 'I': '###|.#.|.#.|.#.|###',
    'J': '..#|..#|..#|#.#|###', 'K': '#.#|#.#|##.|#.#|#.#', 'L': '#..|#..|#..|#..|###',
    'M': '#...#|##.##|#.#.#|#...#|#...#', 'N': '#..#|##.#|#.##|#..#|#..#', 'O': '###|#.#|#.#|#.#|###',
    'P': '###|#.#|###|#..|#..', 'Q': '###|#.#|#.#|###|..#', 'R': '###|#.#|##.|#.#|#.#',
    'S': '###|#..|###|..#|###', 'T': '###|.#.|.#.|.#.|.#.', 'U': '#.#|#.#|#.#|#.#|###',
    'V': '#.#|#.#|#.#|#.#|.#.', 'W': '#...#|#...#|#.#.#|##.##|#...#', 'X': '#.#|#.#|.#.|#.#|#.#',
    'Y': '#.#|#.#|.#.|.#.|.#.', 'Z': '###|..#|.#.|#..|###',
    '0': '###|#.#|#.#|#.#|###', '1': '.#.|##.|.#.|.#.|###', '2': '###|..#|###|#..|###',
    '3': '###|..#|.##|..#|###', '4': '#.#|#.#|###|..#|..#', '5': '###|#..|###|..#|###',
    '6': '###|#..|###|#.#|###', '7': '###|..#|..#|.#.|.#.', '8': '###|#.#|###|#.#|###',
    '9': '###|#.#|###|..#|###',
    '!': '.#.|.#.|.#.|...|.#.', '?': '###|..#|.##|...|.#.', '.': '...|...|...|...|.#.',
    ',': '...|...|...|.#.|#..', ':': '...|.#.|...|.#.|...', "'": '.#.|.#.|...|...|...',
    '-': '...|...|###|...|...', '+': '...|.#.|###|.#.|...', '/': '..#|..#|.#.|#..|#..',
    ' ': '...|...|...|...|...',
  };

  // Turn the strings above into lists of [x, y] pixels once, at startup.
  // Most letters are 3 pixels wide; a few (M, N, W) are wider.
  const PIXELS = {};
  const WIDTHS = {};
  for (const ch in GLYPHS) {
    const rows = GLYPHS[ch].split('|');
    const list = [];
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        if (rows[y][x] === '#') list.push(x, y);
      }
    }
    PIXELS[ch] = list;
    WIDTHS[ch] = rows[0].length;
  }

  const CHAR_H = 5;
  const SPACING = 1;

  function glyphKey(ch) {
    const upper = ch.toUpperCase();
    return PIXELS[upper] ? upper : '?';
  }

  function measure(text, scale) {
    if (text.length === 0) return 0;
    let w = 0;
    for (let i = 0; i < text.length; i++) w += WIDTHS[glyphKey(text[i])] + SPACING;
    return (w - SPACING) * scale;
  }

  // align: 'left' | 'center' | 'right'
  function draw(ctx, text, x, y, scale, color, align) {
    if (align === 'center') x -= measure(text, scale) / 2;
    else if (align === 'right') x -= measure(text, scale);
    x = Math.round(x);
    y = Math.round(y);
    ctx.fillStyle = color;
    let cx = x;
    for (let i = 0; i < text.length; i++) {
      const key = glyphKey(text[i]);
      const pixels = PIXELS[key];
      for (let p = 0; p < pixels.length; p += 2) {
        ctx.fillRect(cx + pixels[p] * scale, y + pixels[p + 1] * scale, scale, scale);
      }
      cx += (WIDTHS[key] + SPACING) * scale;
    }
  }

  // Draw text with a 1-pixel dark shadow underneath — easier to read.
  function drawShadowed(ctx, text, x, y, scale, color, shadowColor, align) {
    draw(ctx, text, x, y + scale, scale, shadowColor, align);
    draw(ctx, text, x, y, scale, color, align);
  }

  // Render a big title into its own small <canvas> (used by the menus).
  // CSS then scales it up with crisp "pixelated" scaling.
  function renderTitle(canvas, text, color, outline, shadow) {
    const w = measure(text, 1) + 2;
    const h = CHAR_H + 3;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);
    draw(ctx, text, 1, 2, 1, shadow, 'left');            // drop shadow
    for (let dx = -1; dx <= 1; dx++) {                    // outline
      for (let dy = -1; dy <= 1; dy++) draw(ctx, text, 1 + dx, 1 + dy, 1, outline, 'left');
    }
    draw(ctx, text, 1, 1, 1, color, 'left');
    return { width: w, height: h };
  }

  return { draw, drawShadowed, measure, renderTitle, CHAR_H };
})();
