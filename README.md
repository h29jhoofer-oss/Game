# Game
For my game

Open `index.html` in a browser to pick a game. No install needed.

## Dungeon Boss (`dungeon.html`)
A reverse side-scroller, inspired by *Hostile Architect*: you are the boss waiting on top of your castle tower, and waves of heroes run and jump through the level to reach it.

You are **Vorgath, the Hollow King**: a king who sold his soul so his tower would never fall, and who now feeds on the souls of the heroes the Order of the Dawn sends to end him. The game opens with a short prologue, and the full story is under *Lore: the Chronicle of Ashfall* on the game page.

- **Ascent (play as the hero):** the third card on the title screen. You are one hero climbing the Hollow King's traps.
  - **Pick a hero:**
    - Knight: 240 health, a sword, E Shield Charge (rams and stuns monsters), hold S to block arrows and fireballs.
    - Archer: 170 health, arrows that also break traps from range, E Volley (three arrows).
    - Mage: 160 health, magic bolts, E Mend (heals 35%).
    - Rogue: 170 health, fast, double jump, immune to spikes and bombs, E Shadow Dash (an untouchable dash).
  - **Controls:** A / D move, W jump, Space attack, E ability. R or "Try again" restarts the level (or the fight) after a death.
  - **Three levels:** the Castle Gate (castle, level 1 traps), the Frozen Spire (ice map, level 2 traps, slippery ice), and the Thornwood (forest, level 2 traps with their upgrades).
    - Each level has its own set of traps, monsters, serpents and red healing potions.
    - Every trap and monster behaves exactly as it does against the AI heroes.
    - You can smash traps with your weapon, and arrows and bolts break them too.
    - Serpents bite for 20% of your health and fling you on across the pit instead of swallowing you.
  - **The boss:** reach the forest tower and you fight **Nyxara, the Lich Queen**, a new boss. She is a floating crowned lich in violet robes, with a staff.
    - She keeps her distance and throws homing skulls, which you can strike or shoot down.
    - Her spells: Grasp of the Grave, Starfall, a Death Ray you can jump, and Repulse if you get close.
    - Below half health she turns red and adds Eclipse, Bone Pyres, Wailing Dead and Phase Shift.
    - A potion falls onto the tower top every 20 seconds.
- **Modes:** the title screen offers two modes. Click one, press 1 or 2, or use the arrows and Enter.
  - **Story:** the prologue, the 25-wave tale with the Marshal and the Voice, the bargains and the Thing Below, and the endings.
  - **Sandbox:** no story, no dialogue, no Thing (no hunger, bargains or finale), and no last wave. From wave 30 on, the column stops growing (32 heroes plus up to 9 champions) but heroes keep levelling up with the wave number. Choosing Sandbox brings up four difficulties (click one, press 1-4, or use the arrows and Enter; Escape goes back):
    - *Easy:* heroes have 60% health and damage and are 10% slower; 30% more gold, and you start with 40.
    - *Normal:* the heroes as in story mode; you start with 20 gold.
    - *Hard:* 150% health, 130% damage, 5% faster, 2 extra heroes each wave, 15% less gold.
    - *Nightmare:* 220% health, 170% damage, 15% faster, 4 extra heroes each wave, 30% less gold, and you start with 15.
    Each difficulty keeps its own best wave, saved in the browser and shown on its card and on the death screen.
  - "Play again" returns to the title, so you can switch modes.
