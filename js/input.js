// =============================================================
// input.js — Keyboard and mouse controls.
//
// Keys are only handled while the game has focus, so a website
// that embeds the game keeps its own keyboard shortcuts and
// scrolling. Clicking the game gives it focus.
// =============================================================

OMJ.Input = class {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.held = {};   // keys currently held down (to block auto-repeat)

    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);

    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    root.addEventListener('pointerdown', this.onPointerDown);
  }

  // Should this keyboard event belong to the game?
  isForGame(e) {
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return false;
    return this.root.contains(document.activeElement);
  }

  onKeyDown(e) {
    if (!this.isForGame(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    const code = e.code;
    const g = this.game;
    const firstPress = !this.held[code] && !e.repeat;
    this.held[code] = true;
    g.sound.unlock(); // browsers allow sound only after a key press/click

    switch (code) {
      case 'Space':
      case 'ArrowUp':
      case 'KeyW':
        e.preventDefault(); // stop the page from scrolling
        if (firstPress) g.onJumpKey(code);
        break;
      case 'Enter':
        e.preventDefault();
        if (firstPress) g.onConfirmKey();
        break;
      case 'Escape':
      case 'KeyP':
        e.preventDefault();
        if (firstPress) g.togglePause();
        break;
      case 'KeyR':
        e.preventDefault();
        if (firstPress) g.onRestartKey();
        break;
      case 'KeyM':
        if (firstPress) g.toggleMute();
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        e.preventDefault();
        if (firstPress) g.onArrowKey(code === 'ArrowLeft' ? -1 : 1);
        break;
      case 'ArrowDown':
      case 'PageUp':
      case 'PageDown':
        e.preventDefault();
        break;
      case 'KeyH':
        if (firstPress) OMJ.CONFIG.DEBUG_HITBOXES = !OMJ.CONFIG.DEBUG_HITBOXES;
        break;
    }
  }

  onKeyUp(e) {
    this.held[e.code] = false;
  }

  onPointerDown(e) {
    this.game.sound.unlock();
    // Keep keyboard focus on the game (so SPACE works after clicking).
    if (document.activeElement !== this.root && !this.root.contains(document.activeElement)) {
      this.root.focus({ preventScroll: true });
    }
    // Clicks on buttons are handled by the buttons themselves.
    if (e.button !== 0 || e.target.closest('button')) return;
    this.game.onPointerJump();
  }
};
