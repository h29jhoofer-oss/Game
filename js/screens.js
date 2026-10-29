// =====================================================================
// screens.js — the menus around the gameplay:
//   TitleScreen    — logo, character lineup, PLAY, personal best
//   CharacterSelect — choose your hero before a run
//   PauseMenu      — resume / restart / sound / quit
//   GameOverScreen — results, personal best, restart
//
// Each screen has the same shape, so game.js can treat them alike:
//   update(dt, game)       keyboard input
//   draw(ctx, game)        drawing
//   getButtons(game)       clickable areas: [{ id, box, index? }]
//   activate(id, game)     what a button does
// `index` links a button to the keyboard selection, so hovering with
// the mouse and pressing arrow keys move the same highlight.
// =====================================================================

// ---------------------------------------------------------------------
// Title screen
// ---------------------------------------------------------------------
const LOGO = { width: 168, height: 58, y: 10 };

const TitleScreen = {
  time: 0,
  logo: null, // the logo is drawn once into its own canvas
  shineCanvas: null,

  open() {
    this.time = 0;
  },

  getButtons() {
    return [
      { id: 'play', box: { x: VIEW_WIDTH / 2 - 34, y: 124, width: 68, height: 16 } },
      { id: 'sound', box: { x: VIEW_WIDTH - 21, y: 4, width: 13, height: 11 } },
    ];
  },

  activate(id, game) {
    if (id === 'play') {
      Sound.play('uiSelect');
      game.openCharacterSelect();
    }
    if (id === 'sound') Sound.toggleMute();
  },

  update(dt, game) {
    this.time += dt;
    if (this.time > 0.4 && (Input.wasPressed('Enter') || Input.wasPressed('Space'))) this.activate('play', game);
  },

  draw(ctx, game) {
    Arena.draw(ctx, game.animTime);
    ctx.drawImage(getDitherOverlay(), 0, 0);
    if (!this.logo) this.bakeLogo();

    // The logo drops in from above, 4 pixels at a time.
    const drop = Math.round(((1 - clamp(this.time / 0.5, 0, 1)) * 80) / 4) * 4;
    const logoX = Math.floor((VIEW_WIDTH - LOGO.width) / 2);
    ctx.drawImage(this.getShinyLogo(), logoX, LOGO.y - drop);

    this.drawLineup(ctx, game);

    const [play, sound] = this.getButtons();
    drawButton(ctx, play.box, 'PLAY', { primary: true, active: pointInBox(game.mouseX, game.mouseY, play.box) || Math.floor(this.time * 2) % 2 === 0 });
    drawIconButton(ctx, sound.box, Sound.muted ? 'soundOff' : 'soundOn', pointInBox(game.mouseX, game.mouseY, sound.box));

    const cx = VIEW_WIDTH / 2;
    drawText(ctx, 'PRESS ENTER', cx, 144, PALETTE.blue, { align: 'center' });

    const best = game.best;
    const bestText = best.score > 0
      ? 'BEST ' + String(best.score).padStart(7, '0') + '   ' + formatTime(best.time)
      : 'NO BEST SCORE YET';
    drawText(ctx, bestText, cx, 155, PALETTE.yellow, { align: 'center', shadow: PALETTE.void });

    drawText(ctx, 'WASD/ARROWS MOVE  SPACE DASH  ESC PAUSE  M MUTE', cx, 169, PALETTE.cyanDim, { align: 'center' });
  },

  // Four characters standing in a row, drawn at exactly 2x size.
  drawLineup(ctx, game) {
    const t = this.time;
    const hero = getCharacter(game.characterId); // your last-picked hero leads the lineup
    const baseline = 110; // where their feet touch the floor
    const members = [
      { sprite: Sprites.players[hero.id][WALK_CYCLE[Math.floor(t / 0.12) % 4]], label: 'YOU', color: hero.uiColor, facing: 'right' },
      { sprite: Sprites.chaser[Math.floor(t / 0.2) % 2 === 0 ? 'hopA' : 'hopB'], label: 'CHASER', color: PALETTE.red, facing: 'left' },
      { sprite: Sprites.toxic[Math.floor(t / 0.2 + 1) % 2 === 0 ? 'hopA' : 'hopB'], label: 'TOXIC', color: PALETTE.green, facing: 'left' },
      { sprite: Sprites.sprinter[Math.floor(t / 0.08) % 2 === 0 ? 'runA' : 'runB'], label: 'SPRINTER', color: PALETTE.yellow, facing: 'left' },
      { sprite: Sprites.shooter[Math.floor(t / 0.25) % 2 === 0 ? 'floatA' : 'floatB'], label: 'SHOOTER', color: PALETTE.purple, facing: 'left' },
      { sprite: Sprites.brute[Math.floor(t / 0.35) % 2 === 0 ? 'stepA' : 'stepB'], label: 'BRUTE', color: PALETTE.orange, facing: 'left' },
    ];
    const spacing = 44;
    const startX = VIEW_WIDTH / 2 - (spacing * (members.length - 1)) / 2;
    members.forEach((member, i) => {
      const image = member.sprite[member.facing];
      const w = image.width * 2;
      const h = image.height * 2;
      const x = Math.round(startX + i * spacing - w / 2);
      const y = baseline - h;
      ctx.fillStyle = PALETTE.void;
      ctx.fillRect(x + 2, baseline, w - 4, 2); // shadow
      ctx.drawImage(image, x, y, w, h);
      drawText(ctx, member.label, startX + i * spacing, baseline + 5, member.color, { align: 'center' });
    });
  },

  // Build the logo once: big letters with a dark outline, a colored drop
  // shadow, and faces made of three hard color bands (no gradients).
  bakeLogo() {
    const { canvas, ctx } = createOffscreenCanvas(LOGO.width, LOGO.height);
    const cx = LOGO.width / 2;
    bakeLogoWord(ctx, 'NEON', cx, 2, 4, [PALETTE.white, PALETTE.cyan, PALETTE.blue], PALETTE.purple);
    bakeLogoWord(ctx, 'SURVIVOR', cx, 38, 2, [PALETTE.white, PALETTE.pink, PALETTE.purple], PALETTE.darkBlue);
    this.logo = canvas;
    this.shineCanvas = createOffscreenCanvas(LOGO.width, LOGO.height);
  },

  // Every few seconds a white diagonal "shine" sweeps across the logo.
  getShinyLogo() {
    const cycle = this.time % 3.5;
    if (cycle > 0.6) return this.logo;
    const { canvas, ctx } = this.shineCanvas;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, LOGO.width, LOGO.height);
    ctx.drawImage(this.logo, 0, 0);
    // 'source-atop' only paints where the logo already has pixels.
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = PALETTE.white;
    const shineX = Math.round((cycle / 0.6) * (LOGO.width + LOGO.height)) - LOGO.height;
    for (let y = 0; y < LOGO.height; y++) {
      ctx.fillRect(shineX + Math.floor(y / 2), y, 4, 1);
    }
    ctx.globalCompositeOperation = 'source-over';
    return canvas;
  },
};

