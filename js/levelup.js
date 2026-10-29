// =====================================================================
// levelup.js — the "LEVEL UP!" screen with three upgrade cards.
//
// While this screen is open the game state is 'levelup' and the world
// is completely frozen. The player picks a card with:
//   - keys 1 / 2 / 3, or
//   - LEFT / RIGHT (or A / D) then ENTER or SPACE, or
//   - the mouse (hover + click).
// =====================================================================

const CARD = { width: 84, height: 96, gap: 8, y: 46 };
const CONFIRM_TIME = 0.3; // seconds the chosen card flashes before closing

const LevelUpScreen = {
  choices: [],
  selected: 0,
  confirmed: -1, // index of the chosen card, or -1 while still choosing
  time: 0, // seconds since this screen opened
  confirmTime: 0,

  open(game) {
    this.choices = Upgrades.pickChoices(game, 3);
    this.selected = 0;
    this.confirmed = -1;
    this.time = 0;
    this.confirmTime = 0;
  },

  // Ignore input briefly, so someone mashing SPACE to dash doesn't
  // accidentally pick a card they never saw.
  isReady() {
    return this.time >= PROGRESSION_CONFIG.levelUpInputDelay && this.confirmed === -1;
  },

  update(dt, game) {
    this.time += dt;

    if (this.confirmed !== -1) {
      this.confirmTime += dt;
      if (this.confirmTime >= CONFIRM_TIME) game.finishLevelUp(this.choices[this.confirmed]);
      return;
    }
    if (!this.isReady()) return;

    const count = this.choices.length;
    const numberKeys = ['Digit1', 'Digit2', 'Digit3'];
    for (let i = 0; i < count; i++) {
      if (Input.wasPressed(numberKeys[i])) {
        this.confirm(i);
        return;
      }
    }
    if (Input.wasPressed('ArrowLeft') || Input.wasPressed('KeyA')) {
      this.selected = (this.selected + count - 1) % count;
      Sound.play('uiMove');
    }
    if (Input.wasPressed('ArrowRight') || Input.wasPressed('KeyD')) {
      this.selected = (this.selected + 1) % count;
      Sound.play('uiMove');
    }
    if (Input.wasPressed('Enter') || Input.wasPressed('Space')) this.confirm(this.selected);
  },

  confirm(index) {
    Sound.play('uiSelect');
    this.selected = index;
    this.confirmed = index;
    this.confirmTime = 0;
  },

  // Where card number `index` sits on screen (before any animation).
  getCardRect(index) {
    const count = this.choices.length;
    const totalWidth = count * CARD.width + (count - 1) * CARD.gap;
    const startX = Math.floor((VIEW_WIDTH - totalWidth) / 2);
    return { x: startX + index * (CARD.width + CARD.gap), y: CARD.y, width: CARD.width, height: CARD.height };
  },

  // Which card is under a point (for the mouse), or -1.
  cardAt(x, y) {
    for (let i = 0; i < this.choices.length; i++) {
      const r = this.getCardRect(i);
      if (x >= r.x && x < r.x + r.width && y >= r.y && y < r.y + r.height) return i;
    }
    return -1;
  },

  draw(ctx, game) {
    ctx.drawImage(getDitherOverlay(), 0, 0);

    const cx = VIEW_WIDTH / 2;
    const titleColor = Math.floor(this.time * 6) % 2 === 0 ? PALETTE.yellow : PALETTE.white;
    drawText(ctx, 'LEVEL UP!', cx, 18, titleColor, { align: 'center', scale: 2, shadow: PALETTE.orange });
    drawText(ctx, 'LEVEL ' + game.level + ' - CHOOSE AN UPGRADE', cx, 35, PALETTE.cyan, { align: 'center' });

    for (let i = 0; i < this.choices.length; i++) this.drawCard(ctx, game, i);

    if (this.isReady()) {
      const hint = Touch.active ? 'TAP A CARD' : 'PRESS 1 2 3  OR  ARROWS + ENTER  OR  CLICK';
      drawText(ctx, hint, cx, 161, PALETTE.blue, { align: 'center' });
    }
  },

  drawCard(ctx, game, index) {
    const upgrade = this.choices[index];
    const rect = this.getCardRect(index);
    const isSelected = index === this.selected;
    const isConfirmed = index === this.confirmed;

    // Slide-in animation: each card rises into place in 4-pixel steps,
    // one shortly after another.
    const progress = clamp((this.time - index * 0.07) / 0.22, 0, 1);
    const slide = Math.round(((1 - progress) * 60) / 4) * 4;
    if (progress === 0) return;

    const x = rect.x;
    const y = rect.y + slide - (isSelected ? 3 : 0); // the selected card lifts up
    const w = rect.width;
    const h = rect.height;
    const ccx = x + Math.floor(w / 2);

    // The chosen card flashes white; the others go dark.
    if (this.confirmed !== -1 && !isConfirmed) {
      drawCardFrame(ctx, x, y, w, h, PALETTE.wallDark, PALETTE.void);
      drawText(ctx, upgrade.name, ccx, y + 27, PALETTE.wallDark, { align: 'center' });
      return;
    }
    if (isConfirmed && Math.floor(this.confirmTime / 0.06) % 2 === 0) {
      ctx.fillStyle = PALETTE.white;
      ctx.fillRect(x, y, w, h);
      return;
    }

    drawCardFrame(ctx, x, y, w, h, isSelected ? PALETTE.yellow : PALETTE.cyanDim, isSelected ? PALETTE.navy : PALETTE.void);

    // Little arrow above the selected card.
    if (isSelected && Math.floor(this.time * 4) % 2 === 0) {
      ctx.fillStyle = PALETTE.yellow;
      ctx.fillRect(ccx - 2, y - 6, 5, 1);
      ctx.fillRect(ccx - 1, y - 5, 3, 1);
      ctx.fillRect(ccx, y - 4, 1, 1);
    }

    // Number key hint in the corner.
    drawText(ctx, String(index + 1), x + 4, y + 4, isSelected ? PALETTE.yellow : PALETTE.blue);

    // Icon, drawn at exactly 2x so it stays crisp.
    ctx.drawImage(upgrade.iconImage, ccx - 7, y + 8, 14, 14);

    drawText(ctx, upgrade.name, ccx, y + 27, isSelected ? PALETTE.yellow : PALETTE.white, { align: 'center' });

    const taken = game.upgradeLevels[upgrade.id] || 0;
    const levelText = taken === 0 ? 'NEW!' : 'LV ' + taken + ' > ' + (taken + 1);
    drawText(ctx, levelText, ccx, y + 36, taken === 0 ? PALETTE.pink : PALETTE.cyan, { align: 'center' });

    upgrade.lines.forEach((line, i) => {
      drawText(ctx, line, ccx, y + 50 + i * 8, PALETTE.white, { align: 'center' });
    });

    // Level pips: filled = already taken, blinking = the one you'd get.
    if (Number.isFinite(upgrade.maxLevel)) {
      const pipsWidth = upgrade.maxLevel * 5 - 2;
      const pipX = ccx - Math.floor(pipsWidth / 2);
      for (let i = 0; i < upgrade.maxLevel; i++) {
        let color = PALETTE.wallDark;
        if (i < taken) color = PALETTE.cyan;
        else if (i === taken && Math.floor(this.time * 4) % 2 === 0) color = PALETTE.yellow;
        ctx.fillStyle = color;
        ctx.fillRect(pipX + i * 5, y + h - 9, 3, 3);
      }
    }
  },
};

// A card: outline, fill, and a darker inner line for a bevelled look.
function drawCardFrame(ctx, x, y, w, h, borderColor, fillColor) {
  ctx.fillStyle = PALETTE.black;
  ctx.fillRect(x + 1, y + h, w, 1); // drop shadow
  ctx.fillRect(x + w, y + 1, 1, h);
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = borderColor;
  ctx.fillRect(x + 1, y, w - 2, 1);
  ctx.fillRect(x + 1, y + h - 1, w - 2, 1);
  ctx.fillRect(x, y + 1, 1, h - 2);
  ctx.fillRect(x + w - 1, y + 1, 1, h - 2);
  ctx.fillStyle = PALETTE.wallDark;
  ctx.fillRect(x + 2, y + 2, w - 4, 1);
}
