// =====================================================================
// game.js — the main game object: state, the game loop, and the HUD.
//
// The game loop runs about 60 times per second:
//   1. update(dt) — move things forward in time by dt seconds
//   2. draw()     — paint the current state onto the canvas
//
// The menus (title, pause, results) live in screens.js and the upgrade
// cards in levelup.js; this file decides which one is showing.
// =====================================================================

const DYING_DURATION = 0.9; // seconds between the final hit and the results panel
const COLLECT_COMBO_WINDOW = 0.6; // orbs collected this close together raise the pitch

const Game = {
  canvas: null,
  ctx: null,

  // Which "mode" the game is in:
  //   'title'    — the start screen
  //   'select'   — choosing a hero
  //   'playing'  — normal gameplay
  //   'paused'   — frozen, pause menu open
  //   'levelup'  — frozen, choosing an upgrade card
  //   'dying'    — short dramatic moment after the last heart is lost
  //   'gameover' — results panel
  state: 'title',
  player: null,
  weapons: [], // every gun you own; they all fire at once (see guns.js)
  gunPickups: [], // guns dropped by monsters, waiting to be picked up
  enemies: [],
  projectiles: [],
  enemyShots: [],
  gasClouds: [], // poison clouds left by Toxic Slimes
  orbs: [],
  heartPickups: [], // hearts dropped by monsters
  heartsLost: 0, // each lost heart raises the heart drop chance
  spawner: null,
  kills: 0, // enemies defeated this run
  score: 0,
  best: null, // personal best, loaded from storage
  characterId: 'runner', // the chosen hero (see characters.js)
  isNewBest: false, // did the last run beat the record?
  runRecorded: false, // makes sure one run is only saved once

  // Experience: collecting energy fills the bar; a full bar = level up.
  level: 1,
  xp: 0,
  xpToNext: 0,
  pendingLevelUps: 0, // level-ups waiting to be shown (you can gain two at once)
  upgradeLevels: {}, // how many times each upgrade was taken, e.g. { rapidFire: 2 }
  survivalTime: 0, // seconds survived in the current run
  animTime: 0, // seconds of animation (keeps running on menus)
  stateTime: 0, // seconds since the current state started
  showDebug: false,

  // Feedback effects
  shakeTime: 0,
  shakeStrength: 0,
  hurtFlashTime: 0, // > 0 while the red screen border shows after a hit
  collectCombo: 0, // orbs collected in quick succession
  collectComboTimer: 0,

  // Mouse position in game pixels
  mouseX: -1,
  mouseY: -1,

  // Game loop bookkeeping
  animationFrameId: null,
  lastTimestamp: null,
  fps: 0,
  fpsFrames: 0,
  fpsTimer: 0,

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    // Turn off smoothing so scaled images stay sharp.
    this.ctx.imageSmoothingEnabled = false;

    Sprites.init();
    Upgrades.init();
    Guns.init();
    UI.init();
    Arena.init();
    Sound.init();
    this.best = Save.loadBest();
    this.characterId = getCharacter(Save.loadCharacter()).id;
    this.resetRun();
    this.setState('title');
    TitleScreen.open();

    // Pause automatically when the player switches to another tab/window.
    window.addEventListener('blur', () => {
      if (this.state === 'playing') this.pause();
    });

    canvas.addEventListener('mousemove', (event) => this.onMouseMove(event));
    canvas.addEventListener('mouseleave', () => { this.mouseX = -1; this.mouseY = -1; });
    canvas.addEventListener('click', (event) => this.onClick(event));
  },

  setState(newState) {
    this.state = newState;
    this.stateTime = 0;
  },

  // Put everything back to the starting state. The personal best is
  // stored separately, so it is never touched here.
  resetRun() {
    const centerX = ARENA.x + ARENA.width / 2;
    const centerY = ARENA.y + ARENA.height / 2;
    const character = getCharacter(this.characterId);
    this.player = new Player(centerX, centerY, character);
    // Everyone starts with just the Blaster. The others are rare drops.
    this.weapons = [this.createWeapon('blaster')];
    this.gunPickups = [];
    this.enemies = [];
    this.projectiles = [];
    this.enemyShots = [];
    this.gasClouds = [];
    this.orbs = [];
    this.heartPickups = [];
    this.heartsLost = 0;
    this.spawner = new Spawner();
    this.kills = 0;
    this.score = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = xpNeededForLevel(1);
    this.pendingLevelUps = 0;
    this.upgradeLevels = {};
    Effects.reset();
    this.survivalTime = 0;
    this.shakeTime = 0;
    this.hurtFlashTime = 0;
    this.collectCombo = 0;
    this.isNewBest = false;
    this.runRecorded = false;
    Input.clear(); // forget keys held from the previous run
  },

  // ---------------------------------------------------------------
  // Moving between screens (each one uses the pixel wipe)
  // ---------------------------------------------------------------
  startGame() {
    Transition.start(() => {
      this.resetRun();
      this.setState('playing');
    });
  },

  openCharacterSelect() {
    Transition.start(() => {
      CharacterSelect.open(this);
      this.setState('select');
    });
  },

  chooseCharacter(id) {
    this.characterId = id;
    Save.saveCharacter(id);
    this.startGame();
  },

  // ---------------------------------------------------------------
  // Guns
  // ---------------------------------------------------------------
  // Make a gun with the current hero's bonuses applied.
  createWeapon(gunId) {
    const character = this.player.character;
    const weapon = new Weapon(getGun(gunId));
    // Range also stretches how far bullets fly.
    weapon.stats.range *= character.range;
    weapon.stats.projectileLifetime *= character.range;
    weapon.stats.damageMultiplier = character.damage;
    return weapon;
  },

  hasGun(gunId) {
    return this.weapons.some((weapon) => weapon.id === gunId);
  },

  getWeapon(gunId) {
    return this.weapons.find((weapon) => weapon.id === gunId);
  },

  // Guns you don't own yet and that aren't already lying on the floor.
  getMissingGuns() {
    return GUNS.filter((gun) => !this.hasGun(gun.id) && !this.gunPickups.some((pickup) => pickup.gunId === gun.id));
  },

  // A small chance for any defeated monster to drop a gun you don't have.
  maybeDropGun(enemy) {
    const missing = this.getMissingGuns();
    if (missing.length === 0 || Math.random() >= GUN_DROP_CONFIG.chance) return;
    const gun = missing[randomInt(0, missing.length - 1)];
    this.gunPickups.push(new GunPickup(enemy.x, enemy.y, gun.id));
    Effects.text(enemy.x, enemy.y - 10, gun.name + '!', gun.uiColor, 1.2);
  },

  addGun(gunId) {
    if (this.hasGun(gunId)) return;
    const weapon = this.createWeapon(gunId);
    Upgrades.catchUpNewWeapon(this, weapon);
    this.weapons.push(weapon);
    const gun = weapon.gun;
    Effects.ring(this.player.x, this.player.y, 16, [PALETTE.white, gun.uiColor, gun.uiColor], 0.35);
    Effects.burst(this.player.x, this.player.y, 14, [PALETTE.white, gun.uiColor], { maxSpeed: 60, life: 0.5 });
    this.spawner.showBanner('NEW GUN: ' + gun.name, gun.uiColor, 2.2);
    Sound.play('gunPickup');
  },

  updateGunPickups(dt) {
    for (const pickup of this.gunPickups) {
      pickup.update(dt, this.player, this.player.magnetRadius);
      if (pickup.collected) this.addGun(pickup.gunId);
    }
    this.gunPickups = this.gunPickups.filter((pickup) => !pickup.collected);
  },

  backToTitle() {
    Transition.start(() => {
      this.resetRun(); // so the title screen shows the chosen hero
      this.setState('title');
      TitleScreen.open();
    });
  },

  restartRun() {
    this.recordRun();
    this.startGame();
  },

  quitToTitle() {
    this.recordRun();
    Transition.start(() => {
      this.resetRun();
      this.setState('title');
      TitleScreen.open();
    });
  },

  pause() {
    PauseMenu.open();
    this.setState('paused');
  },

  // Save the run as the personal best if it beats the old one.
  recordRun() {
    if (this.runRecorded || this.survivalTime === 0) return;
    this.runRecorded = true;
    this.isNewBest = Save.submitRun({
      score: Math.floor(this.score),
      time: Math.floor(this.survivalTime),
      kills: this.kills,
      level: this.level,
    });
    this.best = Save.loadBest();
  },

  // ---------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------
  // Start the loop. The check makes sure we never run two loops at once
  // (two loops would make the game run at double speed).
  start() {
    if (this.animationFrameId !== null) return;
    this.lastTimestamp = null;
    this.animationFrameId = requestAnimationFrame((timestamp) => this.frame(timestamp));
  },

  frame(timestamp) {
    // dt = seconds since the last frame. Clamped so a long pause in the
    // browser (like switching tabs) doesn't cause a giant jump.
    if (this.lastTimestamp === null) this.lastTimestamp = timestamp;
    const dt = Math.min((timestamp - this.lastTimestamp) / 1000, MAX_DELTA);
    this.lastTimestamp = timestamp;

    this.update(dt);
    this.draw();
    Input.endFrame();

    this.animationFrameId = requestAnimationFrame((t) => this.frame(t));
  },

  update(dt) {
    this.trackFps(dt);
    this.stateTime += dt;
    if (Input.wasPressed('KeyM')) Sound.toggleMute();
    if (Input.wasPressed('KeyG') && this.state === 'playing') this.showDebug = !this.showDebug;

    // During a screen wipe, only animations run (no input, no gameplay).
    Transition.update(dt);
    if (Transition.active) {
      this.animTime += dt;
      Arena.update(dt);
      return;
    }

    if (this.state === 'paused') {
      PauseMenu.update(dt, this);
      return; // nothing in the world moves while paused
    }
    if (this.state === 'levelup') {
      LevelUpScreen.update(dt, this);
      return; // the world is frozen while choosing an upgrade
    }

    // Everything below keeps animating in the other states.
    this.animTime += dt;
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    this.hurtFlashTime = Math.max(0, this.hurtFlashTime - dt);
    Touch.update(dt);
    Arena.update(dt);
    Effects.update(dt); // explosions keep playing on the game-over screen

    if (this.state === 'title') TitleScreen.update(dt, this);
    else if (this.state === 'select') CharacterSelect.update(dt, this);
    else if (this.state === 'playing') this.updatePlaying(dt);
    else if (this.state === 'dying') this.updateDying(dt);
    else if (this.state === 'gameover') GameOverScreen.update(dt, this);
  },

  updatePlaying(dt) {
    if (Input.wasPressed('Escape')) {
      this.pause();
      return;
    }

    this.survivalTime += dt;
    this.score += dt * PROGRESSION_CONFIG.scorePerSecond;
    this.collectComboTimer -= dt;
    if (this.collectComboTimer <= 0) this.collectCombo = 0;

    // 1. Player moves and the blaster fires on its own.
    this.player.update(dt);
    this.checkDashRam();
    for (const weapon of this.weapons) weapon.update(dt, this.player, this.enemies, this.projectiles);

    // 2. Shots fly and hit enemies.
    for (const projectile of this.projectiles) projectile.update(dt);
    this.checkProjectileHits();

    // 3. New enemies arrive, then everyone moves.
    this.spawner.update(dt, this.survivalTime, this.player, this.enemies);
    for (const enemy of this.enemies) enemy.update(dt, this.player, this);
    separateEnemies(this.enemies);
    for (const shot of this.enemyShots) shot.update(dt);
    for (const cloud of this.gasClouds) cloud.update(dt);
    this.checkPlayerCollisions();

    // 4. Energy orbs and hearts drift toward the player and get collected.
    this.updateOrbs(dt);
    this.updateHeartPickups(dt);
    this.updateGunPickups(dt);

    // 5. Throw away anything that is finished, so lists never grow forever.
    this.enemies = this.enemies.filter((enemy) => !enemy.dead);
    this.projectiles = this.projectiles.filter((projectile) => !projectile.dead);
    this.enemyShots = this.enemyShots.filter((shot) => !shot.dead);
    this.gasClouds = this.gasClouds.filter((cloud) => !cloud.dead);

    // 6. Enough energy for a new level? Open the upgrade cards.
    if (this.state === 'playing' && this.pendingLevelUps > 0) this.startLevelUp();
  },

  // ---------------------------------------------------------------
  // Experience and upgrades
  // ---------------------------------------------------------------
  gainXp(amount) {
    this.xp += amount;
    // A "while" loop, because one big pickup could fill the bar twice.
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = xpNeededForLevel(this.level);
      this.pendingLevelUps++;
    }
  },

  startLevelUp() {
    Effects.ring(this.player.x, this.player.y, 14, SPARK_COLORS.levelUp, 0.3);
    Effects.burst(this.player.x, this.player.y, 12, SPARK_COLORS.levelUp, { maxSpeed: 60, life: 0.5 });
    Sound.play('levelUp');
    LevelUpScreen.open(this);
    this.setState('levelup');
  },

  // Called by the level-up screen once a card has been chosen.
  finishLevelUp(upgrade) {
    Upgrades.applyUpgrade(this, upgrade);
    this.upgradeLevels[upgrade.id] = (this.upgradeLevels[upgrade.id] || 0) + 1;
    this.pendingLevelUps--;

    if (this.pendingLevelUps > 0) {
      LevelUpScreen.open(this); // another level-up is waiting
      this.setState('levelup');
      return;
    }
    // A moment of safety so enemies that crept close can't hit you instantly.
    const player = this.player;
    player.invulnerableTime = Math.max(player.invulnerableTime, PROGRESSION_CONFIG.postUpgradeSafety);
    this.setState('playing');
  },

  // ---------------------------------------------------------------
  // Combat
  // ---------------------------------------------------------------
  // Check every shot against every enemy.
  checkProjectileHits() {
    for (const projectile of this.projectiles) {
      if (projectile.dead) continue;
      for (const enemy of this.enemies) {
        if (enemy.dead || projectile.alreadyHit.has(enemy)) continue;
        if (!circlesOverlap(projectile, enemy)) continue;

        projectile.alreadyHit.add(enemy);
        Effects.burst(projectile.x, projectile.y, 3, projectile.getSparkColors(), { maxSpeed: 50, life: 0.2 });
        if (projectile.crit) Effects.text(enemy.x, enemy.y - 8, 'CRIT!', PALETTE.yellow, 0.5);
        // A homing bullet stops curving once it has hit its target, so a
        // piercing bullet flies on instead of circling back.
        if (projectile.target === enemy) projectile.target = null;
        const defeated = enemy.takeDamage(projectile.damage, projectile.dirX, projectile.dirY, projectile.knockback);
        if (defeated) this.onEnemyDefeated(enemy);
        else Sound.play('hit');

        // A piercing shot keeps going; a normal shot stops here.
        if (projectile.pierceLeft > 0) {
          projectile.pierceLeft--;
        } else {
          projectile.dead = true;
          break;
        }
      }
    }
  },

  onEnemyDefeated(enemy) {
    this.kills++;
    this.score += enemy.scoreValue;
    Effects.explode(enemy.x, enemy.y, enemy.explosionColors, enemy.explosionSize);
    // Bigger enemies shake the screen harder and show their points.
    if (enemy.type === 'boss') {
      // A huge finale: several explosions, a big shake, and a banner.
      for (let i = 0; i < 4; i++) {
        Effects.explode(enemy.x + randomRange(-12, 12), enemy.y + randomRange(-12, 12), enemy.explosionColors, 4);
      }
      this.shake(5, 0.6);
      Effects.text(enemy.x, enemy.y - 20, '+' + enemy.scoreValue, PALETTE.yellow, 1.5);
      this.spawner.showBanner('BOSS DEFEATED!', PALETTE.yellow, 2.5);
      Sound.play('bruteDie');
      Sound.play('newBest');
    } else if (enemy.type === 'brute') {
      this.shake(3, 0.2);
      Effects.text(enemy.x, enemy.y - 8, '+' + enemy.scoreValue, PALETTE.orange);
      Sound.play('bruteDie');
    } else if (enemy.type === 'toxic') {
      this.shake(1, 0.08);
      this.releaseGas(enemy.x, enemy.y);
    } else if (enemy.type === 'shooter') {
      this.shake(2, 0.1);
      Effects.text(enemy.x, enemy.y - 7, '+' + enemy.scoreValue, PALETTE.pink, 0.6);
      Sound.play('enemyDie');
    } else {
      this.shake(1, 0.08);
      Sound.play('enemyDie');
    }
    for (let i = 0; i < enemy.energyValue; i++) {
      this.orbs.push(new Orb(enemy.x, enemy.y, 1));
    }
    this.maybeDropHeart(enemy);
    this.maybeDropGun(enemy);
    // Too many orbs lying around? Remove the oldest ones.
    if (this.orbs.length > ORB_CONFIG.maxOrbs) this.orbs.splice(0, this.orbs.length - ORB_CONFIG.maxOrbs);
  },

  // Every monster type has its own chance to drop a heart:
  //   1. start from that monster's base chance
  //   2. add +5% for every heart you've lost this run
  //   3. never go above 25%
  //   4. if your hearts are full, cut it in half
  getHeartDropChance(type) {
    const config = HEART_DROP_CONFIG;
    let chance = config.chance[type] + this.heartsLost * config.bonusPerHeartLost;
    chance = Math.min(chance, config.maxChance);
    if (this.player.hasFullHealth()) chance *= config.fullHealthMultiplier;
    return chance;
  },

  maybeDropHeart(enemy) {
    if (this.heartPickups.length >= HEART_DROP_CONFIG.maxOnFloor) return;
    if (Math.random() < this.getHeartDropChance(enemy.type)) {
      this.heartPickups.push(new HeartPickup(enemy.x, enemy.y));
    }
  },

  updateHeartPickups(dt) {
    for (const heart of this.heartPickups) {
      heart.update(dt, this.player, this.player.magnetRadius);
      if (heart.collected) {
        this.player.heal(1);
        Effects.burst(heart.x, heart.y, 8, SPARK_COLORS.heart, { minSpeed: 15, maxSpeed: 45, life: 0.35 });
        Effects.text(this.player.x, this.player.y - 10, '+1 HEART', PALETTE.red);
        Sound.play('heal');
      }
    }
    this.heartPickups = this.heartPickups.filter((heart) => !heart.collected && !heart.isExpired());
  },

  updateOrbs(dt) {
    for (const orb of this.orbs) {
      orb.update(dt, this.player, this.player.magnetRadius);
      if (orb.collected) {
        this.gainXp(orb.value);
        Effects.burst(orb.x, orb.y, 4, SPARK_COLORS.energy, { minSpeed: 10, maxSpeed: 35, life: 0.25 });
        // Each orb in a quick chain plays a slightly higher note.
        Sound.play('collect', this.collectCombo);
        this.collectCombo++;
        this.collectComboTimer = COLLECT_COMBO_WINDOW;
      }
    }
    this.orbs = this.orbs.filter((orb) => !orb.collected && !orb.isExpired());
  },

  // A defeated Toxic Slime leaves a poison cloud behind.
  releaseGas(x, y) {
    this.gasClouds.push(new GasCloud(x, y));
    // Too many clouds? The oldest one vanishes.
    if (this.gasClouds.length > GAS_CONFIG.maxClouds) this.gasClouds.shift();
    Sound.play('gas');
  },

  // The Brute hero's perk: dashing into monsters damages them. Each
  // monster can only be hit once per dash.
  checkDashRam() {
    const player = this.player;
    const damage = player.character.dashDamage;
    if (damage === 0 || !player.isDashing()) return;
    for (const enemy of this.enemies) {
      if (enemy.dead || player.dashHits.has(enemy)) continue;
      // A slightly bigger reach than normal contact, so ramming feels solid.
      if (!circlesOverlap({ x: player.x, y: player.y, radius: player.radius + 3 }, enemy)) continue;
      player.dashHits.add(enemy);
      Effects.burst(enemy.x, enemy.y, 8, SPARK_COLORS.ram, { maxSpeed: 70, life: 0.3 });
      Effects.text(enemy.x, enemy.y - 8, 'RAM!', PALETTE.orange, 0.5);
      this.shake(2, 0.1);
      const defeated = enemy.takeDamage(damage, player.dashDirX, player.dashDirY, 140);
      if (defeated) this.onEnemyDefeated(enemy);
      else Sound.play('hit');
    }
  },

  // Shooters call this to fire.
  spawnEnemyShot(x, y, dirX, dirY) {
    if (this.enemyShots.length >= ENEMY_SHOT_CONFIG.max) return;
    this.enemyShots.push(new EnemyShot(x, y, dirX, dirY));
    Sound.play('enemyShoot');
  },

  // Did any enemy or enemy shot touch the player this frame?
  checkPlayerCollisions() {
    const player = this.player;
    for (const enemy of this.enemies) {
      if (!player.canBeHit()) return;
      if (enemy.dead || !circlesOverlap(player, enemy)) continue; // just-defeated enemies can't hurt you
      enemy.knockBackFrom(player.x, player.y, CHASER_CONFIG.knockback);
      this.hurtPlayer(enemy.contactDamage);
    }
    for (const shot of this.enemyShots) {
      if (!player.canBeHit()) return;
      if (shot.dead || !circlesOverlap(player, shot)) continue;
      shot.dead = true;
      Effects.burst(shot.x, shot.y, 4, SPARK_COLORS.shooter, { maxSpeed: 40, life: 0.2 });
      this.hurtPlayer();
    }
    for (const cloud of this.gasClouds) {
      if (!player.canBeHit()) return;
      if (!cloud.isHarmful() || !cloud.touches(player)) continue;
      Effects.burst(player.x, player.y, 5, SPARK_COLORS.toxic, { maxSpeed: 30, life: 0.3 });
      this.hurtPlayer();
    }
  },

  // Everything that happens when the player gets hit, in one place.
  // `hearts` is how many hearts the hit costs (the boss takes 2).
  hurtPlayer(hearts = 1) {
    const player = this.player;

    // A ready shield takes the hit instead of a heart.
    if (player.shieldReady) {
      player.breakShield();
      Effects.ring(player.x, player.y, SHIELD_CONFIG.radius + 6, SPARK_COLORS.shield, 0.25);
      Effects.burst(player.x, player.y, 10, SPARK_COLORS.shield, { maxSpeed: 60, life: 0.35 });
      Effects.text(player.x, player.y - 10, 'BLOCKED!', PALETTE.cyan);
      Sound.play('shieldBlock');
      this.shake(2, 0.12);
      return;
    }

    const fatal = player.takeHit(hearts);
    this.heartsLost += hearts; // makes heart drops more likely from now on
    if (hearts > 1) Effects.text(player.x, player.y - 10, '-' + hearts + ' HEARTS', PALETTE.red);
    this.shake(3, 0.2);
    this.hurtFlashTime = 0.15;
    if (fatal) {
      this.shake(4, 0.5);
      Effects.explode(player.x, player.y, getCharacterExplosionColors(player.character), 3);
      Sound.play('death');
      this.setState('dying');
    } else {
      Sound.play('hurt');
    }
  },

  // A short freeze after the final hit, so the player sees what happened.
  updateDying(dt) {
    this.player.updateDeath(dt);
    if (this.stateTime < DYING_DURATION) return;
    this.recordRun();
    Sound.play('gameOver');
    if (this.isNewBest) Sound.play('newBest');
    GameOverScreen.open();
    this.setState('gameover');
  },

  shake(strength, duration) {
    // Keep the strongest shake if two happen at once.
    if (strength >= this.shakeStrength || this.shakeTime === 0) this.shakeStrength = strength;
    this.shakeTime = Math.max(this.shakeTime, duration);
  },

  // ---------------------------------------------------------------
  // Drawing
  // ---------------------------------------------------------------
  draw() {
    const ctx = this.ctx;

    if (this.state === 'title') {
      TitleScreen.draw(ctx, this);
    } else if (this.state === 'select') {
      CharacterSelect.draw(ctx, this);
    } else {
      this.drawWorld(ctx);
      this.drawHud(ctx);
      Touch.draw(ctx, this.player);
      if (this.showDebug) this.drawDebug(ctx);
      if (this.state === 'paused') PauseMenu.draw(ctx, this);
      if (this.state === 'levelup') LevelUpScreen.draw(ctx, this);
      if (this.state === 'gameover') GameOverScreen.draw(ctx, this);
    }

    Transition.draw(ctx); // the wipe goes on top of everything
  },

  drawWorld(ctx) {
    // Screen shake moves the whole world by a few WHOLE pixels.
    ctx.save();
    if (this.shakeTime > 0) {
      const offsetX = randomInt(-this.shakeStrength, this.shakeStrength);
      const offsetY = randomInt(-this.shakeStrength, this.shakeStrength);
      ctx.translate(offsetX, offsetY);
    }
    // Draw in layers, from the floor up.
    Arena.draw(ctx, this.animTime);
    this.spawner.draw(ctx);
    for (const orb of this.orbs) orb.draw(ctx);
    for (const heart of this.heartPickups) heart.draw(ctx);
    for (const pickup of this.gunPickups) pickup.draw(ctx);
    for (const cloud of this.gasClouds) cloud.draw(ctx);
    // Things higher on screen are drawn first, so lower ones overlap them
    // naturally (like standing in front of someone).
    const things = [...this.enemies, this.player].sort((a, b) => a.y - b.y);
    for (const thing of things) thing.draw(ctx);
    for (const projectile of this.projectiles) projectile.draw(ctx);
    for (const shot of this.enemyShots) shot.draw(ctx);
    for (const weapon of this.weapons) weapon.draw(ctx);
    Effects.draw(ctx);
    ctx.restore();

    // Red border flash when you lose a heart: crisp 2-pixel frame, no blur.
    if (this.hurtFlashTime > 0) {
      ctx.fillStyle = PALETTE.red;
      ctx.fillRect(0, 0, VIEW_WIDTH, 2);
      ctx.fillRect(0, VIEW_HEIGHT - 2, VIEW_WIDTH, 2);
      ctx.fillRect(0, 0, 2, VIEW_HEIGHT);
      ctx.fillRect(VIEW_WIDTH - 2, 0, 2, VIEW_HEIGHT);
    }
  },

  // Clickable icons in the bottom-right corner while playing.
  getHudButtons() {
    const y = VIEW_HEIGHT - 8;
    return [
      { id: 'sound', box: { x: VIEW_WIDTH - ARENA.x - 21, y, width: 9, height: 8 } },
      { id: 'pause', box: { x: VIEW_WIDTH - ARENA.x - 9, y, width: 9, height: 8 } },
    ];
  },

  drawHud(ctx) {
    const top = 4;

    // Hearts in the top-left corner: one slot per possible heart (5),
    // full or empty. You start with 3 full and 2 empty.
    for (let i = 0; i < this.player.maxHealth; i++) {
      const image = i < this.player.health ? Sprites.heart.full : Sprites.heart.empty;
      ctx.drawImage(image, ARENA.x + i * 9, top);
    }
    let afterHearts = ARENA.x + this.player.maxHealth * 9;

    // Shield icon after the hearts (only once you have the upgrade).
    if (this.player.shieldLevel > 0) {
      const icon = this.player.shieldReady ? Sprites.shieldIcon.ready : Sprites.shieldIcon.empty;
      ctx.drawImage(icon, afterHearts + 1, top - 1);
      afterHearts += 9;
    }

    // Level and experience bar next to the hearts.
    const levelX = afterHearts + 5;
    drawText(ctx, 'LV' + this.level, levelX, top + 1, PALETTE.yellow, { shadow: PALETTE.void });
    const barX = levelX + measureText('LV' + this.level) + 4;
    drawPixelBar(ctx, barX, top + 2, 48, 3, this.xp / this.xpToNext, PALETTE.yellow);

    // Survival timer in the top middle.
    drawText(ctx, formatTime(this.survivalTime), VIEW_WIDTH / 2, top + 1, PALETTE.white, {
      align: 'center',
      shadow: PALETTE.darkBlue,
    });

    // Score in the top-right, padded with zeros like an arcade cabinet.
    const scoreText = String(Math.floor(this.score)).padStart(7, '0');
    drawText(ctx, scoreText, VIEW_WIDTH - ARENA.x, top + 1, PALETTE.white, { align: 'right', shadow: PALETTE.darkBlue });
    drawText(ctx, 'SCORE', VIEW_WIDTH - ARENA.x - measureText(scoreText) - 4, top + 1, PALETTE.cyanDim, { align: 'right' });

    // Bottom row: dash meter, controls reminder, sound and pause icons.
    const bottom = VIEW_HEIGHT - 7;
    drawText(ctx, 'DASH', ARENA.x, bottom, PALETTE.cyanDim);
    const charge = 1 - this.player.dashCooldown / PLAYER_CONFIG.dashCooldown;
    drawPixelBar(ctx, ARENA.x + 20, bottom + 1, 30, 3, charge, charge >= 1 ? PALETTE.cyan : PALETTE.blue);
    // The guns you own, side by side.
    this.weapons.forEach((weapon, i) => ctx.drawImage(weapon.gun.image, ARENA.x + 56 + i * 14, bottom));
    const hint = Touch.active ? 'DRAG LEFT TO MOVE  TAP RIGHT TO DASH' : 'WASD MOVE  SPACE DASH  M MUTE  ESC PAUSE';
    drawText(ctx, hint, VIEW_WIDTH - ARENA.x - 26, bottom, PALETTE.darkBlue, { align: 'right' });
    for (const button of this.getHudButtons()) {
      const icon = button.id === 'pause' ? 'pause' : Sound.muted ? 'soundOff' : 'soundOn';
      const hovered = this.state === 'playing' && pointInBox(this.mouseX, this.mouseY, button.box);
      ctx.drawImage(UI.icons[icon][hovered ? 'hover' : 'normal'], button.box.x, button.box.y + 1);
    }

    // Boss health bar along the bottom of the arena while the boss is alive.
    const boss = this.enemies.find((enemy) => enemy.type === 'boss' && !enemy.dead);
    if (boss) {
      const barWidth = 120;
      const barX = Math.floor((VIEW_WIDTH - barWidth) / 2);
      const barY = ARENA.y + ARENA.height - 7;
      const name = boss.level > 1 ? 'KING SLIME LV ' + boss.level : 'KING SLIME';
      drawText(ctx, name, VIEW_WIDTH / 2, barY - 7, PALETTE.red, { align: 'center', shadow: PALETTE.void });
      drawPixelBar(ctx, barX, barY, barWidth, 3, boss.health / boss.maxHealth, PALETTE.red);
    }

    // Banner messages ("SWARM INCOMING!", "NEW ENEMY: ...").
    const banner = this.spawner.banner;
    if (banner.time > 0 && Math.floor(banner.time * 8) % 2 === 0) {
      drawText(ctx, banner.text, VIEW_WIDTH / 2, ARENA.y + 6, banner.color, { align: 'center', shadow: PALETTE.void });
    }
  },

  drawDebug(ctx) {
    const p = this.player;
    const lines = [
      'FPS ' + this.fps,
      'SCALE ' + currentScale + 'X',
      'X ' + p.x.toFixed(1) + ' Y ' + p.y.toFixed(1),
      'SPEED ' + Math.round(Math.hypot(p.vx, p.vy)),
      'ENEMIES ' + this.enemies.length + ' SHOTS ' + this.projectiles.length + ' ENEMY SHOTS ' + this.enemyShots.length,
      'ORBS ' + this.orbs.length + ' PARTICLES ' + Effects.particles.length + ' GAS ' + this.gasClouds.length,
      'XP ' + this.xp + '/' + this.xpToNext + ' NEXT SURGE ' + Math.ceil(this.spawner.surgeTimer) + 'S',
      'HEARTS LOST ' + this.heartsLost + ' CHASER HEART DROP ' + Math.round(this.getHeartDropChance('chaser') * 1000) / 10 + '%',
      ...this.weapons.map((w) => w.id.toUpperCase() + ' FIRE ' + w.stats.fireInterval.toFixed(2) + 'S DMG ' + w.stats.damage * w.stats.damageMultiplier * w.stats.gunDamage + ' X' + w.stats.projectileCount + ' RANGE ' + Math.round(w.stats.range)),
      'SPAWN EVERY ' + this.spawner.getInterval(this.survivalTime).toFixed(2) + 'S',
    ];
    lines.forEach((line, i) => {
      drawText(ctx, line, ARENA.x + 3, ARENA.y + 3 + i * 7, PALETTE.yellow, { shadow: PALETTE.black });
    });
  },

  // ---------------------------------------------------------------
  // Mouse
  // ---------------------------------------------------------------
  // The screen that currently owns the buttons, if any.
  getActiveScreen() {
    if (Transition.active) return null;
    if (this.state === 'title') return TitleScreen;
    if (this.state === 'select') return CharacterSelect;
    if (this.state === 'paused') return PauseMenu;
    if (this.state === 'gameover' && GameOverScreen.isReady(this)) return GameOverScreen;
    return null;
  },

  // The canvas is scaled up on screen, so convert the mouse position
  // from screen pixels back into the game's 320x180 pixels.
  onMouseMove(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH;
    this.mouseY = ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT;
    let pointer = false;

    const screen = this.getActiveScreen();
    if (screen) {
      for (const button of screen.getButtons(this)) {
        if (!pointInBox(this.mouseX, this.mouseY, button.box)) continue;
        pointer = true;
        // Hovering moves the keyboard highlight too.
        if (button.index !== undefined && screen.selected !== button.index) {
          screen.selected = button.index;
          Sound.play('uiMove');
        }
      }
    }
    if (this.state === 'playing' && !Transition.active) {
      pointer = this.getHudButtons().some((button) => pointInBox(this.mouseX, this.mouseY, button.box));
    }
    // Hovering a level-up card selects it.
    if (this.state === 'levelup' && LevelUpScreen.isReady()) {
      const card = LevelUpScreen.cardAt(this.mouseX, this.mouseY);
      if (card !== -1) {
        if (LevelUpScreen.selected !== card) Sound.play('uiMove');
        LevelUpScreen.selected = card;
        pointer = true;
      }
    }
    this.canvas.style.cursor = pointer ? 'pointer' : 'default';
  },

  onClick(event) {
    this.onMouseMove(event);

    if (this.state === 'levelup' && LevelUpScreen.isReady()) {
      const card = LevelUpScreen.cardAt(this.mouseX, this.mouseY);
      if (card !== -1) LevelUpScreen.confirm(card);
      return;
    }
    if (this.state === 'playing' && !Transition.active) {
      for (const button of this.getHudButtons()) {
        if (!pointInBox(this.mouseX, this.mouseY, button.box)) continue;
        if (button.id === 'sound') Sound.toggleMute();
        if (button.id === 'pause') this.pause();
      }
      return;
    }
    const screen = this.getActiveScreen();
    if (!screen) return;
    for (const button of screen.getButtons(this)) {
      if (pointInBox(this.mouseX, this.mouseY, button.box)) {
        screen.activate(button.id, this);
        this.canvas.style.cursor = 'default';
        return;
      }
    }
  },

  trackFps(dt) {
    this.fpsFrames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }
  },
};

// Energy needed to go from `level` to the next level: 5, 9, 13, 17...
function xpNeededForLevel(level) {
  return PROGRESSION_CONFIG.xpBase + (level - 1) * PROGRESSION_CONFIG.xpPerLevel;
}
