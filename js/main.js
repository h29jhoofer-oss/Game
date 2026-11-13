// Game bootstrap + main loop. Wires menus, battles, AI, progression and audio together.
(function (RR) {
  'use strict';
  const U = RR.U, P = RR.Profile, A = RR.Audio, Menus = RR.Menus, BUI = RR.BattleUI, UI = RR.UI;

  const ENEMY_NAMES = ['Baron Bramblebeard', 'Lady Ashcrown', 'Sir Gristlewick', 'Duchess Thornwhistle', 'Count Cobblebrow', 'Warlord Mudtusk',
    'Queen Frostmantle', 'Lord Emberjaw', 'Captain Pickleshanks', 'The Gilded Gnome', 'Marquis Mossbottom', 'Princess Pebblepaw'];

  const Game = { battle: null, last: 0, chestTick: 0 };

  Game.init = function () {
    P.load();
    A.setVolumes(P.data.settings.sfx, P.data.settings.music);
    BUI.init();
    U.$$('#nav button').forEach((b) => b.addEventListener('click', () => { A.play('tab'); Menus.show(b.dataset.tab); }));
    const unlock = () => { A.init(); A.setVolumes(P.data.settings.sfx, P.data.settings.music); if (!Game.battle) A.music('menu'); };
    window.addEventListener('pointerdown', unlock, { once: false, passive: true });
    window.addEventListener('keydown', unlock, { once: true });
    Menus.show('home');
    if (P.dailyAvailable() && P.data.stats.battles > 0) setTimeout(() => Menus.dailyModal(), 600);
    window.addEventListener('resize', () => { if (Menus.preview) Menus.preview.r.bg = null; });
    requestAnimationFrame(Game.loop);
  };

  Game.loop = function (ts) {
    const dt = Game.last ? Math.min(0.1, (ts - Game.last) / 1000) : 0.016;
    Game.last = ts;
    try {
      if (Game.battle) {
        if (!BUI.paused) Game.battle.update(dt);
        BUI.R.render(Game.battle, BUI.paused ? 0 : dt);
        BUI.update(dt);
      } else {
        Menus.tickPreview(dt);
        Game.chestTick += dt;
        if (Game.chestTick > 1) { Game.chestTick = 0; if (Menus.tab === 'home') Menus.renderChests(); }
      }
    } catch (err) { console.error(err); }
    requestAnimationFrame(Game.loop);
  };

  Game.setMusic = function (fast) { A.music('battle', fast); };

  Game.startBattle = function (difficulty) {
    if (Game.battle) return;
    A.init();
    const arena = P.arena();
    const D = P.DIFF[difficulty];
    const aiLevel = U.clamp(Math.round(P.avgLevel() + D.aiLevel), 1, RR.Cards.MAX_LEVEL);
    const maxArena = Math.min(RR.Arenas.list.length - 1, arena.id + (difficulty === 'hard' ? 1 : 0));
    const aiDeck = RR.AI.buildDeck(maxArena, aiLevel);
    const enemyKing = Math.max(1, P.data.kingLevel + D.kingOff);
    const ai = new RR.AI(1, difficulty, { skill: arena.id / 5 });
    const B = new RR.Battle({
      decks: [P.deckCards(), aiDeck.cards],
      kingLevels: [P.data.kingLevel, enemyKing],
      controllers: [null, ai],
    });
    Game.battle = B;
    Game.difficulty = difficulty;
    Game.resultDone = null;
    Menus.stopPreview();
    U.$('#screens').classList.add('hidden');
    U.$('#nav').classList.add('hidden');
    U.$('#screen-battle').classList.remove('hidden');
    BUI.start(B, { arena, enemyName: U.pick(ENEMY_NAMES), enemyKing, diffLabel: D.label, deckName: aiDeck.name });
    A.music('battle');
    if (!P.data.seenTutorial) {
      BUI.paused = true;
      P.data.seenTutorial = true; P.save();
      Menus.howToPlay(() => { BUI.paused = false; });
    }
  };

  Game.finishBattle = function (B) {
    if (Game.resultDone) return Game.resultDone;
    Game.resultDone = P.battleResult(B, Game.difficulty);
    return Game.resultDone;
  };

  Game.exitBattle = function (res) {
    Game.battle = null;
    BUI.B = null;
    UI.closeAllModals();
    U.$('#screen-battle').classList.add('hidden');
    U.$('#screens').classList.remove('hidden');
    U.$('#nav').classList.remove('hidden');
    A.music('menu');
    Menus.show('home');
    if (res && res.newArena) {
      setTimeout(() => {
        A.play('legendary');
        UI.modal('<h2>New Arena Unlocked!</h2><div style="text-align:center"><div class="disp outl" style="font-size:30px;margin:10px 0;color:#ffe066">' + res.newArena.name + '</div><p class="help">' + res.newArena.desc + '</p>' +
          (res.unlockedCard ? '<p class="help">You unlocked <b>' + RR.Cards.get(res.unlockedCard).name + '</b>! New cards from this arena can now appear in chests and the shop.</p>' : '') + '</div>');
      }, 300);
    } else if (res && res.kingUps && res.kingUps.length) {
      setTimeout(() => Menus.kingUpModal(res.kingUps[res.kingUps.length - 1]), 300);
    }
  };

  RR.Game = Game;
  window.addEventListener('DOMContentLoaded', Game.init);
})(window.RR);
