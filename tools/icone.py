# Icone dell'app installabile (PWA): una barca a vela a pixel, 32×32, ingrandita senza sfumature.
# Uso: python3 tools/icone.py  → apps/client/public/icon-*.png, apple-touch-icon.png, favicon.png
# Solo colori di ART_BIBLE §2.
from PIL import Image
import os
C = {
  '.': (0x16, 0x3F, 0x73),  # abisso (sfondo)
  'd': (0x24, 0x78, 0xA8),  # acqua profonda
  'a': (0x3F, 0xB9, 0xC9),  # acqua
  'b': (0x7F, 0xE3, 0xE0),  # acqua bassa (creste)
  's': (0xF4, 0xE3, 0xC1),  # sabbia chiara (vela)
  'z': (0xE2, 0xB9, 0x7F),  # sabbia (ombra della vela)
  'r': (0xE8, 0x43, 0x3F),  # rosso lanterna
  'l': (0xC9, 0x8A, 0x4B),  # legno chiaro
  'w': (0x8E, 0x5A, 0x2B),  # legno
  'k': (0x5A, 0x3A, 0x1E),  # legno scuro
  'y': (0xF5, 0xD5, 0x47),  # giallo (luna)
}
ART = [
  "................................",
  "................................",
  "................................",
  "................................",
  "......................yyy.......",
  ".....................yy.........",
  "................r....yy.........",
  "................rr....yyy.......",
  "................k...............",
  "...............sk...............",
  "..............ssk...............",
  ".............sssks..............",
  "............ssssksz.............",
  "...........sssssksz.............",
  "..........ssssssksz.............",
  ".........rrrrrrrkszz............",
  "........sssssssskszz............",
  ".......ssssssssskszzz...........",
  "......sssssssssskszzz...........",
  "................k...............",
  ".......wwwwwwwwwwwwwwwwww.......",
  "........llllllllllllllll........",
  ".........kkkkkkkkkkkkkk.........",
  "...b.....aaaaaaaaaaaaaa....b....",
  "..bab..baaaaaaaaaaaaaaaab.bab...",
  ".baaab.aaaaaaaaaaaaaaaaaabaaab..",
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "aaddaaaaaddaaaaaaddaaaaaaddaaaad",
  "dddddddddddddddddddddddddddddddd",
  "dddddddddddddddddddddddddddddddd",
  "dddddddddddddddddddddddddddddddd",
  "dddddddddddddddddddddddddddddddd",
]
assert len(ART) == 32 and all(len(r) == 32 for r in ART), [len(r) for r in ART]
img = Image.new('RGB', (32, 32))
for y, row in enumerate(ART):
  for x, ch in enumerate(row): img.putpixel((x, y), C[ch])
out = os.path.join(os.path.dirname(__file__), '..', 'apps', 'client', 'public')
for name, size in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180), ('favicon.png', 32)]:
  img.resize((size, size), Image.NEAREST).save(os.path.join(out, name), optimize=True)
# maskable: la barca nell'80 % centrale (zona sicura), il resto ripete i bordi (cielo sopra, mare ai lati e sotto)
big = Image.new('RGB', (40, 40))
for y in range(40):
  for x in range(40): big.putpixel((x, y), img.getpixel((min(31, max(0, x - 4)), min(31, max(0, y - 4)))))
m = big.resize((520, 520), Image.NEAREST).crop((4, 4, 516, 516))
m.save(os.path.join(out, 'icon-maskable-512.png'), optimize=True)
print('ok')
