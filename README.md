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

Everyone gets the same 7 prompts each day (picked from the date, so no server
is needed). The bank in `questions.js` holds 70 categories, so no prompt
repeats for 10 days, and each 10-day cycle is reshuffled into new combinations.
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

Add an entry to `questions.js`:

```js
["Name a fruit",
 "apple,banana|mango,peach|fig,guava|lychee/litchi|durian,rambutan"],
```

Five tiers separated by `|` (common → rarest), answers by `,`, alternate
spellings by `/`. Plurals, "the", punctuation and small typos are handled
automatically. Every 7 categories you add gives one more day before repeats.
