#!/usr/bin/env python3
"""Gli sprite del protagonista pronti per il gioco: dall'Atelier agli atlanti di apps/client/public/assets/sprite/.

Uso: python tools/sprite/atlante.py <cartella personaggio dell'Atelier> [<altra copia con gli atlanti dell'Arena>]

Legge `sprite/`, `fogli/pixellab/16_direzioni/pronti/` e `fogli/pixellab/attrezzi/pronti/` (un PNG per disegno + elenco.json) e fa `borgo`;
da `fogli/pixellab/arena/pronti/<arma>.png+.json` fa un atlante per arma. Ogni disegno ha 2 pixel vuoti attorno (niente sbavature coi
mipmap), i doppioni si tengono una volta. Immagine WebP senza perdite. Nel JSON: w, h dell'immagine, d = chiave → [x, y, w, h, ax, ay, ms, px, py] (px, py: la punta della canna, se c'è).
"""
import json
import pathlib
import sys

from PIL import Image

QUI = pathlib.Path(__file__).resolve().parents[2]
USCITA = QUI / "apps/client/public/assets/sprite"
BORDO, LARGO = 2, 1024


def punta(im, ax, ay):
    """Il pixel pieno più lontano dal petto: nei disegni della canna è la sua punta."""
    a = im.getchannel("A").load()
    return max(((x, y) for y in range(im.height) for x in range(im.width) if a[x, y]), key=lambda p: (p[0] - ax) ** 2 + (p[1] - ay + 28) ** 2)


def impacchetta(nome, disegni):
    """disegni: chiave → (immagine RGBA, voce)."""
    posti, unici = {}, {}
    for k, (im, _) in disegni.items():
        unici.setdefault((im.size, im.tobytes()), []).append(k)
    x = y = BORDO
    riga = 0
    for (size, _), chiavi in sorted(unici.items(), key=lambda u: (-u[0][0][1], -u[0][0][0])):
        if x + size[0] + BORDO > LARGO:
            x, y, riga = BORDO, y + riga + BORDO, 0
        for k in chiavi:
            posti[k] = (x, y)
        x, riga = x + size[0] + BORDO, max(riga, size[1])
    foglio = Image.new("RGBA", (LARGO, y + riga + BORDO))
    d = {}
    for k, (im, v) in disegni.items():
        foglio.paste(im, posti[k])
        d[k] = [*posti[k], im.width, im.height, v["ax"], v["ay"], v.get("ms", 100)]
        if "_canna_" in k:
            d[k] += punta(im, v["ax"], v["ay"])
    USCITA.mkdir(parents=True, exist_ok=True)
    foglio.save(USCITA / f"{nome}.webp", lossless=True, quality=100, method=6)
    j = {"w": foglio.width, "h": foglio.height, "d": d}
    (USCITA / f"{nome}.json").write_text(json.dumps(j, separators=(",", ":")) + "\n", encoding="utf-8", newline="\n")
    print(f"{nome}: {len(disegni)} disegni ({len(unici)} diversi), {foglio.width}×{foglio.height}, {(USCITA / f'{nome}.webp').stat().st_size // 1024} KB")


def main():
    base = pathlib.Path(sys.argv[1])
    arena = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else sys.argv[1]) / "fogli/pixellab/arena/pronti"
    borgo = {}
    for c in ("sprite", "fogli/pixellab/16_direzioni/pronti", "fogli/pixellab/attrezzi/pronti"):
        for k, v in json.loads((base / c / "elenco.json").read_text(encoding="utf-8")).items():
            borgo[k] = (Image.open(base / c / f"{k}.png").convert("RGBA"), v)
    impacchetta("borgo", borgo)
    for f in sorted(arena.glob("*.json")):
        foglio = Image.open(f.with_suffix(".png")).convert("RGBA")
        voci = json.loads(f.read_text(encoding="utf-8"))
        impacchetta("arena_" + f.stem, {k: (foglio.crop((v["x"], v["y"], v["x"] + v["w"], v["y"] + v["h"])), v) for k, v in voci.items()})


if __name__ == "__main__":
    main()
