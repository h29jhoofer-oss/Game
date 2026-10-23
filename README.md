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

- The right two lanes go your way. The left two lanes, past the double yellow line, are **oncoming traffic** coming straight at you.
- Every so often the road **curves**. A warning pops up just before each one, and chevrons (`>>>` / `<<<`) show which way to steer while you're in it.
- A curve pushes your car toward the outside, harder the faster you go. At high speed, normal steering can't hold the line. If the curve throws you into the barriers, you're wrecked.

## Potholes, ramps and nitro

- **Potholes** are dark holes in the road. Hitting one costs a big chunk of speed, knocks your car sideways, and takes the wheel out of your hands for a moment. It also breaks your combo and any drift in progress. Cops that hit one get thrown off line too.
- **Launch ramps** have yellow chevrons. Drive over one to jump; the faster you hit it, the longer you fly.
  - In the air you sail over cars, potholes and cops, and you can't be pulled over. Steering is lighter and your speed holds steady.
  - Each car you clear is worth **JUMPED IT! +200**, or +300 for an oncoming car.
  - Watch where you come down: **landing on a car wrecks you.**
- **Nitro bottles** are glowing blue canisters that show up every so often in a random lane. Drive through one (you can grab it mid-jump too) for a 2.5-second boost up to about 190 MPH, plus 100 points.

## On-screen messages

Messages stay out of the driving view. Announcements like **CURVE AHEAD** or **MORE COPS!** show one at a time in a slim banner under the top bar. Points and callouts like **CLOSE! +50** or **POTHOLE!** stack in a small feed in the bottom-right corner, behind your car.

## Drifting

- **Double-tap** left or right (A / D, the arrow keys, or the ◀ ▶ buttons) and keep holding the second tap to drift that way. Let go to stop. The car slides sideways much harder, shrugs off most of a curve's push, and bleeds a little speed.
- Drifting at speed builds drift points (shown under your car). Let go to bank them. Drifts through a curve score **x2**.

## How to score

- You earn points for distance. Above 120 MPH you're driving **RECKLESS** and earn double points.
- Squeeze past a car with only a few pixels to spare to get a **CLOSE!** bonus. Close calls in a row build a combo. Close calls with oncoming cars (**HEAD-ON!**) are worth double.
- Traffic gets heavier the farther you go, and cars signal before they change lanes. Watch for the blinkers!
- Driving on the grass slows you down.
- One crash and you're wrecked.

## Police

- Go over **100 MPH** and a police cruiser starts chasing you. A blue tick on the speed bar marks the limit.
- Keep speeding and your wanted level (the stars) goes up every few seconds. Each level sends another, faster cruiser after you, up to 5 stars.
- To get away you have to go faster than the cops. Each cop you leave behind is worth +250, and losing all of them is a bonus.
- To pull you over, a cop has to pull up right beside you and hold there. A **PULL OVER** meter fills above your car. If it fills, you're **BUSTED!** Swerve away or speed off to drain it.
- While a cop lines up beside you it locks on to you and won't swerve. Ram it sideways, or lead it into another car or the barriers, to wreck it (**COP DOWN! +500**).
- Stay under the limit with no cops on your tail for a few seconds and the heat dies down. That also patches your car back to full HP.

## The chopper

- At **max heat (5 stars)** a police helicopter flies in and hovers ahead of you.
- It locks a **red target** on where you're heading, then sprays a burst of bullets at that spot. Get out of the target before the burst lands.
- Each hit costs 1 **HP**; you have 5, shown at the top right. Your car smokes when it's badly damaged. At 0 HP it blows up and the run is over.
- The chopper runs out of fuel after 25 seconds and leaves. It comes back 15 seconds later if you're still at max heat.
- Black's **Smoke** hides you from the chopper, and White's **Ghost** lets bullets pass straight through.

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

Every point you score is also banked as **cash** at the end of the run. Press **Down** (or **BRK** on a phone) on the title screen to open the shop. Use Up/Down to pick, Left/Right to switch tabs, Enter to buy or equip, and Esc to go back.

**Upgrades** (each level costs more):

| Upgrade | Levels | Effect per level |
| --- | --- | --- |
| Armor | 3 | +1 HP against the chopper |
| Engine | 3 | +8 MPH top speed |
| Tires | 3 | Sharper steering and less push in curves |
| Cooler | 3 | Your B ability recharges 15% faster |
| Suspension | 2 | Potholes cost less speed and knock you around less |
| Radar Jammer | 2 | Cops need 25% longer beside you to bust you |
| Springs | 2 | 20% longer jumps off ramps |

**Style** (cosmetic only; buy once, then equip or take off any time). You can preview anything before you buy it:

- **Decals:** racing stripes, checker roof, flame decals
- **Trails:** fire, sparkle, rainbow
- **Neon underglow:** blue, pink, green

Your best score, chosen paint, cash, upgrades and style are saved in your browser.