// The logo uses its own bigger 5x7 letters, so it reads clearly.
const LOGO_GLYPHS = {
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  V: ['#...#', '#...#', '#...#', '#...#', '.#.#.', '.#.#.', '..#..'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
};

function measureLogoText(text, scale) {
  return (text.length * 6 - 1) * scale; // 5 pixels per letter + 1 gap
}

function drawLogoText(ctx, text, x, y, scale, color) {
  ctx.fillStyle = color;
  for (let i = 0; i < text.length; i++) {
    const rows = LOGO_GLYPHS[text[i]];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (rows[row][col] === '#') ctx.fillRect(x + (i * 6 + col) * scale, y + row * scale, scale, scale);
      }
    }
  }
}

function bakeLogoWord(ctx, text, centerX, y, scale, bands, shadowColor) {
  const width = measureLogoText(text, scale);
  const x = Math.round(centerX - width / 2);
  const height = 7 * scale;

  // 1. Drop shadow, then a 1-pixel dark outline all around.
  drawLogoText(ctx, text, x + 2, y + 2, scale, shadowColor);
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    drawLogoText(ctx, text, x + ox, y + oy, scale, PALETTE.void);
  }

  // 2. The letter faces on a separate canvas, recolored in 3 bands.
  const face = createOffscreenCanvas(ctx.canvas.width, ctx.canvas.height);
  drawLogoText(face.ctx, text, x, y, scale, bands[1]);
  face.ctx.globalCompositeOperation = 'source-atop';
  face.ctx.fillStyle = bands[0];
  face.ctx.fillRect(0, y, ctx.canvas.width, scale); // bright top band
  face.ctx.fillStyle = bands[2];
  face.ctx.fillRect(0, y + height - scale, ctx.canvas.width, scale); // dark bottom band
  ctx.drawImage(face.canvas, 0, 0);
}

