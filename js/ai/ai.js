// Computer opponent. It reads the battlefield every decision tick, evaluates threats per lane,
// scores every card in hand as a counter, values spells by what they would kill, builds pushes
// around win conditions, supports counter-attacks and manages elixir according to difficulty.
(function (RR) {
  'use strict';
  const U = RR.U, M = RR.Map, Cards = RR.Cards;

  const DIFF = {
    easy: { think: 1.5, defendProb: 0.6, mistake: 0.25, pushAt: [5, 10], reserve: 0, spellThr: 2.2, support: 0.35, finish: false, predict: 0, cycleLeak: false, dumbDelay: 0.8 },
    medium: { think: 0.85, defendProb: 0.92, mistake: 0.06, pushAt: [6.5, 9], reserve: 0, spellThr: 1.4, support: 0.7, finish: true, predict: 0.5, cycleLeak: true, dumbDelay: 0.25 },
    hard: { think: 0.4, defendProb: 1, mistake: 0, pushAt: [7, 9.5], reserve: 2, spellThr: 1.05, support: 1, finish: true, predict: 1, cycleLeak: true, dumbDelay: 0 },
  };

  // value of a single unit in elixir
  const unitValue = (e) => (e.kind === 'tower' ? 0 : e.card.cost / (e.card.count || 1) * (e.card.token ? 0 : 1) + (e.card.token ? 1.5 : 0));
  const dps = (c, lv) => (c.hitSpeed ? Cards.stat(c, 'dmg', lv) / c.hitSpeed : 0) * (c.count || 1) * (c.ramp ? 5 : 1);

  class AI {
    constructor(team, difficulty, opts) {
      this.team = team;
      this.diffName = difficulty;
      this.P = Object.assign({}, DIFF[difficulty] || DIFF.medium);
      opts = opts || {};
      // arena progression makes even the same difficulty sharper
      const sk = U.clamp(opts.skill || 0, 0, 1);
      this.P.think *= 1 - sk * 0.3;
      this.P.mistake *= 1 - sk * 0.5;
      this.timer = 1.5 + Math.random();
      this.pushThreshold = U.rand(this.P.pushAt[0], this.P.pushAt[1]);
      this.lastPlayT = 0;
      this.pushLane = Math.random() < 0.5 ? 0 : 1;
    }

    // ---- coordinate helpers: AI reasons in "top-side" coords (own king at rel y ~2.8)
    abs(x, ry) { return this.team === 1 ? [x, ry] : [M.W - x, M.H - ry]; }
    rel(e) { return this.team === 1 ? e.y : M.H - e.y; }
    relX(e) { return this.team === 1 ? e.x : M.W - e.x; }
    laneOf(e) { return this.relX(e) < M.W / 2 ? 0 : 1; }
    laneX(l) { return l === 0 ? 3.5 : 14.5; }

    update(dt, B) {
      this.timer -= dt;
      if (this.timer > 0) return;
      this.timer = this.P.think * U.rand(0.8, 1.25);
      if (B.phase !== 'regular' && B.phase !== 'overtime') return;
      try { this.think(B); } catch (err) { console.error('AI error', err); }
    }

    hand(B) {
      const p = B.players[this.team];
      return p.hand.map((s, i) => ({ idx: i, card: Cards.get(s.id), level: s.level })).filter((h) => h.card);
    }

    play(B, h, x, y) {
      let pos = [x, y];
      if (!M.canDeploy(B, this.team, h.card, x, y)) pos = M.snapDeploy(B, this.team, h.card, x, y);
      if (!pos) return false;
      const ok = B.playCard(this.team, h.idx, pos[0], pos[1]);
      if (ok) { this.timer = Math.max(this.timer, this.P.think * 0.6 + this.P.dumbDelay); this.lastPlayT = B.elapsed; }
      return ok;
    }

    analyze(B) {
      const me = this.team;
      const threats = [[], []];
      const myPush = [[], []];
      for (const e of B.entities) {
        if (e.dead) continue;
        const ry = this.rel(e);
        if (e.team !== me) {
          if (e.kind === 'troop' && !e.burrow && ry < 21) threats[this.laneOf(e)].push(e);
          else if (e.kind === 'troop' && e.burrow) threats[this.laneOf({ x: e.burrow.tx, y: e.burrow.ty })].push(e);
          else if (e.kind === 'building' && !e.card.trap && (ry < 15 || (e.target && e.target.team === me && e.target.kind === 'tower'))) threats[this.laneOf(e)].push(e);
        } else if (e.kind === 'troop' && ry > 11) {
          myPush[this.laneOf(e)].push(e);
        }
      }
      const val = (arr) => arr.reduce((s, e) => s + unitValue(e), 0);
      return {
        threats, myPush,
        threatVal: [val(threats[0]), val(threats[1])],
        pushVal: [val(myPush[0]), val(myPush[1])],
      };
    }

    think(B) {
      const me = this.team, P = this.P;
      const player = B.players[me];
      const elixir = player.elixir;
      const hand = this.hand(B).filter((h) => h.card.cost <= elixir);
      if (!hand.length) return;
      const A = this.analyze(B);

      // Easy AI sometimes just does something silly
      if (Math.random() < P.mistake) {
        const h = U.pick(hand);
        const lane = U.randInt(0, 1);
        const [x, y] = this.abs(this.laneX(lane) + U.rand(-2, 2), U.rand(4, 13));
        if (h.card.type === 'spell') {
          const enemies = B.enemiesOf(me).filter((e) => e.kind !== 'tower');
          const tgt = enemies.length ? U.pick(enemies) : B.towers[1 - me][1 + lane];
          if (tgt && !tgt.dead) this.play(B, h, tgt.x + U.rand(-1.5, 1.5), tgt.y + U.rand(-1.5, 1.5));
        } else this.play(B, h, x, y);
        return;
      }

      // 1. finish a low tower with a spell
      if (P.finish && this.tryFinishTower(B, hand)) return;

      // 2. defend the most threatened lane
      const lane = A.threatVal[0] >= A.threatVal[1] ? 0 : 1;
      const tv = A.threatVal[lane];
      if (tv > 0 && Math.random() < P.defendProb) {
        // only react once the threat is close enough or is a big push
        const closest = Math.min(...A.threats[lane].map((e) => this.rel(e)));
        if (closest < 17.5 || tv >= 7) {
          if (this.defend(B, hand, A, lane)) return;
        }
      }
      // 2b. value spells anywhere (e.g. enemy support troops bunched behind a tank)
      if (this.trySpellValue(B, hand, P.spellThr * 1.15, false)) return;

      // 3. support an existing push / counter-attack
      const pushLane = A.pushVal[0] >= A.pushVal[1] ? 0 : 1;
      if (A.pushVal[pushLane] >= 3 && Math.random() < P.support) {
        const reserve = B.doubleElixir ? 0 : P.reserve;
        if (elixir - reserve >= 3 && this.support(B, hand, A, pushLane)) return;
      }

      // 4. start a push when elixir is high
      const threshold = B.doubleElixir ? Math.max(5, this.pushThreshold - 3) : this.pushThreshold;
      if (elixir >= threshold && tv === 0) {
        if (this.startPush(B, hand, A)) { this.pushThreshold = U.rand(P.pushAt[0], P.pushAt[1]); return; }
      }
      // 5. avoid leaking elixir
      if (elixir >= 9.8 && P.cycleLeak) {
        const cheap = hand.filter((h) => h.card.type !== 'spell').sort((a, b) => a.card.cost - b.card.cost)[0];
        if (cheap) {
          const l = this.weakEnemyLane(B);
          const [x, y] = cheap.card.type === 'building' ? this.abs(9 + (l ? 1.5 : -1.5), 9) : this.abs(this.laneX(l) + (l ? -1 : 1), 3.5);
          this.play(B, cheap, x, y);
        }
      } else if (elixir >= 9.8) {
        const h = U.pick(hand.filter((x) => x.card.type !== 'spell') || hand);
        if (h) { const [x, y] = this.abs(this.laneX(U.randInt(0, 1)), U.rand(8, 14)); this.play(B, h, x, y); }
      }
    }

    weakEnemyLane(B) {
      const et = B.towers[1 - this.team];
      const l = et[1], r = et[2];
      if (l.dead && !r.dead) return this.team === 1 ? 0 : 1;
      if (r.dead && !l.dead) return this.team === 1 ? 1 : 0;
      const lp = l.hp / l.maxHp, rp = r.hp / r.maxHp;
      // map world lanes to AI-relative lanes
      const worldLane = lp <= rp ? 0 : 1;
      return this.team === 1 ? worldLane : 1 - worldLane;
    }

    // --- spells -------------------------------------------------------------
    spellValueAt(B, card, level, x, y) {
      const dmg = Cards.stat(card, 'dmg', level) * (card.waves || 1);
      const r = card.radius || 2;
      let v = 0, n = 0;
      for (const e of B.enemiesOf(this.team)) {
        if (e.dead || e.untargetable) continue;
        if (Math.hypot(e.x - x, e.y - y) > r + e.radius * 0.5) continue;
        if (e.kind === 'tower') { v += Math.min(1, dmg * card.crownMul / e.hp) * 4 + dmg * card.crownMul / 600; continue; }
        n++;
        const uv = unitValue(e);
        if (dmg >= e.hp) v += uv; else v += uv * (dmg / e.hp) * 0.45;
        if (card.stun || card.slow) v += uv * 0.15;
      }
      return { v, n };
    }

    bestSpellSpot(B, card, level, candidates) {
      let best = null;
      for (const e of candidates) {
        // lead the target a little in its movement direction
        let x = e.x, y = e.y;
        if (card.travel && e.kind === 'troop' && e.speed) {
          const t = Math.hypot(x - B.towers[this.team][0].x, y - B.towers[this.team][0].y) / card.travel;
          const dir = M.forward(e.team) * this.P.predict;
          y += dir * e.speed * t * 0.8;
        }
        const s = this.spellValueAt(B, card, level, x, y);
        if (!best || s.v > best.v) best = { v: s.v, x, y, n: s.n };
      }
      return best;
    }

    trySpellValue(B, hand, thr, defensiveOnly) {
      const spells = hand.filter((h) => h.card.type === 'spell' && h.card.dmg > 0 && h.card.id !== 'frost_mist');
      if (!spells.length) return false;
      const cands = B.enemiesOf(this.team).filter((e) => e.kind === 'troop' && !e.untargetable && (!defensiveOnly || this.rel(e) < 20));
      if (!cands.length) return false;
      for (const h of spells) {
        const best = this.bestSpellSpot(B, h.card, h.level, cands);
        if (best && best.v >= h.card.cost * thr) return this.play(B, h, best.x, best.y);
      }
      return false;
    }

    tryFinishTower(B, hand) {
      for (const h of hand) {
        const c = h.card;
        if (c.type !== 'spell' || !c.dmg || !c.crownMul) continue;
        const dmg = Cards.stat(c, 'dmg', h.level) * (c.waves || 1) * c.crownMul;
        for (const t of B.towers[1 - this.team]) {
          if (t.dead) continue;
          if (t.hp <= dmg * 0.98) return this.play(B, h, t.x, t.y);
        }
      }
      return false;
    }

    // --- defense ------------------------------------------------------------
    defend(B, hand, A, lane) {
      const threats = A.threats[lane];
      const tv = A.threatVal[lane];
      const P = this.P;
      // profile the attackers
      let airVal = 0, groundVal = 0, swarm = 0, tankHp = 0, bldgTargeter = false, totalHp = 0;
      let lead = threats[0];
      for (const e of threats) {
        const v = unitValue(e);
        if (e.flying) airVal += v; else groundVal += v;
        if (e.maxHp < 400) swarm++;
        if (e.hp > tankHp) { tankHp = e.hp; }
        if (e.targets === 'buildings') bldgTargeter = true;
        totalHp += e.hp;
        if (this.rel(e) < this.rel(lead)) lead = e;
      }
      // spells first if they are great value
      const spells = hand.filter((h) => h.card.type === 'spell' && h.card.dmg > 0);
      for (const h of spells) {
        const best = this.bestSpellSpot(B, h.card, h.level, threats);
        if (best && best.v >= h.card.cost * P.spellThr && best.n >= 1) return this.play(B, h, best.x, best.y);
      }
      // score troops / buildings
      let bestH = null, bestS = -Infinity;
      for (const h of hand) {
        const c = h.card;
        if (c.type === 'spell') {
          if (c.id === 'frost_mist' && tv >= 6) { const s = 2 + tv * 0.3 - c.cost; if (s > bestS) { bestS = s; bestH = h; } }
          continue;
        }
        if (c.id === 'elixir_well' || (c.roles || []).includes('siege')) continue;
        let s = 0;
        const hitsAir = c.targets === 'both';
        if (airVal > 0 && !hitsAir) s -= airVal >= groundVal ? 100 : 3;
        if (airVal > 0 && hitsAir) s += 2 + airVal * 0.4;
        if (c.targets === 'buildings') s -= 8;
        if (c.targets === 'none' && !c.spawner) s -= 50;
        if (swarm >= 3 && (c.splash || c.selfSplash)) s += 4 + swarm * 0.4;
        if (swarm >= 3 && !(c.splash || c.selfSplash) && c.type === 'troop' && c.count === 1 && c.hitSpeed > 1.3) s -= 3;
        if (tankHp > 1800) s += dps(c, h.level) / 90 + (c.ramp ? 6 : 0) + (c.count >= 3 && airVal === 0 ? 2 : 0);
        if (bldgTargeter && c.type === 'building') s += 5;
        if (c.trap && groundVal > 0) s += 3;
        if (c.trap && groundVal === 0) s -= 50;
        if ((c.roles || []).includes('win')) s -= 3;
        if (c.heal || c.aura) s -= 1.5;
        // elixir efficiency
        const over = c.cost - Math.max(2, tv);
        if (over > 0) s -= over * 1.1;
        s += Math.min(tv, 8) * 0.1;
        s += Math.random() * (this.diffName === 'hard' ? 0.3 : 1.2);
        if (s > bestS) { bestS = s; bestH = h; }
      }
      if (!bestH || bestS < -4) return false;
      const c = bestH.card;
      const lx = this.relX(lead), ly = this.rel(lead);
      let px, py;
      if (c.type === 'spell') { return this.play(B, bestH, lead.x, lead.y); }
      if (c.type === 'building') {
        if (c.trap) { px = lx; py = U.clamp(ly - 2.5, 4, 14); }
        else { px = 9 + (lane === 0 ? -1.3 : 1.3) * (this.P.predict ? 1 : U.rand(0.5, 2)); py = this.P.predict ? 9.2 : U.rand(7, 11); }
      } else if (c.range >= 3) {
        px = this.laneX(lane) + (lane === 0 ? 1.4 : -1.4); py = U.clamp(ly - 5.5, 3.5, 11);
      } else if (c.count >= 3 && tankHp > 1800 && !lead.flying) {
        px = lx; py = U.clamp(ly - 0.8, 1, 14.5);
      } else {
        px = U.clamp(lx, 2, 16); py = U.clamp(ly - 2.2, 4, 14.2);
        if (ly > 15) py = U.clamp(this.P.predict ? 11.5 : 9, 4, 14.2);
      }
      if (!this.P.predict) { px += U.rand(-1.5, 1.5); py += U.rand(-1.5, 1.5); }
      const [x, y] = this.abs(px, py);
      return this.play(B, bestH, x, y);
    }

    // --- offense ------------------------------------------------------------
    support(B, hand, A, lane) {
      const push = A.myPush[lane];
      const tank = push.reduce((a, e) => (!a || e.hp > a.hp ? e : a), null);
      let best = null, bs = -Infinity;
      for (const h of hand) {
        const c = h.card;
        if (c.type === 'building' && !(c.roles || []).includes('siege')) continue;
        let s = 0;
        if (c.type === 'spell') {
          if (c.id === 'battle_cry' && A.pushVal[lane] >= 6) s = 4;
          else if (c.id === 'frost_mist') {
            const nearTower = B.towers[1 - this.team].some((t) => !t.dead && push.some((e) => Math.hypot(e.x - t.x, e.y - t.y) < 6));
            s = nearTower ? 3 : -10;
          } else continue;
        } else {
          if (c.range >= 3) s += 3;
          if (c.splash) s += 1.5;
          if (c.heal || c.aura) s += 3;
          if ((c.roles || []).includes('win')) s += 2;
          if ((c.roles || []).includes('tank') && tank && tank.maxHp > 2000) s -= 3;
        }
        s -= c.cost * 0.3;
        if (s > bs) { bs = s; best = h; }
      }
      if (!best || !tank) return false;
      const c = best.card;
      if (c.type === 'spell') {
        const at = c.id === 'battle_cry' ? tank : (B.towers[1 - this.team].find((t) => !t.dead && Math.hypot(tank.x - t.x, tank.y - t.y) < 8) || tank);
        return this.play(B, best, at.x, at.y);
      }
      // drop behind the tank on our side of the river
      const tx = this.relX(tank);
      const ty = Math.min(this.rel(tank) - 1.5, 14.2);
      const [x, y] = this.abs(U.clamp(tx, 1, 17), Math.max(ty, 9));
      return this.play(B, best, x, y);
    }

    startPush(B, hand, A) {
      const lane = this.diffName === 'easy' ? U.randInt(0, 1) : this.weakEnemyLane(B);
      const lx = this.laneX(lane);
      // economy first if safe
      const well = hand.find((h) => h.card.id === 'elixir_well');
      if (well && B.time > 70 && Math.random() < 0.6) {
        const [x, y] = this.abs(9 + (Math.random() < 0.5 ? -2.5 : 2.5), 2.2);
        if (this.play(B, well, x, y)) return true;
      }
      const wins = hand.filter((h) => (h.card.roles || []).includes('win') || (h.card.roles || []).includes('tank'));
      let pick = wins.sort((a, b) => b.card.cost - a.card.cost)[0];
      if (!pick) {
        // no win condition: lead with the sturdiest troop
        pick = hand.filter((h) => h.card.type === 'troop').sort((a, b) => Cards.stat(b.card, 'hp', b.level) * b.card.count - Cards.stat(a.card, 'hp', a.level) * a.card.count)[0];
      }
      if (!pick) return false;
      const c = pick.card;
      if (c.deployAnywhere) {
        const et = B.towers[1 - this.team].filter((t) => !t.dead);
        const tgt = et.find((t) => t.kind === 'tower' && t.towerKind === 'princess') || et[0];
        if (!tgt) return false;
        return this.play(B, pick, tgt.x + (tgt.x < 9 ? 1.2 : -1.2), tgt.y + M.forward(1 - this.team) * -2.2);
      }
      if ((c.roles || []).includes('siege')) {
        const [x, y] = this.abs(lx, 13.6);
        return this.play(B, pick, x, y);
      }
      let px = lx, py;
      if (c.speed <= 0.8 && B.players[this.team].elixir >= 9 && this.diffName !== 'easy') { py = 1.2; px = lx + (lane === 0 ? 2.5 : -2.5); }
      else py = c.speed >= 1.5 ? 13.5 : 12;
      const [x, y] = this.abs(px, py);
      return this.play(B, pick, x, y);
    }
  }

  // ---------------------------------------------------------- deck builder
  const ARCHETYPES = [
    { name: 'Beatdown', core: ['mountain_titan', 'boulder_brute', 'flame_wizard', 'drakeling', 'forest_druid', 'war_drummer', 'meteor', 'arrow_volley', 'steam_knight', 'longbow_twins'] },
    { name: 'Hog Cycle', core: ['ram_rider', 'iron_squire', 'gremlin_gang', 'bone_rattlers', 'bolt_turret', 'thunder_strike', 'meteor', 'longbow_twins', 'gale_blast', 'powder_gnome'] },
    { name: 'Air Raid', core: ['gas_zeppelin', 'drakeling', 'bat_imps', 'battle_cry', 'storm_caller', 'arrow_volley', 'iron_squire', 'frost_mist', 'longbow_twins'] },
    { name: 'Spawn Siege', core: ['necromancer', 'imp_den', 'siege_ballista', 'rune_trap', 'whirlwind_berserker', 'thunder_strike', 'sky_lance', 'bone_rattlers', 'longbow_twins'] },
    { name: 'Bridge Control', core: ['charging_paladin', 'tunneling_mole', 'steam_knight', 'inferno_spire', 'storm_caller', 'gale_blast', 'meteor', 'bat_imps', 'powder_gnome'] },
    { name: 'Economy', core: ['elixir_well', 'boulder_brute', 'necromancer', 'whirlwind_berserker', 'inferno_spire', 'sky_lance', 'arrow_volley', 'bat_imps', 'forest_druid'] },
  ];

  AI.buildDeck = function (maxArena, level, preferName) {
    const allowed = Cards.list().filter((c) => c.arena <= maxArena);
    const allowedIds = new Set(allowed.map((c) => c.id));
    const arch = preferName ? ARCHETYPES.find((a) => a.name === preferName) : U.pick(ARCHETYPES);
    let deck = U.shuffle(arch.core.filter((id) => allowedIds.has(id))).slice(0, 8);
    const has = (fn) => deck.some((id) => fn(Cards.get(id)));
    const addFrom = (pool) => { const p = U.shuffle(pool.filter((c) => !deck.includes(c.id))); if (p.length) deck.push(p[0].id); };
    if (!has((c) => c.targets === 'both' && c.type !== 'spell') && deck.length < 8) addFrom(allowed.filter((c) => c.targets === 'both' && c.type === 'troop'));
    if (!has((c) => c.type === 'spell') && deck.length < 8) addFrom(allowed.filter((c) => c.type === 'spell' && c.dmg > 0));
    if (!has((c) => (c.roles || []).includes('win')) && deck.length < 8) addFrom(allowed.filter((c) => (c.roles || []).includes('win')));
    while (deck.length < 8) addFrom(allowed);
    // guarantee at least one air answer
    if (!has((c) => c.targets === 'both' && c.type !== 'spell')) {
      const aa = allowed.find((c) => c.targets === 'both' && c.type === 'troop' && !deck.includes(c.id));
      if (aa) deck[deck.length - 1] = aa.id;
    }
    return { name: arch.name, cards: deck.slice(0, 8).map((id) => ({ id, level })) };
  };
  AI.ARCHETYPES = ARCHETYPES;

  RR.AI = AI;
})(window.RR);
