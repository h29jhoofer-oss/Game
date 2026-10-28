// =============================================================
// sprites.js — Turns little text pictures into pixel-art images.
// Each character in a row is one pixel; the palette says which
// color each character means. '.' is always transparent.
// =============================================================

OMJ.Sprites = {
  // Build an off-screen canvas from rows of text + a palette.
  fromStrings(rows, palette) {
    const canvas = document.createElement('canvas');
    canvas.width = rows[0].length;
    canvas.height = rows.length;
    const ctx = canvas.getContext('2d');
    for (let y = 0; y < rows.length; y++) {
      for (let x = 0; x < rows[y].length; x++) {
        const color = palette[rows[y][x]];
        if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(x, y, 1, 1);
      }
    }
    return canvas;
  },

  // Draw a filled pixel circle (no blurry edges).
  circle(ctx, cx, cy, r, color) {
    ctx.fillStyle = color;
    for (let y = -r; y <= r; y++) {
      const half = Math.floor(Math.sqrt(r * r - y * y));
      ctx.fillRect(cx - half, cy + y, half * 2 + 1, 1);
    }
  },

  // Seeded random numbers: the same seed always gives the same
  // "random" landscape, so backgrounds look identical every visit.
  seededRandom(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },
};

// The game's limited color palette. Re-using these keeps the art cohesive.
OMJ.PALETTE = {
  ink: '#1d1a2f',        // outlines
  white: '#fffdf4',
  shadow: '#000000',
  dirt: '#8b5a2b',
  dirtDark: '#6b4220',
  dirtLight: '#a8743c',
  grass: '#5ad04a',
  grassLight: '#8ef06a',
  grassDark: '#3a9a3a',
  pit: '#120d1f',
  pitTop: '#2a1a24',
  metal: '#c8ccd8',
  metalLight: '#ffffff',
  metalDark: '#7d8299',
  wood: '#c9843e',
  woodLight: '#e8a95c',
  woodDark: '#8a5424',
  danger: '#e8384f',
  dangerDark: '#9c1f35',
  gold: '#ffd23f',
  dust: '#e8d7b0',
  dustDark: '#c9b48a',
};
