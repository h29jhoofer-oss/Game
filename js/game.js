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

// Blink's teleport show (seconds since it started).
OMJ.BLINK = { total: 0.42, hideAt: 0.12, jumpAt: 0.2, showAt: 0.3 };

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
    this.swordItem = OMJ.getSword(this.save.sword);   // the sword you own and wear
    this.scarf = OMJ.getScarf(this.save.scarf);
    this.shopOpen = false;
    this.shopTab = 'swords';

    // Game parts
    this.sound = new OMJ.Sound(this.save.muted, this.save.musicMuted);
    this.music = new OMJ.Music(this.sound);
    this.player = new OMJ.Player();
    this.obstacles = new OMJ.Obstacles(24);
    this.coins = new OMJ.Coins(48);
    this.spawner = new OMJ.Spawner(this.obstacles, this.coins);
    this.mods = OMJ.newRunMods();
    this.abilities = new OMJ.AbilitySystem();
    this.sword = new OMJ.SwordSystem();               // swinging it, its shots
    this.boss = new OMJ.Boss();
    this.particles = new OMJ.Particles(200);
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
    this.ui.setMusicMuted(this.save.musicMuted);
    this.ui.setBank(this.save.bank);

    // Pause automatically if the player switches tabs or clicks away.
    window.addEventListener('blur', () => this.autoPause());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });
    root.addEventListener('focusout', (e) => {
      if (!e.relatedTarget || !root.contains(e.relatedTarget)) this.autoPause();
    });

    // Start the ONE game loop.
    this.lastTime = 0;
    this.frame = this.frame.bind(this);
    requestAnimationFrame(this.frame);
  }

  // ---------------------------------------------------------------
  // Game loop: one draw per screen refresh. The time since the last
  // frame is split into equal small steps (at most MAX_STEP each), so
  // every frame moves the game forward and motion stays smooth on
  // 60 Hz and 144 Hz screens alike.
  // ---------------------------------------------------------------
  frame(now) {
    const C = OMJ.CONFIG;
    if (!this.lastTime) this.lastTime = now;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > C.MAX_FRAME_TIME) dt = C.MAX_FRAME_TIME;   // e.g. after the tab was hidden

    if (dt > 0) {
      const steps = Math.ceil(dt / C.MAX_STEP);
      for (let i = 0; i < steps; i++) this.step(dt / steps);
    }

    this.music.update();
    this.render();
    requestAnimationFrame(this.frame);
  }

  step(dt) {
    if (this.state === 'paused' || this.state === 'choosing') return;
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
    this.abilities.reset(this.skin, this.swordItem, this.scarf);
    this.sword.reset(this.swordItem);
    this.boss.reset();
    this.frozen = false;             // Time Freeze (Purple Scarf)
    this.banked = false;             // this run's coins already added to the bank?
    this.passive = this.abilities.passive;
    this.player.setTiming(this.passive);

    // Coins and boosts start fresh every run.
    this.mods = OMJ.newRunMods();
    OMJ.Physics.resetJump();
    this.coins.reset();
    this.coinCount = 0;              // coins toward the next boost
    this.coinsTotal = 0;             // coins collected this run
    this.coinsNeeded = OMJ.COINS.firstBoostAt;
    this.boostsTaken = 0;
    this.boostChoices = null;
    this.freezeTimer = 0;            // short "GO!" pause after picking a boost
    this.blinkTimer = 0;             // Blink's teleport animation (counts down)
    this.blinkShifted = false;
    this.coinText = '';
    this.shownCoins = -1;
    for (let i = 0; i < this.announcements.length; i++) this.announcements[i].active = false;

    this.score = 0;        // the score you see (includes skin bonuses)
    this.progress = 0;     // distance-based score that sets the difficulty
    this.shownScore = -1;
    this.scoreText = '00000';
    this.speed = C.START_SPEED;
    this.worldSpeed = this.speed;   // speed including Dash
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
    this.music.setTempoScale(1);
    this.music.play('run');
    // A few coins right away, so new players see what to collect.
    for (let i = 0; i < 4; i++) this.coins.spawn(150 + i * 12, OMJ.CONFIG.GROUND_Y - 8);
  }

  goToMenu() {
    this.bankCoins();                // quitting a run still keeps its coins
    this.resetRun();
    this.state = 'menu';
    this.ui.setPlaying(false);
    this.ui.setBest(this.save.best);
    this.ui.setBank(this.save.bank);
    this.shopOpen = false;
    this.pickerIndex = OMJ.SKINS.indexOf(this.skin);
    this.updateSkinPicker();
    this.ui.show('start');
    this.music.setTempoScale(1);
    this.music.play('menu');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.ui.show('pause');
    this.music.pause();
    this.sound.play('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.player.jumpBufferTimer = 0;   // ignore presses made while paused
    this.ui.show(null);
    this.music.resume();
    this.sound.play('resume');
  }

  togglePause() {
    if (this.state === 'menu' && this.shopOpen) { this.closeShop(); return; }   // ESC leaves the shop
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

  toggleMusic() {
    this.save.musicMuted = !this.save.musicMuted;
    this.sound.setMusicMuted(this.save.musicMuted);
    this.ui.setMusicMuted(this.save.musicMuted);
    OMJ.Storage.save(this.save);
  }

  // ---------------------------------------------------------------
  // Input (called by input.js and ui.js)
  // ---------------------------------------------------------------
  onJumpKey(code) {
    if (this.state === 'menu') { if (!this.shopOpen) this.startRun(); }
    else if (this.state === 'playing') this.player.pressJump();
    else if (this.state === 'over' && code === 'Space' && this.canRestart()) this.startRun();
  }

  onPointerJump() {
    if (this.state === 'playing') this.player.pressJump();
  }

  onAbilityKey() {
    if (this.state === 'playing' && !this.holding()) this.abilities.tryActivate(this);
  }

  onBonusKey() {
    if (this.state === 'playing' && !this.holding()) this.abilities.tryActivateBonus(this);
  }

  onSwordKey() {
    if (this.state === 'playing' && !this.holding()) this.sword.swing(this);
  }

  onSwordPowerKey() {
    if (this.state === 'playing' && !this.holding()) this.abilities.tryActivate(this, 'sword');
  }

  onScarfKey() {
    if (this.state === 'playing' && !this.holding()) this.abilities.tryActivate(this, 'scarf');
  }

  onNumberKey(n) {
    if (this.state === 'choosing') this.chooseBoost(n - 1);
  }

  // DOWN: ground smash in the air, or drop through a wooden platform.
  onSmashKey() {
    if (this.state !== 'playing') return;
    const p = this.player;
    if (p.grounded && p.standingOn && p.standingOn.type.oneWay) {
      p.dropThrough();
      this.sound.play('dropThrough');
    } else if (p.groundSmash()) {
      this.sound.play('smashDown');
    }
  }

  onConfirmKey() {
    if (this.state === 'menu') { if (!this.shopOpen) this.startRun(); }
    else if (this.state === 'paused') this.resume();
    else if (this.state === 'over' && this.canRestart()) this.startRun();
  }

  onRestartKey() {
    if (this.state === 'dying' || this.state === 'over') this.startRun();
  }

  onArrowKey(direction) {
    if (this.state === 'menu' && !this.shopOpen) this.cycleSkin(direction);
  }

  canRestart() {
    return this.overTime >= OMJ.CONFIG.RESTART_LOCK_TIME;
  }

  onAction(action) {
    if (action.indexOf('shop-item-') === 0) { this.onShopItem(parseInt(action.slice(10), 10)); return; }
    switch (action) {
      case 'play': this.startRun(); break;
      case 'restart': this.startRun(); break;
      case 'resume': this.resume(); break;
      case 'menu': this.goToMenu(); break;
      case 'pause': this.togglePause(); break;
      case 'mute': this.toggleMute(); break;
      case 'music': this.toggleMusic(); break;
      case 'skin-prev': this.cycleSkin(-1); break;
      case 'skin-next': this.cycleSkin(1); break;
      case 'shop': this.openShop(); break;
      case 'shop-back': this.closeShop(); break;
      case 'shop-tab-swords': this.shopTab = 'swords'; this.renderShop(); this.sound.play('click'); break;
      case 'shop-tab-scarves': this.shopTab = 'scarves'; this.renderShop(); this.sound.play('click'); break;
      case 'boost-0': this.chooseBoost(0); break;
      case 'boost-1': this.chooseBoost(1); break;
      case 'boost-2': this.chooseBoost(2); break;
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
    this.resolveFloor(false);
    this.particles.update(dt, menuSpeed);
    this.runningDust(dt);
  }

  updatePlaying(realDt) {
    const C = OMJ.CONFIG;
    const p = this.player;
    const a = this.abilities;

    // Blink: everything holds still while you blink out and back in.
    if (this.blinkTimer > 0) {
      this.updateBlink(realDt);
      return;
    }
    // Frozen for a moment after picking a boost, so you can get ready.
    if (this.freezeTimer > 0) {
      this.freezeTimer -= realDt;
      return;
    }

    // Ability timers use real time; everything else uses game time,
    // which Slow-Mo slows down.
    a.update(realDt, this);
    const dt = realDt * a.timeScale;
    this.frozen = a.isActive('timeFreeze');
    p.floating = a.isActive('float');
    p.angry = a.isActive('bulldozer');

    // Difficulty grows with distance; speed follows difficulty.
    this.difficulty = Math.min(1, this.progress / C.DIFFICULTY_MAX_SCORE);
    this.speed = OMJ.lerp(C.START_SPEED, C.MAX_SPEED, this.difficulty) * this.mods.speedScale;
    const speed = this.speed * a.speedScale;
    this.worldSpeed = speed;
    this.music.setTempoScale((1 + 0.18 * this.difficulty) * (a.timeScale < 1 ? 0.7 : 1));

    p.update(dt, speed);
    this.obstacles.update(dt, speed, this);
    // No new obstacles while the boss is around: it brings its own.
    if (!this.boss.active) this.spawner.update(dt, speed, this.difficulty);
    else if (!this.frozen) this.boss.update(dt, this);   // Time Freeze stops the boss too
    this.background.update(dt, speed, this.score);
    this.particles.update(dt, speed);
    a.updateWorld(dt, this);
    this.resolveFloor(a.invulnerable);
    this.sword.update(dt, this);         // swings cut things before you can bump into them
    const picked = this.coins.update(dt, speed, p, this.mods.magnet);
    if (picked > 0) this.collectCoins(picked);

    // Jump & land effects
    if (p.justJumped) {
      this.sound.play('jump');
      this.particles.burst(p.x + 4, p.bottom - 1, 5, 20, 50, Math.PI * 0.8, Math.PI * 1.1, 0.35, [OMJ.PALETTE.dust, OMJ.PALETTE.dustDark], 0);
    }
    if (p.justSmashed) {
      // Ground smash landing: big dust cloud and a thump.
      // (It doesn't break obstacles or hurt the boss.)
      this.sound.play('groundSmash');
      this.shake = Math.max(this.shake, 2);
      this.particles.burst(p.x + 5, p.bottom - 1, 14, 40, 110, Math.PI, Math.PI * 2, 0.45, [OMJ.PALETTE.dust, OMJ.PALETTE.dustDark, OMJ.PALETTE.white], 150);
    } else if (p.justLanded) {
      if (p.landSpeed > 150) this.sound.play('land');
      this.particles.burst(p.x + 5, p.bottom - 1, 6, 20, 55, Math.PI, Math.PI * 2, 0.3, [OMJ.PALETTE.dust, OMJ.PALETTE.dustDark], 80);
    }
    if (p.angry) {
      // Bulldozer: flames lick up off you, mostly from the top of your head
      for (let k = 0; k < 2; k++) {
        const r = Math.random();
        this.particles.spawn(p.x + OMJ.rand(0, 10), p.y + OMJ.rand(-2, k ? 8 : 3), OMJ.rand(-40, -10), OMJ.rand(-90, -40), 0.32,
          r < 0.45 ? 2 : 1, r < 0.35 ? OMJ.PALETTE.danger : r < 0.8 ? '#ff8a3d' : OMJ.PALETTE.gold, -60);
      }
    }
    if (p.smashing) {
      // Speed streaks above you while you plummet
      this.particles.spawn(p.x + OMJ.randInt(1, 9), p.y - 2, 0, -40, 0.15, 1, OMJ.PALETTE.white, 0);
    }
    this.runningDust(dt);

    // Crashes
    if (a.invulnerable) {
      // Dash smashes whatever it touches; Phase just floats through.
      if (a.smashing) {
        let o;
        while ((o = this.findCollision())) this.smash(o);
      }
    } else {
      const hit = this.findCollision();
      if (hit) {
        if (a.tryRescue(this)) this.smash(hit);
        else { this.die(hit.typeName); return; }
      }
    }
    if (p.bottom > C.GROUND_Y + 4) {
      // Fell into a pit. Protected (or saved by Shield / Second Chance)?
      // Then bounce back out; otherwise it's game over.
      if (a.invulnerable || a.tryRescue(this)) this.bounceOutOfPit();
      else { this.die('gap'); return; }
    }

    // Obstacles you got past
    const pool = this.obstacles.pool;
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (o.active && !o.passed && !o.type.harmless && o.x + o.w < p.x) {
        o.passed = true;
        this.jumped++;
        this.sound.play('pass');
      }
    }

    // Score: based on distance, so frame rate doesn't matter.
    const gained = speed * dt * C.SCORE_PER_PIXEL;
    this.progress += gained;
    this.score += gained * this.scoreRate();
    this.checkScoreEvents();

    // The boss arrives when a night ends.
    if (!this.boss.active && this.score >= this.boss.nextAt) this.boss.start(this);

    // Enough coins for a boost? Wait for a calm moment (on the ground,
    // nothing close, boss not mid-slam), then pause and offer the cards.
    if (this.coinCount >= this.coinsNeeded && p.grounded && !a.invulnerable &&
        !this.isDangerClose(0.8) && !this.boss.stomp) {
      this.openBoostChoice();
    }
  }

  scoreRate() {
    return this.passive.scoreRate * this.mods.scoreRate;
  }

  // ---------------------------------------------------------------
  // Coins and boosts
  // ---------------------------------------------------------------
  collectCoins(count) {
    const value = count * this.mods.coinValue * (this.abilities.isActive('luckyCharm') ? 3 : 1);
    this.coinCount += value;
    this.coinsTotal += value;
    this.sound.play('coin');
    const p = this.player;
    this.particles.burst(p.x + 5, p.y + 4, 4, 20, 60, -Math.PI, 0, 0.3, [OMJ.PALETTE.gold, '#fff2a8'], 0);
    if (this.coinCount >= this.coinsNeeded && this.coinCount - value < this.coinsNeeded) {
      this.announce('BOOST READY!', OMJ.PALETTE.gold);
      this.sound.play('boostReady');
    }
  }

  openBoostChoice() {
    this.boostChoices = OMJ.pickBoostChoices(this.mods, !!this.abilities.bonusDef);
    if (this.boostChoices.length === 0) {         // everything maxed out: just keep the coins
      this.coinCount = 0;
      return;
    }
    this.state = 'choosing';
    this.choiceOpenedAt = performance.now();
    this.ui.showBoostChoice(this.boostChoices, this.mods);
  }

  // Pick card number `index` (0, 1 or 2).
  chooseBoost(index) {
    if (this.state !== 'choosing') return;
    // Ignore clicks/keys in the first moment, so a jump you were already
    // pressing can't pick a card by accident.
    if (performance.now() - this.choiceOpenedAt < 400) return;
    const choice = this.boostChoices[index];
    if (!choice) return;

    let name;
    if (choice.kind === 'bonus') {
      this.abilities.setBonus(choice.key);
      name = choice.ability.name;
    } else {
      choice.boost.apply(this.mods);
      this.mods.stacks[choice.boost.id] = (this.mods.stacks[choice.boost.id] || 0) + 1;
      name = choice.boost.name;
    }
    this.applyMods();

    this.coinCount -= this.coinsNeeded;
    this.boostsTaken++;
    this.coinsNeeded = OMJ.COINS.firstBoostAt + OMJ.COINS.costIncrease * this.boostsTaken;
    this.boostChoices = null;

    this.state = 'playing';
    this.ui.show(null);
    this.player.jumpBufferTimer = 0;
    this.freezeTimer = 0.7;
    this.announce(name.toUpperCase() + '!', OMJ.PALETTE.gold);
    this.announce('GO!', OMJ.PALETTE.white);
    this.sound.play('boostPick');
  }

  // Push the run's boosts into the player and the jump physics.
  applyMods() {
    OMJ.Physics.jumpVelocity = OMJ.CONFIG.JUMP_VELOCITY * this.mods.jumpScale;
    this.player.setTiming(this.passive, this.mods.extraCoyote, this.mods.extraBuffer);
  }

  // The nearest dangerous thing (including pits) touching or ahead of you.
  nextThingAhead() {
    const p = this.player;
    let best = null;
    const pool = this.obstacles.pool;
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.active || o.type.harmless || o.x + o.w <= p.x || o.x > OMJ.CONFIG.VIEW_W) continue;
      if (!best || o.x < best.x) best = o;
    }
    return best;
  }

  // Is the game holding still for a moment (after a boost pick, or mid-Blink)?
  holding() {
    return this.freezeTimer > 0 || this.blinkTimer > 0;
  }

  // ---- Blink: stop for a beat, blink out in a blue star, blink back in ----
  // Timeline (seconds): 0 star opens on you, 0.12 you vanish, 0.2 the world
  // jumps forward, a second star opens, 0.3 you reappear, 0.42 go again.
  startBlink() {
    this.blinkTimer = OMJ.BLINK.total;
    this.blinkShifted = false;
    this.sound.play('blink');
  }

  blinkElapsed() { return OMJ.BLINK.total - this.blinkTimer; }

  updateBlink(dt) {
    this.blinkTimer -= dt;
    if (!this.blinkShifted && this.blinkElapsed() >= OMJ.BLINK.jumpAt) {
      this.blinkShifted = true;
      const target = this.nextThingAhead();
      if (target) this.blinkPast(target);
      this.sound.play('blinkIn');
    }
    if (this.blinkTimer <= 0) {
      this.blinkTimer = 0;
      // Safe for a moment after landing (and never switching off next to danger).
      this.abilities.giveInvulnerability(0.35);
    }
  }

  // Is the runner "blinked out" (invisible) right now?
  get blinkedOut() {
    if (this.blinkTimer <= 0) return false;
    const t = this.blinkElapsed();
    return t >= OMJ.BLINK.hideAt && t < OMJ.BLINK.showAt;
  }

  // A blue four-pointed star that bursts open and closes again.
  // `t` goes 0 -> 1 over its life.
  drawBlinkStar(ctx, cx, cy, t, twist) {
    const size = Math.round(Math.sin(t * Math.PI) * 11);      // grow, then shrink
    if (size < 1) return;
    const diag = Math.floor(this.time * 20) % 2 === (twist ? 1 : 0);
    const layers = [['#3b8bff', size, 2], ['#7bd6ff', Math.round(size * 0.65), 1], [OMJ.PALETTE.white, Math.round(size * 0.3), 1]];
    for (let l = 0; l < layers.length; l++) {
      const color = layers[l][0];
      const len = layers[l][1];
      const thick = layers[l][2];
      ctx.fillStyle = color;
      for (let i = -len; i <= len; i++) {
        const w = Math.max(0, Math.round((1 - Math.abs(i) / (len + 1)) * thick));
        // The four long points...
        ctx.fillRect(cx - w, cy + i, w * 2 + 1, 1);
        ctx.fillRect(cx + i, cy - w, 1, w * 2 + 1);
      }
      // ...and four short ones on the diagonals, which twinkle.
      if (diag) {
        const d = Math.round(len * 0.5);
        for (let i = -d; i <= d; i++) {
          ctx.fillRect(cx + i, cy + i, 1, 1);
          ctx.fillRect(cx + i, cy - i, 1, 1);
        }
      }
    }
  }

  drawBlink(ctx) {
    if (this.blinkTimer <= 0) return;
    const B = OMJ.BLINK;
    const t = this.blinkElapsed();
    const p = this.player;
    const cx = Math.round(p.x + p.w / 2);
    const cy = Math.round(p.y + p.h / 2);
    if (t < B.jumpAt + 0.02) this.drawBlinkStar(ctx, cx, cy, t / (B.jumpAt + 0.02), false);    // blink out
    if (t >= B.jumpAt) this.drawBlinkStar(ctx, cx, cy, (t - B.jumpAt) / (B.total - B.jumpAt), true);  // blink in
  }

  // Blink: jump the whole world forward so you land just past `o`.
  blinkPast(o) {
    const p = this.player;
    const distance = OMJ.clamp(o.x + o.w - p.x + 4, 16, 220);
    const pool = this.obstacles.pool;
    for (let i = 0; i < pool.length; i++) if (pool[i].active) pool[i].x -= distance;
    this.coins.shift(distance);
    this.background.distance += distance;
    this.spawner.distanceUntilNext -= distance;
    const gained = distance * OMJ.CONFIG.SCORE_PER_PIXEL;
    this.progress += gained;
    this.score += gained * this.scoreRate();
    // A streak of sparkles where you "were"
    for (let k = 0; k < 10; k++) {
      this.particles.spawn(p.x + 5 - (distance * k) / 10, p.y + OMJ.rand(2, 10), OMJ.rand(-20, 20), OMJ.rand(-20, 20), 0.4, 1,
        k % 2 ? '#7bd6ff' : OMJ.PALETTE.white, 0);
    }
  }

  // Milestones, new best and unlocks.
  checkScoreEvents() {
    const C = OMJ.CONFIG;
    const p = this.player;
    while (this.score >= this.nextMilestone) {
      this.announce(this.nextMilestone + '!', OMJ.PALETTE.gold);
      this.score += C.MILESTONE_BONUS * this.passive.milestoneBonus;
      this.nextMilestone += C.MILESTONE_EVERY;
      this.sound.play('milestone');
      this.particles.burst(p.x + 5, p.y + 4, 10, 40, 90, 0, Math.PI * 2, 0.6, [OMJ.PALETTE.gold, OMJ.PALETTE.white], 60);
    }
    if (!this.announcedBest && this.score > this.bestAtStart) {
      this.announcedBest = true;
      this.announce('NEW BEST!', '#7bd6ff');
      this.sound.play('newBest');
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
    this.worldSpeed = this.speed;
    this.player.update(dt, 0);
    this.obstacles.update(dt, this.speed, this);
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
  // bridgeGaps: true while invulnerable, so you can run over pits.
  resolveFloor(bridgeGaps) {
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
    let floor = overGap && !bridgeGaps ? Infinity : C.GROUND_Y;
    let floorObject = null;

    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.active || !o.solid) continue;
      if (o.type.oneWay && p.dropTimer > 0) continue;    // dropping through a platform
      const overlaps = footR > o.x + o.bx + 1 && footL < o.x + o.bx + o.bw - 1;
      if (overlaps && p.prevBottom <= o.y + 4 && o.y < floor) { floor = o.y; floorObject = o; }
    }

    // Land only if we were above the floor a moment ago (so you can't
    // "pop up" out of a pit once you've fallen in). Platforms work the
    // same way, which is why you can jump up through them from below.
    if (p.vy >= 0 && p.bottom >= floor && p.prevBottom <= floor + 2) {
      p.land(floor);
      p.standingOn = floorObject;
    } else {
      p.grounded = false;
      p.standingOn = null;
    }
  }

  // Returns the obstacle the player crashed into, or null.
  findCollision() {
    const C = OMJ.CONFIG;
    const p = this.player;
    // (Obstacle "body" boxes: see the top of obstacles.js.)
    // The player's hitbox is 1px smaller than the sprite: near misses feel great.
    // Some skins shrink it even more.
    const shrink = 1 + this.passive.hitboxShrink + this.mods.hitboxShrink;
    const px1 = p.x + shrink;
    const px2 = p.x + p.w - shrink;
    const py1 = p.y + shrink;
    const py2 = p.bottom;
    const pool = this.obstacles.pool;

    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.active || o.type.isGap || o.type.harmless) continue;
      const hb = o.type.hitbox;
      const ox1 = o.x + o.bx + hb.left;
      const ox2 = o.x + o.bx + o.bw - hb.right;
      const oy1 = o.y + hb.top;
      const oy2 = Math.min(o.y + o.h, C.GROUND_Y);
      if (px2 > ox1 && px1 < ox2 && py2 > oy1 && py1 < oy2) {
        // Clipped the top corner of a crate? Be nice: keep rising if you're
        // already going up, or step onto it if you're coming down.
        if (o.solid && p.bottom <= o.y + 3) {
          if (p.vy >= 0) p.land(o.y);
          continue;
        }
        return o;
      }
    }
    return null;
  }

  // Is an obstacle or pit touching the player, or less than `seconds`
  // away? (Used so invulnerability never runs out at an unfair moment.)
  isDangerClose(seconds) {
    const p = this.player;
    const reach = p.x + p.w + this.worldSpeed * (seconds || 0.3);
    const pool = this.obstacles.pool;
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (o.active && !o.type.harmless && o.x < reach && o.x + o.w > p.x - 2) return true;
    }
    return p.bottom > OMJ.CONFIG.GROUND_Y + 1;
  }

  // The nearest obstacle ahead that can be smashed (not a pit), or null.
  nextObstacleAhead() {
    const p = this.player;
    let best = null;
    const pool = this.obstacles.pool;
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.active || o.type.isGap || o.type.harmless || o.x + o.w < p.x + p.w || o.x > OMJ.CONFIG.VIEW_W) continue;
      if (!best || o.x < best.x) best = o;
    }
    return best;
  }

  // Is anything dangerous between the player and screen position x?
  // (The crossbow waits until nothing is, before it fires.)
  hasDangerBefore(x) {
    const p = this.player;
    const pool = this.obstacles.pool;
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (o.active && !o.type.harmless && o.x < x && o.x + o.w > p.x) return true;
    }
    return false;
  }

  // Seconds until every dangerous obstacle on screen has gone past you.
  timeUntilClear() {
    const p = this.player;
    let t = 0;
    const pool = this.obstacles.pool;
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (o.active && !o.type.harmless) t = Math.max(t, (o.x + o.w - p.x) / this.worldSpeed);
    }
    return t;
  }

  onCrusherSlam(o) {
    this.sound.play('crusher');
    this.shake = Math.max(this.shake, 3);
    this.particles.burst(o.x + 10, OMJ.CONFIG.GROUND_Y - 1, 12, 30, 90, Math.PI, Math.PI * 2, 0.4, [OMJ.PALETTE.dust, OMJ.PALETTE.dustDark], 150);
  }

  onBossEnd(defeated, reward) {
    const B = OMJ.BOSS;
    if (defeated) {
      this.score += reward;
      this.collectCoins(10 * this.boss.level);      // and a pile of coins
      this.announce('BOSS DEFEATED! +' + reward, OMJ.PALETTE.gold);
    }
    // Next visit: after the next night.
    this.boss.nextAt = Math.floor(this.score / B.every + 1) * B.every;
    this.spawner.distanceUntilNext = OMJ.CONFIG.FIRST_OBSTACLE_DISTANCE;
    this.music.play('run');
  }

  // ---------------------------------------------------------------
  // Sword and scarf helpers
  // ---------------------------------------------------------------

  // A sword swing hit a boss attack: send it flying back into the boss.
  reflect(o, damage) {
    o.origType = o.type;
    o.type = OMJ.REFLECTED;
    o.extra = damage;
    o.dropping = false;
    if (!o.passed) this.jumped++;
    this.sound.play('reflect');
    this.particles.burst(o.x + o.w / 2, o.y + o.h / 2, 8, 30, 90, -Math.PI / 2, Math.PI / 2, 0.3, [OMJ.PALETTE.white, OMJ.PALETTE.gold], 0);
  }

  // A sword swing cut through an obstacle.
  cut(o) {
    this.smash(o);
    this.sound.play('cut');
  }

  // Coin Rush (Red Scarf): everything on screen turns into coins.
  coinRush() {
    const C = OMJ.CONFIG;
    const pool = this.obstacles.pool;
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.active || o.type.isGap || o.type.harmless || o.x > C.VIEW_W) continue;
      const cx = o.x + o.bx + o.bw / 2;
      this.coins.spawn(cx - 6, Math.min(o.y + o.h / 2, C.GROUND_Y - 8));
      this.coins.spawn(cx + 6, Math.min(o.y + o.h / 2, C.GROUND_Y - 8));
      this.particles.burst(cx, o.y + o.h / 2, 8, 30, 80, 0, Math.PI * 2, 0.4, [OMJ.PALETTE.gold, '#fff2a8'], 100);
      o.active = false;
      if (!o.passed) this.jumped++;
    }
  }

  // Add this run's coins to the saved bank (once per run).
  bankCoins() {
    if (this.banked || !this.coinsTotal) return;
    this.banked = true;
    this.save.bank += this.coinsTotal;
    OMJ.Storage.save(this.save);
    this.ui.setBank(this.save.bank);
  }

  // ---------------------------------------------------------------
  // Shop (on the start screen)
  // ---------------------------------------------------------------
  openShop() {
    this.shopOpen = true;
    this.ui.setShopNote('');
    this.renderShop();
    this.sound.play('click');
  }

  closeShop() {
    this.shopOpen = false;
    this.ui.show('start');
    this.sound.play('click');
  }

  renderShop() {
    const swords = this.shopTab === 'swords';
    this.ui.showShop(this.shopTab, swords ? OMJ.SWORDS : OMJ.SCARVES,
      swords ? this.save.swords : this.save.scarves,
      swords ? this.save.sword : this.save.scarf, this.save.bank);
  }

  // Click an item: equip it if you own it, otherwise try to buy it.
  onShopItem(index) {
    const swords = this.shopTab === 'swords';
    const item = (swords ? OMJ.SWORDS : OMJ.SCARVES)[index];
    if (!item) return;
    const owned = swords ? this.save.swords : this.save.scarves;
    if (owned.indexOf(item.id) < 0) {
      if (this.save.bank < item.price) {
        this.ui.setShopNote('Need ' + (item.price - this.save.bank) + ' more coins');
        this.sound.play('denied');
        return;
      }
      this.save.bank -= item.price;
      owned.push(item.id);
      this.ui.setShopNote('');
      this.sound.play('buy');
    } else {
      this.sound.play('equip');
    }
    if (swords) {
      this.save.sword = item.id;
      this.swordItem = item;
      this.sword.reset(item);
    } else {
      this.save.scarf = item.id;
      this.scarf = item;
    }
    OMJ.Storage.save(this.save);
    this.ui.setBank(this.save.bank);
    this.renderShop();
  }

  // Break an obstacle into pieces (Dash, Shuriken, Shield...).
  smash(o) {
    o.active = false;
    if (!o.passed) this.jumped++;
    const colors = o.type.debris || [OMJ.PALETTE.metal, OMJ.PALETTE.metalLight];
    this.particles.burst(o.x + o.bx + o.bw / 2, o.y + o.h / 2, 14, 40, 130, 0, Math.PI * 2, 0.6, colors, 300);
    this.sound.play('smash');
    this.shake = Math.max(this.shake, 2);
    this.score += 5;
  }

  // Supernova: everything on screen disappears in a burst.
  clearScreen() {
    const C = OMJ.CONFIG;
    const pool = this.obstacles.pool;
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.active || o.x > C.VIEW_W) continue;
      if (o.type.isGap) {
        // Pits get filled in with sparkles.
        this.particles.burst(o.x + o.w / 2, C.GROUND_Y, 10, 30, 90, Math.PI, Math.PI * 2, 0.6, [OMJ.PALETTE.white, this.scarf.color], 150);
        o.active = false;
        if (!o.passed) this.jumped++;
      } else {
        this.smash(o);
      }
    }
    if (this.boss.fighting) this.boss.hit(2, this);
    this.flash = 0.15;
    this.shake = 4;
  }

  bounceOutOfPit() {
    const C = OMJ.CONFIG;
    const p = this.player;
    p.y = C.GROUND_Y + 2 - p.h;
    p.vy = -C.JUMP_VELOCITY;
    p.grounded = false;
    this.abilities.giveInvulnerability(0.6);
  }

  die(cause) {
    const p = this.player;
    p.die(cause);
    this.state = 'dying';
    this.deathTimer = 0;
    this.hitstop = OMJ.CONFIG.HITSTOP_TIME;
    this.shake = cause === 'gap' ? 2 : 5;
    this.flash = 0.1;
    this.sound.play(cause === 'gap' ? 'fall' : 'hit');
    this.music.stop();
    this.particles.burst(p.x + 5, p.y + 6, 18, 40, 140, 0, Math.PI * 2, 0.8,
      [this.skin.body, this.skin.light, this.scarf.color, OMJ.PALETTE.white], 300);

    this.bankCoins();
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
    this.sound.play(this.isNewBest ? 'newBest' : 'gameOver');

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
      coins: this.coinsTotal,
      unlocks: this.newUnlocks,
      nextUnlock: nextUnlock,
      bank: this.save.bank,
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
    const inRun = this.state === 'playing' || this.state === 'paused' || this.state === 'choosing';

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
    this.boss.draw(ctx, this);
    this.obstacles.draw(ctx, this);
    this.coins.draw(ctx);
    this.particles.draw(ctx);
    if (inRun) this.abilities.drawBehindPlayer(ctx, this);

    ctx.globalAlpha = inRun ? this.abilities.playerAlpha(this.time) : 1;
    if (!this.blinkedOut) {
      this.sword.drawBehind(ctx, this);     // a dragged sword trails out behind you
      this.player.draw(ctx, this.skin, this.time, this.scarf);
      this.sword.draw(ctx, this);
    }
    ctx.globalAlpha = 1;
    this.drawBlink(ctx);
    if (inRun) this.abilities.drawInFrontOfPlayer(ctx, this);

    if (C.DEBUG_HITBOXES) this.drawHitboxes(ctx);
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (inRun) this.abilities.drawScreenEffects(ctx, this);

    // Quick white flash (crashes, Supernova). Short and soft.
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.5, this.flash * 5);
      ctx.fillStyle = OMJ.PALETTE.white;
      ctx.fillRect(0, 0, C.VIEW_W, C.VIEW_H);
      ctx.globalAlpha = 1;
    }

    if (this.state === 'menu') {
      this.ui.drawSkinPreview(this.time, this.scarf);
      if (this.shopOpen) this.ui.animateShop(this.time);
    } else {
      this.drawHud(ctx);
      this.boss.drawHud(ctx);
      if (inRun) this.abilities.drawHud(ctx, this);
    }
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

    // Coins toward the next boost (rebuilt only when it changes)
    if (this.coinCount !== this.shownCoins) {
      this.shownCoins = this.coinCount;
      this.coinText = Math.min(this.coinCount, this.coinsNeeded) + '/' + this.coinsNeeded;
    }
    const ready = this.coinCount >= this.coinsNeeded;
    const label = ready ? 'BOOST!' : this.coinText;
    if (!ready || Math.floor(this.time * 4) % 2 === 0) {
      F.drawShadowed(ctx, label, C.VIEW_W - 8, 32, 1, ready ? OMJ.PALETTE.gold : OMJ.PALETTE.white, ink, 'right');
    }
    const iconX = C.VIEW_W - 12 - F.measure(label, 1);
    ctx.fillStyle = ink;
    ctx.fillRect(iconX - 3, 31, 6, 7);
    ctx.fillStyle = OMJ.PALETTE.gold;
    ctx.fillRect(iconX - 2, 31, 4, 6);
    ctx.fillStyle = '#fff2a8';
    ctx.fillRect(iconX - 1, 32, 1, 3);

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
    const s = 1 + this.passive.hitboxShrink + this.mods.hitboxShrink;
    ctx.strokeStyle = '#00ff00';
    ctx.lineWidth = 1;
    ctx.strokeRect(p.x + s + 0.5, p.y + s + 0.5, p.w - s * 2, p.h - s);
    const pool = this.obstacles.pool;
    ctx.strokeStyle = '#ff00ff';
    for (let i = 0; i < pool.length; i++) {
      const o = pool[i];
      if (!o.active) continue;
      if (o.type.harmless) continue;
      if (o.type.isGap) { ctx.strokeRect(o.x + 0.5, OMJ.CONFIG.GROUND_Y + 0.5, o.w - 1, 6); continue; }
      const hb = o.type.hitbox;
      ctx.strokeRect(o.x + o.bx + hb.left + 0.5, o.y + hb.top + 0.5, o.bw - hb.left - hb.right - 1, o.h - hb.top - 1);
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
