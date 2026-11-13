"""Build the claude.ai copy of the game room.

Writes artifact.html (the home page) plus artifact-chess.html and
artifact-cards.html, published next to it as chess.html and cards.html.
claude.ai pages can't make direct browser-to-browser connections, so these
copies drop PeerJS and offer bot (and same-screen) games only.
"""
import pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
PEER = '<script src="vendor/peerjs.min.js"></script>'

# Home page: the artifact host supplies the document skeleton.
s = (root / "index.html").read_text()
head_end = s.index("</head>")
styles = s[s.index("<style>"):s.index("</style>") + len("</style>")]
fonts = re.findall(r'<link [^>]+>', s[:head_end])
body = s[s.index("<body>") + len("<body>"):s.index("</body>")]
home = "\n".join(["<title>Pixel Parlor</title>", '<meta name="claude:viewport-fit-sides" content="cover">', *fonts, styles, body.strip()]) + "\n"
(root / "artifact.html").write_text(home)

# Game pages are served as full documents of their own.
for name, msg_from, msg_to in [
    ("chess", '"Online play couldn\'t load. You can still play the bot here."',
     '"Online play works in the GitHub Pages version. Here you can play the bot or a friend on the same screen."'),
    ("cards", '"Online play couldn\'t load. You can still play the bots here."',
     '"Online play works in the GitHub Pages version. Here you can play the bots."'),
]:
    page = (root / f"{name}.html").read_text()
    assert PEER in page and msg_from in page, name
    page = page.replace(PEER, "").replace(msg_from, msg_to)
    (root / f"artifact-{name}.html").write_text(page)

print("wrote artifact.html, artifact-chess.html, artifact-cards.html")