// ---------------------------------------------------------------------
// Pick screen: "Choose your hero"
//
// Cards in a row, arrows / 1-3 / mouse, ESC to go back. It's built by a
// function so another pick screen could reuse it: each screen only
// supplies its title, its list of items, and how to draw a card.
// ---------------------------------------------------------------------
const PICK_CARD = { width: 92, height: 112, gap: 8, y: 34 };

function makePickScreen({ title, getItems, getCurrentId, drawCardBody, onPick, onBack }) {
  return {
    selected: 0,
    time: 0,

    open(game) {
      this.time = 0;
      // Start on whatever you picked last time.
      this.selected = Math.max(0, getItems().findIndex((item) => item.id === getCurrentId(game)));
    },

    getCardBox(index) {
      const count = getItems().length;
      const totalWidth = count * PICK_CARD.width + (count - 1) * PICK_CARD.gap;
      const startX = Math.floor((VIEW_WIDTH - totalWidth) / 2);
      return { x: startX + index * (PICK_CARD.width + PICK_CARD.gap), y: PICK_CARD.y, width: PICK_CARD.width, height: PICK_CARD.height };
    },

    getButtons() {
      const buttons = getItems().map((item, index) => ({ id: 'pick', index, box: this.getCardBox(index) }));
      buttons.push({ id: 'back', box: { x: ARENA.x + 4, y: 157, width: 36, height: 13 } });
      return buttons;
    },

    activate(id, game) {
      Sound.play('uiSelect');
      if (id === 'pick') onPick(game, getItems()[this.selected]);
      if (id === 'back') onBack(game);
    },

    update(dt, game) {
      this.time += dt;
      if (this.time < 0.25) return; // ignore the key press that opened this screen
      const count = getItems().length;
      if (Input.wasPressed('ArrowLeft') || Input.wasPressed('KeyA')) {
        this.selected = (this.selected + count - 1) % count;
        Sound.play('uiMove');
      }
      if (Input.wasPressed('ArrowRight') || Input.wasPressed('KeyD')) {
        this.selected = (this.selected + 1) % count;
        Sound.play('uiMove');
      }
      ['Digit1', 'Digit2', 'Digit3'].forEach((key, index) => {
        if (index < count && Input.wasPressed(key)) {
          this.selected = index;
          this.activate('pick', game);
        }
      });
      if (Input.wasPressed('Enter') || Input.wasPressed('Space')) this.activate('pick', game);
      if (Input.wasPressed('Escape')) this.activate('back', game);
    },

    draw(ctx, game) {
      Arena.draw(ctx, game.animTime);
      ctx.drawImage(getDitherOverlay(), 0, 0);
      const cx = VIEW_WIDTH / 2;
      drawText(ctx, title, cx, 12, PALETTE.cyan, { align: 'center', scale: 2, shadow: PALETTE.darkBlue });

      getItems().forEach((item, index) => this.drawCard(ctx, item, index));

      const back = this.getButtons().find((button) => button.id === 'back');
      drawButton(ctx, back.box, 'BACK', { active: pointInBox(game.mouseX, game.mouseY, back.box) });
      drawText(ctx, '1 2 3 OR ARROWS + ENTER', cx + 20, 161, PALETTE.blue, { align: 'center' });
    },

    drawCard(ctx, item, index) {
      const box = this.getCardBox(index);
      const isSelected = index === this.selected;
      const x = box.x;
      const y = box.y - (isSelected ? 3 : 0); // the selected card lifts up
      const w = box.width;
      const ccx = x + Math.floor(w / 2);

      drawCardFrame(ctx, x, y, w, box.height, isSelected ? PALETTE.yellow : PALETTE.wallDark, isSelected ? PALETTE.navy : PALETTE.void);
      drawText(ctx, String(index + 1), x + 4, y + 4, isSelected ? PALETTE.yellow : PALETTE.blue);
      drawText(ctx, item.name, ccx, y + 45, item.uiColor, { align: 'center', shadow: PALETTE.black });
      drawText(ctx, item.tagline, ccx, y + 53, PALETTE.cyanDim, { align: 'center' });
      drawCardBody(ctx, item, x, y, w, isSelected, this.time);

      // Blinking arrow above the selected card.
      if (isSelected && Math.floor(this.time * 4) % 2 === 0) {
        ctx.fillStyle = PALETTE.yellow;
        ctx.fillRect(ccx - 2, y - 6, 5, 1);
        ctx.fillRect(ccx - 1, y - 5, 3, 1);
        ctx.fillRect(ccx, y - 4, 1, 1);
      }
    },
  };
}

