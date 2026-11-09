"""Builds index.html (and artifact.html for publishing) from src/game.html,
embedding images/netanyahu.png so the face always shows."""
import base64, io
from PIL import Image

b = io.BytesIO()
Image.open('images/netanyahu.png').save(b, 'WEBP', quality=88)
face = base64.b64encode(b.getvalue()).decode()
body = open('src/game.html').read().replace('__FACE__', face)

open('artifact.html', 'w').write(body)
open('index.html', 'w').write(
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    + body + '\n</html>\n')
