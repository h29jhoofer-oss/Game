"""Builds the playable pages from src/, embedding each face image so it always shows.

  src/game.html  + images/netanyahu.png + images/bot1-5.png -> index.html  (Bibi Clicker)
  src/trump.html + images/trump.png     -> trump.html  (Trump Clicker)

Also writes artifact*.html (same page without the <html>/<head> wrapper) for publishing.
"""
import base64, io
from PIL import Image

GAMES = [
    ('src/game.html', 'images/netanyahu.png', 'index.html', 'artifact.html'),
    ('src/trump.html', 'images/trump.png', 'trump.html', 'artifact-trump.html'),
]

for src, img, out, art in GAMES:
    b = io.BytesIO()
    Image.open(img).save(b, 'WEBP', quality=88)
    face = base64.b64encode(b.getvalue()).decode()
    body = open(src).read().replace('__FACE__', face)
    for i in range(1, 6):
        if f'__BOT{i}__' in body:
            b = io.BytesIO()
            Image.open(f'images/bot{i}.png').save(b, 'WEBP', quality=85)
            body = body.replace(f'__BOT{i}__', base64.b64encode(b.getvalue()).decode())
    open(art, 'w').write(body)
    open(out, 'w').write(
        '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        + body + '\n</html>\n')
