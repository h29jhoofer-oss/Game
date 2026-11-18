# Pixel Parlor

A cozy pixel-art game room. `index.html` is the home page: pick **CHESS**, **CARDS** or **DICE**.

- `chess.html`: **Devour Chess** (below).
- `cards.html`: **Pixel Blackjack**.
- `dice.html`: **Pixel Liar's Dice**.

Old chess invite links (`index.html#g-CODE`) still open the chess game.

## Pixel Blackjack

- Play against **1 to 5 bots** (PIP, MOSS, JUNIPER, TOFFEE and BRAMBLE, each with their own betting and playing style), or open an **online table** and send the link to **up to 5 friends**.
- Everyone plays against the dealer. Bet $5 to $100, then **HIT**, **STAND**, **DOUBLE** or **SPLIT** (keys H, S, D, P; Space deals). Blackjack pays 3 to 2, the dealer draws to 17 and stands on all 17s, and the dealer peeks for blackjack when showing an ace or a ten. Four decks, reshuffled when the shoe runs low. Split any two cards of the same value into separate hands (up to 4, double after split allowed); split aces get one card each, and 21 on a split hand is not blackjack. No insurance.
- Everyone starts with **$500** and there are no loans. A bot that runs out of money leaves the table; if you run out, you're done (online you can stay and watch) and START OVER deals a fresh table. Each player's bankroll sits beside their bet as a pile of chips.
- Cards fly out of the shoe and flip over, the dealer's hidden card flips when it's their turn, chips are paid out or swept away, and old cards slide into the discard tray. Bots say what they're doing in speech bubbles.
- **Table mode:** CLASSIC, CHEATER or BRIBES.
- **Cheater mode** (needs at least 3 players: you plus 2+ bots, or 3+ people online). Roles are dealt in secret each game:
  - **Dealer**: sits in the dealer's spot and has a pistol lying left of the dealer's cards. Click it, then click a player's hand to shoot. One shot ends the game.
  - **Cheater**: once the starting hands are dealt, a private panel shows the next 3 cards in the shoe and the dealer's face-down card. Wins by reaching $1,000.
  - **Dealer at the cards**: a human dealer plays the house hand themselves once the players are done, with HIT, STAND, DOUBLE and SPLIT (keys H, S, D and P), and isn't bound by the draw-to-17 rule. DOUBLE takes one card and makes every bet on the table count twice (a doubled loss can cost more than the bet, never more than a player has; blackjacks still pay 3 to 2). SPLIT turns a pair into two house hands, and each player's hand plays half its bet against each one. Online, if the dealer runs out of time the house rule finishes the hand. Bot dealers still draw to 17.
  - **Jester**: on their own turn, sees the card they'd get if they hit. Wins if the dealer shoots them, so they act guilty.
  - **The gambler** (always exactly one): wins with the dealer if the cheater is shot. Has one ace in their pocket: once a game, on their turn, they can quietly swap it for a card in their hand. The card just changes on the table, with no log line or sound.
  - **Regulars** (anyone else, at 5 or 6 players): honest players with no tricks, who win with the dealer.
  - **Calling out the gambler:** once a game, any player except the gambler can call someone out (button, then click their hand or name). Right: they take half the gambler's money and the pocket ace, and the gambler's role is shown to everyone. Wrong: the accused takes half of theirs. Bots sometimes call out a swap they see, and now and then make a wild guess.
  - **Hidden totals:** in Cheater mode each player only sees their own hand total (the dealer's is still shown).
  - **Secrets on B:** every player's screen looks the same. Your role, the peek panels, the pocket ace and your role tag only show while you **hold B**, or on a phone, **press and hold your own cards** on the table (nothing on screen gives it away). The role popup at the start of each game tells you so. Everyone except the dealer gets the same call-out box, even the gambler.
  - Shoot the cheater: the dealer, gambler and regulars win. Shoot the jester: the jester wins. Shoot the gambler or a regular: the cheater wins. The cheater going broke is a win for the dealer. A reveal shows everyone's role, then NEW GAME deals new roles with everyone back at $500.
  - Bot cheaters use what they see most of the time; bot jesters bet big and play cocky; a bot dealer tracks who keeps making suspiciously perfect hits and stands, betting big and winning fast, then takes its shot (it can be fooled by the jester).
  - Online, 3 to 6 people can play (the dealer counts as one, so up to 5 at the cards). With 3 the roles are a dealer, a cheater and a regular; with 4 or more a jester and a gambler join, then regulars (and the call-out box only appears when there is a gambler). Against bots you need at least 2. The host presses DEAL ROLES once at least 3 are seated; latecomers join as regulars until all 6 seats are taken. Each player's browser is only ever sent its own role and its own secrets (the cheater's and jester's peeks, a gambler's pocket).
