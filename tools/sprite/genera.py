#!/usr/bin/env python3
"""MAREA — fa disegnare a Codex i fogli di <cartella>/lavori.txt, alcuni alla volta in parallelo (su Mac, Windows e Linux).

Per ogni riga (nome|immagine,immagine|prompt) che non ha ancora il suo PNG lancia `codex exec` con le immagini allegate e
fa salvare il risultato in fogli/<nome>.png (modello/<nome>.png per il foglio delle 5 viste). I log stanno in
fogli/log/. Serve Codex installato e collegato all'account ChatGPT (`codex login`). Un foglio di 12 disegni ci mette ~3-4
minuti; dopo ~40-50 immagini di fila Codex si può fermare: si rilancia, i fogli già fatti si saltano.
Senza Codex: prompt.py --stampa <nome> dà il prompt e le immagini da allegare a ChatGPT; il PNG si salva con quel nome.

Uso:  python tools/sprite/genera.py <cartella> [nome nome…] [--paralleli 4] [--rifai]
  nomi = solo quelle righe; --rifai = anche quelle che hanno già il PNG (lo sposta in fogli/scarti/ prima di rifarlo).
"""
import os
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comune import cartella_da_argomenti, opzione  # noqa: E402

CHIUSA = ('Generate ONE image with your image generation tool, then save the generated PNG into the current folder named '
          '{nome}.png (copy it there if it was saved elsewhere). Do NOT create or edit any other file and do not use git. '
          'Reply only with the file name.')


def lavori(cartella):
    p = os.path.join(cartella, 'lavori.txt')
    if not os.path.exists(p):
        sys.exit(f'manca {p}: prima tools/sprite/prompt.py')
    out = []
    for riga in open(p, encoding='utf-8').read().splitlines():
        if riga.strip() and not riga.startswith('#'):
            nome, rif, testo = riga.split('|', 2)
            out.append((nome.strip(), [r for r in rif.split(',') if r.strip()], testo.strip()))
    return out


def uno(cartella, nome, rif, testo):
    dove = os.path.join(cartella, 'modello' if nome.startswith('modello_') else 'fogli')
    log = os.path.join(dove, 'log')
    os.makedirs(log, exist_ok=True)
    immagini = [os.path.abspath(os.path.join(cartella, r)) for r in rif]
    mancano = [r for r in immagini if not os.path.exists(r)]
    if mancano:
        return nome, False, 'mancano le immagini ' + ', '.join(mancano)
    prompt = testo + '\n\n' + CHIUSA.format(nome=nome)
    with open(os.path.join(log, f'prompt_{nome}.txt'), 'w', encoding='utf-8') as f:
        f.write(prompt)
    t0 = time.time()
    # le immagini prima di -C: dopo --image un'opzione chiude l'elenco, così il «-» (prompt da stdin) non diventa un'immagine
    cmd = [shutil.which('codex') or 'codex', 'exec', '--skip-git-repo-check', '-s', 'workspace-write',
           '--image', ','.join(immagini), '-C', dove, '-']
    with open(os.path.join(log, f'codex_{nome}.log'), 'w', encoding='utf-8') as f:
        r = subprocess.run(cmd, input=prompt, text=True, stdout=f, stderr=subprocess.STDOUT, cwd=dove)
    fatto = os.path.exists(os.path.join(dove, nome + '.png'))
    nota = f'{time.time() - t0:.0f} s' + ('' if fatto else f' · niente PNG (codice {r.returncode}): guarda {log}/codex_{nome}.log')
    return nome, fatto, nota


def main():
    cartella = cartella_da_argomenti(__doc__)
    if not shutil.which('codex'):
        sys.exit('Codex non c\'è: npm install -g @openai/codex, poi codex login (account ChatGPT). Oppure ChatGPT a mano: '
                 'tools/sprite/prompt.py <cartella> --stampa <nome>')
    solo = [a for a in sys.argv[2:] if not a.startswith('--') and a != opzione('paralleli')]
    tutti = lavori(cartella)
    da_fare = []
    for nome, rif, testo in tutti:
        if solo and nome not in solo:
            continue
        png = os.path.join(cartella, 'modello' if nome.startswith('modello_') else 'fogli', nome + '.png')
        if os.path.exists(png):
            if '--rifai' not in sys.argv:
                continue
            scarti = os.path.join(os.path.dirname(png), 'scarti')
            os.makedirs(scarti, exist_ok=True)
            shutil.move(png, os.path.join(scarti, f'{nome}_{time.strftime("%H%M%S")}.png'))
        da_fare.append((nome, rif, testo))
    if not da_fare:
        print('niente da fare: i fogli ci sono già (--rifai per rifarli)')
        return
    n = int(opzione('paralleli', 4))
    print(f'{len(da_fare)} fogli a Codex, {n} alla volta…', flush=True)
    with ThreadPoolExecutor(n) as ex:
        for nome, fatto, nota in ex.map(lambda x: uno(cartella, *x), da_fare):
            print(f"  {'✓' if fatto else '✗'} {nome}  {nota}", flush=True)


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()
