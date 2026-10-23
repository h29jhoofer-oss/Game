# Reckless Driver

A pixelated, top-down arcade game where you're a reckless driver weaving through two-way traffic on a winding construction-zone road, drifting through curves and dodging the cops. Your car starts out **white**. Beat high scores to unlock new paint colors.

## Play

Open `index.html` in any modern browser. You don't need to build or install anything.

## Controls

| Action | Keys |
| --- | --- |
| Steer | ← → or A / D |
| Drift | Space or Shift (hold) |
| Gas | ↑ or W |
| Brake | ↓ or S |
| Start / retry | Enter or Space |
| Pause | P or Esc |
| Ability | B |
| Mute | M |

On phones and tablets, on-screen buttons appear (including **DFT** for drift), and you tap the screen to start.

## The road

- The right two lanes go your way. The left two lanes, past the double yellow line, are **oncoming traffic** coming straight at you.
- Every so often the road **curves**. A warning pops up just before each one, and chevrons (`>>>` / `<<<`) show which way to steer while you're in it.
- A curve pushes your car toward the outside, harder the faster you go. At high speed, normal steering can't hold the line. If the curve throws you into the barriers, you're wrecked.

## Drifting

- Hold **Space** (or Shift) while steering to drift. The car slides sideways much harder, shrugs off most of a curve's push, and bleeds a little speed.
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
- Stay under the limit with no cops on your tail for a few seconds and the heat dies down.

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

Your best score and chosen paint are saved in your browser.
