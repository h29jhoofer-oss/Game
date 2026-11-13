// In-battle interface: card hand, drag-to-deploy and tap-to-deploy input, elixir bar,
// timer, crowns, banners, pause menu and the victory / defeat sequence.
(function (RR) {
  'use strict';
  const U = RR.U, Cards = RR.Cards, A = RR.Audio, UI = RR.UI, M = RR.Map;

  const BUI = { B: null, R: null, selected: -1, drag: null, handIds: [], lastSecond: null };

  BUI.init = function () {
    BUI.canvas = U.$('#b-canvas');
    BUI.R = new RR.Renderer(BUI.canvas);
    // canvas tap-to-deploy + hover preview
    BUI.canvas.addEventListener('pointerdown', (e) => {
      if (!BUI.B || BUI.drag) return;
      if (BUI.selected >= 0) {
        const [x, y] = BUI.R.toWorld(e.clientX, e.clientY);
        BUI.tryPlay(BUI.selected, x, y);
      }
    });
    BUI.canvas.addEventListener('pointermove', (e) => {
      if (!BUI.B || BUI.drag || BUI.selected < 0 || e.pointerType === 'touch') return;
      BUI.updatePreview(BUI.selected, e.clientX, e.clientY);
    });
    BUI.canvas.addEventListener('pointerleave', () => { if (!BUI.drag && BUI.R.preview) BUI.R.preview.x = null; });
    window.addEventListener('pointermove', (e) => BUI.onDragMove(e));
    window.addEventListener('pointerup', (e) => BUI.onDragEnd(e));
    window.addEventListener('pointercancel', () => BUI.cancelDrag());
    U.$('#b-pause').onclick = () => BUI.pause();
    window.addEventListener('keydown', (e) => {
      if (!BUI.B || BUI.B.over) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= 4) BUI.select(n - 1);
      if (e.key === 'Escape') BUI.select(-1);
    });
  };

  BUI.start = function (B, info) {
    BUI.B = B;
    BUI.info = info;
    BUI.selected = -1;
    BUI.drag = null;
    BUI.handIds = [];
    BUI.R.setArena(info.arena);
    BUI.R.preview = null;
    U.$('#b-enemy-name').textContent = info.enemyName;
    U.$('#b-enemy-sub').textContent = 'King Lv ' + info.enemyKing + ' · ' + info.diffLabel + ' · ' + info.deckName;
    U.$('#b-end').classList.add('hidden');
    U.$('#b-end').innerHTML = '';
    U.$$('#b-crowns i').forEach((i) => i.classList.remove('on'));
    U.$('#b-timer').className = 'b-timer';
    U.$('#b-elixir').classList.remove('double');
    BUI.buildHand();
    BUI.banner('Ready…', 'Defend your King!', 1.4);
  };

  BUI.buildHand = function () {
    const p = BUI.B.players[0];
    const hand = U.$('#b-hand');
    hand.innerHTML = '';
    p.hand.forEach((slot, i) => {
      const ce = UI.cardEl(slot.id, { cls: 'hcard' + (BUI.handIds[i] && BUI.handIds[i] !== slot.id ? ' cycle' : '') });
      ce.insertAdjacentHTML('beforeend', '<div class="nope"><i></i></div>');
      ce.dataset.idx = i;
      if (i === BUI.selected) ce.classList.add('selected');
      ce.addEventListener('pointerdown', (e) => BUI.onCardDown(e, i));
      hand.appendChild(ce);
    });
    BUI.handIds = p.hand.map((s) => s.id);
    const nx = p.queue[0];
    U.$('#b-next .mini').style.backgroundImage = 'url(' + RR.CardArt.url(nx.id) + ')';
  };

  BUI.select = function (i) {
    if (i === BUI.selected || i < 0) { BUI.selected = -1; BUI.R.preview = null; }
    else { BUI.selected = i; BUI.R.preview = { card: Cards.get(BUI.B.players[0].hand[i].id), x: null, y: null, valid: false }; A.play('tab'); }
    U.$$('#b-hand .hcard').forEach((c, j) => c.classList.toggle('selected', j === BUI.selected));
  };

  BUI.onCardDown = function (e, i) {
    if (!BUI.B || BUI.B.over) return;
    e.preventDefault();
    A.init();
    BUI.drag = { idx: i, sx: e.clientX, sy: e.clientY, moved: false, wasSelected: BUI.selected === i, el: e.currentTarget, pid: e.pointerId };
    if (BUI.selected !== i) BUI.select(i);
  };

  BUI.overCanvas = function (x, y) {
    const r = BUI.canvas.getBoundingClientRect();
    return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
  };

  BUI.onDragMove = function (e) {
    const d = BUI.drag;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 12) {
      d.moved = true;
      d.el.classList.add('dragging');
      d.ghost = UI.cardEl(BUI.B.players[0].hand[d.idx].id);
      d.ghost.id = 'drag-ghost';
      document.body.appendChild(d.ghost);
    }
    if (!d.moved) return;
    d.ghost.style.left = e.clientX + 'px'; d.ghost.style.top = e.clientY + 'px';
    const over = BUI.overCanvas(e.clientX, e.clientY - 30);
    d.ghost.style.display = over ? 'none' : '';
    if (over) BUI.updatePreview(d.idx, e.clientX, e.clientY - 30);
    else if (BUI.R.preview) BUI.R.preview.x = null;
  };

  BUI.updatePreview = function (idx, cx, cy) {
    const slot = BUI.B.players[0].hand[idx];
    if (!slot) return;
    const card = Cards.get(slot.id);
    let [x, y] = BUI.R.toWorld(cx, cy);
    x = U.clamp(x, 0.5, M.W - 0.5); y = U.clamp(y, 0.5, M.H - 0.5);
    BUI.R.preview = { card, x, y, valid: M.canDeploy(BUI.B, 0, card, x, y) };
  };

  BUI.onDragEnd = function (e) {
    const d = BUI.drag;
    if (!d) return;
    BUI.drag = null;
    if (d.ghost) d.ghost.remove();
    d.el.classList.remove('dragging');
    if (d.moved) {
      if (BUI.overCanvas(e.clientX, e.clientY - 30)) {
        const [x, y] = BUI.R.toWorld(e.clientX, e.clientY - 30);
        if (!BUI.tryPlay(d.idx, x, y)) { BUI.R.preview = null; BUI.select(-1); }
      } else { BUI.select(-1); }
    } else if (d.wasSelected) {
      BUI.select(-1);
    }
  };
  BUI.cancelDrag = function () {
    const d = BUI.drag;
    if (!d) return;
    if (d.ghost) d.ghost.remove();
    d.el.classList.remove('dragging');
    BUI.drag = null;
  };

  BUI.tryPlay = function (idx, x, y) {
    const B = BUI.B;
    const p = B.players[0];
    const slot = p.hand[idx];
    if (!slot || B.over) return false;
    const card = Cards.get(slot.id);
    if (B.phase === 'intro') { UI.toast('Get ready…'); return false; }
    if (p.elixir < card.cost) {
      A.play('error');
      const el = U.$('#b-elixir'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
      UI.toast('Not enough Elixir!', true);
      return false;
    }
    if (!M.canDeploy(B, 0, card, x, y)) { A.play('error'); UI.toast('Can\'t deploy there!', true); return false; }
    if (B.playCard(0, idx, x, y)) {
      BUI.selected = -1; BUI.R.preview = null;
      BUI.buildHand();
      return true;
    }
    return false;
  };

  BUI.banner = function (text, sub, dur, cls) {
    const b = U.$('#b-banner');
    b.className = cls || '';
    b.innerHTML = '<span class="outl">' + text + '</span>' + (sub ? '<small class="outl">' + sub + '</small>' : '');
    void b.offsetWidth;
    b.classList.add('show');
  };

  BUI.pause = function () {
    if (!BUI.B || BUI.B.over) return;
    A.play('click');
    BUI.paused = true;
    const m = UI.modal('<h2>Paused</h2><div class="pause-menu"><button class="btn green" data-a="resume">Resume</button><button class="btn blue" data-a="help">How to Play</button><button class="btn red" data-a="quit">Surrender</button></div>', { onClose: () => { BUI.paused = false; } });
    m.el.querySelector('[data-a=resume]').onclick = () => { A.play('click'); m.close(); };
    m.el.querySelector('[data-a=help]').onclick = () => { A.play('click'); m.close(); BUI.paused = true; RR.Menus.howToPlay(() => { BUI.paused = false; }); };
    m.el.querySelector('[data-a=quit]').onclick = () => {
      m.close();
      BUI.paused = true;
      UI.confirm('Surrender?', 'You will lose this battle (and trophies).', 'Surrender', () => {
        BUI.paused = false;
        const B = BUI.B;
        if (!B || B.over) return;
        B.kill(B.towers[0][0]);
        B.endReason = 'surrender';
      }, () => { BUI.paused = false; });
    };
  };

  // called every frame
  BUI.update = function (dt) {
    const B = BUI.B;
    if (!B) return;
    // events
    while (B.events.length) BUI.onEvent(B.events.shift());
    // timer
    const tEl = U.$('#b-timer');
    const label = B.phase === 'overtime' ? 'Overtime' : B.phase === 'intro' ? 'Get ready' : 'Time left';
    const time = B.phase === 'intro' ? 180 : B.time;
    tEl.querySelector('small').textContent = label + (B.doubleElixir && B.phase === 'regular' ? ' · x2' : B.phase === 'overtime' ? ' · x3' : '');
    tEl.querySelector('b').textContent = U.fmtTime(time);
    tEl.classList.toggle('double', B.doubleElixir && B.phase === 'regular');
    tEl.classList.toggle('ot', B.phase === 'overtime');
    tEl.classList.toggle('urgent', B.phase !== 'intro' && time <= 10);
    // elixir
    const p = B.players[0];
    U.$('#b-elixir-fill').style.width = (p.elixir / 10 * 100) + '%';
    U.$('#b-elixir-num').textContent = Math.floor(p.elixir);
    U.$('#b-elixir').classList.toggle('double', B.doubleElixir);
    // resync the hand if it changed outside the drag/tap flow
    if (p.hand.some((sl, i) => sl.id !== BUI.handIds[i]) && !BUI.drag) { BUI.selected = -1; BUI.R.preview = null; BUI.buildHand(); }
    // affordability overlays
    U.$$('#b-hand .hcard').forEach((el, i) => {
      const slot = p.hand[i];
      if (!slot) return;
      const c = Cards.get(slot.id);
      const nope = el.querySelector('.nope');
      const ok = p.elixir >= c.cost;
      nope.style.display = ok ? 'none' : '';
      if (!ok) nope.firstChild.style.height = (p.elixir / c.cost * 100) + '%';
    });
    // marching footsteps while ground troops are on the move
    BUI.stepT = (BUI.stepT || 0) - dt;
    if (BUI.stepT <= 0 && B.phase !== 'ended') {
      BUI.stepT = 0.42;
      if (B.entities.some((e) => e.moving && !e.flying && e.kind === 'troop')) A.play('step', 0);
    }
    // keep preview validity fresh while hovering
    const pv = BUI.R.preview;
    if (pv && pv.x != null) pv.valid = M.canDeploy(B, 0, pv.card, pv.x, pv.y);
  };

  BUI.onEvent = function (ev) {
    const B = BUI.B;
    switch (ev.type) {
      case 'start': BUI.banner('FIGHT!', null, 1.2); A.play('horn'); break;
      case 'double': BUI.banner('Double Elixir!', '60 seconds left', 2); A.play('double'); RR.Game.setMusic(true); break;
      case 'overtime': BUI.banner('Overtime!', 'Sudden death — next tower wins', 2); A.play('double'); break;
      case 'countdown': if (ev.n <= 10 && ev.n > 0) { BUI.banner(String(ev.n), null, 0.9, 'count'); A.play('countdown'); } break;
      case 'kingActive': if (ev.team === 1) BUI.banner('King Activated!', null, 1.4); break;
      case 'crown': {
        const crowns = B.players[ev.team].crowns;
        const sel = ev.team === 0 ? '#b-crowns-player i' : '#b-crowns-enemy i';
        U.$$(sel).forEach((el, i) => el.classList.toggle('on', i < crowns));
        A.play('crown');
        if (ev.tower.towerKind !== 'king') BUI.banner(ev.team === 0 ? 'Tower Destroyed!' : 'Tower Lost!', null, 1.4);
        break;
      }
      case 'end': setTimeout(() => BUI.showEnd(), 1600); BUI.select(-1); break;
      default: break;
    }
  };

  BUI.showEnd = function () {
    const B = BUI.B;
    const res = RR.Game.finishBattle(B);
    const won = B.winner === 0, draw = B.winner === -1;
    const end = U.$('#b-end');
    end.className = won ? '' : 'lose';
    end.classList.remove('hidden');
    A.music(null);
    A.play(won ? 'victory' : 'defeat', 0);
    const crownRow = (n) => [0, 1, 2].map((i) => '<i class="' + (i < n ? 'on' : '') + '" style="animation-delay:' + (0.9 + i * 0.35) + 's"></i>').join('');
    const reasonTxt = { king: 'King Tower destroyed!', time: 'More crowns at the final bell', suddendeath: 'Sudden death!', tiebreak: 'Won on tower health', draw: 'Perfectly matched', surrender: 'Surrendered' }[B.endReason] || '';
    let rewards = '';
    const rw = (i, ico, txt, val) => '<div class="rw" style="animation-delay:' + (1.8 + i * 0.25) + 's"><span class="ri">' + ico + '</span><span class="outl">' + txt + '</span><b class="outl">' + val + '</b></div>';
    let i = 0;
    rewards += rw(i++, '🏆', 'Trophies', (res.trophies > 0 ? '+' : '') + res.trophies);
    if (res.gold) rewards += rw(i++, '💰', 'Gold', '+' + res.gold);
    rewards += rw(i++, '⭐', 'Experience', '+' + res.xp);
    if (res.chest) rewards += rw(i++, '🎁', RR.Profile.CHESTS[res.chest].name, '<img src="' + UI.chestUrl(res.chest) + '" style="width:44px;height:38px;vertical-align:middle">');
    else if (won) rewards += rw(i++, '🎁', 'Chest slots full!', '—');
    if (res.crownChestReady) rewards += rw(i++, '👑', 'Crown Chest ready!', '✔');
    if (res.newArena) rewards += rw(i++, '🗺️', 'New arena: ' + res.newArena.name, '+20💎');
    if (res.unlockedCard) rewards += rw(i++, '🃏', 'Unlocked ' + Cards.get(res.unlockedCard).name, 'NEW');
    if (res.kingUps.length) rewards += rw(i++, '👑', 'King Level ' + res.kingUps[res.kingUps.length - 1] + '!', '+10💎');
    end.innerHTML = '<div class="end-title disp outl ' + (won ? 'win' : 'lose') + '">' + (won ? 'VICTORY!' : draw ? 'DRAW' : 'DEFEAT') + '</div>' +
      '<div class="muted disp" style="font-size:15px">' + reasonTxt + '</div>' +
      '<div class="end-crowns"><div class="end-side me"><div class="cr">' + crownRow(B.players[0].crowns) + '</div><span class="outl">' + RR.Profile.data.name.replace(/</g, '') + '</span></div>' +
      '<div class="end-vs">VS</div><div class="end-side foe"><div class="cr">' + crownRow(B.players[1].crowns) + '</div><span class="outl">' + BUI.info.enemyName + '</span></div></div>' +
      '<div class="panel rewards">' + rewards + '</div>' +
      '<button class="btn big green" id="end-ok" style="animation:revealin .4s ' + (2.2 + i * 0.25) + 's backwards">OK</button>';
    U.$('#end-ok').onclick = () => { A.play('click'); RR.Game.exitBattle(res); };
    if (won) BUI.confetti(end);
  };

  BUI.confetti = function (root) {
    const cols = ['#ffe066', '#3d8bff', '#ff4d4d', '#7dff6a', '#ff8af5', '#ffffff'];
    for (let i = 0; i < 70; i++) {
      const c = U.el('div', 'confetti');
      c.style.left = Math.random() * 100 + '%';
      c.style.background = U.pick(cols);
      c.style.animationDuration = U.rand(2.2, 4.5) + 's';
      c.style.animationDelay = U.rand(0, 1.5) + 's';
      root.appendChild(c);
    }
  };

  RR.BattleUI = BUI;
})(window.RR);
