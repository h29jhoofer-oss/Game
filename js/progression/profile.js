// Player profile & progression: currencies, collection, decks, chests, king level,
// trophies/arenas, achievements, daily login rewards and the daily shop. Persisted to localStorage.
(function (RR) {
  'use strict';
  const U = RR.U, Cards = RR.Cards, Arenas = RR.Arenas;
  const KEY = 'rampart_rush_save_v1';

  const CHESTS = {
    wooden: { name: 'Wooden Chest', time: 15, gold: [20, 40], cards: 5, stacks: 2, color: '#b07a45', gems: 0 },
    silver: { name: 'Silver Chest', time: 60, gold: [50, 90], cards: 12, stacks: 3, color: '#c6d2de', gems: 0 },
    golden: { name: 'Golden Chest', time: 180, gold: [150, 260], cards: 30, stacks: 4, color: '#f2c14e', gems: 2, minRare: true },
    magic: { name: 'Magic Chest', time: 480, gold: [400, 650], cards: 70, stacks: 5, color: '#b34ee8', gems: 5, minEpic: true },
    crown: { name: 'Crown Chest', time: 0, gold: [120, 220], cards: 25, stacks: 4, color: '#3d8bff', gems: 5, minRare: true },
    legendary: { name: 'Legendary Chest', time: 900, gold: [300, 500], cards: 40, stacks: 4, color: '#3fe0c8', gems: 10, legendary: true },
  };
  const CHEST_CYCLE = ['silver', 'silver', 'wooden', 'golden', 'silver', 'wooden', 'silver', 'magic', 'silver', 'golden', 'wooden', 'silver', 'silver', 'golden', 'silver', 'legendary'];
  const KING_XP = [0, 20, 55, 110, 190, 300, 450, 650, 900, 1250, 1700, 2300, 3000];
  const DAILY = [
    { gold: 60, label: '60 Gold' }, { gems: 10, label: '10 Gems' }, { chest: 'silver', label: 'Silver Chest' },
    { gold: 150, label: '150 Gold' }, { gems: 20, label: '20 Gems' }, { gold: 300, label: '300 Gold' }, { chest: 'magic', label: 'Magic Chest' },
  ];
  const DIFF = {
    easy: { label: 'Easy', winT: 22, lossT: 10, gold: 0.8, aiLevel: -1, kingOff: -1 },
    medium: { label: 'Medium', winT: 30, lossT: 18, gold: 1.0, aiLevel: 0, kingOff: 0 },
    hard: { label: 'Hard', winT: 40, lossT: 22, gold: 1.4, aiLevel: 1, kingOff: 1 },
  };

  const ACHIEVEMENTS = [
    { id: 'win1', name: 'First Blood', desc: 'Win your first battle', stat: 'wins', goal: 1, gems: 20 },
    { id: 'win10', name: 'Seasoned Warlord', desc: 'Win 10 battles', stat: 'wins', goal: 10, gems: 50 },
    { id: 'win50', name: 'Conqueror', desc: 'Win 50 battles', stat: 'wins', goal: 50, gems: 150 },
    { id: 'three', name: 'Royal Flush', desc: 'Win with 3 crowns', stat: 'threeCrowns', goal: 1, gems: 30 },
    { id: 'three10', name: 'Crown Collector', desc: 'Win 10 battles with 3 crowns', stat: 'threeCrowns', goal: 10, gems: 80 },
    { id: 'tow25', name: 'Wall Breaker', desc: 'Destroy 25 towers', stat: 'towersDestroyed', goal: 25, gems: 40 },
    { id: 'tow100', name: 'Siege Master', desc: 'Destroy 100 towers', stat: 'towersDestroyed', goal: 100, gems: 120 },
    { id: 'up1', name: 'Getting Stronger', desc: 'Upgrade a card', stat: 'upgrades', goal: 1, gems: 10 },
    { id: 'up25', name: 'Master Smith', desc: 'Upgrade cards 25 times', stat: 'upgrades', goal: 25, gems: 80 },
    { id: 'chest10', name: 'Treasure Hunter', desc: 'Open 10 chests', stat: 'chestsOpened', goal: 10, gems: 40 },
    { id: 'play300', name: 'Tactician', desc: 'Deploy 300 cards in battle', stat: 'cardsPlayed', goal: 300, gems: 60 },
    { id: 'hard1', name: 'Giant Slayer', desc: 'Defeat the Hard AI', stat: 'hardWins', goal: 1, gems: 50 },
    { id: 'coll20', name: 'Collector', desc: 'Unlock 20 different cards', stat: 'unlocked', goal: 20, gems: 80 },
    { id: 'arena1', name: 'Into the Woods', desc: 'Reach Whisperwood', stat: 'arena', goal: 1, gems: 30 },
    { id: 'arena3', name: 'Through the Fire', desc: 'Reach Ember Canyon', stat: 'arena', goal: 3, gems: 60 },
    { id: 'arena5', name: 'Legend of the Summit', desc: 'Reach Crown Summit', stat: 'arena', goal: 5, gems: 200 },
  ];

  function fresh() {
    const cards = {};
    for (const id of Cards.starterDeck) cards[id] = { level: 1, count: 0 };
    cards.bone_rattlers = { level: 1, count: 0 };
    cards.powder_gnome = { level: 1, count: 0 };
    return {
      v: 1, name: 'Champion', gold: 200, gems: 40, xp: 0, kingLevel: 1, trophies: 0, bestTrophies: 0,
      cards, decks: [Cards.starterDeck.slice(), Cards.starterDeck.slice(), Cards.starterDeck.slice()], activeDeck: 0,
      chests: [{ type: 'wooden', unlockAt: null }, null, null, null], chestIdx: 0, crowns: 0,
      stats: { wins: 0, losses: 0, draws: 0, battles: 0, threeCrowns: 0, towersDestroyed: 0, cardsPlayed: 0, upgrades: 0, chestsOpened: 0, hardWins: 0 },
      claimed: {}, daily: { last: null, streak: 0 }, shop: null, maxArena: 0,
      settings: { sfx: 0.8, music: 0.5, difficulty: 'medium' }, seenTutorial: false, history: [],
    };
  }

  const P = {
    data: null, CHESTS, ACHIEVEMENTS, DAILY, DIFF, KING_XP,

    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const d = JSON.parse(raw);
          const f = fresh();
          P.data = Object.assign(f, d);
          P.data.stats = Object.assign(f.stats, d.stats || {});
          P.data.settings = Object.assign(f.settings, d.settings || {});
          // sanitize decks
          P.data.decks = P.data.decks.map((dk) => (Array.isArray(dk) && dk.length === 8 && dk.every((id) => P.data.cards[id]) ? dk : Cards.starterDeck.slice()));
        } else P.data = fresh();
      } catch (e) { P.data = fresh(); }
      return P.data;
    },
    save() { try { localStorage.setItem(KEY, JSON.stringify(P.data)); } catch (e) { /* storage unavailable */ } },
    reset() { P.data = fresh(); P.save(); },

    get deck() { return P.data.decks[P.data.activeDeck]; },
    arena() { return Arenas.forTrophies(P.data.trophies); },
    owned(id) { return !!P.data.cards[id]; },
    level(id) { return P.data.cards[id] ? P.data.cards[id].level : 1; },
    deckCards() { return P.deck.map((id) => ({ id, level: P.level(id) })); },
    avgElixir(deck) { deck = deck || P.deck; return deck.reduce((s, id) => s + Cards.get(id).cost, 0) / deck.length; },
    avgLevel() { return P.deck.reduce((s, id) => s + P.level(id), 0) / 8; },
    xpForNext() { return KING_XP[P.data.kingLevel] || Infinity; },

    setDeckCard(slot, id) {
      const dk = P.deck;
      const existing = dk.indexOf(id);
      if (existing >= 0) { dk[existing] = dk[slot]; }
      dk[slot] = id;
      P.save();
    },

    addXp(n) {
      const d = P.data;
      d.xp += n;
      const ups = [];
      while (d.xp >= (KING_XP[d.kingLevel] || Infinity)) {
        d.kingLevel++;
        d.gems += 10; d.gold += 100;
        ups.push(d.kingLevel);
      }
      return ups;
    },

    addCards(id, n) {
      const d = P.data;
      const isNew = !d.cards[id];
      if (isNew) d.cards[id] = { level: 1, count: 0 };
      d.cards[id].count += n;
      return isNew;
    },

    canUpgrade(id) {
      const c = d0(id);
      if (!c) return false;
      const card = Cards.get(id);
      return c.level < Cards.MAX_LEVEL && c.count >= Cards.cardsToUpgrade(card, c.level) && P.data.gold >= Cards.goldToUpgrade(c.level);
    },
    upgrade(id) {
      if (!P.canUpgrade(id)) return null;
      const c = d0(id), card = Cards.get(id);
      c.count -= Cards.cardsToUpgrade(card, c.level);
      P.data.gold -= Cards.goldToUpgrade(c.level);
      const xp = Cards.xpForUpgrade(c.level);
      c.level++;
      P.data.stats.upgrades++;
      const ups = P.addXp(xp);
      P.save();
      return { level: c.level, xp, kingUps: ups };
    },

    // --------------------------------------------------- chests
    chestPool(arenaId) {
      return Cards.list().filter((c) => c.arena <= arenaId);
    },
    rollChest(type) {
      const ch = CHESTS[type];
      const ar = P.arena().id;
      const mul = 1 + ar * 0.35;
      const gold = Math.round(U.randInt(ch.gold[0], ch.gold[1]) * mul);
      const total = Math.round(ch.cards * mul);
      const pool = P.chestPool(ar);
      const byR = (r) => pool.filter((c) => c.rarity === r);
      const stacks = [];
      const used = new Set();
      const rollR = (i) => {
        if (ch.legendary && i === 0) return 'legendary';
        if (ch.minEpic && i === 0) return 'epic';
        if (ch.minRare && i === 0) return 'rare';
        const r = Math.random();
        return r < 0.012 ? 'legendary' : r < 0.07 ? 'epic' : r < 0.3 ? 'rare' : 'common';
      };
      let remaining = total;
      for (let i = 0; i < ch.stacks; i++) {
        let rar = rollR(i);
        let choices = byR(rar).filter((c) => !used.has(c.id));
        while (!choices.length && rar !== 'common') { rar = rar === 'legendary' ? 'epic' : rar === 'epic' ? 'rare' : 'common'; choices = byR(rar).filter((c) => !used.has(c.id)); }
        if (!choices.length) break;
        // bias towards cards the player doesn't own yet now and then
        const unowned = choices.filter((c) => !P.owned(c.id));
        const card = unowned.length && Math.random() < 0.35 ? U.pick(unowned) : U.pick(choices);
        used.add(card.id);
        const share = i === ch.stacks - 1 ? remaining : Math.max(1, Math.round(remaining * U.rand(0.3, 0.55)));
        remaining -= share;
        const div = { common: 1, rare: 3.5, epic: 12, legendary: 30 }[card.rarity];
        stacks.push({ id: card.id, n: Math.max(1, Math.round(share / div)) });
      }
      stacks.sort((a, b) => Cards.RARITY[Cards.get(a.id).rarity].order - Cards.RARITY[Cards.get(b.id).rarity].order);
      return { type, gold, gems: ch.gems ? U.randInt(Math.ceil(ch.gems / 2), ch.gems) : 0, stacks };
    },
    applyLoot(loot) {
      const d = P.data;
      d.gold += loot.gold; d.gems += loot.gems;
      for (const s of loot.stacks) s.isNew = P.addCards(s.id, s.n);
      d.stats.chestsOpened++;
      P.save();
      return loot;
    },
    nextChestType() {
      const d = P.data;
      const t = CHEST_CYCLE[d.chestIdx % CHEST_CYCLE.length];
      d.chestIdx++;
      return t;
    },
    grantChest() {
      const slot = P.data.chests.findIndex((c) => !c);
      if (slot < 0) return null;
      const type = P.nextChestType();
      P.data.chests[slot] = { type, unlockAt: null };
      return type;
    },
    chestState(ch) {
      if (!ch) return 'empty';
      if (ch.unlockAt == null) return 'locked';
      return Date.now() >= ch.unlockAt ? 'ready' : 'unlocking';
    },
    anyUnlocking() { return P.data.chests.some((c) => c && c.unlockAt != null && Date.now() < c.unlockAt); },
    startUnlock(i) {
      const ch = P.data.chests[i];
      if (!ch || ch.unlockAt != null || P.anyUnlocking()) return false;
      ch.unlockAt = Date.now() + CHESTS[ch.type].time * 1000;
      P.save();
      return true;
    },
    skipCost(i) {
      const ch = P.data.chests[i];
      if (!ch) return 0;
      const rem = ch.unlockAt == null ? CHESTS[ch.type].time : Math.max(0, (ch.unlockAt - Date.now()) / 1000);
      return Math.max(1, Math.ceil(rem / 60) * 2);
    },
    openChest(i, payGems) {
      const ch = P.data.chests[i];
      if (!ch) return null;
      const st = P.chestState(ch);
      if (st !== 'ready') {
        if (!payGems) return null;
        const cost = P.skipCost(i);
        if (P.data.gems < cost) return null;
        P.data.gems -= cost;
      }
      P.data.chests[i] = null;
      return P.applyLoot(P.rollChest(ch.type));
    },

    // --------------------------------------------------- battle results
    battleResult(B, difficulty) {
      const d = P.data, df = DIFF[difficulty];
      const won = B.winner === 0, draw = B.winner === -1;
      const crowns = B.players[0].crowns;
      const before = P.arena();
      const r = { won, draw, crowns, enemyCrowns: B.players[1].crowns, trophies: 0, gold: 0, xp: 0, chest: null, kingUps: [], newArena: null, crownChestReady: false, unlockedCard: null };
      d.stats.battles++;
      d.stats.cardsPlayed += B.stats.cardsPlayed[0];
      d.stats.towersDestroyed += B.stats.towersDestroyed[0];
      if (won) {
        d.stats.wins++;
        if (crowns >= 3) d.stats.threeCrowns++;
        if (difficulty === 'hard') d.stats.hardWins++;
        r.trophies = df.winT + U.randInt(-2, 2);
        r.gold = Math.round((18 + before.id * 8 + crowns * 4) * df.gold);
        r.xp = 10;
        r.chest = P.grantChest();
      } else if (draw) {
        d.stats.draws++;
        r.xp = 4; r.gold = Math.round(6 * df.gold);
      } else {
        d.stats.losses++;
        r.trophies = -Math.min(d.trophies, df.lossT + U.randInt(-2, 2));
        r.xp = 3;
      }
      const prevCrowns = d.crowns;
      d.crowns = Math.min(10, d.crowns + crowns);
      r.crownChestReady = d.crowns >= 10 && prevCrowns < 10;
      d.trophies = Math.max(0, d.trophies + r.trophies);
      d.bestTrophies = Math.max(d.bestTrophies, d.trophies);
      d.gold += r.gold;
      r.kingUps = P.addXp(r.xp);
      const after = P.arena();
      if (after.id > d.maxArena) {
        d.maxArena = after.id;
        r.newArena = after;
        // arena reward: a brand new card from the arena
        const fresh = Cards.list().filter((c) => c.arena === after.id && !P.owned(c.id));
        if (fresh.length) {
          const c = U.pick(fresh.sort((a, b) => Cards.RARITY[a.rarity].order - Cards.RARITY[b.rarity].order).slice(0, 3));
          P.addCards(c.id, 1);
          r.unlockedCard = c.id;
        }
        d.gems += 20;
      }
      d.history.unshift({ won, draw, crowns, enemyCrowns: B.players[1].crowns, diff: difficulty, t: Date.now(), trophies: r.trophies });
      d.history = d.history.slice(0, 15);
      P.save();
      return r;
    },
    claimCrownChest() {
      if (P.data.crowns < 10) return null;
      P.data.crowns = 0;
      return P.applyLoot(P.rollChest('crown'));
    },

    // --------------------------------------------------- achievements
    statValue(stat) {
      if (stat === 'unlocked') return Object.keys(P.data.cards).length;
      if (stat === 'arena') return P.data.maxArena;
      return P.data.stats[stat] || 0;
    },
    achievementsReady() { return ACHIEVEMENTS.filter((a) => !P.data.claimed[a.id] && P.statValue(a.stat) >= a.goal).length; },
    claimAchievement(id) {
      const a = ACHIEVEMENTS.find((x) => x.id === id);
      if (!a || P.data.claimed[id] || P.statValue(a.stat) < a.goal) return false;
      P.data.claimed[id] = true;
      P.data.gems += a.gems;
      P.save();
      return true;
    },

    // --------------------------------------------------- daily
    dayNumber(d) { const x = d ? new Date(d) : new Date(); return Math.floor((x.getTime() - x.getTimezoneOffset() * 60000) / 86400000); },
    dailyAvailable() { return P.data.daily.last !== P.dayNumber(); },
    dailyIndex() {
      const dl = P.data.daily;
      const today = P.dayNumber();
      if (dl.last == null || today - dl.last > 1) return 0;
      return dl.streak % 7;
    },
    claimDaily() {
      if (!P.dailyAvailable()) return null;
      const dl = P.data.daily;
      const today = P.dayNumber();
      if (dl.last == null || today - dl.last > 1) dl.streak = 0;
      const idx = dl.streak % 7;
      const rw = DAILY[idx];
      dl.streak++; dl.last = today;
      let loot = null;
      if (rw.gold) P.data.gold += rw.gold;
      if (rw.gems) P.data.gems += rw.gems;
      if (rw.chest) loot = P.applyLoot(P.rollChest(rw.chest));
      P.save();
      return { reward: rw, loot, idx };
    },

    // --------------------------------------------------- shop
    PRICE: { common: [10, 6], rare: [5, 50], epic: [1, 400], legendary: [1, 3000] },
    shop() {
      const today = P.dayNumber();
      if (!P.data.shop || P.data.shop.day !== today) {
        const pool = P.chestPool(P.arena().id);
        const rnd = U.seeded(today * 7 + 3);
        const pick = (filter) => { const p = pool.filter(filter); return p[Math.floor(rnd() * p.length)]; };
        const offers = [];
        const used = new Set();
        const add = (c) => {
          if (!c || used.has(c.id)) return;
          used.add(c.id);
          const [n, price] = P.PRICE[c.rarity];
          offers.push({ id: c.id, n, price: n * price, bought: false });
        };
        add(pick((c) => c.rarity === 'common'));
        add(pick((c) => c.rarity === 'common' && !used.has(c.id)));
        add(pick((c) => c.rarity === 'rare'));
        add(pick((c) => c.rarity === 'epic' || c.rarity === 'rare'));
        add(pick((c) => !P.owned(c.id)) || pick(() => true));
        add(pick((c) => c.rarity === 'legendary') || pick((c) => c.rarity === 'epic'));
        P.data.shop = { day: today, offers, freeClaimed: false };
        P.save();
      }
      return P.data.shop;
    },
    buyOffer(i) {
      const s = P.shop(), o = s.offers[i];
      if (!o || o.bought || P.data.gold < o.price) return false;
      P.data.gold -= o.price;
      o.bought = true;
      P.addCards(o.id, o.n);
      P.save();
      return true;
    },
    CHEST_PRICES: { silver: 12, golden: 45, magic: 120, legendary: 300 },
    buyChest(type) {
      const price = P.CHEST_PRICES[type];
      if (P.data.gems < price) return null;
      P.data.gems -= price;
      return P.applyLoot(P.rollChest(type));
    },
    GOLD_PACKS: [{ gems: 20, gold: 250 }, { gems: 60, gold: 900 }, { gems: 150, gold: 2600 }],
    buyGold(i) {
      const p = P.GOLD_PACKS[i];
      if (!p || P.data.gems < p.gems) return false;
      P.data.gems -= p.gems; P.data.gold += p.gold; P.save();
      return true;
    },
    claimFree() {
      const s = P.shop();
      if (s.freeClaimed) return null;
      s.freeClaimed = true;
      const gold = 40 + P.arena().id * 20;
      P.data.gold += gold;
      P.save();
      return gold;
    },
  };
  function d0(id) { return P.data.cards[id]; }

  RR.Profile = P;
})(window.RR);
