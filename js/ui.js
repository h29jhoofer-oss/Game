// =============================================================
// ui.js — The HTML menus on top of the canvas (start, pause,
// game over), the corner buttons, and screen resizing.
// =============================================================

OMJ.UI = class {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.stage = root.querySelector('.omj-stage');

    this.screens = {};
    root.querySelectorAll('[data-screen]').forEach((el) => {
      this.screens[el.dataset.screen] = el;
    });

    this.fields = {};
    root.querySelectorAll('[data-field]').forEach((el) => {
      this.fields[el.dataset.field] = el;
    });
    this.skinPreview = root.querySelector('[data-skin-preview]');
    this.pauseButton = root.querySelector('[data-action="pause"]');
    this.muteButton = root.querySelector('[data-action="mute"]');

    // Draw the pixel-font titles.
    root.querySelectorAll('canvas[data-title]').forEach((canvas) => {
      this.renderTitle(canvas, canvas.dataset.title);
    });

    // One click listener handles every button with a data-action.
    root.addEventListener('click', (e) => {
      const button = e.target.closest('[data-action]');
      if (!button || !root.contains(button)) return;
      game.sound.unlock();
      game.onAction(button.dataset.action);
      // Give focus back to the game so the keyboard keeps working.
      root.focus({ preventScroll: true });
    });

    // Keep the game sharp and correctly shaped whenever its size changes.
    this.resize = this.resize.bind(this);
    if (window.ResizeObserver) new ResizeObserver(this.resize).observe(root);
    window.addEventListener('resize', this.resize);
    this.resize();
  }

  renderTitle(canvas, text) {
    const big = canvas.classList.contains('omj-title--big');
    const size = OMJ.PixelFont.renderTitle(canvas, text, big ? '#ffd23f' : '#fffdf4', '#1d1a2f', '#e8384f');
    const scale = big ? 4 : 3;
    canvas.style.width = 'calc(var(--px) * ' + size.width * scale + ')';
    canvas.style.height = 'calc(var(--px) * ' + size.height * scale + ')';
  }

  // Scale the stage to fit its container while keeping 16:9.
  // Whole-number scales keep every pixel the same size (crisper).
  resize() {
    const C = OMJ.CONFIG;
    const rect = this.root.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    let scale = Math.min(rect.width / C.VIEW_W, rect.height / C.VIEW_H);
    if (scale * dpr >= 2) scale = Math.floor(scale * dpr) / dpr;
    this.stage.style.width = C.VIEW_W * scale + 'px';
    this.stage.style.height = C.VIEW_H * scale + 'px';
    this.stage.style.setProperty('--px', scale + 'px');
  }

  // Show one screen by name ('start', 'pause', 'over') or null for none.
  show(name) {
    for (const key in this.screens) {
      this.screens[key].classList.toggle('is-visible', key === name);
    }
  }

  setPlaying(isPlaying) {
    this.pauseButton.classList.toggle('is-hidden', !isPlaying);
  }

  setMuted(muted) {
    this.muteButton.classList.toggle('is-muted', muted);
    this.muteButton.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
  }

  setBest(best) {
    this.fields.best.textContent = best;
  }

  setSkin(skin, unlocked) {
    this.fields['skin-name'].textContent = unlocked ? skin.name : '???';
    this.fields['skin-lock'].textContent = unlocked ? '' : 'REACH ' + skin.unlockAt;
    this.skinLocked = !unlocked;
    this.skinShown = skin;
  }

  drawSkinPreview(time) {
    if (this.skinShown) OMJ.PlayerArt.drawPreview(this.skinPreview, this.skinShown, this.skinLocked, time);
  }

  showGameOver(info) {
    const f = this.fields;
    this.renderTitle(f['over-title'], info.isNewBest ? 'NEW BEST!' : 'GAME OVER');
    f['over-title'].classList.toggle('is-best', info.isNewBest);
    f.message.textContent = info.message;
    f.cause.textContent = info.cause;
    f.score.textContent = info.score;
    f['over-best'].textContent = info.best;
    f.jumped.textContent = info.jumped;
    f.unlock.textContent = info.unlocks.length
      ? 'Unlocked: ' + info.unlocks.join(', ') + '! Choose skins on the menu.'
      : info.nextUnlock || '';
    this.show('over');
  }
};
