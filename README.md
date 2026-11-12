# Devour Chess

A pixel-art chess game with a twist: **you are what you eat.** When a piece captures another, it absorbs all of the victim's movement powers. A pawn that eats a knight can hop like a knight; a knight that eats a queen can slide like one too.

## Play

Open `index.html` in a browser, or host the folder on GitHub Pages. No build step.

- Pick a game in the **NEW GAME** panel: play a **bot** (Easy, Medium or Hard), a **friend online**, or a friend on the **same screen**. Then press **START GAME**.
- The **Devour rule** switch turns the twist on or off. Off is classic chess captures.
- The **Fog of war** switch covers every square your team hasn't stood on or passed through in drifting smoke, for you and the bot alike. A piece that runs into a hidden enemy stops and captures it. Haze at a piece's feet means the other side can't see it. With **King can be captured** off (the default), kings are protected and checkmate wins; turn it on for no check and king-capture wins.
- Pawns that reach the far side let you pick a queen, rook, bishop or knight, and melt into their new shape.
- Click a piece, then a highlighted square to move. Pieces that eat grow the features of their victims.
- Online: **CREATE ONLINE GAME** gives you a link. Anyone who opens it can play you as Black, no account needed. Later visitors watch. Keep your page open while you play: your browser hosts the game. A friend's code can also be typed into **JOIN**.
- Checkmate wins. Pawns promote to queens. No castling or en passant.

## How online play works

Players connect directly browser to browser with [PeerJS](https://peerjs.com) (bundled in `vendor/`, MIT licensed). PeerJS's free public server only introduces the two browsers; moves never pass through it. The game creator's browser is the referee: it checks every move and sends the board to everyone. If the creator reloads, the game is restored from their browser's storage and the friend can press RECONNECT.

Some strict school or work networks block direct browser connections. If a friend can't connect, try another network (e.g. a phone hotspot).

## Files

- `index.html`: the game, for GitHub Pages or any static host.
- `artifact.html`: the claude.ai copy, built from `index.html` by `tools/build_artifact.py`. It has everything except online play (claude.ai pages can't connect browsers directly).
