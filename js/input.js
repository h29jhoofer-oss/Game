// =====================================================================
// input.js — keeps track of which keys are pressed.
//
// Two ways to ask about a key:
//   Input.isDown('KeyW')     -> true for as long as the key is held
//   Input.wasPressed('Space') -> true only on the frame it was pressed
// =====================================================================

const Input = {
  held: new Set(), // keys being held right now
  pressed: new Set(), // keys pressed since the last frame

  // Keys the game uses. We stop the browser's normal behavior for these
  // (for example, Space and the arrow keys would scroll the page).
  gameKeys: new Set([
    'KeyW', 'KeyA', 'KeyS', 'KeyD',
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'Escape', 'Enter', 'KeyR', 'KeyG',
    'Digit1', 'Digit2', 'Digit3', 'KeyM',
  ]),

  init() {
    window.addEventListener('keydown', (event) => this.onKeyDown(event));
    window.addEventListener('keyup', (event) => this.onKeyUp(event));

    // If the window loses focus, the browser never tells us about key
    // releases. Forget all keys so the player doesn't keep walking.
    window.addEventListener('blur', () => this.clear());
  },

  onKeyDown(event) {
    // Don't steal keys while the user types in a text box elsewhere on the page.
    if (isTypingTarget(event.target)) return;
    if (!this.gameKeys.has(event.code)) return;

    event.preventDefault();
    // Holding a key makes the browser repeat keydown events. Only count
    // the first one as a "press".
    if (!event.repeat) this.pressed.add(event.code);
    this.held.add(event.code);
  },

  onKeyUp(event) {
    if (!this.gameKeys.has(event.code)) return;
    this.held.delete(event.code);
  },

  isDown(code) {
    return this.held.has(code);
  },

  wasPressed(code) {
    return this.pressed.has(code);
  },

  // Called at the end of every frame so "pressed" only lasts one frame.
  endFrame() {
    this.pressed.clear();
  },

  clear() {
    this.held.clear();
    this.pressed.clear();
  },

  // Returns the movement direction from WASD / arrow keys as {x, y}.
  // Each part is -1, 0 or 1. Normalizing happens in the player code.
  getMoveDirection() {
    let x = 0;
    let y = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) x -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) x += 1;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) y -= 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) y += 1;
    return { x, y };
  },
};

function isTypingTarget(element) {
  if (!element) return false;
  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || element.isContentEditable;
}
