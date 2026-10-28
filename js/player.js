// =============================================================
// player.js — The little runner: movement, jumping and drawing.
// The player never moves left/right; the WORLD scrolls instead.
// =============================================================

OMJ.Player = class {
  constructor() {
    this.reset();
  }

  reset() {
    const C = OMJ.CONFIG;
    this.x = C.PLAYER_X;
    this.y = C.GROUND_Y - C.PLAYER_H;  // y is the TOP of the hitbox
    this.vy = 0;                        // vertical speed (negative = up)
    this.prevBottom = C.GROUND_Y;
    this.grounded = true;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.dead = false;
    // How forgiving jump timing is (some skins change these).
    this.coyoteTime = C.COYOTE_TIME;
    this.jumpBufferTime = C.JUMP_BUFFER_TIME;

    // Animation state
    this.runTime = 0;
    this.squash = 0;         // >0 squashed (landing), <0 stretched (jumping)
    this.blinkTimer = 2;
    this.blinking = false;

    // Ground smash (DOWN in the air): drop fast until you land.
    this.smashing = false;
    // Float (Blue Scarf power): fall slowly while this is on.
    this.floating = false;
    // Standing on a platform? (DOWN drops through it for a moment.)
    this.standingOn = null;      // the obstacle under your feet, or null for the ground
    this.dropTimer = 0;

    // One-step event flags the game reads for sounds/particles.
    this.justJumped = false;
    this.justLanded = false;
    this.justSmashed = false;   // landed from a ground smash
    this.landSpeed = 0;
  }

  get w() { return OMJ.CONFIG.PLAYER_W; }
  get h() { return OMJ.CONFIG.PLAYER_H; }
  get bottom() { return this.y + OMJ.CONFIG.PLAYER_H; }

  // Called when the jump key is PRESSED (not held).
  // We remember the press for a moment ("jump buffer") so a press
  // slightly before landing still works — this makes controls feel tight.
  pressJump() {
    this.jumpBufferTimer = this.jumpBufferTime;
  }

  // Ground smash: only works in the air. Shoots you straight down.
  // Returns true if it started.
  groundSmash() {
    if (this.grounded || this.dead || this.smashing) return false;
    this.smashing = true;
    this.vy = Math.max(this.vy, OMJ.CONFIG.SMASH_SPEED);
    this.squash = -1;
    return true;
  }

  // DOWN while standing on a wooden platform: fall through it.
  dropThrough() {
    this.dropTimer = 0.25;
    this.grounded = false;
    this.standingOn = null;
  }

  // Use a skin's passive perk for jump timing (null = keep the normal value),
  // plus any extra time from boosts.
  setTiming(passive, extraCoyote, extraBuffer) {
    const C = OMJ.CONFIG;
    this.coyoteTime = (passive.coyoteTime !== null ? passive.coyoteTime : C.COYOTE_TIME) + (extraCoyote || 0);
    this.jumpBufferTime = (passive.jumpBufferTime !== null ? passive.jumpBufferTime : C.JUMP_BUFFER_TIME) + (extraBuffer || 0);
  }

  update(dt, runSpeed) {
    const C = OMJ.CONFIG;
    this.justJumped = false;
    this.justLanded = false;
    this.justSmashed = false;
    this.prevBottom = this.bottom;

    if (!this.dead) {
      // "Coyote time": a short grace period after walking off a ledge.
      if (this.grounded) this.coyoteTimer = this.coyoteTime;
      else this.coyoteTimer -= dt;
      this.jumpBufferTimer -= dt;
      if (this.dropTimer > 0) this.dropTimer -= dt;

      if (this.jumpBufferTimer > 0 && (this.grounded || this.coyoteTimer > 0)) {
        this.vy = -OMJ.Physics.jumpVelocity;   // (boosts can make this bigger)
        this.grounded = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.justJumped = true;
        this.smashing = false;
        this.squash = -1;
      }
    }

    // Gravity. Using the exact formula (not just "speed * time") means the
    // jump is identical at any frame rate and matches the math in physics.js.
    const gravity = OMJ.Physics.gravity;
    this.y += this.vy * dt + 0.5 * gravity * dt * dt;
    this.vy += gravity * dt;
    if (this.vy > C.MAX_FALL_SPEED) this.vy = C.MAX_FALL_SPEED;
    if (this.floating && !this.smashing && this.vy > 45) this.vy = 45;   // drift down gently

    // Animation timers
    this.runTime += dt * (runSpeed / 150);
    this.squash *= Math.pow(0.0001, dt); // ease back to normal shape quickly
    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinking = !this.blinking;
      this.blinkTimer = this.blinking ? 0.12 : OMJ.rand(1.5, 4);
    }
  }

  // Put the player's feet on a surface at height `floorY`.
  land(floorY) {
    if (!this.grounded) {
      this.justLanded = true;
      this.landSpeed = this.vy;
      this.squash = OMJ.clamp(this.vy / 500, 0.3, 1);
      if (this.smashing) this.justSmashed = true;
    }
    this.smashing = false;
    this.y = floorY - OMJ.CONFIG.PLAYER_H;
    this.vy = 0;
    this.grounded = true;
  }

  die(cause) {
    if (this.dead) return;
    this.dead = true;
    this.grounded = false;
    this.smashing = false;
    // Falling into a pit keeps falling; anything else gives a cartoon "pop".
    this.vy = cause === 'gap' ? Math.max(this.vy, 60) : -260;
  }

  draw(ctx, skin, time, scarf) {
    OMJ.PlayerArt.draw(ctx, this, skin, time, scarf);
  }
};

