# Devour Chess

A pixel-art chess game with a twist: **you are what you eat.** When a piece captures another, it absorbs all of the victim's movement powers. A pawn that eats a knight can hop like a knight; a knight that eats a queen can slide like one too.

## Play

Open `index.html` in a browser, or host the folder on GitHub Pages. No build step.

- Click a piece, then a highlighted square to move.
- Colored pips under a piece show the powers it has absorbed.
- **CREATE GAME** starts an online game and gives you a link. Anyone who opens it can play you as Black, no account needed. Later visitors watch. Keep your page open while you play: your browser hosts the game.
- **PLAY HERE** gives you the CPU (plays Black) or two-player hotseat on one screen.
- Checkmate wins. Pawns promote to queens. No castling or en passant.

## How online play works

Players connect directly browser to browser with [PeerJS](https://peerjs.com) (bundled in `vendor/`, MIT licensed). PeerJS's free public server only introduces the two browsers; moves never pass through it. The game creator's browser is the referee: it checks every move and sends the board to everyone. If the creator reloads, the game is restored from their browser's storage and the friend can press RECONNECT.

Some strict school or work networks block direct browser connections. If a friend can't connect, try another network (e.g. a phone hotspot).

## Files

- `index.html`: the game, for GitHub Pages or any static host.
- `artifact.html`: an older build published as a claude.ai artifact, where online play goes through the artifact's shared storage (only people in the owner's organization can make moves there).