- Its own synthesised lounge music, plus card, chip and win sounds. Sound settings are shared with chess.
- Online: the host's browser runs the table and never sends anyone the shoe or the dealer's face-down card. Players have 15 seconds to bet once someone has bet, and 25 seconds per turn (then they stand). Anyone who drops out can reopen the link to get their seat and chips back. A 7th visitor watches. The table has a chat.

- **Bribes mode** (3 to 6 players; against bots you need at least 2). Everyone's screen looks the same; hold B (or press and hold your own cards) to see your role and secrets.
  - **Roles:** one public dealer; secretly **0, 1 or 2 undercover inspectors** (nobody is told how many, so you can't count your way to them); everyone else is a **high roller with a secret motive**:
    - **Greedy** (the most common): after 12 rounds, wins with the best high roller score (money plus $50 per favour point). If the top score belongs to a non-greedy player, no greedy player wins.
    - **Spiteful:** doesn't care about winning. Wins (alongside whoever else wins) if, when the game ends, someone else has gone broke or the other players average under $400.
    - **The jester:** wants to get caught. If an inspector names them in a catch, the catch doesn't count and the jester wins when the game ends.
    - **The snitch:** see below.
    - **Undercover:** working with the inspectors, who don't know who they are. Their bribes are marked: if the dealer pockets 3 of them, the dealer is caught and the undercover player and the inspectors win on the spot. They also win whenever the inspectors win.
    - Each special motive turns up at most once, and maybe not at all.
  - **Bribes buy favours.** To bribe, click your own chip pile on the table: a popup lets you pick a favour and an amount, then the timing game starts. The favours: **PEEK** (hold B to see the dealer's hidden card this round), **SWAP** (on your turn, hold B and trade one of your cards for the next one in the shoe), **JINX** (pick another player: their next hand is dealt stiff, 12 to 16, and if they hit it a 10 comes) or **SHIELD** (your next losing hand is quietly refunded; everyone else still sees it as a loss). Every pocketed bribe also earns a **favour point** worth $50 in the final score.
  - **Timing games:** slipping a bribe and pocketing one are both stop-the-marker games. A fumble is heard by everyone ("somebody fumbles chips under the table", "chips clatter near the dealer's pocket") but nobody is named. Only the dealer sees offers, with the favour asked for.
  - **Inspectors** make catches by naming a player who bribed the dealer this round or last. Right: that player pays the inspector half their money. Wrong: they take half the inspector's. Either way the inspector's badge is out. An inspector can only make catches once one of their own bribes has been refused or returned. **Two catches** and the inspectors win; if the dealer ever pockets an inspector's bribe, the inspectors win on the spot.
  - **The snitch** watches for bribes and, once a round (hold B), sends the inspectors an anonymous letter about any player, true or false. Only an inspector sees it: while they hold B, a pixel envelope appears on the table, and clicking it opens the letter. If a catch lands on someone they tipped about, the snitch wins too when the game ends. Anyone can **call out the snitch** once a game: right, they take half the snitch's money and silence them; wrong, the accused takes half of theirs.
  - **The dealer** wins by pocketing **$300**, but loses if they pocket an inspector's bribe, 3 marked bribes, or the inspectors make 2 catches.
  - Bots bribe for favours (and use a SWAP on a stiff hand), fumble now and then, take bribes or refuse known inspectors, act on tips, and occasionally take a stab at the snitch. A spiteful bot mostly buys JINXes on the richest player; a jester bot bribes often and fumbles on purpose; an undercover bot bribes often.
- **Chips** are drawn as round pixel chips (a face with an inlay and edge stripes, and a striped rim), stacked on the felt and on the bet buttons.

## Pixel Liar's Dice

- 2 to 6 players: you and **1 to 5 bots**, or an **online table** with up to 5 friends (the host presses START GAME once at least 2 are seated; anyone arriving mid-game is dealt in next game, and a 7th visitor watches).
- Everyone starts with 5 dice, rolled in secret under a leather cup. Players take turns bidding on how many dice of one face are on the whole table (**ones are wild**). Each bid must raise the count, or keep it and raise the face.
- **LIAR!** lifts every cup: if the bid was short, the bidder loses a die, otherwise the caller does. **SPOT ON** wins a die back (up to 5) if the bid is exactly right, and costs a die if not. The loser starts the next round; the last player with dice wins.
- **Loaded die:** once a game, each player can secretly turn one of their dice to any face. There's no log line or sound.
- Bots (PIP, MOSS, JUNIPER, TOFFEE, BRAMBLE) work out the odds from their own dice; careful ones call liar sooner, bluffers push their bids, and they use their loaded die now and then.
- Online: the host's browser runs the table and only ever sends each player their own dice; everyone's dice are sent only when the cups come up. 30 seconds per turn (then the smallest raise is made for you). Keys: + and - for the count, 2 to 6 for the face, Enter bids, L liar, O spot on.

## Devour Chess

A pixel-art chess game with a twist: **you are what you eat.** When a piece captures another, it absorbs all of the victim's movement powers. A pawn that eats a knight can hop like a knight; a knight that eats a queen can slide like one too.

## Play

Open `index.html` in a browser and pick CHESS, or host the folder on GitHub Pages. No build step.

- Pick a game in the **NEW GAME** panel: play a **bot** (Easy, Medium or Hard), a **friend online**, or a friend on the **same screen**. Then press **START GAME**.
- The **Devour rule** switch turns the twist on or off. Off is classic chess captures.
- The **Fog of war** switch covers every square your team hasn't stood on or passed through in drifting smoke, for you and the bot alike. A piece that runs into a hidden enemy stops and captures it. Haze at a piece's feet means the other side can't see it. With **King can be captured** off (the default), kings are protected and checkmate wins; turn it on for no check and king-capture wins.
- The **XXL board** switch plays on 16 x 16: two sets side by side with one king each (the spare king is a queen), a second row of rooks, knights and bishops, and a row of pawns.
- **Kings' feast:** when a game would stall into a draw (only kings left, or a player stuck but not in check), any king that has eaten pieces shakes and spits them back out as its own pieces.
- **Sound:** all effects and the background music are synthesised in the browser (no audio files). An original chiptune loop plays, with a slower, darker version and wind in fog games. The SOUND panel has music and effects switches and a volume slider; press M to mute.
- **Mystery boxes** switch: every few moves a treasure chest falls. Balloon chests drift down over 3 moves (a shadow shows where); plain chests crash down at once and crush whatever is there (never a king). Finish a move on a chest to open it:
  - **Teleport** (saved): the piece gets a light blue star. Press TELEPORT under POWERS, then any empty square, and it jumps there.
  - **Fireball** (saved): press FIREBALL, then a square. Every piece in the 3x3 around it is destroyed, yours too, but never kings.
  - **Extra turn**, **change** into another piece, or become a secret **jester** (only its owner sees the hat; whoever eats it dies, even a king).
  - Using a saved power takes your turn. The bot saves and uses them too.
- **Premove**: while the bot or your online opponent is thinking, pick a piece and a square. The move plays the moment it's your turn, if it's still allowed. Click anywhere or press Esc to cancel.
- **Taunts**: six buttons (HA HA HA!, TOO EASY!, YUM YUM!, OOPS!, BRING IT!, ZZZ...) pop a speech bubble over your king with a sound. Your online opponent sees them, and the bot taunts back now and then.
- Pawns that reach the far side let you pick a queen, rook, bishop or knight, and melt into their new shape.
- Click a piece, then a highlighted square to move. Pieces that eat grow the features of their victims.
- Online: **CREATE ONLINE GAME** gives you a link. Anyone who opens it can play you as Black, no account needed. Later visitors watch. Keep your page open while you play: your browser hosts the game. A friend's code can also be typed into **JOIN**.
- Once an online game starts, the board fills the screen with the game buttons and a chat beside it (below it on phones). Players can type or use quick replies; spectators can read along.
- Bot and same-screen games use the same big-board layout once they start, with UNDO / NEW GAME buttons, piece info, taunts and (with mystery boxes on) the POWERS buttons beside the board instead of chat. NEW GAME brings the settings back.
- Checkmate wins. Castling (king and rook that have never moved; on the XXL board, the nearest rook on each side) and en passant (by any piece with pawn powers) work as in normal chess.

## How online play works

Players connect directly browser to browser with [PeerJS](https://peerjs.com) (bundled in `vendor/`, MIT licensed). PeerJS's free public server only introduces the two browsers; moves never pass through it. The game creator's browser is the referee: it checks every move and sends the board to everyone. If the creator reloads, the game is restored from their browser's storage and the friend can press RECONNECT.

Some strict school or work networks block direct browser connections. If a friend can't connect, try another network (e.g. a phone hotspot).

## Files

- `index.html`: the game, for GitHub Pages or any static host.
- `artifact.html` (home), `artifact-chess.html`, `artifact-cards.html` and `artifact-dice.html`: the claude.ai copy, built by `tools/build_artifact.py`. It has everything except online play (claude.ai pages can't connect browsers directly).
