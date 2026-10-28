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
    // Right-click is the ability button, so don't open the browser menu.
    root.addEventListener('contextmenu', (e) => e.preventDefault());
    // A key released while the window is in the background never sends
    // "keyup", so forget all held keys when the window loses focus.
    window.addEventListener('blur', () => { this.held = {}; });
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

    // A menu button focused with TAB: let ENTER/SPACE press that button,
    // except mid-run, where SPACE must always jump.
    if ((code === 'Enter' || code === 'Space') && e.target.tagName === 'BUTTON') {
      if (g.state !== 'playing') return;
      this.root.focus({ preventScroll: true });
    }
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
      case 'KeyN':
        if (firstPress) g.toggleMusic();
        break;
      case 'KeyB':
      case 'ShiftLeft':
      case 'ShiftRight':
        e.preventDefault();
        if (firstPress) g.onAbilityKey();
        break;
      case 'KeyV':
        e.preventDefault();
        if (firstPress) g.onBonusKey();      // rare ability from a boost
        break;
      case 'Digit1': case 'Digit2': case 'Digit3':
      case 'Numpad1': case 'Numpad2': case 'Numpad3':
        if (firstPress) g.onNumberKey(parseInt(code.slice(-1), 10));   // pick a boost card
        break;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault();
        if (firstPress) g.onSmashKey();   // ground smash
        break;
      case 'ArrowLeft':
      case 'ArrowRight':
        e.preventDefault();
        if (firstPress) g.onArrowKey(code === 'ArrowLeft' ? -1 : 1);
        break;
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
    if (e.target.closest('button')) return;
    if (e.button === 0) this.game.onPointerJump();      // left click = jump
    else if (e.button === 2) this.game.onAbilityKey();  // right click = ability
  }
};
