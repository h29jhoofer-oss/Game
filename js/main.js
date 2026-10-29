// =====================================================================
// main.js — starts everything and keeps the canvas scaled correctly.
// =====================================================================

let currentScale = 1;

// Make the 320x180 canvas as big as possible while:
//   - keeping the 16:9 shape (no stretching)
//   - using a WHOLE-NUMBER scale (2x, 3x, 4x...) so every game pixel
//     becomes an exact square block of screen pixels.
function resizeCanvas(canvas, container) {
  // devicePixelRatio is >1 on high-resolution screens (and when the
  // browser is zoomed). Working in real device pixels keeps it crisp there too.
  const dpr = window.devicePixelRatio || 1;
  const availableW = container.clientWidth * dpr;
  const availableH = container.clientHeight * dpr;

  let scale = Math.floor(Math.min(availableW / VIEW_WIDTH, availableH / VIEW_HEIGHT));
  if (scale < 1) {
    // Window is tiny: shrink to fit. Not perfectly crisp, but still usable.
    scale = Math.min(availableW / VIEW_WIDTH, availableH / VIEW_HEIGHT);
  }
  currentScale = Math.round(scale * 100) / 100;

  // The canvas keeps its 320x180 drawing size; we only change how big
  // it appears on the page (in CSS pixels).
  canvas.style.width = (VIEW_WIDTH * scale) / dpr + 'px';
  canvas.style.height = (VIEW_HEIGHT * scale) / dpr + 'px';
}

window.addEventListener('load', () => {
  const canvas = document.getElementById('game-canvas');
  const container = document.getElementById('game-container');

  Input.init();
  Game.init(canvas);

  resizeCanvas(canvas, container);
  window.addEventListener('resize', () => resizeCanvas(canvas, container));

  Game.start();
});
