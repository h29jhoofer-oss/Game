# Pixel Parlor

A cozy pixel-art game room. `index.html` is the home page: pick **CHESS** or **CARDS**.

- `chess.html`: **Devour Chess** (below).
- `cards.html`: **Pixel Blackjack**.

Old chess invite links (`index.html#g-CODE`) still open the chess game.

## Pixel Blackjack

- Play against **1 to 5 bots** (PIP, MOSS, JUNIPER, TOFFEE and BRAMBLE, each with their own betting and playing style), or open an **online table** and send the link to **up to 5 friends**.
- Everyone plays against the dealer. Bet 5 to 100 chips, then **HIT**, **STAND** or **DOUBLE** (keys H, S, D; Space deals). Blackjack pays 3 to 2, the dealer draws to 17 and stands on all 17s, and the dealer peeks for blackjack when showing an ace or a ten. Four decks, reshuffled when the shoe runs low. No splits or insurance.
- Everyone starts with 200 chips; if you run out, the house lends you 200 more.
- Cards fly out of the shoe and flip over, the dealer's hidden card flips when it's their turn, chips are paid out or swept away, and old cards slide into the discard tray. Bots say what they're doing in speech bubbles.
- Its own synthesised lounge music, plus card, chip and win sounds. Sound settings are shared with chess.
- Online: the host's browser runs the table and never sends anyone the shoe or the dealer's face-down card. Players have 15 seconds to bet once someone has bet, and 25 seconds per turn (then they stand). Anyone who drops out can reopen the link to get their seat and chips back. A 7th visitor watches. The table has a chat.

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
- Checkmate wins. Pawns promote to queens. No castling or en passant.

## How online play works

Players connect directly browser to browser with [PeerJS](https://peerjs.com) (bundled in `vendor/`, MIT licensed). PeerJS's free public server only introduces the two browsers; moves never pass through it. The game creator's browser is the referee: it checks every move and sends the board to everyone. If the creator reloads, the game is restored from their browser's storage and the friend can press RECONNECT.

Some strict school or work networks block direct browser connections. If a friend can't connect, try another network (e.g. a phone hotspot).

## Files

- `index.html`: the game, for GitHub Pages or any static host.
- `artifact.html` (home), `artifact-chess.html` and `artifact-cards.html`: the claude.ai copy, built by `tools/build_artifact.py`. It has everything except online play (claude.ai pages can't connect browsers directly).