// One "LABEL ... X1.5" row on a card. Green = better than normal, red = worse.
function drawStatRow(ctx, x, y, w, label, valueText, quality) {
  const color = quality > 0 ? PALETTE.green : quality < 0 ? PALETTE.red : PALETTE.white;
  drawText(ctx, label, x + 6, y, PALETTE.blue);
  drawText(ctx, valueText, x + w - 6, y, color, { align: 'right' });
}

const CharacterSelect = makePickScreen({
  title: 'CHOOSE YOUR HERO',
  getItems: () => CHARACTERS,
  getCurrentId: (game) => game.characterId,
  onPick: (game, character) => game.chooseCharacter(character.id),
  onBack: (game) => game.backToTitle(),

  drawCardBody(ctx, character, x, y, w, isSelected, time) {
    const ccx = x + Math.floor(w / 2);
    // The hero at exactly 3x size: walking if selected, idle otherwise.
    const frames = Sprites.players[character.id];
    const frameName = isSelected
      ? WALK_CYCLE[Math.floor(time / 0.12) % 4]
      : Math.floor(time / 0.5) % 2 === 0 ? 'idle' : 'idleBreath';
    const image = frames[frameName].right;
    const spriteX = ccx - Math.floor((image.width * 3) / 2);
    ctx.fillStyle = PALETTE.black;
    ctx.fillRect(spriteX + 3, y + 39, image.width * 3 - 6, 2); // shadow
    ctx.drawImage(image, spriteX, y + 9, image.width * 3, image.height * 3);

    const stats = [['SPEED', character.speed], ['DAMAGE', character.damage], ['RANGE', character.range]];
    stats.forEach(([label, value], i) => drawStatRow(ctx, x, y + 65 + i * 8, w, label, 'X' + value, value - 1));

    // Hearts: one icon per possible heart, filled for the ones you start with.
    const rowY = y + 92;
    drawText(ctx, 'HEARTS', x + 6, rowY + 1, PALETTE.blue);
    for (let i = 0; i < character.maxHealth; i++) {
      const heart = i < character.startHealth ? Sprites.heart.full : Sprites.heart.empty;
      ctx.drawImage(heart, x + w - 6 - character.maxHealth * 8 + i * 8 + 1, rowY);
    }

    // The hero's special perk, if any.
    if (character.perk) drawText(ctx, character.perk, ccx, y + 102, PALETTE.green, { align: 'center' });
  },
});

// ---------------------------------------------------------------------
// Pause menu
// ---------------------------------------------------------------------
const PAUSE_PANEL = { width: 132, height: 106 };

