# tools/sprite — gli sprite dei personaggi (look 3)

Gli script della ricetta in `.claude/skills/sprite-marea/SKILL.md`: leggi quella per il giro completo, le regole e il perché. Servono Python 3.12+ con Pillow, numpy e OpenCV: il venv di Fenaki li ha già (`<fenaki>/.venv/bin/python`, su Windows `<fenaki>\.venv\Scripts\python.exe`). Codex per disegnare (`genera.py`), oppure ChatGPT a mano.

| Script | Cosa fa |
|---|---|
| `viste.py guida <cartella> --testa 45` | la sagoma grigia delle 5 viste, da allegare per il modello di un personaggio nuovo |
| `prompt.py <cartella> --modello` | il prompt del foglio delle 5 viste (sagoma grigia + disegno approvato) |
| `viste.py taglia <cartella> <foglio>` | dal foglio delle 5 viste alle viste separate e al foglio da far approvare |
| `prompt.py <cartella> [--giro 2] [--mosse …]` | i prompt degli sprite: giro 1 = SE, E, NE; giro 2 = le altre 6 viste; `--stampa <nome>` per ChatGPT |
| `genera.py <cartella>` | manda i prompt a Codex, 4 alla volta, e salva i fogli in `fogli/` |
| `pixel.py <cartella>` | dai fogli agli sprite: taglio per sagome, scala, tavolozza comune, contorno di 1 pixel, piedi sulla riga |
| `foglio.py <cartella> [--apri]` | il foglio da guardare: per mossa le 9 viste × 4 disegni, sulla linea di terra, e il giro delle 16 direzioni |
| `in_fenaki.py <cartella>` | gli sprite nel banco di Fenaki: ogni mossa in ogni vista e il giro delle viste, da guardare e far votare |

La cartella di un personaggio sta nell'**Atelier di MAREA** (repo `worldwidejack/marea-atelier`, clonato accanto a `marea`): `<atelier>/personaggi/<id>/`, esempio vero `personaggi/f3-prova/`. Tutto si committa lì, tranne `controllo/`:

```
scheda.json         chi è e cosa fa: descrizione in inglese, immagini approvate, altezza, mosse (si committa)
lavori.txt          i prompt (prompt.py, si committa)
modello/            guida e viste del modello in 5 viste
fogli/              i fogli di Codex: <vista>_<mossa>-<mossa>.png, anche i bocciati, e REGISTRO.md (una riga per foglio)
sprite/             gli sprite <vista>_<mossa>_<n>.png, elenco.json e tavolozza.json
controllo/          il banco di Fenaki (resta sul computer)
_FOGLIO_sprite.jpg  il foglio da guardare (lo mostra anche la galleria dell'Atelier)
```