- **Sandbox maps:** after the difficulty, pick a map (click, 1-3, or the arrows and Enter; Escape goes back).
  - **Castle:** the story's map.
  - **Ice Tower:** an icy castle under snowy peaks and falling snow, with blue torches and icicles on the tower.
    - Every flat stretch of ground after the first is glazed with ice. Heroes on it build up speed slowly, go 35% faster once moving, and skid when they try to stop.
    - A hero on ice coming to a pit edge slips in 30% of the time instead of jumping (in testing, about a quarter of unhindered heroes died this way).
    - Pits are beds of ice spikes, the serpent is an Ice Serpent, and Vorgath is the Frost King (icy armour, cyan eyes, an ice blade), with icy Devourer and Unmade forms.
  - **Forest:** dark woods, fireflies and green lanterns.
    - The tower is a great tree with a door in its trunk, roots and a canopy.
    - Pits are pools of deep water (heroes drown), the serpent is a Great Viper, and Vorgath is the Thorn King (bark and moss, green eyes, a wooden club), with mossy Devourer and Unmade forms.
  - **Themed attacks:** on the ice and forest maps every boss attack takes the map's look.
    - On the Ice Tower, fire, blood, stone and souls become frost and ice: icicles fall instead of fireballs, Cataclysm raises ice spikes, Devour shoots ice chains, the Void Lance turns white.
    - In the Forest they become poison, sap, wood and vines: spiked seed pods fall, Cataclysm raises roots, Devour lashes out with leafy vines, Grasp opens a swamp pool with wooden hands.
    - His glowing eyes and chest change colour to match.
  - **Themed traps and monsters:** on the ice and forest maps the traps and monsters change too, on the level, in the toolbar, in their tabs and in the placement preview.
    - On the Ice Tower, their stone, iron, wood and bone turn to frosted ice. Ogres become blue ice trolls, imps and hellhounds burn with icy blue fire, and skeletons and golems are frost-pale.
    - In the Forest, they turn to bark and lichen. Wraiths become brown forest spirits, imps turn into green goblins, and hellhounds' fire goes a sickly green.
    - Fire vents, frost totems and tesla sparks keep their colours, so you can still tell what they do.
- **Boss level:** heroes Vorgath kills himself in the boss battle don't add to your soul counter. Their souls fly into him and level him up instead.
  - Champions are worth 3 souls, colossi 5, and dark souls count double.
  - Level n needs 3 + 2n souls. Each level gives +12% health in every form (filled at once if it happens mid-fight) and +8% damage on the tower.
  - The level shows in the HUD next to his health, with a gold bar for the souls he needs for the next level.
- **Desperate heroes:** if no hero reaches the tower in 3 waves in a row, the next waves' heroes have 4x health on the path, with red health bars, until one gets in. On the tower top they have their normal health. This works in both modes.
- **Sandbox boss battles:** Vorgath has twice the health in every form (1200, then 1440, then 1800, before Unholy Might), a fifth attack on E in each form, and a third form.
  - Form 1 (E) **Iron Tempest:** he spins with the cleaver out for 1.4s, hitting everyone within 2.8 tiles every 0.2s. He can still walk while it spins.
  - Form 2 (E) **Feast of Blood:** after a short gathering, a crimson wave hits every hero within 6 tiles for 22, and heals him 14 for each one.
  - Form 3, **the Unmade**, rises when the Devourer falls: black and gold, hovering, with circling shards. He is faster, can jump, and his claws hit for 48.
    - Q **Void Lance:** a warning line, then a beam across the tower top at chest height (60 damage, knockback). Jumping over it dodges it.
    - S **Eclipse:** a black sun drops on every hero's spot after a warning ring (40 each).
    - R **Soul Harvest:** drags every hero towards him for 1.2s, then hits those close for 30 and heals 20 for each.
    - F **Doom Pillars:** columns of black fire burst up one after another on both sides (35 each, and they throw heroes up).
    - E **Void Step:** vanishes (untouchable for a moment) and reappears behind the hero furthest away, with a 30-damage blast.
  - In story mode, the boss battle is unchanged.
