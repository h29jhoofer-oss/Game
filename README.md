# Game
For my game

Open `index.html` in a browser to pick a game. No install needed.

## Dungeon Boss (`dungeon.html`)
A reverse side-scroller, inspired by *Hostile Architect*: you are the boss waiting on top of your castle tower, and waves of heroes run and jump through the level to reach it.

You are **Vorgath, the Hollow King**: a king who sold his soul so his tower would never fall, and who now feeds on the souls of the heroes the Order of the Dawn sends to end him. The game opens with a short prologue, and the full story is under *Lore* on the game page.

- **Opening:** a lone hero charges in and falls into the lava, the ground rumbles, and the first wave comes running.
- **Heroes:** sword knights; archers from wave 2 (fast, fragile, shoot from range and keep their distance); Iron Knights from wave 3 (slow, very tough, and their tower shields block most arrow damage from the front). Champions from wave 4, one more every three waves: hero bosses that are huge, slow and hard-hitting, with far more health, and they grow stronger every wave. Mages from wave 5: weak bolts, but they heal nearby heroes and empower one ally (glowing green) with more speed, damage and health until the mage dies.
- **Trap-immune heroes:** rogues from wave 6 (fast and fragile, never set off spikes or bombs), Flame Wardens from wave 7 (immune to fire vents, imp fireballs and burning), berserkers from wave 8 (frost can't slow or freeze them, and they rage when badly hurt) and sappers from wave 9 (immune to crushers and saws, and they jam any trap they pass for 4 seconds). "IMMUNE" pops up when a trap fails to hurt one.
- **Waves:** each wave is a group of heroes. Heroes who reach the tower door hide inside; once 5 are in the tower, they all climb up for the boss battle.
- **The path** to the tower is twice as wide as the screen. Scroll with A / D, the arrow keys, the mouse wheel, the screen edges, or by clicking the mini-map under the HUD.
- **Build:** spend coins on spikes, saw blades and arrow turrets, and souls on monsters. You can build during waves too.
- **Monsters:** skeletons and ogres from the start; then, as your kill count grows, imps (4 kills: spit fireballs), wraiths (8: fly over pits and walls, drain life), hellhounds (12: fast, pounce, set heroes burning) and bone golems (20: huge tanks that smash every hero around them). Click a monster to see its stats.
- **Bone Serpent:** costs 2 dark souls; click over a lava pit to put one in it (one per pit). It can't be killed. It swims slowly along its pit toward heroes and, about every 7 seconds, lunges up to snatch a hero jumping over the pit and drag them into the lava. Champions are too big to swallow and take a bite worth half their health instead.
- **Dark souls:** 1 hero in 4 drops a dark soul instead of a normal soul. Spend them in two ways:
  - **Dark powers** (panel under the toolbar), bought once and kept: *Dark Mending* (key 1, heal 150), *Doom Nova* (key 2, 30 damage to every hero and a 1.5s stun), *Raise the Fallen* (key 3, three dark skeletons fight for 12s) and the passive *Unholy Might* (+150 max health in both forms, abilities recharge 20% faster).
  - **Dark infusion:** click a monster and give it a dark soul (or press I): it turns black and violet with a glowing aura, gets 2.5x health, double damage and 20% more speed, and drains life with every hit.
- **Manage traps:** click a placed trap and its tab slides in from the right side of the screen: see its stats and what the next level adds, **Upgrade** it (up to level 3, or press U) or **Sell** it for half what you paid (or press X). The *Your traps* list under the toolbar does the same for every trap, with a **Find** button that scrolls to it.
- **More traps:** spring traps (8 kills: fling heroes back the way they came, often into lava), tar pits (12: slow heroes, and tarred heroes take 50% more fire damage), tesla coils (20: lightning that chains between nearby heroes) and pendulums (25: a blade swinging under the mount). Each has two level-3 paths: Catapult / Rapid Spring, Glue Trap / Burning Tar, Storm Coil / Lance Coil, Executioner / Twin Blades. Rogues don't set off springs and sappers ignore pendulums.
- **Dark traps:** give any trap a dark soul from its tab (Infuse, or press I): +75% damage, 25% faster cycles and 20% more reach, with violet flames and a dark-soul mark.
- **Crushers:** only one crusher fits in each column, so they can't be stacked into a wall.
- **Specialize:** at level 3 each trap can go down one of two paths (click a card or press 1 / 2). Each path trades one strength for another and gives the trap a new look:
  - Spikes: *Barbed* (heroes bleed, less hit damage) or *Impaler* (double damage and pins heroes, much slower).
  - Saw blade: *Ripper* (huge blade, big damage, slow) or *Patrol Saw* (slides along a rail, less damage).
  - Arrow turret: *Ballista* (piercing bolts, big damage, slow) or *Twin Gargoyle* (shoots both ways, faster, less damage).
  - Fire vent: *Pillar of Fire* (3 tiles tall, more damage, erupts less often) or *Ember Pit* (burns nonstop, low and weak).
  - Crusher: *Steam Piston* (rises and resets far faster, half damage) or *Obsidian Slab* (more damage and a landing shockwave, rises slowly).
  - Bomb: *Cluster Bomb* (three blasts, rearms, half damage) or *Powder Keg* (bigger, stronger blast on a short fuse).
  - Frost totem: *Blizzard* (wider aura, weaker slow) or *Deep Freeze* (freezes heroes solid now and then, smaller aura).
- **Loot:** every hero you kill drops coins and exactly one soul, which fly into your counters.
- **Unlockable traps:** kills unlock fire vents (3 kills), crushers (6), bombs (10) and frost totems that slow heroes down (15).
- **Boss battle:** Vorgath has 600 HP (his Devourer form has 720). He roars to open the fight and becomes enraged (faster, deadlier) below half health. A / D move, W jumps and Space swings your cleaver. Special attacks, each on a cooldown shown in the action bar:
  - **Q – Cleaver Slash:** dash forward, cutting through every hero in the way.
  - **S – Ground Smash:** leap and slam down, hurting and hurling away everyone around you, with shockwaves along the floor.
  - **R – Grasp of the Damned:** a pool of blood opens under the heroes; bony hands hold them, and the weak are dragged down to hell.
  - **F – Hellfire:** the sky burns and fireballs rain down on the heroes.
- **Phase two:** the first time Vorgath falls in a fight, his armour bursts apart and he rises again as the much larger **Devourer**, with a new health bar, a heavier theme and new attacks on the same keys:
  - **Space – Claw Swipe:** a huge raking swipe that throws heroes.
  - **Q – Soul Breath:** a torrent of soulfire poured along the ground.
  - **S – Cataclysm:** a crushing leap that throws every hero into the air and sets stone spikes erupting across the floor.
  - **R – Devour:** spectral chains drag the furthest heroes into his jaws; the weak are eaten (healing him), the rest are spat out.
  - **F – Wailing Souls:** screaming skulls circle him, then hunt the heroes down.
- **Sound:** orchestral-style music and sound effects, all synthesized in the browser (no audio files): string and brass sections, a choir, timpani, taiko, a funeral bell and a hall reverb. The path plays a slow, grim funeral march in D minor; the boss battle an epic C minor battle theme with choir and horns; and the Devourer a faster, heavier theme in E phrygian. M mutes the music, N mutes sound effects, and the toolbar has toggles for both.
- Lava pits kill heroes who miss a jump. Each wave brings one more hero than the last, and they're stronger, better geared, and better at spotting traps and dodging.

## Pixel Snake (`snake.html`)
Classic Snake. Arrows / WASD to move, Space to pause, swipe on mobile.
