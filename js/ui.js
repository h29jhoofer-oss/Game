// =====================================================================
// ui.js — shared interface pieces: panels, bars, buttons, small icons,
// and little helpers used by several screens.
// =====================================================================

const ICON_DATA = {
  soundOn: [
    '...c....',
    '..cc..c.',
    'cccc.c.c',
    'cccc.c.c',
    'cccc.c.c',
    '..cc..c.',
    '...c....',
  ],
  soundOff: [
    '...c....',
    '..cc....',
    'cccc.r.r',
    'cccc..r.',
    'cccc.r.r',
    '..cc....',
    '...c....',
  ],
  pause: [
    '........',
    '.cc..cc.',
    '.cc..cc.',
    '.cc..cc.',
    '.cc..cc.',
    '.cc..cc.',
    '........',
  ],
};

const UI = {
  icons: {}, // { soundOn: { normal, hover }, ... }

  init() {
    for (const name in ICON_DATA) {
      // Two versions of each icon: dim normally, bright when hovered.
      this.icons[name] = {
        normal: bakeSprite(ICON_DATA[name], { c: PALETTE.cyanDim, r: PALETTE.red }),
        hover: bakeSprite(ICON_DATA[name], { c: PALETTE.white, r: PALETTE.red }),
      };
    }
  },
};

// Turn seconds into a clock like 1:05.
function formatTime(seconds) {
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return minutes + ':' + String(rest).padStart(2, '0');
}

// Is the point (x, y) inside a box {x, y, width, height}?
function pointInBox(x, y, box) {
  return x >= box.x && x < box.x + box.width && y >= box.y && y < box.y + box.height;
}

// The checkerboard overlay is drawn once and reused, since filling
// thousands of single pixels every frame would be wasteful.
let ditherOverlay = null;
function getDitherOverlay() {
  if (ditherOverlay) return ditherOverlay;
  const { canvas, ctx } = createOffscreenCanvas(VIEW_WIDTH, VIEW_HEIGHT);
  ctx.fillStyle = PALETTE.black;
  for (let y = 0; y < VIEW_HEIGHT; y++) {
    for (let x = y % 2; x < VIEW_WIDTH; x += 2) ctx.fillRect(x, y, 1, 1);
  }
  ditherOverlay = canvas;
  return ditherOverlay;
}

// A bordered progress bar. `fraction` goes from 0 (empty) to 1 (full).
function drawPixelBar(ctx, x, y, width, height, fraction, color) {
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(x - 1, y - 1, width + 2, height + 2);
  ctx.fillStyle = PALETTE.gridLine;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(width * clamp(fraction, 0, 1)), height);
}

// A retro window: dark fill, double border, and notched corners.
function drawPixelPanel(ctx, x, y, width, height) {
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = PALETTE.cyanDim;
  ctx.fillRect(x + 1, y, width - 2, 1);
  ctx.fillRect(x + 1, y + height - 1, width - 2, 1);
  ctx.fillRect(x, y + 1, 1, height - 2);
  ctx.fillRect(x + width - 1, y + 1, 1, height - 2);
  ctx.fillStyle = PALETTE.wallDark;
  ctx.fillRect(x + 2, y + 2, width - 4, 1);
  ctx.fillRect(x + 2, y + height - 3, width - 4, 1);
  ctx.fillRect(x + 2, y + 2, 1, height - 4);
  ctx.fillRect(x + width - 3, y + 2, 1, height - 4);
}

// A clickable pixel button.
//   primary : a filled, eye-catching button (like PLAY or RESTART)
//   active  : highlighted (hovered by the mouse or selected by keyboard)
function drawButton(ctx, box, label, { primary = false, active = false } = {}) {
  const { x, y, width, height } = box;
  if (primary) {
    ctx.fillStyle = active ? PALETTE.cyan : PALETTE.blue;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = active ? PALETTE.white : PALETTE.cyanDim;
    ctx.fillRect(x, y, width, 1); // light top edge
    ctx.fillStyle = PALETTE.darkBlue;
    ctx.fillRect(x, y + height - 1, width, 1); // dark bottom edge
  } else {
    ctx.fillStyle = active ? PALETTE.navy : PALETTE.void;
    ctx.fillRect(x, y, width, height);
    ctx.fillStyle = active ? PALETTE.yellow : PALETTE.wallDark;
    ctx.fillRect(x, y, width, 1);
    ctx.fillRect(x, y + height - 1, width, 1);
    ctx.fillRect(x, y, 1, height);
    ctx.fillRect(x + width - 1, y, 1, height);
  }
  const textColor = primary ? (active ? PALETTE.void : PALETTE.white) : active ? PALETTE.yellow : PALETTE.cyanDim;
  drawText(ctx, label, x + Math.floor(width / 2), y + Math.floor((height - 5) / 2), textColor, { align: 'center' });

  // A blinking arrow marks the keyboard selection.
  if (active && !primary && Math.floor(performance.now() / 250) % 2 === 0) {
    ctx.fillStyle = PALETTE.yellow;
    const ay = y + Math.floor(height / 2);
    ctx.fillRect(x - 5, ay - 2, 1, 5);
    ctx.fillRect(x - 4, ay - 1, 1, 3);
    ctx.fillRect(x - 3, ay, 1, 1);
  }
}

// A small square button with an icon (mute, pause).
function drawIconButton(ctx, box, iconName, hovered) {
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(box.x, box.y, box.width, box.height);
  ctx.fillStyle = hovered ? PALETTE.cyan : PALETTE.wallDark;
  ctx.fillRect(box.x, box.y, box.width, 1);
  ctx.fillRect(box.x, box.y + box.height - 1, box.width, 1);
  ctx.fillRect(box.x, box.y, 1, box.height);
  ctx.fillRect(box.x + box.width - 1, box.y, 1, box.height);
  const icon = UI.icons[iconName][hovered ? 'hover' : 'normal'];
  ctx.drawImage(icon, box.x + Math.floor((box.width - icon.width) / 2), box.y + Math.floor((box.height - icon.height) / 2));
}