// -------------------------------------------------------------
// PlayerArt — draws the character. The body is a text sprite;
// eyes, feet and the scarf are drawn on top so they can animate.
// -------------------------------------------------------------
OMJ.PlayerArt = (function () {
  const BODY = [
    '..OOOOOOOO..',
    '.OHHHBBBBBO.',
    'OHHBBBBBBBBO',
    'OHBBBBBBBBBO',
    'OBBBBBBBBBBO',
    'OBBBBBBBBBBO',
    'OBBBBBBBBBBO',
    'OBBBBBBBBBSO',
    'OSBBBBBBBSSO',
    '.OSSSSSSSSO.',
    '..OOOOOOOO..',
  ];
  const BUF_W = 18;     // 5 px of scarf tail + 12 px body + 1 spare
  const BUF_H = 13;     // 11 px body + 2 px feet
  const BODY_X = 5;     // body position inside the buffer
  const INK = OMJ.PALETTE.ink;
  const WHITE = OMJ.PALETTE.white;

  // Pre-computed rainbow colors (no new strings created while playing).
  const RAINBOW = [];
  for (let i = 0; i < 12; i++) RAINBOW.push('hsl(' + i * 30 + ', 90%, 62%)');

  const bodyCache = {};   // skin id -> pre-rendered body canvas
  let buffer = null;
  let bctx = null;

  function getBody(skin) {
    if (!bodyCache[skin.id]) {
      bodyCache[skin.id] = OMJ.Sprites.fromStrings(BODY, {
        O: INK, B: skin.body, S: skin.shade, H: skin.light,
      });
    }
    return bodyCache[skin.id];
  }

  function ensureBuffer() {
    if (buffer) return;
    buffer = document.createElement('canvas');
    buffer.width = BUF_W;
    buffer.height = BUF_H;
    bctx = buffer.getContext('2d');
  }

  // Draws the character (un-scaled) into a small canvas context.
  function drawPose(c, p, skin, time, ox, oy, scarfItem) {
    // ---- Feet ----
    let bob = 0;
    c.fillStyle = INK;
    if (p.dead || !p.grounded) {
      if (p.vy < 0 && !p.dead) {         // rising: feet tucked up
        c.fillRect(ox + BODY_X + 3, oy + 11, 2, 1);
        c.fillRect(ox + BODY_X + 7, oy + 11, 2, 1);
      } else {                           // falling: feet spread
        c.fillRect(ox + BODY_X + 1, oy + 11, 3, 2);
        c.fillRect(ox + BODY_X + 8, oy + 11, 3, 2);
      }
    } else {
      const frame = Math.floor(p.runTime * 12) % 4;
      const backUp = frame === 2;
      const frontUp = frame === 0;
      bob = frame === 1 || frame === 3 ? 1 : 0;
      c.fillRect(ox + BODY_X + 2, oy + 11, 3, backUp ? 1 : 2);
      c.fillRect(ox + BODY_X + 7, oy + 11, 3, frontUp ? 1 : 2);
    }

    // ---- Body ----
    const bx = ox + BODY_X;
    const by = oy + bob;
    c.drawImage(getBody(skin), bx, by);

    // ---- Scarf (band + flapping tail) ----
    const item = scarfItem || OMJ.SCARVES[0];
    const scarf = item.rainbow ? RAINBOW[Math.floor(time * 10) % 12] : item.color;
    // The tail flaps faster (and lifts) while floating.
    const flap = Math.floor(time * (p.floating ? 24 : 10)) % 2;
    c.fillStyle = scarf;
    c.fillRect(bx + 1, by + 7, 10, 2);
    c.fillRect(bx - 1, by + 7, 2, 2);
    c.fillRect(bx - 3, by + 7 + flap, 2, 1);
    c.fillRect(bx - 5, by + 8 - flap, 2, 1);

    // ---- Face ----
    if (p.dead) {
      c.fillStyle = INK;            // X X eyes
      c.fillRect(bx + 5, by + 2, 1, 1); c.fillRect(bx + 7, by + 2, 1, 1);
      c.fillRect(bx + 6, by + 3, 1, 1);
      c.fillRect(bx + 5, by + 4, 1, 1); c.fillRect(bx + 7, by + 4, 1, 1);
      c.fillRect(bx + 8, by + 2, 1, 1); c.fillRect(bx + 10, by + 2, 1, 1);
      c.fillRect(bx + 9, by + 3, 1, 1);
      c.fillRect(bx + 8, by + 4, 1, 1); c.fillRect(bx + 10, by + 4, 1, 1);
      c.fillRect(bx + 7, by + 6, 3, 1);
    } else if (p.blinking) {
      c.fillStyle = INK;
      c.fillRect(bx + 5, by + 4, 2, 1);
      c.fillRect(bx + 8, by + 4, 2, 1);
    } else {
      c.fillStyle = WHITE;
      c.fillRect(bx + 5, by + 2, 2, 3);
      c.fillRect(bx + 8, by + 2, 2, 3);
      // Pupils look up while rising, down while falling.
      const look = p.grounded ? 1 : p.vy < 0 ? 0 : 2;
      c.fillStyle = INK;
      c.fillRect(bx + 6, by + 2 + look, 1, 1);
      c.fillRect(bx + 9, by + 2 + look, 1, 1);
      if (!p.grounded) c.fillRect(bx + 7, by + 5, 2, 2);  // "whoa!" mouth
      else c.fillRect(bx + 7, by + 6, 2, 1);
    }
  }

  function draw(ctx, p, skin, time, scarfItem) {
    ensureBuffer();
    bctx.clearRect(0, 0, BUF_W, BUF_H);
    drawPose(bctx, p, skin, time, 0, 0, scarfItem);

    // Squash & stretch: scale the buffer by whole pixels, anchored at the feet.
    const s = p.squash;
    const dw = BUF_W + Math.round(s * 2);
    const dh = BUF_H - Math.round(s * 2);
    const anchorX = Math.round(p.x) + 5;         // center of the hitbox
    const bottom = Math.round(p.bottom);
    const dx = anchorX - Math.round((BODY_X + 6) * dw / BUF_W);

    if (p.dead) {
      // Upside down when knocked out (classic cartoon style).
      ctx.save();
      ctx.translate(dx, bottom);
      ctx.scale(1, -1);
      ctx.drawImage(buffer, 0, 0, dw, dh);
      ctx.restore();
    } else {
      ctx.drawImage(buffer, dx, bottom - dh, dw, dh);
    }
  }

  // Draw a still preview (used by the skin picker on the start screen).
  const previewPose = { grounded: true, dead: false, blinking: false, vy: 0, runTime: 0 };
  function drawPreview(canvas, skin, locked, time, scarfItem) {
    const c = canvas.getContext('2d');
    if (canvas.width !== BUF_W) canvas.width = BUF_W;
    if (canvas.height !== BUF_H) canvas.height = BUF_H;
    c.clearRect(0, 0, BUF_W, BUF_H);
    previewPose.runTime = time;
    drawPose(c, previewPose, skin, time, 0, 0, scarfItem);
    if (locked) {
      // Show a dark silhouette for skins you haven't earned yet.
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = '#2a2540';
      c.fillRect(0, 0, BUF_W, BUF_H);
      c.globalCompositeOperation = 'source-over';
    }
  }

  return { draw, drawPreview };
})();
