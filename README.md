# Devour Chess

A pixel-art chess game with a twist: **you are what you eat.** When a piece captures another, it absorbs all of the victim's movement powers. A pawn that eats a knight can hop like a knight; a knight that eats a queen can slide like one too.

## Play

Open `index.html` in a browser, or host the folder on GitHub Pages. No build step.

- Pick a game in the **NEW GAME** panel: play a **bot** (Easy, Medium or Hard), a **friend online**, or a friend on the **same screen**. Then press **START GAME**.
- The **Devour rule** switch turns the twist on or off. Off is classic chess captures.
- The **Fog of war** switch covers every square your team hasn't stood on or passed through in drifting smoke, for you and the bot alike. A piece that runs into a hidden enemy stops and captures it. Haze at a piece's feet means the other side can't see it. With **King can be captured** off (the default), kings are protected and checkmate wins; turn it on for no check and king-capture wins.
- The **XXL board** switch plays on 16 x 16: two sets side by side with one king each (the spare king is a queen), a second row of rooks, knights and bishops, and a row of pawns.
- **Kings' feast:** when a game would stall into a draw (only kings left, or a player stuck but not in check), any king that has eaten pieces shakes and spits them back out as its own pieces.
- **Sound:** all effects and the background music are synthesised in the browser (no audio files). An original chiptune loop plays, with a slower, darker version and wind in fog games. The SOUND panel has music and effects switches and a volume slider; press M to mute.
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
- `artifact.html`: the claude.ai copy, built from `index.html` by `tools/build_artifact.py`. It has everything except online play (claude.ai pages can't connect browsers directly).
