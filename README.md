# Little Lure Co.

A pixelated drop-and-reel fishing game. Drop your hook, dodge fish on the way down, catch them on the way up, then sell the haul for better tackle so you can fish deeper.

Open `index.html` in a browser. It's a single self-contained file.

## Controls

| Action | Keyboard | Touch / mouse |
| --- | --- | --- |
| Steer the hook | Left / Right (or A / D) | Drag (or move the mouse) |
| Menus | Arrow keys, Enter or Space | Tap |
| Pause | P or Esc | Tap the pause icon |
| Mute | M | |

## How a cast works

1. **Down.** The hook sinks until it reaches the end of your line. Touch a fish (or a jellyfish) on the way down and the line snags, so you start reeling up from there.
2. **Up.** Now every fish the hook touches gets caught, until the hook is full. Jellyfish zap you and knock your last fish loose.
3. **Sell.** Back at the boat the catch is sold. The deeper the fish, the more it's worth. Golden fish (rare) are worth 5x.

## The ocean

| Zone | From |
| --- | --- |
| Sunlit Shallows | 0 m |
| Kelp Forest | 60 m |
| Twilight Zone | 160 m |
| Midnight Zone | 350 m |
| The Abyss | 650 m |
| The Trench | 1,100 m, down to the floor at 1,700 m |

It gets darker as you go down, and rock walls start closing in from 160 m. Below the twilight zone you can mostly see only what your bait lights up and the fish that glow on their own. There are 20 species to find; the Fish Log tracks them. Reach the trench floor to find the sunken chest.

## Tackle shop

| Upgrade | Levels | What it does |
| --- | --- | --- |
| Line | 11 | How deep the hook can go: 50 m up to the 1,700 m floor |
| Hook | 10 | How many fish you can hold: 3 up to 40 |
| Pole | 7 | Shove past fish on the way down without snagging (up to 6 per cast), and reel and steer faster |
| Bait | 7 | Worm → Cricket → Shrimp → Minnow → Squid → Glow Lure → Gold Lure. Raises fish value (up to 3.2x), draws nearby fish toward the hook, lights up more of the dark, and makes golden fish more common |

Cash, tackle, the fish log and your best depth are saved in the browser.
