# Deep Dig

A pixel-art daily trivia game. Every day you get **7 open-ended prompts**
("Name a fruit", "Name a bone in the human body", ...) with **20 seconds** each.
Any correct answer counts, but the rarer it is, the more it's worth — and the
deeper your little miner digs.

| Tier    | Rarity    | Points |
|---------|-----------|--------|
| DIAMOND | Legendary | 100    |
| GOLD    | Epic      | 75     |
| SILVER  | Rare      | 50     |
| COPPER  | Uncommon  | 25     |
| DIRT    | Common    | 10     |
| BEDROCK | Wrong     | 0      |

Each point = 10m of depth; a perfect dig reaches 7000m.

## Daily prompts

There are 150 prompts: 70 classic ones in `questions.js` and 80 niche ones in
`questions-niche.js`. While `PLAYTEST` is `true` in `game.js`, every run picks
7 prompts you haven't played yet (5 niche + 2 classic), with no daily limit.
Once you've seen them all, the cycle starts over. With `PLAYTEST` set to
`false`, everyone gets the same 7 prompts each day, picked from the date.
A new dig unlocks at local midnight. There's also an unlimited **Practice Mine**
that doesn't affect stats.

Progress, streaks and stats are saved in the browser (`localStorage`).

## Run it

It's a static site — just open `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
```

To host it for free, enable GitHub Pages on this repo (Settings → Pages → deploy from branch).

## Adding questions

Add an entry to `questions.js` (classic) or `questions-niche.js` (niche):

```js
["Name a fruit",
 "apple,banana|mango,peach|fig,guava|lychee/litchi|durian,rambutan"],
```

Five tiers separated by `|` (common → rarest), answers by `,`, alternate
spellings by `/`. Plurals, "the", punctuation and small typos are handled
automatically. Every 7 categories you add gives one more day before repeats.