- **Sandbox heroes:** eleven kinds that only march in sandbox mode, joining from wave 6.
  - **Fliers** (only arrow turrets, tesla coils and skyhooks can reach them while airborne; they fight on foot in the tower):
    - Lantern Wisps (8): tiny, very fast lights that come in packs of three.
    - Gryphon Riders (11): knights on gryphons; tough and slow.
    - Balloon Bombers (13): drop firepots on the traps below, jamming everything near where they land for 3s.
    - Sky Priestesses (16): fly overhead healing the heroes around them.
  - **Burrowers** (out of reach of every trap and monster while underground; they have to surface to jump pits and climb ledges):
    - Tunnel Miners (7): dig 2.6s, then surface for 2s.
    - Burrow Stalkers (14): underground for 6s at a time, and burst up under monsters to ambush them.
  - **Ground heroes with special abilities:**
    - Aegis Bearers (6): heroes inside the blue ring around one take half damage on the path.
    - Exorcists (9): a holy pulse that damages and stuns your monsters nearby.
    - Martyrs (12): when one dies, every hero near it heals 35% of their health.
    - Illusionists (15): split into two illusions the first time they drop below 75% health. Illusions drop nothing and fade at the tower door.
  - **Siege Colossus:** a giant twice the size of an Iron Knight with 9 times a knight's health, heavy blows and a slow, shaking stride. One comes at the back of every fifth wave from wave 10, with one more for every 20 waves after that.
- **The Thing Below (25 waves):** the story now runs 25 waves, alternating the Marshal and the Voice Below, the thing Vorgath bargained with.
  - **The Hunger:** every soul feeds it (dark souls and bargains most). As it grows: tremors (15), eyes opening in the lava (30), a heartbeat (45), tendrils that drag heroes near pits into the lava (60), and your own monsters too (75).
  - **Bargains:** after waves 4, 7, 10, 13, 16, 19 and 22 the Voice offers three deals (keys 1-3, Esc refuses): Burning Traps (+50% trap damage next wave for 5 souls), Flesh for Iron (sacrifice a monster for +100 max health), A Debt (2 dark souls now; in two waves it takes half your coins and a trap), Gold from the Deep (+60 coins, 3 extra heroes), Souls of the Drowned (+5 souls), A Gift of Darkness (a free dark power).
  - **Wave 25, the finale:** the Thing bursts through the tower top. Vorgath fights it with the Marshal and three knights. Its hide takes only 20% damage except when the great eye in its brow opens; it raises its huge claw and slams it down on a spot marked in red, sends tendrils up through the floor, and spills spawn as it weakens.
  - **Endings:** beat it and choose: *Devour It All* (dark ending) or *Let Her Free You* (light ending). The light ending is locked if you took 5 or more bargains, or if the Marshal died.
