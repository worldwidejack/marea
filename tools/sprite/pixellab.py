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
  pixellab.py pixelart <disegno.png> <uscita.png> [--lato 64] [--forza 200]
                                                           un disegno di Codex (su magenta o scontornato) → pixel art da
                                                           davanti, lato×lato; serve il python del venv di Fenaki (PIL)
  pixellab.py testo "<descrizione>" <uscita.png> [--lato 64] [--seme N]
                                                           da testo con Pixen, come il mozzo: low detail, low top-down,
                                                           da davanti (south), fondo trasparente (1 generazione)
  pixellab.py modifica <sprite.png> "<cosa cambia>" <uscita.png> [--seme N]
                                                           lo stesso sprite con una modifica a parole (edit-image-pixen):
                                                           faccia, posa e pixel restano (1 generazione)
  pixellab.py personaggio <sprite_south.png> "<descrizione>" [--seme N]
                                                           le 8 direzioni da uno sprite da davanti (create-character-v3, 1 generazione a 64x64);
                                                           stampa l'id, poi `scarica <id> <cartella>`
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


def pixelart(disegno, uscita, lato=64, forza=200):
    """image-to-pixelart: la figura scontornata, quadrata su 4×lato (l'ingresso consigliato è 4 volte l'uscita)."""
    import base64
    import io

    import numpy as np
    from PIL import Image
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import pixel_vero as pv
    im = Image.open(disegno).convert('RGBA')
    rgba = np.array(im)
    if rgba[..., 3].min() == 255:  # fondo magenta → alfa
        rgba[..., 3] = (pv.alfa_magenta(rgba[..., :3]) * 255).astype(np.uint8)
    ys, xs = np.where(rgba[..., 3] > 127)
    fig = Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')
    L = 4 * lato
    s = (L * 0.94) / max(fig.size)  # un filo di margine: piedi e capelli non toccano il bordo
    fig = fig.resize((round(fig.size[0] * s), round(fig.size[1] * s)), Image.LANCZOS)
    tela = Image.new('RGBA', (L, L))
    tela.paste(fig, ((L - fig.size[0]) // 2, L - fig.size[1] - round(L * 0.02)), fig)
    buf = io.BytesIO()
    tela.save(buf, 'PNG')
    r = api('POST', '/image-to-pixelart', {'image': {'type': 'base64', 'base64': base64.b64encode(buf.getvalue()).decode()},
                                          'image_size': {'width': L, 'height': L}, 'output_size': {'width': lato, 'height': lato},
                                          'init_image_strength': forza})
    os.makedirs(os.path.dirname(os.path.abspath(uscita)), exist_ok=True)
    tela.save(os.path.splitext(uscita)[0] + '_ingresso.png')
    open(uscita, 'wb').write(base64.b64decode(r['image']['base64']))
    print(uscita, json.dumps(r.get('usage')))


def testo(descrizione, uscita, lato=64, seme=None):
    """create-image-pixen con le impostazioni del mozzo (il più bello finora, 3/11): low detail, low top-down, south."""
    import base64
    r = api('POST', '/create-image-pixen', {'description': descrizione, 'image_size': {'width': lato, 'height': lato},
                                            'detail': 'low detail', 'view': 'low top-down', 'direction': 'south',
                                            'no_background': True, **({'seed': seme} if seme is not None else {})})
    job = r.get('background_job_id')
    if job:
        r = aspetta(job).get('last_response') or {}
    img = r.get('image') or (r.get('images') or [None])[0]
    if not img:
        sys.exit('nessuna immagine nella risposta: ' + json.dumps(r)[:600])
    os.makedirs(os.path.dirname(os.path.abspath(uscita)), exist_ok=True)
    if img.get('base64'):
        open(uscita, 'wb').write(base64.b64decode(img['base64']))
    else:
        scarica_url(img['url'], uscita)
    print(uscita, json.dumps(r.get('usage')))


def modifica(sprite, descrizione, uscita, seme=None):
    """edit-image-pixen: cambia solo quello che si chiede. Lato multiplo di 4, mai riscalare il pixel art."""
    import base64
    b = base64.b64encode(open(sprite, 'rb').read()).decode()
    r = api('POST', '/edit-image-pixen', {'image': {'type': 'base64', 'base64': b, 'format': 'png'}, 'description': descrizione,
                                          'no_background': True, **({'seed': seme} if seme is not None else {})})
    job = r.get('background_job_id')
    if job:
        j = aspetta(job)
        r = j.get('last_response') or {}
    img = r.get('image') or (r.get('images') or [None])[0]
    if not img:
        sys.exit('nessuna immagine nella risposta: ' + json.dumps(r)[:600])
    os.makedirs(os.path.dirname(os.path.abspath(uscita)), exist_ok=True)
    if img.get('base64'):
        open(uscita, 'wb').write(base64.b64decode(img['base64']))
    else:
        scarica_url(img['url'], uscita)
    print(uscita, json.dumps(r.get('usage')))


def personaggio(sprite, descrizione, seme=None):
    import base64
    b = base64.b64encode(open(sprite, 'rb').read()).decode()
    r = api('POST', '/create-character-v3', {'description': descrizione, 'reference_image': {'type': 'base64', 'base64': b, 'format': 'png'},
                                             'n_directions': 8, 'view': 'low top-down', 'template_id': 'mannequin', 'no_background': True,
                                             **({'seed': seme} if seme is not None else {})})
    print(json.dumps({k: r.get(k) for k in ('character_id', 'background_job_id', 'status', 'usage')}))
    job = r.get('background_job_id')
    if job:
        j = aspetta(job)
        print(job, j['status'], json.dumps(j.get('usage')))
        r = j.get('last_response') or r
    print('id personaggio:', r.get('character_id'))


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
    elif a[0] == 'pixelart':
        o = {k: int(a[a.index(k) + 1]) for k in ('--lato', '--forza') if k in a}
        pixelart(a[1], a[2], o.get('--lato', 64), o.get('--forza', 200))
    elif a[0] == 'testo':
        o = {k: int(a[a.index(k) + 1]) for k in ('--lato', '--seme') if k in a}
        testo(a[1], a[2], o.get('--lato', 64), o.get('--seme'))
    elif a[0] == 'modifica':
        modifica(a[1], a[2], a[3], int(a[a.index('--seme') + 1]) if '--seme' in a else None)
    elif a[0] == 'personaggio':
        personaggio(a[1], a[2], int(a[a.index('--seme') + 1]) if '--seme' in a else None)
    elif a[0] == 'lavoro':
        print(json.dumps(api('GET', f'/background-jobs/{a[1]}'), indent=1)[:3000])


if __name__ == '__main__':
    main()
