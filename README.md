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

## How rarity is decided

Whether an answer counts at all comes from the lists in the question files.
How rare it is comes from an estimated share of people who would give it:

- The first time a prompt comes up, the page asks Claude (Haiku 4.5, falling
  back to the "quick" tier) to estimate, for every listed answer, how many of
  100 people would say it. One call covers all of a run's new prompts, and the
  estimate is saved in the shared store (`priors/<prompt>`) for every player.
- Every player's latest answer to each prompt is saved too (`plays/<player id>`).
  Claude's estimate counts as 20 imaginary players and real answers blend in
  on top, so the crowd gradually takes over.
- Share to tier: under 1% Diamond, 1-3% Gold, 3-8% Silver, 8-20% Copper,
  20%+ Dirt. Without Claude's estimate, the hand-made tier stands in for it.
- The owner's stats screen lists answers players gave that aren't on any list,
  and has a button to estimate every remaining prompt at once.

## Daily prompts

There are 135 prompts: 70 classic ones in `questions.js` and 65 niche ones in
`questions-niche.js`. While `PLAYTEST` is `true` in `game.js`, every run picks
7 prompts you haven't played yet (4 niche + 3 classic), with no daily limit.
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