- **Dialogue:** only between waves. Waves and boss battles stay quiet; anything the Voice says during a wave waits for the next break. Each line stays up until you press Space (or Enter, or click the box).
- **Story:** after each wave, Seraphine Vane, High Marshal of the Order (and, it turns out, Vorgath's granddaughter many times over), Vorgath and the Voice Below talk. Over 25 waves the conversations reveal the plague, the bargain, Elowen, what the Voice really is, and what Vorgath may still be.

- **Opening:** a lone hero charges in and falls into the lava, the ground rumbles, and the first wave comes running.
- **Heroes:** sword knights; archers from wave 2 (fast, fragile, shoot from range and keep their distance); Iron Knights from wave 3 (slow, very tough, and their tower shields block most arrow damage from the front). Champions from wave 4, one more every three waves: hero bosses that are huge, slow and hard-hitting, with far more health, and they grow stronger every wave. Mages from wave 5: weak bolts, but they heal nearby heroes and empower one ally (glowing green) with more speed, damage and health until the mage dies.
- **Trap-immune heroes:** rogues from wave 6 (fast and fragile, never set off spikes or bombs), Flame Wardens from wave 7 (immune to fire vents, imp fireballs and burning), berserkers from wave 8 (frost can't slow or freeze them, and they rage when badly hurt) and sappers from wave 9 (immune to crushers and saws, and they jam any trap they pass for 4 seconds). "IMMUNE" pops up when a trap fails to hurt one.
- **Dawn Seraphs** (wave 10): winged knights who fly over the whole path. Only arrow turrets, tesla coils and skyhooks can hit them; monsters, serpents and every other trap can't reach them. A skyhook harpoon drags one out of the sky, and if it is over a pit it falls into the lava.
- **Hero toughness:** heroes have double health on the path; when they reach the tower top their health is halved again for the boss battle.
- **Waves:** each wave is a group of heroes. Heroes who reach the tower door hide inside; once 5 are in the tower, they all climb up for the boss battle.
- **The path** to the tower is twice as wide as the screen. Scroll with A / D, the arrow keys, the mouse wheel, the screen edges, or by clicking the mini-map under the HUD.
- **Build:** spend coins on spikes, saw blades and arrow turrets, and souls on monsters. You can build during waves too.
- **Monsters:** skeletons and ogres from the start; then, as your kill count grows, imps (4 kills: spit fireballs), wraiths (8: fly over pits and walls, drain life), hellhounds (12: fast, pounce, set heroes burning) and bone golems (20: huge tanks that smash every hero around them). Click a monster to see its stats.
- **Bone Serpent:** click its lava to open its tab; a dark soul makes it strike every 4 seconds instead of 7, reach further and higher, swim faster and bite Champions harder, and turns its pit violet.
- **Bone Serpent (placing):** costs 2 dark souls; click over a lava pit to put one in it (one per pit). It can't be killed. It swims slowly along its pit toward heroes and, about every 7 seconds, lunges up to snatch a hero jumping over the pit and drag them into the lava. Champions are too big to swallow and take a bite worth half their health instead.
- **Dark souls:** 1 hero in 4 drops a dark soul instead of a normal soul. Spend them in two ways:
  - **Dark powers** (panel under the toolbar), bought once and kept: *Dark Mending* (key 1, heal 150), *Doom Nova* (key 2, 30 damage to every hero and a 1.5s stun), *Raise the Fallen* (key 3, three dark skeletons fight for 12s) and the passive *Unholy Might* (+150 max health in both forms, abilities recharge 20% faster).
  - **Dark infusion:** click a monster and give it a dark soul (or press I): it turns black and violet with a glowing aura, gets 2.5x health, double damage and 20% more speed, and drains life with every hit.
- **Manage traps:** click a placed trap and its tab slides in from the right side of the screen: see its stats and what the next level adds, **Upgrade** it (up to level 3, or press U) or **Sell** it for half what you paid (or press X). The *Your traps* list under the toolbar does the same for every trap, with a **Find** button that scrolls to it.
- **Big traps:** two traps take up more than one tile. They're placed by their bottom-left tile, and clicking any tile of them opens their tab.
  - Grinder (5 kills, 3 tiles wide, on the ground): gears in the floor that chew and slow 25% anyone walking across. Paths: *Meat Grinder* (+80% damage, no slow) or *Conveyor* (-40% damage, drags heroes back the way they came).
  - Boulder chute (18 kills, 2 by 2, anywhere): when heroes are coming, it tips a boulder out that rolls back down the path, hopping over pits, hitting each hero once, until it smashes into a wall or falls in the lava. Paths: *Wrecking Ball* (spiked iron ball, +80% damage, knocks heroes back, rolls slower) or *Rockslide* (3 smaller boulders, -55% damage each).
  - Flying Dawn Seraphs are immune to both.
- **More traps:** skyhooks (8 kills: harpoon launchers that aim at the nearest hero above them, fliers first, and drag fliers down), tar pits (12: slow heroes, and tarred heroes take 50% more fire damage), tesla coils (20: lightning that chains between nearby heroes) and pendulums (25: a blade swinging under the mount). Each has two level-3 paths: Heavy Harpoon / Net Launcher, Glue Trap / Burning Tar, Storm Coil / Lance Coil, Executioner / Twin Blades. Sappers ignore pendulums.
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
