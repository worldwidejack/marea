#!/usr/bin/env python3
"""MAREA — gli sprite di un personaggio nel banco di Fenaki, per controllarli prima di metterli nel gioco.

Scrive <cartella>/controllo/ (una cartella di disegni di Fenaki):
- ogni sprite di sprite/ ingrandito ×zoom a pixel netti (Fenaki misura e mostra meglio i disegni grandi), col perno sul
  punto d'appoggio dello sprite (i piedi, come nel gioco);
- le animazioni <mossa>-<vista>-v1: i 4 disegni della mossa in quella vista, in giro, a 8 disegni al secondo;
- le animazioni giro-<mossa>-v1: la stessa posa in tutte le viste disegnate, da S a N (per la camminata il disegno 2, le
  gambe unite; per le altre il disegno 1): girando, la testa, l'altezza e i colori devono restare gli stessi;
- progetto.json coi nomi delle scene in parole.
Poi lo guardi con Fenaki: gli strumenti MCP «fenaki» (situazione, provino, momento, teste, diagnosi, chiedi_giudizio…) e la
pagina (fenaki.py --app, «Nuovo progetto» → questa cartella controllo/). Rilanciarlo dopo aver rifatto gli sprite riscrive
disegni e animazioni -v1; giudizi, richieste e versioni nuove restano.

Uso:  python tools/sprite/in_fenaki.py <cartella> [--zoom 8] [--fps 8]
"""
import json
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comune import CODICI, NOME_VISTA, cartella_da_argomenti, leggi_scheda, opzione  # noqa: E402


def leggi(p, vuoto):
    if os.path.exists(p):
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    return vuoto


def scrivi(p, dati):
    tmp = p + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(dati, f, ensure_ascii=False, indent=1)
    os.replace(tmp, p)


def main():
    cartella = cartella_da_argomenti(__doc__)
    scheda = leggi_scheda(cartella)
    K = int(opzione('zoom', 8))
    durata = max(1, round(24 / float(opzione('fps', 8))))   # fotogrammi a 24 fps per disegno
    elenco = leggi(os.path.join(cartella, 'sprite', 'elenco.json'), None)
    if not elenco:
        sys.exit('mancano gli sprite: prima tools/sprite/pixel.py')
    out = os.path.join(cartella, 'controllo')
    dati = os.path.join(out, 'fenaki')
    os.makedirs(dati, exist_ok=True)
    disegni = leggi(os.path.join(dati, 'disegni.json'), {})
    for k, e in elenco.items():
        im = Image.open(os.path.join(cartella, 'sprite', k + '.png')).convert('RGBA')
        im.resize((im.width * K, im.height * K), Image.NEAREST).save(os.path.join(out, k + '.png'))
        voce = disegni.get(k, {})
        voce['perno'] = [e['ax'] * K, e['ay'] * K]
        disegni[k] = voce
    scrivi(os.path.join(dati, 'disegni.json'), disegni)
    # la tela: abbastanza larga per lo sprite più largo da tutte e due le parti del perno, la terra in basso
    lato = max(max(e['ax'], e['w'] - e['ax']) for e in elenco.values()) * K
    alto = max(e['ay'] for e in elenco.values()) * K
    tela = {'w': 2 * lato + 80, 'h': alto + 80}
    terra = tela['h'] - 40
    cella = lambda k, d: {'disegno': k, 'durata': d, 'x': tela['w'] // 2, 'y': terra, 'scala': 1, 'rot': 0}  # noqa: E731
    mosse = list(scheda['mosse']) + sorted({k.rsplit('_', 2)[1] for k in elenco} - set(scheda['mosse']))
    famiglie, scritte = {}, []
    for m in mosse:
        for v in CODICI:
            celle = [cella(f'{v}_{m}_{n}', durata) for n in range(1, 5) if f'{v}_{m}_{n}' in elenco]
            if not celle:
                continue
            nome = f'{m}-{v}'
            scrivi(os.path.join(dati, nome + '-v1.json'), {'fps': 24, 'tela': tela, 'terra': terra, 'celle': celle})
            famiglie[nome] = f'{m} · {NOME_VISTA[v]}'
            scritte.append(nome + '-v1')
        posa = 2 if m == 'cammina' else 1
        giro = [cella(f'{v}_{m}_{posa}', 6) for v in CODICI if f'{v}_{m}_{posa}' in elenco]
        if len(giro) > 1:
            scrivi(os.path.join(dati, f'giro-{m}-v1.json'), {'fps': 24, 'tela': tela, 'terra': terra, 'celle': giro})
            famiglie[f'giro-{m}'] = f'{m} · il giro delle viste (disegno {posa})'
            scritte.append(f'giro-{m}-v1')
    progetto = leggi(os.path.join(dati, 'progetto.json'), {})
    progetto.setdefault('nome', f"{scheda.get('nome', os.path.basename(cartella))} · sprite")
    progetto.setdefault('sottotitolo', f"MAREA, look 3: {len(elenco)} sprite ×{K}")
    progetto['famiglie'] = {**progetto.get('famiglie', {}), **famiglie}
    scrivi(os.path.join(dati, 'progetto.json'), progetto)
    print(f'{len(elenco)} disegni ×{K} e {len(scritte)} animazioni in {out}')
    print('animazioni:', ' '.join(scritte))
    print(f'Fenaki: situazione(cartella="{out}"), poi provino/momento/teste/diagnosi; la pagina: fenaki.py --app → Nuovo progetto')


if __name__ == '__main__':
    main()
