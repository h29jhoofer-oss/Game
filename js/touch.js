// =====================================================================
// touch.js — touchscreen controls for phones and tablets.
//
// While playing:
//   - Put a finger down on the LEFT side and drag: a joystick appears
//     where you touched, and you move in the direction you drag.
//   - Tap anywhere on the RIGHT side to dash (a DASH button shows there).
// Everywhere else (menus, upgrade cards, buttons) a tap works like a
// mouse click, so no extra code is needed for those.
//
// The touch controls only appear after the game sees a real touch, so
// keyboard and mouse players never see them.
// =====================================================================

const TOUCH_STICK = { radius: 16, deadZone: 3 }; // in game pixels
const TOUCH_DASH_BUTTON = { x: VIEW_WIDTH - 40, y: VIEW_HEIGHT - 44, radius: 14 };

const Touch = {
  active: false, // becomes true the first time someone touches the screen
  stick: null, // { id, originX, originY, x, y } while a finger is steering
  dashFlash: 0, // > 0 right after a dash tap, so the button lights up

  init(canvas, game) {
    this.canvas = canvas;
    this.game = game;
    canvas.addEventListener('pointerdown', (event) => this.onDown(event));
    canvas.addEventListener('pointermove', (event) => this.onMove(event));
    canvas.addEventListener('pointerup', (event) => this.onUp(event));
    canvas.addEventListener('pointercancel', (event) => this.onUp(event));
  },

  // Screen position -> position in the game's 320x180 pixels.
  toGame(event) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
      y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
    };
  },

  isPlaying() {
    return this.game.state === 'playing' && !Transition.active;
  },

  onDown(event) {
    if (event.pointerType !== 'touch') return; // mouse and pen work as before
    this.active = true;
    if (!this.isPlaying()) return; // menus: let the tap become a normal click

    const point = this.toGame(event);

    // Small HUD icons (sound, pause) are hard to hit with a finger, so a
    // tap within 10 pixels counts, and the closest icon wins.
    const button = this.findNearestHudButton(point, 10);
    if (button) {
      event.preventDefault();
      if (button.id === 'sound') Sound.toggleMute();
      if (button.id === 'pause') this.game.pause();
      return;
    }

    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId); // keep tracking even off the canvas
    if (point.x < VIEW_WIDTH * 0.55) {
      if (!this.stick) this.stick = { id: event.pointerId, originX: point.x, originY: point.y, x: point.x, y: point.y };
    } else {
      Input.pressed.add('Space'); // the same as pressing SPACE
      this.dashFlash = 0.15;
    }
  },

  findNearestHudButton(point, maxDistance) {
    let nearest = null;
    let nearestDistance = maxDistance;
    for (const button of this.game.getHudButtons()) {
      const box = button.box;
      const distance = Math.hypot(point.x - (box.x + box.width / 2), point.y - (box.y + box.height / 2));
      if (distance < nearestDistance) {
        nearest = button;
        nearestDistance = distance;
      }
    }
    return nearest;
  },

  onMove(event) {
    if (!this.stick || event.pointerId !== this.stick.id) return;
    const point = this.toGame(event);
    this.stick.x = point.x;
    this.stick.y = point.y;
  },

  onUp(event) {
    if (this.stick && event.pointerId === this.stick.id) this.stick = null;
  },

  // The joystick direction as {x, y}, or {0, 0} if no finger is steering.
  getDirection() {
    if (!this.isPlaying()) this.stick = null; // let go when a menu opens
    if (!this.stick) return { x: 0, y: 0 };
    const dx = this.stick.x - this.stick.originX;
    const dy = this.stick.y - this.stick.originY;
    const length = Math.hypot(dx, dy);
    if (length < TOUCH_STICK.deadZone) return { x: 0, y: 0 };
    return { x: dx / length, y: dy / length };
  },

  update(dt) {
    this.dashFlash = Math.max(0, this.dashFlash - dt);
  },

  // Pixel-art joystick and dash button, drawn over the game.
  draw(ctx, player) {
    if (!this.active || !this.isPlaying()) return;

    // Joystick: a ring where your finger landed, and a knob that follows it.
    if (this.stick) {
      const ox = Math.round(this.stick.originX);
      const oy = Math.round(this.stick.originY);
      drawPixelCircle(ctx, ox, oy, TOUCH_STICK.radius, PALETTE.cyanDim);
      let dx = this.stick.x - this.stick.originX;
      let dy = this.stick.y - this.stick.originY;
      const length = Math.hypot(dx, dy);
      const maxReach = TOUCH_STICK.radius - 4;
      if (length > maxReach) {
        dx = (dx / length) * maxReach;
        dy = (dy / length) * maxReach;
      }
      drawPixelDisc(ctx, Math.round(ox + dx), Math.round(oy + dy), 4, PALETTE.cyan);
    } else {
      // A faint hint of where to put your thumb.
      drawPixelCircle(ctx, 44, VIEW_HEIGHT - 44, TOUCH_STICK.radius, PALETTE.wallDark);
      drawText(ctx, 'MOVE', 44, VIEW_HEIGHT - 47, PALETTE.wallDark, { align: 'center' });
    }

    // Dash button: bright when the dash is ready, dim while recharging.
    const b = TOUCH_DASH_BUTTON;
    const ready = player.dashCooldown === 0;
    const color = this.dashFlash > 0 ? PALETTE.white : ready ? PALETTE.cyan : PALETTE.blue;
    drawPixelCircle(ctx, b.x, b.y, b.radius, color);
    drawPixelCircle(ctx, b.x, b.y, b.radius - 1, color);
    drawText(ctx, 'DASH', b.x, b.y - 2, color, { align: 'center', shadow: PALETTE.void });
  },
};

// A filled circle, one row of pixels at a time (no anti-aliasing).
function drawPixelDisc(ctx, cx, cy, radius, color) {
  ctx.fillStyle = color;
  for (let y = -radius; y <= radius; y++) {
    const halfWidth = Math.floor(Math.sqrt(radius * radius - y * y));
    ctx.fillRect(cx - halfWidth, cy + y, halfWidth * 2 + 1, 1);
  }
}
