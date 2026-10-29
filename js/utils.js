// =====================================================================
// utils.js — small helper functions used all over the game.
// =====================================================================

// Keep a number between a minimum and a maximum.
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Random decimal number between min and max.
function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

// Random whole number from min to max (both included).
function randomInt(min, max) {
  return Math.floor(randomRange(min, max + 1));
}

// Create an off-screen canvas we can draw into once and reuse later.
// Drawing a pre-made canvas is much faster than redrawing every pixel.
function createOffscreenCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}