const PauseMenu = {
  selected: 0,

  open() {
    this.selected = 0;
  },

  getItems() {
    return [
      { id: 'resume', label: 'RESUME' },
      { id: 'restart', label: 'RESTART' },
      { id: 'sound', label: Sound.muted ? 'SOUND: OFF' : 'SOUND: ON' },
      { id: 'quit', label: 'QUIT TO TITLE' },
    ];
  },

  getPanelBox() {
    return {
      x: Math.floor((VIEW_WIDTH - PAUSE_PANEL.width) / 2),
      y: Math.floor((VIEW_HEIGHT - PAUSE_PANEL.height) / 2),
      width: PAUSE_PANEL.width,
      height: PAUSE_PANEL.height,
    };
  },

  getButtons() {
    const panel = this.getPanelBox();
    return this.getItems().map((item, index) => ({
      id: item.id,
      index,
      box: { x: panel.x + 18, y: panel.y + 36 + index * 16, width: panel.width - 36, height: 13 },
    }));
  },

  activate(id, game) {
    Sound.play('uiSelect');
    if (id === 'resume') game.setState('playing');
    if (id === 'restart') game.restartRun();
    if (id === 'sound') Sound.toggleMute();
    if (id === 'quit') game.quitToTitle();
  },

  update(dt, game) {
    const count = this.getItems().length;
    if (Input.wasPressed('Escape')) {
      game.setState('playing');
      return;
    }
    if (Input.wasPressed('ArrowUp') || Input.wasPressed('KeyW')) {
      this.selected = (this.selected + count - 1) % count;
      Sound.play('uiMove');
    }
    if (Input.wasPressed('ArrowDown') || Input.wasPressed('KeyS')) {
      this.selected = (this.selected + 1) % count;
      Sound.play('uiMove');
    }
    if (Input.wasPressed('Enter') || Input.wasPressed('Space')) this.activate(this.getItems()[this.selected].id, game);
  },

  draw(ctx, game) {
    ctx.drawImage(getDitherOverlay(), 0, 0);
    const panel = this.getPanelBox();
    drawPixelPanel(ctx, panel.x, panel.y, panel.width, panel.height);
    const cx = VIEW_WIDTH / 2;
    drawText(ctx, 'PAUSED', cx, panel.y + 8, PALETTE.cyan, { align: 'center', scale: 2, shadow: PALETTE.darkBlue });
    const stats = 'SCORE ' + Math.floor(game.score) + '   TIME ' + formatTime(game.survivalTime);
    drawText(ctx, stats, cx, panel.y + 24, PALETTE.blue, { align: 'center' });

    const items = this.getItems();
    for (const button of this.getButtons()) {
      drawButton(ctx, button.box, items[button.index].label, { active: button.index === this.selected });
    }
  },
};

// ---------------------------------------------------------------------
// Game over / results screen
// ---------------------------------------------------------------------
const GAMEOVER_PANEL = { width: 184, height: 122 };
const GAMEOVER_INPUT_DELAY = 0.5; // seconds before restart input is accepted

