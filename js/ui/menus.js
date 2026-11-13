// Menu screens: Home (arena + play + chests), Cards (collection + deck builder + upgrades),
// Shop, Quests (achievements + daily rewards) and Profile (stats, trophy road, settings).
(function (RR) {
  'use strict';
  const U = RR.U, Cards = RR.Cards, P = RR.Profile, UI = RR.UI, A = RR.Audio;
  const Menus = { tab: 'home', swapCard: null, preview: null };

  const ico = { gold: '💰', gems: '💎', trophy: '🏆' };

  Menus.topbar = function () {
    const d = P.data;
    const need = P.xpForNext();
    const prev = P.KING_XP[d.kingLevel - 1] || 0;
    const pct = need === Infinity ? 100 : U.clamp((d.xp - prev) / (need - prev) * 100, 0, 100);
    return '<div class="topbar">' +
      '<div class="profile-chip"><div class="lvl-shield outl">' + d.kingLevel + '</div><div style="min-width:0;flex:1"><div class="pname outl">' + escapeHtml(d.name) + '</div>' +
      '<div class="xpbar"><i style="width:' + pct + '%"></i><span>' + (need === Infinity ? 'MAX' : d.xp + ' / ' + need + ' XP') + '</span></div></div></div>' +
      '<div class="currency"><span class="ci">' + ico.gold + '</span><span class="outl">' + U.fmtNum(d.gold) + '</span></div>' +
      '<div class="currency"><span class="ci">' + ico.gems + '</span><span class="outl">' + U.fmtNum(d.gems) + '</span></div></div>';
  };
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  Menus.show = function (tab) {
    Menus.tab = tab;
    U.$$('.screen').forEach((s) => s.classList.toggle('active', s.id === 'screen-' + tab));
    U.$$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    Menus.render(tab);
  };
  Menus.render = function (tab) {
    tab = tab || Menus.tab;
    const fn = Menus['render_' + tab];
    if (fn) fn(U.$('#screen-' + tab));
    Menus.updateBadges();
  };
  Menus.refresh = function () { Menus.render(Menus.tab); };
  Menus.updateBadges = function () {
    const n = P.achievementsReady() + (P.dailyAvailable() ? 1 : 0);
    const b = U.$('#quest-badge');
    b.textContent = n; b.classList.toggle('show', n > 0);
  };

  // =================================================================== HOME
  Menus.render_home = function (el) {
    const d = P.data;
    const ar = P.arena();
    const nx = RR.Arenas.next(d.trophies);
    const pct = nx ? U.clamp((d.trophies - ar.trophies) / (nx.trophies - ar.trophies) * 100, 0, 100) : 100;
    const diff = d.settings.difficulty;
    el.innerHTML = Menus.topbar() +
      '<div class="panel trophy-row"><div class="tro outl">' + ico.trophy + ' ' + d.trophies + '</div><div class="prog"><div class="prog-bar"><i style="width:' + pct + '%"></i><span>' +
      (nx ? 'Next: ' + nx.name + ' (' + nx.trophies + ')' : 'Top arena reached!') + '</span></div></div></div>' +
      '<div class="arena-card"><canvas id="home-arena"></canvas><div class="arena-num">Arena ' + (ar.id + 1) + '</div>' +
      '<button class="btn small blue daily-btn" id="daily-btn">📅 Daily' + (P.dailyAvailable() ? ' <span style="color:#ffe066">!</span>' : '') + '</button>' +
      '<div class="arena-label"><div class="aname outl">' + ar.name + '</div><div class="adesc">' + ar.desc + '</div></div></div>' +
      '<div class="play-area"><div class="diff-pills">' +
      ['easy', 'medium', 'hard'].map((k) => '<button data-d="' + k + '" class="' + (k === diff ? 'on' : '') + '">' + P.DIFF[k].label + '</button>').join('') +
      '</div><button class="btn big play-btn" id="play-btn">BATTLE<small>+' + P.DIFF[diff].winT + ' 🏆 per win</small></button></div>' +
      '<div class="chest-row" id="chest-row"></div>' +
      '<div class="panel crown-chest"><img src="' + UI.chestUrl('crown') + '"><div class="info"><b class="outl">Crown Chest</b><div class="prog-bar blue" style="margin-top:4px"><i style="width:' + d.crowns * 10 + '%"></i><span>' + d.crowns + ' / 10 crowns</span></div></div>' +
      (d.crowns >= 10 ? '<button class="btn small green" id="crown-open">Open</button>' : '') + '</div>';
    Menus.renderChests();
    U.$$('.diff-pills button', el).forEach((b) => b.onclick = () => { A.play('tab'); d.settings.difficulty = b.dataset.d; P.save(); Menus.render_home(el); });
    U.$('#play-btn', el).onclick = () => { A.play('select'); RR.Game.startBattle(d.settings.difficulty); };
    U.$('#daily-btn', el).onclick = () => { A.play('click'); Menus.dailyModal(); };
    const co = U.$('#crown-open', el);
    if (co) co.onclick = () => { const loot = P.claimCrownChest(); if (loot) UI.openChestSequence(loot, () => Menus.refresh()); };
    Menus.startPreview(U.$('#home-arena', el), ar);
  };

  Menus.renderChests = function () {
    const row = U.$('#chest-row');
    if (!row) return;
    row.innerHTML = '';
    P.data.chests.forEach((ch, i) => {
      const st = P.chestState(ch);
      const slot = U.el('div', 'chest-slot ' + st);
      if (st === 'empty') { slot.innerHTML = 'Chest slot<br>Win to earn'; row.appendChild(slot); return; }
      const info = P.CHESTS[ch.type];
      let label;
      if (st === 'locked') label = (P.anyUnlocking() ? '' : 'Tap to unlock<br>') + U.fmtDuration(info.time);
      else if (st === 'unlocking') label = '⏳ ' + U.fmtDuration((ch.unlockAt - Date.now()) / 1000) + '<br>💎 ' + P.skipCost(i);
      else label = 'OPEN!';
      slot.innerHTML = '<img src="' + UI.chestUrl(ch.type) + '"><div class="cs-label outl">' + label + '</div>';
      slot.onclick = () => Menus.chestClick(i);
      row.appendChild(slot);
    });
  };
  Menus.chestClick = function (i) {
    const ch = P.data.chests[i];
    const st = P.chestState(ch);
    A.play('click');
    if (st === 'ready') {
      const loot = P.openChest(i);
      if (loot) UI.openChestSequence(loot, () => Menus.refresh());
      return;
    }
    const info = P.CHESTS[ch.type];
    const cost = P.skipCost(i);
    const canStart = st === 'locked' && !P.anyUnlocking();
    const m = UI.modal('<h2>' + info.name + '</h2><div style="text-align:center"><img src="' + UI.chestUrl(ch.type) + '" style="width:150px;height:128px"></div>' +
      '<p class="help" style="text-align:center">Contains ~' + Math.round(info.cards * (1 + P.arena().id * 0.35)) + ' cards and ' + info.gold[0] + '-' + info.gold[1] + '+ gold.<br>' +
      (st === 'unlocking' ? 'Unlocking: ' + U.fmtDuration((ch.unlockAt - Date.now()) / 1000) + ' left' : 'Unlock time: ' + U.fmtDuration(info.time)) + '</p>' +
      '<div class="modal-actions">' + (canStart ? '<button class="btn blue" data-a="start">Start Unlock</button>' : '') +
      '<button class="btn purple" data-a="gems">Open now 💎' + cost + '</button></div>' +
      (st === 'locked' && !canStart ? '<p class="help muted" style="text-align:center">Another chest is already unlocking.</p>' : ''));
    const s = m.el.querySelector('[data-a=start]');
    if (s) s.onclick = () => { P.startUnlock(i); A.play('select'); m.close(); Menus.renderChests(); };
    m.el.querySelector('[data-a=gems]').onclick = () => {
      if (P.data.gems < cost) { UI.toast('Not enough gems!', true); A.play('error'); return; }
      const loot = P.openChest(i, true);
      m.close();
      if (loot) UI.openChestSequence(loot, () => Menus.refresh());
    };
  };

  // animated arena preview on the home screen
  Menus.startPreview = function (canvas, arena) {
    Menus.stopPreview();
    const r = new RR.Renderer(canvas);
    r.setArena(arena);
    r.fixedView = { tiles: 17, cy: 21.6 };
    const B = new RR.Battle({ decks: [P.deckCards(), P.deckCards()], kingLevels: [1, 1], controllers: [null, null] });
    B.phase = 'preview';
    Menus.preview = { r, B };
  };
  Menus.stopPreview = function () { Menus.preview = null; };
  Menus.tickPreview = function (dt) {
    const p = Menus.preview;
    if (!p || Menus.tab !== 'home' || !document.body.contains(p.r.canvas)) return;
    for (const t of p.B.towers[0].concat(p.B.towers[1])) t.t += dt;
    p.B.fx.update(dt);
    p.r.render(p.B, dt);
  };

  Menus.dailyModal = function () {
    const idx = P.dailyIndex();
    const avail = P.dailyAvailable();
    const cells = P.DAILY.map((r, i) => {
      const done = i < idx || (!avail && i === idx - 0 && false);
      const today = i === idx && avail;
      return '<div class="panel" style="padding:8px 4px;text-align:center;' + (today ? 'box-shadow:0 0 0 3px #ffe066;' : '') + (i < idx ? 'opacity:.45;' : '') + '">' +
        '<div class="disp" style="font-size:12px">Day ' + (i + 1) + '</div><div style="font-size:26px">' + (r.gold ? '💰' : r.gems ? '💎' : '🎁') + '</div><div class="disp" style="font-size:11px">' + r.label + '</div>' + (i < idx ? '<div>✅</div>' : '') + '</div>';
    }).join('');
    const m = UI.modal('<h2>Daily Rewards</h2><p class="help" style="text-align:center">Log in every day to keep your streak going!</p>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px">' + cells + '</div>' +
      '<div class="modal-actions">' + (avail ? '<button class="btn green" data-a="claim">Claim Day ' + (idx + 1) + '</button>' : '<button class="btn gray" disabled>Come back tomorrow!</button>') + '</div>');
    const c = m.el.querySelector('[data-a=claim]');
    if (c) c.onclick = () => {
      const res = P.claimDaily();
      m.close();
      if (!res) return;
      A.play('coin');
      if (res.loot) UI.openChestSequence(res.loot, () => Menus.refresh());
      else { UI.toast('Claimed ' + res.reward.label + '!'); Menus.refresh(); }
    };
  };

  // =================================================================== CARDS
  Menus.render_cards = function (el) {
    const d = P.data;
    const deck = P.deck;
    el.innerHTML = Menus.topbar() +
      '<div class="panel" style="padding:10px 6px 4px"><div class="deck-head" style="padding:0 6px"><div class="ribbon" style="font-size:16px;padding:4px 12px 6px">Battle Deck</div>' +
      '<div class="deck-tabs">' + [0, 1, 2].map((i) => '<button data-deck="' + i + '" class="' + (i === d.activeDeck ? 'on' : '') + '">' + (i + 1) + '</button>').join('') + '</div>' +
      '<div class="avg-elixir"><span class="drop-ico"></span><span class="outl">Avg ' + P.avgElixir().toFixed(1) + '</span></div></div>' +
      (Menus.swapCard ? '<div class="swap-hint outl">Tap a deck card to replace it with ' + Cards.get(Menus.swapCard).name + ' <button class="btn small gray" id="swap-cancel">Cancel</button></div>' : '') +
      '<div class="deck-grid" id="deck-grid"></div></div>' +
      '<div class="section-title outl">Collection <small>' + Object.keys(d.cards).length + ' / ' + Cards.list().length + ' found</small></div>' +
      '<div class="coll-grid" id="coll-grid"></div>' +
      '<div class="section-title outl">Not yet found</div><div class="coll-grid" id="locked-grid"></div>';
    const dg = U.$('#deck-grid', el);
    deck.forEach((id, slot) => {
      const ce = Menus.collCard(id, true);
      if (Menus.swapCard) ce.classList.add('swapme');
      ce.onclick = () => {
        if (Menus.swapCard) {
          P.setDeckCard(slot, Menus.swapCard); Menus.swapCard = null; A.play('select'); Menus.render_cards(el); return;
        }
        Menus.cardModal(id);
      };
      dg.appendChild(ce);
    });
    const owned = Object.keys(d.cards).filter((id) => !deck.includes(id)).map(Cards.get).sort((a, b) => a.cost - b.cost || Cards.RARITY[a.rarity].order - Cards.RARITY[b.rarity].order);
    const cg = U.$('#coll-grid', el);
    if (!owned.length) cg.innerHTML = '<p class="help muted" style="grid-column:span 4;text-align:center">All your cards are in your deck. Open chests to find more!</p>';
    owned.forEach((c) => { const ce = Menus.collCard(c.id); ce.onclick = () => Menus.cardModal(c.id); cg.appendChild(ce); });
    const lg = U.$('#locked-grid', el);
    Cards.list().filter((c) => !d.cards[c.id]).sort((a, b) => a.arena - b.arena || a.cost - b.cost).forEach((c) => {
      const ce = UI.cardEl(c.id, { cls: 'locked', label: 'Arena ' + (c.arena + 1) });
      ce.onclick = () => Menus.cardModal(c.id);
      lg.appendChild(ce);
    });
    U.$$('[data-deck]', el).forEach((b) => b.onclick = () => { A.play('tab'); d.activeDeck = +b.dataset.deck; P.save(); Menus.render_cards(el); });
    const sc = U.$('#swap-cancel', el);
    if (sc) sc.onclick = () => { Menus.swapCard = null; Menus.render_cards(el); };
  };

  Menus.collCard = function (id, inDeck) {
    const st = P.data.cards[id];
    const c = Cards.get(id);
    const ce = UI.cardEl(id, { level: st.level });
    const need = Cards.cardsToUpgrade(c, st.level);
    if (st.level < Cards.MAX_LEVEL) {
      const pct = U.clamp(st.count / need * 100, 0, 100);
      ce.insertAdjacentHTML('beforeend', '<div class="cprog"><div class="prog-bar ' + (st.count >= need ? 'green' : 'blue') + '" style="height:12px;border-width:2px"><i style="width:' + pct + '%"></i><span style="font-size:8px;line-height:8px">' + st.count + '/' + need + '</span></div></div>');
    } else ce.insertAdjacentHTML('beforeend', '<div class="cprog"><div class="prog-bar" style="height:12px;border-width:2px"><i style="width:100%"></i><span style="font-size:8px;line-height:8px">MAX</span></div></div>');
    if (P.canUpgrade(id)) ce.insertAdjacentHTML('beforeend', '<div class="up-arrow">⬆</div>');
    return ce;
  };

  Menus.statRows = function (c, lv, nextLv) {
    const rows = [];
    const add = (icon, label, val, next) => rows.push('<div class="stat"><span class="si">' + icon + '</span><div><small>' + label + '</small><b>' + val + (next != null && next !== val ? ' <em>+' + (next - val) + '</em>' : '') + '</b></div></div>');
    const lvStat = (k) => Cards.stat(c, k, lv);
    const nxStat = (k) => (nextLv ? Cards.stat(c, k, nextLv) : null);
    if (c.type !== 'spell') add('❤️', 'Hitpoints', lvStat('hp'), nxStat('hp'));
    if (c.dmg) {
      if (c.ramp) add('🔥', 'Damage (ramps)', lvStat('dmg') + '→' + Math.round(lvStat('dmg') * c.ramp[2]));
      else add(c.type === 'spell' ? '💥' : '⚔️', c.waves ? 'Damage / wave' : c.trap ? 'Blast Damage' : 'Damage', lvStat('dmg'), nxStat('dmg'));
    }
    if (c.hitSpeed && c.type !== 'spell' && !c.trap) add('⏱️', 'Hit Speed', c.hitSpeed + 's');
    if (c.hitSpeed && c.dmg && !c.trap && c.type !== 'spell') add('📈', 'DPS', Math.round(lvStat('dmg') / c.hitSpeed * (c.ramp ? c.ramp[2] : 1)) + (c.ramp ? ' max' : ''));
    if (c.type === 'troop') add('👟', 'Speed', Cards.SPEED_NAME(c.speed));
    if (c.range != null && c.type !== 'spell' && c.targets !== 'none' && !c.trap) add('🎯', 'Range', c.range < 1.5 ? 'Melee' : c.range);
    if (c.radius && c.type === 'spell') add('⭕', 'Radius', c.radius);
    if (c.targets && c.type !== 'spell' && !c.trap) add('🎯', 'Targets', c.targets === 'both' ? 'Air & Ground' : c.targets === 'ground' ? 'Ground' : c.targets === 'buildings' ? 'Buildings' : 'None');
    if (c.count > 1) add('👥', 'Count', 'x' + c.count);
    if (c.lifetime) add('⌛', 'Lifetime', c.lifetime + 's');
    if (c.duration) add('⌛', 'Duration', c.duration + 's');
    if (c.flying) add('🪽', 'Movement', 'Flying');
    if (c.splash || c.selfSplash) add('💢', 'Splash', (c.splash || c.selfSplash) + ' tiles');
    // special ability
    let sp = null;
    if (c.spawner) sp = 'Spawns ' + c.spawner.count + ' ' + Cards.get(c.spawner.card).name + ' every ' + c.spawner.interval + 's';
    else if (c.heal) sp = 'Heals allies for ' + Math.round(c.heal.amount * Cards.levelMul(lv)) + ' every ' + c.heal.interval + 's';
    else if (c.aura) sp = 'Allies within ' + c.aura.radius + ' tiles: +30% speed & attack speed';
    else if (c.charge) sp = 'Charges after ' + c.charge.distance + ' tiles: 2x speed, 2x first hit';
    else if (c.chain) sp = 'Lightning chains to ' + c.chain.count + ' targets, ' + c.chain.stun + 's stun';
    else if (c.deployAnywhere) sp = 'Can be deployed anywhere in the arena';
    else if (c.jumpsRiver) sp = 'Jumps over the river';
    else if (c.deathSpawn) sp = 'Death: splits into ' + c.deathSpawn.count + ' ' + Cards.get(c.deathSpawn.card).name + 's';
    else if (c.deathDamage) sp = 'Death: explodes for ' + Math.round(c.deathDamage.dmg * Cards.levelMul(lv)) + ' damage';
    else if (c.ramp) sp = 'Damage ramps up x4 then x14 while locked on';
    else if (c.trap) sp = 'Invisible to the enemy. Stuns for ' + c.trap.stun + 's';
    else if (c.elixirGen) sp = 'Generates 1 Elixir every ' + c.elixirGen.interval + 's';
    else if (c.stun) sp = 'Stuns for ' + c.stun + 's';
    else if (c.slow) sp = 'Slows enemies by ' + Math.round(c.slow * 100) + '%';
    else if (c.buff) sp = 'Allies +' + Math.round((c.buff - 1) * 100) + '% speed & attack';
    else if (c.knockback) sp = 'Knocks back ground troops';
    if (c.crownMul && c.type === 'spell') add('🏰', 'Crown Tower dmg', Math.round(lvStat('dmg') * c.crownMul));
    if (sp) rows.push('<div class="stat wide"><span class="si">✨</span><div><small>Special</small><b style="font-size:13px">' + sp + '</b></div></div>');
    return rows.join('');
  };

  Menus.cardModal = function (id) {
    A.play('click');
    const c = Cards.get(id);
    const st = P.data.cards[id];
    const lv = st ? st.level : 1;
    const rar = Cards.RARITY[c.rarity];
    const canUp = st && P.canUpgrade(id);
    const maxed = st && lv >= Cards.MAX_LEVEL;
    const need = st ? Cards.cardsToUpgrade(c, lv) : 0;
    const gold = Cards.goldToUpgrade(lv);
    const wrap = U.el('div');
    const head = U.el('div', 'card-detail');
    head.appendChild(UI.cardEl(id, { level: st ? lv : null, cls: st ? '' : 'locked' }));
    head.insertAdjacentHTML('beforeend', '<div class="cd-info"><h2 style="text-align:left;margin:0" class="outl">' + c.name + '</h2><div class="rar" style="color:' + rar.color + '">' + rar.name + ' ' + Cards.typeName(c) + '</div>' +
      '<div class="desc">' + c.desc + '</div>' + (st ? '<div class="muted" style="font-weight:900;font-size:12px;margin-top:6px">Cards: ' + st.count + (maxed ? '' : ' / ' + need) + '</div>' : '<div style="color:#ffe066;font-weight:900;font-size:12px;margin-top:6px">Found in Arena ' + (c.arena + 1) + ': ' + RR.Arenas.list[c.arena].name + '</div>') + '</div>');
    wrap.appendChild(head);
    wrap.insertAdjacentHTML('beforeend', '<div class="stats">' + Menus.statRows(c, lv, canUp ? lv + 1 : null) + '</div>');
    const acts = U.el('div', 'modal-actions');
    if (st) {
      if (!P.deck.includes(id)) {
        const use = U.el('button', 'btn blue', 'Use');
        use.onclick = () => { A.play('select'); Menus.swapCard = id; m.close(); Menus.show('cards'); };
        acts.appendChild(use);
      }
      if (!maxed) {
        const up = U.el('button', 'btn ' + (canUp ? 'green' : 'gray'), 'Upgrade 💰' + U.fmtNum(gold));
        up.onclick = () => {
          if (!canUp) { A.play('error'); UI.toast(st.count < need ? 'Need ' + (need - st.count) + ' more cards' : 'Not enough gold!', true); return; }
          const res = P.upgrade(id);
          if (res) {
            A.play('upgrade');
            m.close();
            UI.toast(c.name + ' upgraded to Level ' + res.level + '!  +' + res.xp + ' XP');
            if (res.kingUps.length) setTimeout(() => Menus.kingUpModal(res.kingUps[res.kingUps.length - 1]), 400);
            Menus.refresh();
            setTimeout(() => Menus.cardModal(id), 120);
          }
        };
        acts.appendChild(up);
      } else acts.insertAdjacentHTML('beforeend', '<div class="disp outl" style="font-size:18px;color:#ffe066">MAX LEVEL</div>');
    }
    wrap.appendChild(acts);
    const m = UI.modal(wrap);
  };

  Menus.kingUpModal = function (lvl) {
    A.play('victory');
    UI.modal('<h2>King Level Up!</h2><div style="text-align:center"><div class="lvl-shield outl" style="width:90px;height:100px;font-size:46px;margin:0 auto 10px">' + lvl + '</div>' +
      '<p class="help">Your crown towers are now stronger!<br>Rewards: 💰 100 Gold, 💎 10 Gems</p></div>');
  };

  // =================================================================== SHOP
  Menus.render_shop = function (el) {
    const s = P.shop();
    const msLeft = (P.dayNumber() + 1) * 86400000 + new Date().getTimezoneOffset() * 60000 - Date.now();
    el.innerHTML = Menus.topbar() +
      '<div class="panel free-gift"><div class="gi">🎁</div><div class="info"><b class="outl">Free Daily Gift</b><div class="refresh">A little gold every day</div></div>' +
      (s.freeClaimed ? '<button class="btn small gray" disabled>Claimed</button>' : '<button class="btn small green" id="free-gift">Claim</button>') + '</div>' +
      '<div class="section-title outl">Daily Deals <small>Refresh in ' + U.fmtDuration(msLeft / 1000) + '</small></div>' +
      '<div class="shop-grid" id="offers"></div>' +
      '<div class="section-title outl">Chests</div><div class="chest-shop" id="chest-shop"></div>' +
      '<div class="section-title outl">Gold</div><div class="gold-packs" id="gold-packs"></div>';
    const og = U.$('#offers', el);
    s.offers.forEach((o, i) => {
      const box = U.el('div', 'offer' + (o.bought ? ' bought' : ''));
      const ce = UI.cardEl(o.id);
      ce.insertAdjacentHTML('beforeend', '<div class="qty outl">x' + o.n + '</div>' + (!P.owned(o.id) ? '<div class="newtag">NEW!</div>' : ''));
      ce.onclick = () => Menus.cardModal(o.id);
      box.appendChild(ce);
      const b = U.el('button', 'btn small ' + (o.bought ? 'gray' : ''), o.bought ? 'Sold' : '💰 ' + U.fmtNum(o.price));
      b.onclick = () => {
        if (o.bought) return;
        if (P.data.gold < o.price) { A.play('error'); UI.toast('Not enough gold!', true); return; }
        if (P.buyOffer(i)) { A.play('coin'); UI.toast('Bought ' + o.n + 'x ' + Cards.get(o.id).name + '!'); Menus.render_shop(el); }
      };
      box.appendChild(b);
      og.appendChild(box);
    });
    const cs = U.$('#chest-shop', el);
    Object.keys(P.CHEST_PRICES).forEach((type) => {
      const box = U.el('div', 'panel chest-offer');
      box.innerHTML = '<img src="' + UI.chestUrl(type) + '"><b class="outl">' + P.CHESTS[type].name + '</b>';
      const b = U.el('button', 'btn small purple', '💎 ' + P.CHEST_PRICES[type]);
      b.onclick = () => {
        if (P.data.gems < P.CHEST_PRICES[type]) { A.play('error'); UI.toast('Not enough gems!', true); return; }
        const loot = P.buyChest(type);
        if (loot) UI.openChestSequence(loot, () => Menus.refresh());
      };
      box.appendChild(b);
      cs.appendChild(box);
    });
    const gp = U.$('#gold-packs', el);
    P.GOLD_PACKS.forEach((p, i) => {
      const box = U.el('div', 'panel gold-pack');
      box.innerHTML = '<div class="pile">' + ['💰', '💰💰', '🏦'][i] + '</div><b class="disp outl">' + U.fmtNum(p.gold) + '</b>';
      const b = U.el('button', 'btn small purple', '💎 ' + p.gems);
      b.onclick = () => {
        if (!P.buyGold(i)) { A.play('error'); UI.toast('Not enough gems!', true); return; }
        A.play('coin'); UI.toast('+' + U.fmtNum(p.gold) + ' gold!'); Menus.render_shop(el);
      };
      box.appendChild(b);
      gp.appendChild(box);
    });
    const fg = U.$('#free-gift', el);
    if (fg) fg.onclick = () => { const g = P.claimFree(); if (g) { A.play('coin'); UI.toast('+' + g + ' gold!'); Menus.render_shop(el); } };
  };

  // =================================================================== QUESTS
  Menus.render_quests = function (el) {
    const avail = P.dailyAvailable();
    el.innerHTML = Menus.topbar() +
      '<div class="panel free-gift"><div class="gi">📅</div><div class="info"><b class="outl">Daily Login Reward</b><div class="refresh">Streak: day ' + (P.dailyIndex() + 1) + ' of 7</div></div>' +
      '<button class="btn small ' + (avail ? 'green' : 'gray') + '" id="q-daily">' + (avail ? 'Claim' : 'View') + '</button></div>' +
      '<div class="section-title outl">Achievements <small>' + Object.keys(P.data.claimed).length + ' / ' + P.ACHIEVEMENTS.length + '</small></div><div id="ach-list"></div>';
    U.$('#q-daily', el).onclick = () => { A.play('click'); Menus.dailyModal(); };
    const list = U.$('#ach-list', el);
    const items = P.ACHIEVEMENTS.slice().sort((a, b) => {
      const sa = P.data.claimed[a.id] ? 2 : P.statValue(a.stat) >= a.goal ? 0 : 1;
      const sb = P.data.claimed[b.id] ? 2 : P.statValue(b.stat) >= b.goal ? 0 : 1;
      return sa - sb;
    });
    for (const a of items) {
      const v = Math.min(P.statValue(a.stat), a.goal);
      const claimed = P.data.claimed[a.id];
      const ready = !claimed && v >= a.goal;
      const row = U.el('div', 'panel ach' + (claimed ? ' done' : ''));
      row.innerHTML = '<div class="medal">' + (claimed ? '✅' : ready ? '🏅' : '🎖️') + '</div><div class="info"><b class="outl">' + a.name + '</b><p>' + a.desc + '</p>' +
        '<div class="prog-bar ' + (ready || claimed ? 'green' : 'blue') + '"><i style="width:' + (v / a.goal * 100) + '%"></i><span>' + v + ' / ' + a.goal + '</span></div></div>';
      const b = U.el('button', 'btn small ' + (ready ? 'green' : 'gray'), claimed ? 'Done' : '💎 ' + a.gems);
      b.onclick = () => {
        if (!ready) { A.play('error'); return; }
        if (P.claimAchievement(a.id)) { A.play('coin'); UI.toast('+' + a.gems + ' gems!'); Menus.render_quests(el); Menus.updateBadges(); }
      };
      row.appendChild(b);
      list.appendChild(row);
    }
  };

  // =================================================================== PROFILE
  Menus.render_profile = function (el) {
    const d = P.data, s = d.stats;
    const winRate = s.battles ? Math.round(s.wins / s.battles * 100) : 0;
    el.innerHTML = Menus.topbar() +
      '<div class="section-title outl">Statistics</div><div class="stats-grid">' +
      [['Wins', s.wins], ['Losses', s.losses], ['Win rate', winRate + '%'], ['3-Crown wins', s.threeCrowns], ['Towers', s.towersDestroyed], ['Best 🏆', d.bestTrophies],
        ['Cards found', Object.keys(d.cards).length], ['Upgrades', s.upgrades], ['Chests', s.chestsOpened]]
        .map(([k, v]) => '<div class="panel stat-box"><b class="outl">' + v + '</b><small>' + k + '</small></div>').join('') + '</div>' +
      '<div class="section-title outl">Recent Battles</div><div id="hist">' +
      (d.history.length ? d.history.map((h) => '<div class="hist ' + (h.draw ? 'd' : h.won ? 'w' : 'l') + '"><span class="res outl">' + (h.draw ? 'Draw' : h.won ? 'Victory' : 'Defeat') + '</span><span class="cr">👑 ' + h.crowns + ' - ' + h.enemyCrowns + ' · ' + P.DIFF[h.diff].label + '</span><span>' + (h.trophies > 0 ? '+' : '') + h.trophies + ' 🏆</span></div>').join('') : '<p class="help muted">No battles yet. Go fight!</p>') + '</div>' +
      '<div class="section-title outl">Trophy Road</div><div class="arena-path">' +
      RR.Arenas.list.slice().reverse().map((a) => '<div class="panel arena-step ' + (a.id === P.arena().id ? 'cur' : d.trophies < a.trophies ? 'locked' : '') + '"><div class="sw" style="background:linear-gradient(135deg,' + a.theme.grassA + ',' + a.theme.water + ')"></div><div class="an outl">' + (a.id + 1) + '. ' + a.name + '</div><div class="disp">🏆 ' + a.trophies + '</div></div>').join('') + '</div>' +
      '<div class="section-title outl">Settings</div>' +
      '<div class="panel setting"><label class="outl">Name</label><input type="text" id="set-name" maxlength="16" value="' + escapeHtml(d.name) + '"></div>' +
      '<div class="panel setting"><label class="outl">🎵 Music</label><input type="range" id="set-music" min="0" max="1" step="0.05" value="' + d.settings.music + '"></div>' +
      '<div class="panel setting"><label class="outl">🔊 Sound FX</label><input type="range" id="set-sfx" min="0" max="1" step="0.05" value="' + d.settings.sfx + '"></div>' +
      '<div class="modal-actions" style="margin:12px 0"><button class="btn blue" id="how-btn">How to Play</button><button class="btn red" id="reset-btn">Reset Progress</button></div>';
    const nm = U.$('#set-name', el);
    nm.onchange = () => { d.name = nm.value.trim().slice(0, 16) || 'Champion'; P.save(); Menus.render_profile(el); };
    const mu = U.$('#set-music', el), sf = U.$('#set-sfx', el);
    mu.oninput = () => { d.settings.music = +mu.value; A.setVolumes(d.settings.sfx, d.settings.music); P.save(); };
    sf.oninput = () => { d.settings.sfx = +sf.value; A.setVolumes(d.settings.sfx, d.settings.music); P.save(); };
    sf.onchange = () => A.play('sword', 0);
    U.$('#how-btn', el).onclick = () => { A.play('click'); Menus.howToPlay(); };
    U.$('#reset-btn', el).onclick = () => UI.confirm('Reset Progress?', 'All cards, trophies, gold and gems will be lost forever.', 'Reset', () => { P.reset(); Menus.show('home'); UI.toast('Progress reset'); });
  };

  Menus.howToPlay = function (onClose) {
    UI.modal('<h2>How to Play</h2><div class="help">' +
      '<p>🏰 <b>Goal:</b> Destroy the enemy\'s <b>King Tower</b> for an instant win — or destroy more towers than your opponent before time runs out. Each tower = 1 crown.</p>' +
      '<p>💧 <b>Elixir</b> refills over time (max 10). Every card costs elixir. In the <b>last minute</b> elixir flows twice as fast!</p>' +
      '<p>🃏 <b>Deploy</b> by dragging a card onto your half of the arena — or tap a card, then tap the battlefield. Spells can go anywhere. Destroying an enemy Princess Tower lets you deploy deeper on that side.</p>' +
      '<p>⚔️ Troops march down the lanes, cross the bridges and attack whatever is closest. <b>Building-targeters</b> (like the Boulder Brute) ignore troops — distract them with buildings!</p>' +
      '<p>⏱️ Tied after 3 minutes? <b>Overtime</b>: the next tower destroyed wins (sudden death). Still tied? The side whose weakest tower has more health wins.</p>' +
      '<p>📈 Win battles for <b>trophies, gold and chests</b>. Upgrade cards, climb through 6 arenas, and unlock new cards!</p></div>' +
      '<div class="modal-actions"><button class="btn green" id="htp-ok">Let\'s go!</button></div>', { onClose });
    const ok = U.$('#htp-ok');
    if (ok) ok.onclick = () => { A.play('click'); UI.closeAllModals(); if (onClose) onClose(); };
  };

  RR.Menus = Menus;
})(window.RR);
