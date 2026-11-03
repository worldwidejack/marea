#!/usr/bin/env python3
"""MAREA — PixelLab dall'API v2 (3/11/2026): i personaggi in pixel art vera, 8 direzioni e animazioni.

Il token sta solo sul computer di chi lo usa: variabile PIXELLAB_TOKEN o il file ~/.config/jackos/pixellab-token.
Mai nel repo, nelle issue o nelle PR (il repo è pubblico).

Uso:
  pixellab.py saldo
  pixellab.py personaggi                                   elenco dei personaggi dell'account
  pixellab.py scarica <id> <cartella>                      le 8 direzioni e le animazioni già fatte → PNG
  pixellab.py anima <id> <modello> [direzione …]           animazione da modello (1 generazione a direzione)
  pixellab.py lavoro <job_id>                              lo stato di un lavoro
Le direzioni sono quelle di PixelLab: south, south-east, east, north-east, north, north-west, west, south-west.
"""
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = 'https://api.pixellab.ai/v2'


def token():
    t = os.environ.get('PIXELLAB_TOKEN') or ''
    f = os.path.expanduser('~/.config/jackos/pixellab-token')
    if not t and os.path.exists(f):
        t = open(f).read()
    t = ''.join(t.split())
    if not t:
        sys.exit('manca il token: PIXELLAB_TOKEN o ~/.config/jackos/pixellab-token')
    return t


def api(metodo, percorso, dati=None):
    req = urllib.request.Request(BASE + percorso, method=metodo, data=json.dumps(dati).encode() if dati is not None else None,
                                 headers={'Authorization': 'Bearer ' + token(), 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        sys.exit(f'{metodo} {percorso}: HTTP {e.code} {e.read().decode()[:600]}')


def aspetta(job, ogni=5, max_s=900):
    t0 = time.time()
    while True:
        j = api('GET', f'/background-jobs/{job}')
        if j['status'] != 'processing':
            return j
        if time.time() - t0 > max_s:
            sys.exit(f'il lavoro {job} non finisce dopo {max_s} s')
        time.sleep(ogni)


def scarica_url(url, dove):
    os.makedirs(os.path.dirname(dove), exist_ok=True)
    # l'archivio dei file di PixelLab rifiuta lo user-agent di Python (403)
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (MAREA sprite)'})
    with urllib.request.urlopen(req, timeout=120) as r, open(dove, 'wb') as f:
        f.write(r.read())


def scarica(cid, cartella):
    c = api('GET', f'/characters/{cid}')
    for d, url in (c.get('rotation_urls') or {}).items():
        if url:
            scarica_url(url, os.path.join(cartella, 'direzioni', d + '.png'))
    for a in c.get('animations') or []:
        nome = a.get('display_name') or a.get('animation_type') or a.get('animation_group_id')
        for d in a.get('directions') or []:
            for i, url in enumerate(d.get('frames') or []):
                scarica_url(url, os.path.join(cartella, 'animazioni', nome, d['direction'], f'{i + 1:02d}.png'))
    json.dump(c, open(os.path.join(cartella, 'personaggio.json'), 'w'), indent=1, ensure_ascii=False)
    print(f"{c.get('name')}: {len(c.get('rotation_urls') or {})} direzioni, {len(c.get('animations') or [])} animazioni → {cartella}")


def main():
    a = sys.argv[1:]
    if not a:
        print(__doc__)
        return
    if a[0] == 'saldo':
        print(json.dumps(api('GET', '/balance')))
    elif a[0] == 'personaggi':
        for c in api('GET', '/characters?limit=50')['characters']:
            print(c['id'], c['size'], c['directions'], c['animation_count'], c['name'])
    elif a[0] == 'scarica':
        scarica(a[1], a[2])
    elif a[0] == 'anima':
        r = api('POST', '/animate-character', {'character_id': a[1], 'template_animation_id': a[2], 'mode': 'template',
                                               **({'directions': a[3:]} if a[3:] else {})})
        print(json.dumps({k: r.get(k) for k in ('animation_group_id', 'directions', 'background_job_ids', 'status')}))
        for job in r.get('background_job_ids') or []:
            j = aspetta(job)
            print(job, j['status'], json.dumps(j.get('usage')))
    elif a[0] == 'lavoro':
        print(json.dumps(api('GET', f'/background-jobs/{a[1]}'), indent=1)[:3000])


if __name__ == '__main__':
    main()
