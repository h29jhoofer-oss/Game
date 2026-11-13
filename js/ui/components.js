// Shared UI building blocks: card elements, chest art, modals, toasts.
(function (RR) {
  'use strict';
  const U = RR.U, Cards = RR.Cards;
  const UI = {};

  UI.cardEl = function (id, o) {
    o = o || {};
    const c = Cards.get(id);
    const el = U.el('div', 'card r-' + c.rarity + (o.cls ? ' ' + o.cls : ''));
    el.dataset.id = id;
    el.innerHTML = '<div class="art" style="background-image:url(' + RR.CardArt.url(id) + ')"></div><div class="frame"></div>' +
      (o.noCost ? '' : '<div class="cost">' + c.cost + '</div>') +
      (o.level ? '<div class="lvl">Level ' + o.level + '</div>' : '') +
      (o.label ? '<div class="lvl">' + o.label + '</div>' : '');
    return el;
  };

  // ------------------------------------------------------------ chest art
  const chestCache = {};
  UI.chestUrl = function (type, open) {
    const key = type + (open ? '_o' : '');
    if (chestCache[key]) return chestCache[key];
    const ch = RR.Profile.CHESTS[type];
    const cv = document.createElement('canvas');
    cv.width = 200; cv.height = 170;
    const g = cv.getContext('2d');
    g.lineJoin = 'round';
    const base = ch.color;
    const dark = U.shade(base, -0.35), light = U.shade(base, 0.35);
    const OL = '#1c1a2b';
    const box = (x, y, w, h, r, fill) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = 6; g.strokeStyle = OL; g.stroke(); };
    // shadow
    g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(100, 158, 80, 10, 0, 0, 7); g.fill();
    if (open) {
      const gr = g.createRadialGradient(100, 70, 5, 100, 70, 90);
      gr.addColorStop(0, 'rgba(255,245,180,1)'); gr.addColorStop(1, 'rgba(255,245,180,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 200, 170);
    }
    // body
    const bodyGrad = g.createLinearGradient(0, 75, 0, 155);
    bodyGrad.addColorStop(0, base); bodyGrad.addColorStop(1, dark);
    box(28, 75, 144, 80, 12, bodyGrad);
    // planks
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3;
    for (let i = 1; i < 3; i++) { g.beginPath(); g.moveTo(30, 75 + i * 26); g.lineTo(170, 75 + i * 26); g.stroke(); }
    // bands
    const band = type === 'wooden' ? '#8a8f99' : type === 'magic' ? '#ffd23f' : type === 'legendary' ? '#ffffff' : type === 'golden' ? '#b8732a' : '#5d6675';
    box(46, 75, 18, 80, 4, band); box(136, 75, 18, 80, 4, band);
    // lid
    if (!open) {
      const lidGrad = g.createLinearGradient(0, 22, 0, 80);
      lidGrad.addColorStop(0, light); lidGrad.addColorStop(1, base);
      g.beginPath(); g.moveTo(24, 82); g.lineTo(24, 55); g.quadraticCurveTo(100, 5, 176, 55); g.lineTo(176, 82); g.closePath();
      g.fillStyle = lidGrad; g.fill(); g.lineWidth = 6; g.strokeStyle = OL; g.stroke();
      box(46, 32, 18, 50, 4, band); box(136, 32, 18, 50, 4, band);
      // lock
      box(86, 66, 28, 32, 6, '#ffd23f');
      g.fillStyle = OL; g.beginPath(); g.arc(100, 80, 4, 0, 7); g.fill(); g.fillRect(98, 80, 4, 9);
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(70, 42, 26, 7, -0.25, 0, 7); g.fill();
    } else {
      g.beginPath(); g.moveTo(24, 75); g.lineTo(40, 20); g.quadraticCurveTo(100, -10, 160, 20); g.lineTo(176, 75); g.closePath();
      g.fillStyle = dark; g.fill(); g.lineWidth = 6; g.strokeStyle = OL; g.stroke();
      g.fillStyle = '#fff6c0'; g.beginPath(); g.ellipse(100, 78, 64, 10, 0, 0, 7); g.fill();
    }
    if (type === 'magic' || type === 'legendary') {
      g.fillStyle = type === 'magic' ? '#ff8af5' : '#7ff6ff';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(30 + i * 28, 20 + (i % 2) * 18, 3, 0, 7); g.fill(); }
    }
    if (type === 'crown') {
      g.fillStyle = '#ffd23f'; g.strokeStyle = OL; g.lineWidth = 4;
      g.beginPath(); g.moveTo(80, 120); g.lineTo(80, 100); g.lineTo(90, 110); g.lineTo(100, 96); g.lineTo(110, 110); g.lineTo(120, 100); g.lineTo(120, 120); g.closePath(); g.fill(); g.stroke();
    }
    chestCache[key] = cv.toDataURL();
    return chestCache[key];
  };

  // ------------------------------------------------------------ modal
  UI.modal = function (content, opts) {
    opts = opts || {};
    const root = U.$('#modal-root');
    const back = U.el('div', 'modal-back');
    const m = U.el('div', 'modal' + (opts.cls ? ' ' + opts.cls : ''));
    if (!opts.noClose) {
      const x = U.el('button', 'iconbtn close', '✕');
      x.onclick = () => { RR.Audio.play('click'); close(); };
      m.appendChild(x);
    }
    if (typeof content === 'string') m.insertAdjacentHTML('beforeend', content); else m.appendChild(content);
    back.appendChild(m);
    root.appendChild(back);
    function close() { if (back.parentNode) back.parentNode.removeChild(back); if (opts.onClose) opts.onClose(); }
    if (!opts.noClose) back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
    return { el: m, back, close };
  };
  UI.closeAllModals = function () { U.$('#modal-root').innerHTML = ''; };

  let toastTimer = null;
  UI.toast = function (msg, err) {
    const t = U.$('#toast');
    t.textContent = msg;
    t.className = 'show' + (err ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = ''; }, 1800);
  };

  UI.confirm = function (title, text, okLabel, onOk, onCancel) {
    let done = false;
    const m = UI.modal('<h2>' + title + '</h2><p class="help" style="text-align:center">' + text + '</p><div class="modal-actions"><button class="btn gray" data-a="no">Cancel</button><button class="btn red" data-a="yes">' + okLabel + '</button></div>',
      { onClose: () => { if (!done && onCancel) onCancel(); } });
    m.el.querySelector('[data-a=no]').onclick = () => { RR.Audio.play('click'); m.close(); };
    m.el.querySelector('[data-a=yes]').onclick = () => { RR.Audio.play('click'); done = true; m.close(); onOk(); };
  };

  // ------------------------------------------------------------ chest opening sequence
  UI.openChestSequence = function (loot, onDone) {
    const wrap = U.el('div', 'chest-open');
    const m = UI.modal(wrap, { noClose: true });
    const stacks = loot.stacks.slice();
    let stage = 'closed';
    const total = stacks.length;
    function render() {
      wrap.innerHTML = '';
      if (stage === 'closed') {
        wrap.innerHTML = '<div class="glow-burst"></div><h2>' + RR.Profile.CHESTS[loot.type].name + '</h2><img class="big-chest" src="' + UI.chestUrl(loot.type) + '"><div class="left">Tap to open!</div>';
        return;
      }
      if (stage === 'gold') {
        wrap.innerHTML = '<div class="glow-burst"></div><img src="' + UI.chestUrl(loot.type, true) + '" style="width:150px;height:128px"><div class="reveal"><div style="font-size:64px">💰</div><div class="rcount disp outl">+' + U.fmtNum(loot.gold) + ' Gold</div>' +
          (loot.gems ? '<div class="rname disp outl">💎 +' + loot.gems + ' Gems</div>' : '') + '</div><div class="left">' + total + ' card stacks inside — tap!</div>';
        RR.Audio.play('coin');
        return;
      }
      if (stage === 'card') {
        const s = stacks.shift();
        const c = Cards.get(s.id);
        const rar = Cards.RARITY[c.rarity];
        wrap.innerHTML = '<div class="glow-burst" style="background:radial-gradient(circle, ' + U.rgba(rar.color, 0.7) + ', transparent 65%)"></div>';
        const rv = U.el('div', 'reveal');
        const ce = UI.cardEl(s.id);
        if (s.isNew) ce.insertAdjacentHTML('beforeend', '<div class="newtag">NEW!</div>');
        rv.appendChild(ce);
        rv.insertAdjacentHTML('beforeend', '<div class="rcount disp outl">x' + s.n + '</div><div class="rname disp outl" style="color:' + rar.color + '">' + c.name + '</div><div class="disp" style="color:' + rar.color + '">' + rar.name + '</div>');
        wrap.appendChild(rv);
        wrap.insertAdjacentHTML('beforeend', '<div class="left">' + stacks.length + ' left</div>');
        RR.Audio.play(c.rarity === 'legendary' ? 'legendary' : 'reveal');
        return;
      }
      if (stage === 'summary') {
        wrap.insertAdjacentHTML('beforeend', '<h2>Rewards</h2><div class="loot-coins"><span>💰 ' + U.fmtNum(loot.gold) + '</span>' + (loot.gems ? '<span>💎 ' + loot.gems + '</span>' : '') + '</div>');
        const grid = U.el('div', 'loot-summary');
        for (const s of loot.stacks) {
          const ce = UI.cardEl(s.id);
          ce.insertAdjacentHTML('beforeend', '<div class="qty outl">x' + s.n + '</div>' + (s.isNew ? '<div class="newtag">NEW!</div>' : ''));
          grid.appendChild(ce);
        }
        wrap.appendChild(grid);
        const b = U.el('button', 'btn green', 'Collect');
        b.onclick = () => { RR.Audio.play('click'); m.close(); if (onDone) onDone(); };
        wrap.appendChild(b);
      }
    }
    wrap.addEventListener('click', () => {
      if (stage === 'summary') return;
      if (stage === 'closed') { stage = 'gold'; RR.Audio.play('chest'); }
      else if (stage === 'gold' || stage === 'card') stage = stacks.length ? 'card' : 'summary';
      render();
    });
    render();
  };

  RR.UI = UI;
})(window.RR);