const GameOverScreen = {
  selected: 0, // 0 = RESTART, 1 = MENU

  open() {
    this.selected = 0;
  },

  getPanelBox() {
    return {
      x: Math.floor((VIEW_WIDTH - GAMEOVER_PANEL.width) / 2),
      y: Math.floor((VIEW_HEIGHT - GAMEOVER_PANEL.height) / 2),
      width: GAMEOVER_PANEL.width,
      height: GAMEOVER_PANEL.height,
    };
  },

  getButtons() {
    const panel = this.getPanelBox();
    const y = panel.y + 88;
    return [
      { id: 'restart', index: 0, box: { x: VIEW_WIDTH / 2 - 62, y, width: 76, height: 15 } },
      { id: 'menu', index: 1, box: { x: VIEW_WIDTH / 2 + 20, y, width: 42, height: 15 } },
    ];
  },

  isReady(game) {
    return game.stateTime >= GAMEOVER_INPUT_DELAY;
  },

  activate(id, game) {
    if (!this.isReady(game)) return;
    Sound.play('uiSelect');
    if (id === 'restart') game.restartRun();
    if (id === 'menu') game.quitToTitle();
  },

  update(dt, game) {
    // Ignore input for a moment so a key held during the final hit
    // doesn't instantly skip the results.
    if (!this.isReady(game)) return;
    if (Input.wasPressed('ArrowLeft') || Input.wasPressed('KeyA') || Input.wasPressed('ArrowRight') || Input.wasPressed('KeyD')) {
      this.selected = 1 - this.selected;
      Sound.play('uiMove');
    }
    if (Input.wasPressed('KeyR')) this.activate('restart', game);
    else if (Input.wasPressed('Escape')) this.activate('menu', game);
    else if (Input.wasPressed('Enter') || Input.wasPressed('Space')) this.activate(this.selected === 0 ? 'restart' : 'menu', game);
  },

  draw(ctx, game) {
    ctx.drawImage(getDitherOverlay(), 0, 0);

    // Pixel transition: the panel grows open in 8-pixel steps.
    const panel = this.getPanelBox();
    const reveal = Math.min(1, game.stateTime / 0.3);
    const shownH = Math.max(8, Math.floor((panel.height * reveal) / 8) * 8);
    drawPixelPanel(ctx, panel.x, panel.y + Math.floor((panel.height - shownH) / 2), panel.width, shownH);
    if (reveal < 1) return;

    const cx = VIEW_WIDTH / 2;
    // The title flickers between red and pink like an old arcade sign.
    const titleColor = Math.floor(game.animTime * 4) % 2 === 0 ? PALETTE.red : PALETTE.pink;
    drawText(ctx, 'GAME OVER', cx, panel.y + 8, titleColor, { align: 'center', scale: 2, shadow: PALETTE.void });

    if (game.isNewBest) {
      // A flashing badge for a new record.
      const flash = Math.floor(game.animTime * 6) % 2 === 0;
      const badge = { x: cx - 30, y: panel.y + 23, width: 60, height: 9 };
      ctx.fillStyle = flash ? PALETTE.yellow : PALETTE.orange;
      ctx.fillRect(badge.x, badge.y, badge.width, badge.height);
      drawText(ctx, 'NEW BEST!', cx, badge.y + 2, PALETTE.void, { align: 'center' });
    } else {
      drawText(ctx, 'BEST ' + game.best.score, cx, panel.y + 25, PALETTE.yellow, { align: 'center' });
    }

    // Results: label on the left of the center line, value on the right.
    const results = [
      ['SCORE', String(Math.floor(game.score))],
      ['SURVIVED', formatTime(game.survivalTime)],
      ['DEFEATED', String(game.kills)],
      ['LEVEL', String(game.level)],
    ];
    results.forEach(([label, value], i) => {
      const rowY = panel.y + 37 + i * 8;
      drawText(ctx, label, cx - 4, rowY, PALETTE.cyanDim, { align: 'right' });
      drawText(ctx, value, cx + 4, rowY, i === 0 ? PALETTE.yellow : PALETTE.white);
    });
    drawText(ctx, getGameOverMessage(game.survivalTime, game.isNewBest), cx, panel.y + 74, PALETTE.pink, { align: 'center' });

    const [restart, menu] = this.getButtons();
    drawButton(ctx, restart.box, 'RESTART', { primary: true, active: this.selected === 0 });
    drawButton(ctx, menu.box, 'MENU', { active: this.selected === 1 });
    drawText(ctx, 'ENTER/R RESTART   ESC MENU', cx, panel.y + 108, PALETTE.blue, { align: 'center' });
  },
};

// A short fun message depending on how the run went.
function getGameOverMessage(seconds, isNewBest) {
  if (isNewBest && seconds >= 30) return 'A NEW RECORD! THE ARENA BOWS.';
  if (seconds < 15) return 'TIP: DASH THROUGH ENEMIES!';
  if (seconds < 40) return 'NOT BAD, NEON RUNNER.';
  if (seconds < 80) return 'SLICK MOVES!';
  if (seconds < 150) return 'THE SLIMES FEAR YOU.';
  return 'LEGENDARY SURVIVOR!';
}
