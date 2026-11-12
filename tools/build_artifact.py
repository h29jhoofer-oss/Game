"""Build artifact.html (the claude.ai copy) from index.html.

claude.ai pages can't make direct browser-to-browser connections, so this
copy drops PeerJS and offers bot and same-screen games only.
"""
import pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
s = (root / "index.html").read_text()
head_end = s.index("</head>")
styles = s[s.index("<style>"):s.index("</style>") + len("</style>")]
fonts = re.findall(r'<link [^>]+>', s[:head_end])
body = s[s.index("<body>") + len("<body>"):s.index("</body>")]
body = body.replace(
    '"Online play couldn\'t load. You can still play the bot here."',
    '"Online play works in the GitHub Pages version. Here you can play the bot or a friend on the same screen."')
out = "\n".join([
    "<title>Devour Chess</title>",
    '<meta name="claude:viewport-fit-sides" content="cover">',
    *fonts,
    styles,
    body.strip(),
]) + "\n"
(root / "artifact.html").write_text(out)
print("wrote artifact.html", len(out), "bytes")
