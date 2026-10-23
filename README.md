# Reckless Driver

A pixelated, top-down arcade game where you're a reckless driver weaving through two-way traffic on a winding construction-zone road, drifting through curves and dodging the cops. Your car starts out **white**. Beat high scores to unlock new paint colors.

## Play

Open `index.html` in any modern browser. You don't need to build or install anything.

## Controls

| Action | Keys |
| --- | --- |
| Steer | ← → or A / D |
| Drift | Double-tap ← / → or A / D, and keep holding |
| Gas | ↑ or W |
| Brake | ↓ or S |
| Start / retry | Enter or Space |
| Pause | P or Esc |
| Ability | B |
| Mute | M |

On phones and tablets, on-screen buttons appear (double-tap ◀ or ▶ to drift), and you tap the screen to start.

## The road

This is the level 1 road, the construction zone. See [Levels](#levels) for the bridge.

- The right two lanes go your way. The left two lanes, past the double yellow line, are **oncoming traffic** coming straight at you.
- Every so often the road **curves**. A warning pops up just before each one, and chevrons (`>>>` / `<<<`) show which way to steer while you're in it.
- A curve pushes your car toward the outside, harder the faster you go. At high speed, normal steering can't hold the line. If the curve throws you into the barriers, you're wrecked.

## Ramps

- **Launch ramps** have yellow chevrons and show up every few seconds. Drive over one to jump; the faster you hit it, the longer you fly.
  - In the air you sail over cars and cops, and you can't be pulled over. Steering is lighter and your speed holds steady.
  - Each car you clear is worth **JUMPED IT! +200**, or +300 for an oncoming car.
  - Come down on top of a car and you **squash it flat**: **SQUASHED! +500** (+750 for a truck, 1.5x for oncoming cars, +500 on top of the cop bonus for a cruiser). You then flash for **2 seconds of invulnerability**: cars, cops, bullets, the big rig and barriers can't hurt you, and cops can't pull you over.

## On-screen messages

Messages stay out of the driving view. Announcements like **CURVE AHEAD** or **MORE COPS!** show one at a time in a slim banner under the top bar. Points and callouts like **CLOSE! +50** or **JUMPED IT! +200** stack in a small feed in the bottom-right corner, behind your car.

## Drifting

- **Double-tap** left or right (A / D, the arrow keys, or the ◀ ▶ buttons) and keep holding to drift that way. While drifting, a single tap the other way flicks the drift into the other direction. Letting go for a moment (under 0.2s) doesn't end it; let go a bit longer to stop. The car slides sideways much harder, shrugs off most of a curve's push, and bleeds a little speed.
- Drifting at speed builds drift points (shown under your car). Let go to bank them. Drifts through a curve score **x2**.

## How to score

- You earn points for distance. Above 120 MPH you're driving **RECKLESS** and earn double points.
- Squeeze past a car with only a few pixels to spare to get a **CLOSE!** bonus. Close calls in a row build a combo. Close calls with oncoming cars (**HEAD-ON!**) are worth double.
- Traffic gets heavier the farther you go, and cars signal before they change lanes. Watch for the blinkers!
- Driving on the grass slows you down.
- One crash and you're wrecked.

## Don't dawdle

Driving slowly isn't safe either:

- After the first few seconds, driving under **75 MPH** fills a **SPEED UP!** meter at the bottom of the screen. An orange tick on the speed bar marks the line.
- If the meter fills, a **big rig** barrels up behind you, honking and smashing through any car in its way. If it catches you, you're flattened. Get above its speed to leave it behind. Each new rig is a little faster than the last.
- Cash is paid out by your **average speed** for the run: from x0.5 for a slow run up to x1.5 for a fast one (x1.0 at 90 MPH). The game-over screen shows your average and the multiplier.

The sweet spot is fast enough to stay ahead of the rigs, but not so fast that the cops pile on.

## The zone

Staying in that sweet spot pays off. Between **75 MPH** (orange tick) and the **police limit** (blue tick), the stretch of the speed bar between them glows green and you're **in the zone**:

- Every second in the zone adds **0.01x** to a score multiplier (+0.1x every 10 seconds). It starts at **x1.00** and has **no cap**.
- It's shown as **ZONE X1.23** under your speed: green while it's growing, grey while you're out of the zone.
- Leaving the zone doesn't reset it. It just stops growing until you're back in. It lasts until the run ends.
- It multiplies **all** points: distance, close calls, jumps, squashes, drifts and cop bonuses.


## Police

- Go over **100 MPH** and a police cruiser starts chasing you. A blue tick on the speed bar marks the limit.
- Keep speeding and your wanted level (the stars) goes up every few seconds. Each level sends another, faster cruiser after you, up to 5 stars.
- To get away you have to go faster than the cops. Each cop you leave behind is worth +250, and losing all of them is a bonus.
- To pull you over, a cop has to pull up right beside you and hold there. A **PULL OVER** meter fills above your car. If it fills, you're **BUSTED!** Swerve away or speed off to drain it.
- While a cop lines up beside you it locks on to you and won't swerve. Ram it sideways, or lead it into another car or the barriers, to wreck it (**COP DOWN! +500**).
- Stay under the limit with no cops on your tail for a few seconds and the heat dies down. That also patches your car back to full HP.

## The chopper

- At **max heat (5 stars)** a police helicopter flies in and hovers ahead of you.
- The road is closed while it hunts you: no new civilian traffic shows up, only cops. Traffic returns once the chopper leaves.
- It locks a **red target** on where you're heading, then sprays a burst of bullets at that spot. Get out of the target before the burst lands.
- Each hit costs 1 **HP**; you have 5, shown at the top right. Your car smokes when it's badly damaged. At 0 HP it blows up and the run is over.
- The chopper runs out of fuel after 25 seconds and leaves. **Survive until then at max heat and you beat it**, which clears the level (see [Levels](#levels)). If you drop below max heat first, it just bugs out and comes back 15 seconds after you're at max heat again.
- Black's **Smoke** hides you from the chopper, and White's **Ghost** lets bullets pass straight through.

## Levels

Beat the chopper to move on to the next level. You get **CHOPPER BEATEN! +2,000 × the level number**, the screen fades out, and the next road fades in. The level number is shown as **LV** at the top of the screen.

Every new level starts fresh: heat back to zero, cops and the chopper gone, HP fully repaired and 2 seconds of invulnerability. Your score and **zone multiplier** carry over.

| Level | Road |
| --- | --- |
| 1, 3, 5... | **Construction zone:** four lanes, two each way, with curves and barriers |
| 2, 4, 6... | **The bridge:** three lanes, all going your way, dead straight, and **no railings** |

On the bridge:

- Drift too far and you drive right off the edge. Once the middle of your car is past the edge with its wheels down, you go over and the run ends: **SPLASH!**
- A ramp jump can carry you out over the water, but if you come down off the deck, you go in.
- Cops can go over too. Ram one or blast it with Blue's Shockwave off the edge for **COP OVERBOARD! +600**.

## Paint jobs and abilities

Every paint has a passive perk that is always on, and an active ability you trigger with **B**. Each ability has its own cooldown.

| Paint | Unlock score | Passive | Active (B) |
| --- | --- | --- | --- |
| White | Start | **Blend In:** cops only chase over 110 MPH | **Ghost:** phase through cars and cops for 3s |
| Red | 1,500 | **Hot Rod:** +15 MPH top speed | **Nitro:** a 3s burst well past top speed |
| Blue | 4,000 | **Cool Head:** wanted level rises slower | **Shockwave:** shoves nearby cops and cars away |
| Yellow | 8,000 | **Big Fares:** 2x close-call bonus | **Horn:** cars ahead move out of your lane |
| Green | 15,000 | **Off-Roader:** dirt doesn't slow you | **Oil Slick:** cops that drive through it spin out |
| Black | 25,000 | **Shadow:** cops take twice as long to bust you | **Smoke:** blinds cops behind you for 4s |
| Hot Pink | 40,000 | **Fabulous:** 1.5x all points | **Slow-Mo:** the world slows while you steer at full speed |

## Shop

Every point you score is also banked as **cash** at the end of the run. Press **Down** (or **BRK** on a phone) on the title screen to open the shop. Use Up/Down to pick, Left/Right to switch between the Upgrades, Style and Bodies tabs, Enter to buy or equip, and Esc to go back.

**Upgrades** (each level costs more):

| Upgrade | Levels | Effect per level |
| --- | --- | --- |
| Armor | 3 | +1 HP against the chopper |
| Engine | 3 | +8 MPH top speed |
| Tires | 3 | Sharper steering and less push in curves |
| Cooler | 3 | Your B ability recharges 15% faster |
| Radar Jammer | 2 | Cops need 25% longer beside you to bust you |
| Springs | 2 | 20% longer jumps off ramps |

**Style** (cosmetic only; buy once, then equip or take off any time). You can preview anything before you buy it:

- **Decals:** racing stripes, checker roof, flame decals
- **Trails:** fire, sparkle, rainbow
- **Neon underglow:** blue, pink, green

**Bodies** (buy once, then switch any time). Every body has the same size and hitbox, and each comes with a small trade-off. Decals follow each body's shape:

| Body | Price | Pros | Cons |
| --- | --- | --- | --- |
| Sedan | Free (default) | Balanced | None |
| Delivery Van | 2,000 | +2 HP | -10 MPH, slower steering |
| Pickup Truck | 2,500 | +1 HP, dirt barely slows you | -5 MPH |
| Sports Coupe | 3,000 | +5 MPH, sharper steering | -1 HP |
| Muscle Car | 5,000 | +10 MPH, faster acceleration | Slower steering |
| Open-Wheel Racer | 10,000 | +15 MPH, sharper steering | -2 HP |

Your best score, chosen paint, cash, upgrades and style are saved in your browser.
