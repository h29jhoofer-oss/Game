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
    this.musicButton = root.querySelector('[data-action="music"]');

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

  setMusicMuted(muted) {
    this.musicButton.classList.toggle('is-muted', muted);
    this.musicButton.setAttribute('aria-label', muted ? 'Turn music on' : 'Turn music off');
  }

  setBest(best) {
    this.fields.best.textContent = best;
  }

  setSkin(skin, unlocked) {
    this.fields['skin-name'].textContent = unlocked ? skin.name : '???';
    this.fields['skin-lock'].textContent = unlocked ? '' : 'REACH ' + skin.unlockAt;
    // Show the powers even for locked skins: something to play for!
    const ability = OMJ.ABILITIES[skin.active];
    this.setPerk(this.fields['skin-passive'], skin.passive.name, skin.passive.desc);
    this.setPerk(this.fields['skin-active'], ability.name, ability.desc);
    this.skinLocked = !unlocked;
    this.skinShown = skin;
  }

  setPerk(el, name, desc) {
    el.textContent = '';
    const strong = document.createElement('strong');
    strong.textContent = name;
    el.append(strong, ': ' + desc);
  }

  drawSkinPreview(time, scarf) {
    if (this.skinShown) OMJ.PlayerArt.drawPreview(this.skinPreview, this.skinShown, this.skinLocked, time, scarf);
  }

  setBank(coins) {
    this.fields.bank.textContent = coins;
    this.fields['shop-bank'].textContent = coins;
  }

  setShopNote(text) {
    this.fields['shop-note'].textContent = text;
  }

  // Fill the shop grid. `items` is OMJ.SWORDS or OMJ.SCARVES; each one
  // becomes a button with data-action "shop-item-N".
  showShop(tab, items, owned, equipped, bank) {
    this.root.querySelectorAll('.omj-tab').forEach((t) => {
      t.classList.toggle('is-active', t.dataset.action === 'shop-tab-' + tab);
    });
    const grid = this.fields['shop-grid'];
    grid.textContent = '';
    this.shopIcons = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const power = OMJ.GEAR_ABILITIES[item.power];
      const has = owned.indexOf(item.id) >= 0;
      const wearing = equipped === item.id;
      const card = document.createElement('button');
      card.className = 'omj-item' + (wearing ? ' is-equipped' : '') + (!has && bank < item.price ? ' is-locked' : '');
      card.dataset.action = 'shop-item-' + i;

      const icon = document.createElement('canvas');
      icon.className = 'omj-item-icon';
      if (tab === 'swords') OMJ.GearArt.drawSwordIcon(icon, item);
      else OMJ.GearArt.drawScarfIcon(icon, item, 0);
      this.shopIcons.push({ canvas: icon, item: item, tab: tab });

      const text = document.createElement('span');
      text.className = 'omj-item-text';
      const name = document.createElement('strong');
      name.textContent = item.name;
      const stats = document.createElement('span');
      stats.className = 'omj-item-stats';
      stats.textContent = tab === 'swords'
        ? 'DMG ' + item.damage + ' · ' + (item.cut >= 2 ? 'cuts crates, arrows & spikes' : 'cuts crates & arrows')
        : 'E: ' + power.name;
      const desc = document.createElement('span');
      desc.className = 'omj-item-desc';
      desc.textContent = (tab === 'swords' ? 'Q: ' + power.name + '. ' : '') + power.desc;
      const status = document.createElement('span');
      status.className = 'omj-item-status';
      status.textContent = wearing ? 'EQUIPPED' : has ? 'EQUIP' : 'BUY ' + item.price;
      text.append(name, stats, desc, status);
      card.append(icon, text);
      grid.append(card);
    }
    this.show('shop');
  }

  // Keep the rainbow scarf's icon shimmering while the shop is open.
  animateShop(time) {
    if (!this.shopIcons) return;
    for (let i = 0; i < this.shopIcons.length; i++) {
      const s = this.shopIcons[i];
      if (s.tab === 'scarves' && s.item.rainbow) OMJ.GearArt.drawScarfIcon(s.canvas, s.item, time);
    }
  }

  // Build the three boost cards. Each is a button with data-action
  // "boost-0/1/2", so the normal click handler picks it.
  showBoostChoice(choices, mods) {
    const holder = this.fields.cards;
    holder.textContent = '';
    for (let i = 0; i < choices.length; i++) {
      const c = choices[i];
      const rare = c.kind === 'bonus';
      const card = document.createElement('button');
      card.className = 'omj-card' + (rare ? ' omj-card--rare' : '');
      card.dataset.action = 'boost-' + i;

      const key = document.createElement('span');
      key.className = 'omj-card-key';
      key.textContent = String(i + 1);
      const tag = document.createElement('span');
      tag.className = 'omj-card-tag';
      const name = document.createElement('strong');
      name.className = 'omj-card-name';
      const desc = document.createElement('span');
      desc.className = 'omj-card-desc';

      if (rare) {
        tag.textContent = 'RARE ABILITY · V';
        name.textContent = c.ability.name;
        desc.textContent = c.ability.desc;
      } else {
        const have = mods.stacks[c.boost.id] || 0;
        tag.textContent = c.boost.max > 1 ? 'BOOST ' + (have + 1) + '/' + c.boost.max : 'BOOST';
        name.textContent = c.boost.name;
        desc.textContent = c.boost.desc;
      }
      card.append(key, tag, name, desc);
      holder.append(card);
    }
    this.show('boost');
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
    f.coins.textContent = info.coins;
    f.banked.textContent = info.coins > 0 ? '+' + info.coins + ' coins banked (' + info.bank + ' to spend in the shop)' : '';
    f.unlock.textContent = info.unlocks.length
      ? 'Unlocked: ' + info.unlocks.join(', ') + '! Choose skins on the menu.'
      : info.nextUnlock || '';
    this.show('over');
  }
};
