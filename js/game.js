// =============================================================
// game.js — The main game: states, the game loop, collisions,
// scoring and drawing. Everything else plugs into this file.
//
// Game states:
//   'menu'    start screen (the little runner jogs in the background)
//   'playing' the actual game
//   'paused'  frozen, pause screen showing
//   'dying'   short crash animation
//   'over'    game-over screen
// =============================================================

OMJ.Game = class {
  constructor(root) {
    const C = OMJ.CONFIG;
    this.root = root;
    this.canvas = root.querySelector('.omj-canvas');
    this.canvas.width = C.VIEW_W;
    this.canvas.height = C.VIEW_H;
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    // Saved progress
    this.save = OMJ.Storage.load();
    if (!OMJ.isSkinUnlocked(OMJ.getSkin(this.save.skin), this.save.best)) this.save.skin = 'classic';
    this.skin = OMJ.getSkin(this.save.skin);
    this.pickerIndex = OMJ.SKINS.indexOf(this.skin);

    // Game parts
    this.sound = new OMJ.Sound(this.save.muted);
    this.player = new OMJ.Player();
    this.obstacles = new OMJ.Obstacles(24);
    this.spawner = new OMJ.Spawner(this.obstacles);
    this.particles = new OMJ.Particles(160);
    this.background = new OMJ.Background();
    this.ui = new OMJ.UI(root, this);
    this.input = new OMJ.Input(root, this);

    // Pop-up texts like "100!" (fixed slots, re-used)
    this.announcements = [];
    for (let i = 0; i < 3; i++) this.announcements.push({ active: false, text: '', color: '', life: 0, age: 0 });
    this.newUnlocks = [];

    this.state = 'menu';
    this.time = 0;
    this.resetRun();
    this.goToMenu();
    this.ui.setMuted(this.save.muted);

    // Pause automatically if the player switches tabs or clicks away.
    window.addEventListener('blur', () => this.autoPause());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });
    root.addEventListener('focusout', (e) => {
      if (!e.relatedTarget || !root.contains(e.relatedTarget)) this.autoPause();
    });

    // Start the ONE game loop.
    this.lastTime = 0;
    this.accumulator = 0;
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  // ---------------------------------------------------------------
  // Game loop: a fixed physics step + one draw per screen refresh.
  // ---------------------------------------------------------------
  frame(now) {
    const C = OMJ.CONFIG;
    if (!this.lastTime) this.lastTime = now;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.25) dt = 0.25;            // e.g. after the tab was hidden

    this.accumulator += dt;
    let steps = 0;
    while (this.accumulator >= C.FIXED_STEP && steps < C.MAX_STEPS_PER_FRAME) {
      this.step(C.FIXED_STEP);
      this.accumulator -= C.FIXED_STEP;
      steps++;
    }
    if (steps === C.MAX_STEPS_PER_FRAME) this.accumulator = 0;

    this.render();
    requestAnimationFrame(this.frame);
  }

  step(dt) {
    if (this.state === 'paused') return;
    this.time += dt;

    if (this.state === 'menu') this.updateMenu(dt);
    else if (this.state === 'playing') this.updatePlaying(dt);
    else this.updateDying(dt);    // 'dying' and 'over'

    this.updateEffects(dt);
  }

  // ---------------------------------------------------------------
  // State changes
  // ---------------------------------------------------------------
  resetRun() {
    const C = OMJ.CONFIG;
    this.player.reset();
    this.obstacles.reset();
    this.spawner.reset();
    this.particles.reset();
    this.background.reset();
    for (let i = 0; i < this.announcements.length; i++) this.announcements[i].active = false;

    this.score = 0;
    this.shownScore = -1;
    this.scoreText = '00000';
    this.speed = C.START_SPEED;
    this.difficulty = 0;
    this.nextMilestone = C.MILESTONE_EVERY;
    this.jumped = 0;
    this.bestAtStart = this.save.best;
    this.announcedBest = this.bestAtStart === 0;  // no "NEW BEST" on your very first run
    this.nextUnlock = 0;
    while (this.nextUnlock < OMJ.SKINS.length && OMJ.SKINS[this.nextUnlock].unlockAt <= this.bestAtStart) this.nextUnlock++;
    this.newUnlocks.length = 0;

    this.hitstop = 0;
    this.shake = 0;
    this.flash = 0;
    this.dustTimer = 0;
    this.deathTimer = 0;
    this.overTime = 0;
  }

  startRun() {
    this.resetRun();
    this.state = 'playing';
    this.ui.show(null);
    this.ui.setPlaying(true);
    this.sound.play('click');
  }

  goToMenu() {
    this.resetRun();
    this.state = 'menu';
    this.ui.setPlaying(false);
    this.ui.setBest(this.save.best);
    this.pickerIndex = OMJ.SKINS.indexOf(this.skin);
    this.updateSkinPicker();
    this.ui.show('start');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.show('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.player.jumpBufferTimer = 0;   // ignore presses made while paused
    this.ui.show(null);
  }

  togglePause() {
    if (this.state === 'playing') this.pause();
    else if (this.state === 'paused') this.resume();
  }

  autoPause() {
    this.pause();
  }

  toggleMute() {
    this.save.muted = !this.save.muted;
    this.sound.setMuted(this.save.muted);
    this.ui.setMuted(this.save.muted);
    OMJ.Storage.save(this.save);
  }

  // ---------------------------------------------------------------
  // Input (called by input.js and ui.js)
  // ---------------------------------------------------------------
  onJumpKey(code) {
    if (this.state === 'menu') this.startRun();
    else if (this.state === 'playing') this.player.pressJump();
    else if (this.state === 'over' && code === 'Space' && this.canRestart()) this.startRun();
  }

  onPointerJump() {
    if (this.state === 'playing') this.player.pressJump();
  }

  onConfirmKey() {
    if (this.state === 'menu') this.startRun();
    else if (this.state === 'paused') this.resume();
    else if (this.state === 'over' && this.canRestart()) this.startRun();
  }

  onRestartKey() {
    if (this.state === 'dying' || this.state === 'over') this.startRun();
  }

  onArrowKey(direction) {
    if (this.state === 'menu') this.cycleSkin(direction);
  }

  canRestart() {
    return this.overTime >= OMJ.CONFIG.RESTART_LOCK_TIME;
  }

  onAction(action) {
    switch (action) {
      case 'play': this.startRun(); break;
      case 'restart': this.startRun(); break;
      case 'resume': this.resume(); break;
      case 'menu': this.goToMenu(); break;
      case 'pause': this.togglePause(); break;
      case 'mute': this.toggleMute(); break;
      case 'skin-prev': this.cycleSkin(-1); break;
      case 'skin-next': this.cycleSkin(1); break;
    }
  }

  // ---------------------------------------------------------------
  // Skins
  // ---------------------------------------------------------------
  cycleSkin(direction) {
    const n = OMJ.SKINS.length;
    this.pickerIndex = (this.pickerIndex + direction + n) % n;
    const skin = OMJ.SKINS[this.pickerIndex];
    if (OMJ.isSkinUnlocked(skin, this.save.best)) {
      this.skin = skin;
      this.save.skin = skin.id;
      OMJ.Storage.save(this.save);
    }
    this.updateSkinPicker();
    this.sound.play('click');
  }

  updateSkinPicker() {
    const skin = OMJ.SKINS[this.pickerIndex];
    this.ui.setSkin(skin, OMJ.isSkinUnlocked(skin, this.save.best));
  }

  // ---------------------------------------------------------------
  // Updating each state
  // ---------------------------------------------------------------
  updateMenu(dt) {
    const menuSpeed = 50;
    this.background.update(dt, menuSpeed, 0);
    this.player.update(dt, menuSpeed);
    this.resolveFloor();
    this.particles.update(dt, menuSpeed);
    this.runningDust(dt);
  }

  updatePlaying(dt) {
    const C = OMJ.CONFIG;
    const p = this.player;

    // Difficulty grows with score; speed follows difficulty.
    this.difficulty = Math.min(1, this.score / C.DIFFICULTY_MAX_SCORE);
    this.speed = OMJ.lerp(C.START_SPEED, C.MAX_SPEED, this.difficulty);

    p.update(dt, this.speed);
    this.obstacles.update(dt, this.speed);
    this.spawner.update(dt, this.speed, this.difficulty);
    this.background.update(dt, this.speed, this.score);
    this.particles.update(dt, this.speed);
    this.resolveFloor();

    // Jump & land effects
    if (p.justJumped) {
      this.sound.play('jump');
      this.particles.burst(p.x + 4, p.bottom - 1, 5, 20, 50, Math.PI * 0.8, Math.PI * 1.1, 0.35, [OMJ.PALETTE.dust, OMJ.PALETTE.dustDark], 0);
    }
    if (p.justLanded) {
      if (p.landSpeed > 150) this.sound.play('land');
      this.particles.burst(p.x + 5, p.bottom - 1, 6, 20, 55, Math.PI, Math.PI * 2, 0.3, [OMJ.PALETTE.dust, OMJ.PALETTE.dustDark], 80);
    }
    this.runningDust(dt);

    // Crashes
    const hit = this.findCollision();
    if (hit) { this.die(hit.typeName, hit); return; }
    if (p.bottom > C.GROUND_Y + 4) { this.die('gap', null); return; }

    // Obstacles you got past
    const pool = this.obstacles.pool;
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (o.active && !o.passed && o.x + o.w < p.x) {
        o.passed = true;
        this.jumped++;
        this.sound.play('pass');
      }
    }

    // Score: based on distance, so frame rate doesn't matter.
    this.score += this.speed * dt * C.SCORE_PER_PIXEL;
    while (this.score >= this.nextMilestone) {
      this.announce(this.nextMilestone + '!', OMJ.PALETTE.gold);
      this.score += C.MILESTONE_BONUS;
      this.nextMilestone += C.MILESTONE_EVERY;
      this.sound.play('milestone');
      this.particles.burst(p.x + 5, p.y + 4, 10, 40, 90, 0, Math.PI * 2, 0.6, [OMJ.PALETTE.gold, OMJ.PALETTE.white], 60);
    }
    if (!this.announcedBest && this.score > this.bestAtStart) {
      this.announcedBest = true;
      this.announce('NEW BEST!', '#7bd6ff');
    }
    while (this.nextUnlock < OMJ.SKINS.length && this.score >= OMJ.SKINS[this.nextUnlock].unlockAt) {
      const skin = OMJ.SKINS[this.nextUnlock];
      this.newUnlocks.push(skin.name);
      this.announce('NEW SKIN: ' + skin.name + '!', skin.light);
      this.sound.play('unlock');
      this.nextUnlock++;
    }
  }

  updateDying(dt) {
    if (this.hitstop > 0) { this.hitstop -= dt; return; }
    this.speed *= Math.pow(0.03, dt);          // world slows to a stop
    this.player.update(dt, 0);
    this.obstacles.update(dt, this.speed);
    this.background.update(dt, this.speed, this.score);
    this.particles.update(dt, this.speed);

    if (this.state === 'dying') {
      this.deathTimer += dt;
      if (this.deathTimer >= OMJ.CONFIG.DEATH_TO_GAMEOVER) this.showGameOver();
    } else {
      this.overTime += dt;
    }
  }

  updateEffects(dt) {
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt);
    for (let i = 0; i < this.announcements.length; i++) {
      const a = this.announcements[i];
      if (!a.active) continue;
      a.age += dt;
      if (a.age >= a.life) a.active = false;
    }
    if (this.state === 'menu') this.ui.drawSkinPreview(this.time);
  }

  runningDust(dt) {
    const p = this.player;
    if (!p.grounded) return;
    this.dustTimer -= dt;
    if (this.dustTimer <= 0) {
      this.dustTimer = 0.12;
      this.particles.spawn(p.x + 1, p.bottom - 1, OMJ.rand(-20, -5), OMJ.rand(-25, -8), 0.3, 1, OMJ.PALETTE.dust, 40);
    }
  }

  // ---------------------------------------------------------------
  // Collisions
  // ---------------------------------------------------------------

  // Find what the player is standing on: the ground (unless over a
  // gap) or the top of a crate. Then land on it, or keep falling.
  resolveFloor() {
    const C = OMJ.CONFIG;
    const p = this.player;
    if (p.dead) return;
    const footL = p.x + 2;
    const footR = p.x + p.w - 2;
    const pool = this.obstacles.pool;

    let overGap = false;
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (o.active && o.type.isGap && footL >= o.x && footR <= o.x + o.w) overGap = true;
    }
    let floor = overGap ? Infinity : C.GROUND_Y;

    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.active || !o.type.solidTop) continue;
      const overlaps = footR > o.x + 1 && footL < o.x + o.w - 1;
      if (overlaps && p.prevBottom <= o.y + 4 && o.y < floor) floor = o.y;
    }

    // Land only if we were above the floor a moment ago (so you can't
    // "pop up" out of a pit once you've fallen in).
    if (p.vy >= 0 && p.bottom >= floor && p.prevBottom <= floor + 2) p.land(floor);
    else p.grounded = false;
  }

  // Returns the obstacle the player crashed into, or null.
  findCollision() {
    const C = OMJ.CONFIG;
    const p = this.player;
    // The player's hitbox is 1px smaller than the sprite: near misses feel great.
    const px1 = p.x + 1;
    const px2 = p.x + p.w - 1;
    const py1 = p.y + 1;
    const py2 = p.bottom;
    const pool = this.obstacles.pool;

    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.active || o.type.isGap) continue;
      const hb = o.type.hitbox;
      const ox1 = o.x + hb.left;
      const ox2 = o.x + o.w - hb.right;
      const oy1 = o.y + hb.top;
      const oy2 = C.GROUND_Y;
      if (px2 > ox1 && px1 < ox2 && py2 > oy1 && py1 < oy2) {
        // Clipped the top corner of a crate? Be nice: step onto it.
        if (o.type.solidTop && p.bottom <= o.y + 3) { p.land(o.y); continue; }
        return o;
      }
    }
    return null;
  }

  die(cause, obstacle) {
    const p = this.player;
    p.die(cause);
    this.state = 'dying';
    this.deathTimer = 0;
    this.hitstop = OMJ.CONFIG.HITSTOP_TIME;
    this.shake = cause === 'gap' ? 2 : 5;
    this.flash = 0.1;
    this.sound.play('hit');
    this.particles.burst(p.x + 5, p.y + 6, 18, 40, 140, 0, Math.PI * 2, 0.8,
      [this.skin.body, this.skin.light, this.skin.scarf, OMJ.PALETTE.white], 300);

    const type = OMJ.ObstacleTypes[cause];
    this.deathLine = OMJ.pickFrom(type.deathLines);

    // Save the personal best right away (safe even if the tab is closed now).
    this.finalScore = Math.floor(this.score);
    this.isNewBest = this.finalScore > this.save.best;
    if (this.isNewBest) {
      this.save.best = this.finalScore;
      OMJ.Storage.save(this.save);
    }
  }

  showGameOver() {
    this.state = 'over';
    this.overTime = 0;
    this.ui.setPlaying(false);

    // Tell the player how close the next skin is (a reason for one more jump!).
    let nextUnlock = '';
    for (let i = 0; i < OMJ.SKINS.length; i++) {
      const s = OMJ.SKINS[i];
      if (s.unlockAt > this.save.best) {
        nextUnlock = 'Next skin at ' + s.unlockAt + ' (' + (s.unlockAt - this.save.best) + ' to go)';
        break;
      }
    }

    this.ui.showGameOver({
      score: this.finalScore,
      best: this.save.best,
      isNewBest: this.isNewBest,
      message: OMJ.pickMessage(this.finalScore),
      cause: this.deathLine,
      jumped: this.jumped,
      unlocks: this.newUnlocks,
      nextUnlock: nextUnlock,
    });
  }

  announce(text, color) {
    // Use a free slot, or replace the oldest one.
    let slot = this.announcements[0];
    for (let i = 0; i < this.announcements.length; i++) {
      const a = this.announcements[i];
      if (!a.active) { slot = a; break; }
      if (a.age > slot.age) slot = a;
    }
    slot.active = true;
    slot.text = text;
    slot.color = color;
    slot.age = 0;
    slot.life = 1.4;
  }

  // ---------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------
  render() {
    const C = OMJ.CONFIG;
    const ctx = this.ctx;
    const ink = OMJ.PALETTE.ink;

    // Screen shake: shift everything by a few whole pixels.
    let sx = 0;
    let sy = 0;
    if (this.shake > 0 && this.state !== 'paused') {
      const s = Math.ceil(this.shake);
      sx = OMJ.randInt(-s, s);
      sy = OMJ.randInt(-s, s);
    }
    ctx.setTransform(1, 0, 0, 1, sx, sy);
    ctx.fillStyle = ink;
    ctx.fillRect(-8, -8, C.VIEW_W + 16, C.VIEW_H + 16);

    this.background.draw(ctx);
    this.background.drawGround(ctx);
    this.background.drawGroundTint(ctx);
    this.obstacles.draw(ctx);
    this.particles.draw(ctx);
    this.player.draw(ctx, this.skin, this.time);

    if (C.DEBUG_HITBOXES) this.drawHitboxes(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Quick white flash when you crash (short and soft).
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.5, this.flash * 5);
      ctx.fillStyle = OMJ.PALETTE.white;
      ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
      ctx.globalAlpha = 1;
    }

    if (this.state !== 'menu') this.drawHud(ctx);
  }

  drawHud(ctx) {
    const C = OMJ.CONFIG;
    const F = OMJ.PixelFont;
    const ink = OMJ.PALETTE.ink;

    // Only rebuild the score text when the number actually changes.
    const shown = Math.floor(this.score);
    if (shown !== this.shownScore) {
      this.shownScore = shown;
      this.scoreText = String(shown).padStart(5, '0');
      this.bestText = 'HI ' + String(Math.max(this.save.best, shown)).padStart(5, '0');
    }
    F.drawShadowed(ctx, this.scoreText, C.VIEW_W - 8, 8, 2, OMJ.PALETTE.white, ink, 'right');
    F.drawShadowed(ctx, this.bestText, C.VIEW_W - 8, 22, 1, '#ffe98a', ink, 'right');

    // Pop-up announcements, stacked in the middle-top.
    let row = 0;
    for (let i = 0; i < this.announcements.length; i++) {
      const a = this.announcements[i];
      if (!a.active) continue;
      const rise = Math.min(1, a.age * 6);            // quick slide-in
      const y = 44 + row * 16 - Math.round((1 - rise) * 6);
      const blinkOut = a.life - a.age < 0.35 && Math.floor(a.age * 16) % 2 === 0;
      if (!blinkOut) F.drawShadowed(ctx, a.text, C.VIEW_W / 2, y, 2, a.color, ink, 'center');
      row++;
    }
  }

  drawHitboxes(ctx) {
    const p = this.player;
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x + 1.5, p.y + 1.5, p.w - 2, p.h - 1);
    const pool = this.obstacles.pool;
    ctx.strokeStyle = '#ff00ff';
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.active) continue;
      if (o.type.isGap) { ctx.strokeRect(o.x + 0.5, OMJ.CONFIG.GROUND_Y + 0.5, o.w - 1, 6); continue; }
      const hb = o.type.hitbox;
      ctx.strokeRect(o.x + hb.left + 0.5, o.y + hb.top + 0.5, o.w - hb.left - hb.right - 1, o.h - hb.top - 1);
    }
  }
};

// Create the game inside any element. Safe to call twice (it won't
// start a second game loop on the same element).
// options.autofocus: give the game keyboard focus right away
// (good for a stand-alone page; leave it off when embedding).
OMJ.createGame = function (root, options) {
  if (!root) return null;
  if (!root.omjGame) root.omjGame = new OMJ.Game(root);
  if (options && options.autofocus) root.focus({ preventScroll: true });
  return root.omjGame;
};
