# La Diga dei Disertori (Riccardo, 15 ott 2026, #354): l'ingresso nella Gola del Dente sull'Isola della Tempesta, il kit del relitto della
# «Stella del Mattino», la Ruota di Sentina, il pilone dell'arena, il ponte mobile e i nemici (la Guardia della Paratia, il Fuciliere
# d'Acquafonda, l'Albatros di Pece, il Capitano Vaelen). Scritto sul PC di Riccardo senza Blender: MAI ESEGUITO. Il Claude di Jack lo lancia con:
#   npm run assets prop_ingresso_diga dng_diga_pavimento dng_diga_muro dng_diga_muro_basso dng_diga_colonna dng_diga_ruota dng_diga_pilone dng_diga_ponte nem_guardiano nem_fuciliere nem_albatros nem_vaelen
# poi lo sistema se qualcosa non torna, conta i triangoli e guarda il foglio dei contatti (tests/out/rpg_contact.png).
# I nomi sono quelli che cerca il codice: prop_ingresso_<stile> (game/ingressi.ts), dng_diga_pavimento/muro/muro_basso e dng_diga_colonna
# (il cannone sull'affusto: rpg/dungeon_scene.ts), dng_diga_ruota (solo il piedistallo: la ruota d'ottone che gira la mette il client),
# dng_diga_pilone (la bitta intera: il moncone fracassato lo mette il client) e dng_diga_ponte (rpg/diga_fx.ts: il tavolato 6 × 4 m con la
# cerniera a x = 0, che si allunga verso −X), e il campo `model` di enemies.json.
# Finché i modelli mancano dal manifest il gioco usa i segnaposto in codice di apps/client/src/rpg/diga.ts (nemici, kit, ruota, pilone,
# ponte, rottami) e apps/client/src/game/ingressi_forme.ts (ingresso, `prua`): le forme qui sotto li ricalcano, così l'aspetto non cambia di
# colpo. La Guardia ha DUE oggetti: il corpo (`nem_guardiano`) e il portello (`portello`, lo scudo che il client nasconde quando va in
# frantumi): il nodo deve chiamarsi proprio così. I rottami, la schiuma della risacca, il mare oltre la murata, le corsie e gli scudi
# restano in codice: niente modello.
# Le parti che brillano (l'oblò dello scafandro, gli occhi, la lanterna azzurra, la vela del Capitano) usano `mat_emissivo`.
# Convenzioni come models_mausoleo.py: x destra, y su, davanti −Z, 1 unità = 1 m, pivot a terra al centro; dng_* moduli ≤ 60 triangoli
# (pavimento da 0 a −0,3, muri da 0 a 2,4, bassi 0,6), colonna, ruota, pilone e ponte 50-200; nem_* ≤ 600 (il Capitano, boss, ≤ 1.200);
# solo colori della palette e i campioni piatti `p_<colore>` dell'atlas. Triangoli NON contati (qui niente Python): li conta il Claude di Jack.
import math
from lib import Mesh, Xf

EM = 'mat_emissivo'


def _obj(*ms, **info):
    out = [m.build() for m in ms]
    return (out, info) if info else out


def _quad(m, pts, reg, mat=None):
    m.poly(pts, reg, mat)


def _anello(m, c, r, t, reg, n=8, asse='y'):
    """Anello (toro grezzo a sezione quadra) attorno a c: asse 'y' = steso a terra, 'z' = in piedi verso −Z."""
    for i in range(n):
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        p = lambda a, rr: (c[0] + math.cos(a) * rr, c[1], c[2] + math.sin(a) * rr) if asse == 'y' else (c[0] + math.cos(a) * rr, c[1] + math.sin(a) * rr, c[2])  # noqa: E731
        _quad(m, [p(a0, r - t), p(a1, r - t), p(a1, r + t), p(a0, r + t)], reg)


# ------------------------------------------------------------------ manifest principale: ingresso
def prop_ingresso_diga():
    """La prua della «Stella del Mattino» incastrata di traverso tra due pareti di roccia nera (≈ 5 × 4 m): le due fiancate a V che si
    chiudono sulla ruota di prua (verso −Z), fasciame a bande col catrame, lo squarcio nero alla base (la bocca), il bompresso spezzato, la
    polena senza volto che stringe la culla e, appesa, la lanterna azzurra (≤ 200 triangoli)."""
    m = Mesh('prop_ingresso_diga')
    m.push(Xf(t=(-2.7, 0, 0.6), r=(0, 14, 5))); m.cbox(0, 0, 1.4, 3.2, 0, 4.0, 'p_roccia', skip=('bottom',)); m.pop()   # la roccia a sinistra
    m.push(Xf(t=(2.7, 0, 0.7), r=(0, -11, -3))); m.cbox(0, 0, 1.5, 3.0, 0, 4.6, 'p_nero_caldo', skip=('bottom',)); m.pop()  # e a destra
    m.push(Xf(r=(0, 17, 3)))                                                                          # di traverso nella gola
    for lato in (-1, 1):
        m.push(Xf(t=(0.9 * lato, 0, 0.6), r=(0, 24 * lato, 0)))
        for k, (y0, y1, reg) in enumerate(((0, 1.0, 'p_legno_scuro'), (1.0, 2.0, 'p_legno'), (2.0, 3.0, 'p_legno_scuro'), (3.0, 3.6, 'p_legno'))):
            m.cbox(0, 0, 0.32, 4.5 - k * 0.3, y0, y1, reg, skip=('bottom',))
        m.cbox(0, 0.2, 0.4, 3.8, 3.6, 3.75, 'p_legno_chiaro', skip=('bottom',))                       # la falchetta
        m.pop()
    m.push(Xf(t=(0, 0, -1.5), r=(-9, 0, 0))); m.cbox(0, 0, 0.36, 0.36, 0, 4.3, 'p_legno_scuro', skip=('bottom',)); m.pop()  # ruota di prua
    m.pop()
    m.push(Xf(t=(-0.35, 0, -1.25), r=(0, 17, 0))); m.box(-0.65, 0, -0.12, 0.65, 1.8, 0.12, 'p_nero_caldo', skip=('bottom',)); m.pop()  # lo squarcio
    m.push(Xf(t=(0.55, 4.0, -2.2), r=(-60, 17, 0))); m.prism(6, 0.14, 0.11, -1.2, 1.2, 'p_legno', top='p_legno_chiaro'); m.pop()  # bompresso spezzato
    m.push(Xf(t=(0.3, 2.95, -1.95), r=(-29, 17, 0))); m.prism(6, 0.28, 0.2, -0.6, 0.6, 'p_legno_chiaro', top='p_legno_chiaro'); m.pop()  # la polena
    m.cbox(0.38, -2.2, 0.32, 0.3, 3.43, 3.77, 'p_legno_chiaro')                                         # la testa senza volto
    m.push(Xf(t=(0.28, 2.69, -2.3), r=(0, 17, 0))); m.cbox(0, 0, 0.5, 0.3, 0, 0.22, 'p_legno', top='p_sabbia'); m.pop()  # la culla
    m.prism(4, 0.02, 0.02, 2.7, 3.5, 'p_roccia', cx=0.75, cz=-2.7)                                    # la catenella
    m.cbox(0.75, -2.7, 0.32, 0.32, 2.22, 2.3, 'p_roccia'); m.cbox(0.75, -2.7, 0.32, 0.32, 2.64, 2.72, 'p_roccia')  # il telaio della lanterna
    m.cbox(0.75, -2.7, 0.26, 0.26, 2.3, 2.64, 'p_acqua_bassa', mat=EM)                                 # la lanterna azzurra
    return _obj(m, footprint=[6, 6])


# ------------------------------------------------------------------ kit del dungeon (≤ 60 tri i moduli)
def dng_diga_pavimento():
    """Tavolato 2×2 a y = 0 (bordo che scende a −0,3): quattro tavole col catrame nelle commessure, tutte nello stesso verso (lungo X)."""
    m = Mesh('dng_diga_pavimento')
    m.box(-1, -0.3, -1, 1, 0, 1, 'p_legno_scuro', top='p_legno', skip=('bottom',))
    y = 0.004
    for z in (-0.5, 0, 0.5):
        _quad(m, [(-1, y, z + 0.025), (1, y, z + 0.025), (1, y, z - 0.025), (-1, y, z - 0.025)], 'p_nero_caldo')
    _quad(m, [(0.3, y * 2, 0.5), (0.36, y * 2, 0.5), (0.36, y * 2, 0), (0.3, y * 2, 0)], 'p_ombra_calda')  # la testa di una tavola
    return _obj(m)


def _murata(m, H):
    m.box(-1, 0, -1, 1, H, 1, 'p_legno', top='p_legno_scuro', skip=('bottom',))
    if H > 1:  # fasciame col catrame, un'ordinata, la linea dell'acqua coi cirripedi
        for y in (0.9, 1.5, 2.1):
            m.box(-1.01, y, -1.01, 1.01, y + 0.05, 1.01, 'p_nero_caldo', skip=('bottom', 'top'))
        m.box(-1.02, 0.25, -1.02, 1.02, 0.32, 1.02, 'p_acqua_profonda', skip=('bottom', 'top'))
        m.box(-1.015, 0, -1.015, 1.015, 0.25, 1.015, 'p_ombra_calda', skip=('bottom', 'top'))


def dng_diga_muro():
    m = Mesh('dng_diga_muro')
    _murata(m, 2.4)
    return _obj(m)


def dng_diga_muro_basso():
    m = Mesh('dng_diga_muro_basso')
    _murata(m, 0.6)
    return _obj(m)


def dng_diga_colonna():
    """Le colonne della Diga: un cannone di ferro sull'affusto di legno, la bocca verso −Z, le quattro ruote, la braca e due palle a terra."""
    m = Mesh('dng_diga_colonna')
    m.cbox(0, 0.1, 1.1, 1.5, 0.22, 0.58, 'p_legno_scuro', top='p_legno')                               # l'affusto
    for x in (-0.62, 0.62):
        for z in (-0.4, 0.55):
            m.push(Xf(t=(x, 0.24, z), r=(0, 0, 90))); m.prism(8, 0.24, 0.24, -0.07, 0.07, 'p_legno', top='p_legno', bottom='p_legno'); m.pop()
    m.push(Xf(t=(0, 0.95, -0.25), r=(90, 0, 0))); m.prism(8, 0.24, 0.32, -0.9, 0.9, 'p_roccia', top='p_nero_caldo', bottom='p_roccia'); m.pop()  # la canna
    m.push(Xf(t=(0, 0.95, 0.15), r=(90, 0, 0))); m.prism(8, 0.27, 0.27, -0.05, 0.05, 'p_pietra_scura'); m.pop()
    m.prism(4, 0.14, 0.14, 0, 0.28, 'p_nero_caldo', top='p_nero_caldo', cx=-0.35, cz=0.75)            # le palle
    return _obj(m)


def dng_diga_ruota():
    """Il piedistallo della Ruota di Sentina: base di legno, colonna, il collare d'ottone, il tubo della paratia e la targa (la ruota a otto
    razze che gira la mette il client, a 1,45 m davanti a −Z)."""
    m = Mesh('dng_diga_ruota')
    m.prism(8, 0.55, 0.45, 0, 0.2, 'p_legno_scuro', top='p_legno_scuro')
    m.cbox(0, 0, 0.3, 0.3, 0.2, 1.22, 'p_legno')
    m.cbox(0, 0, 0.42, 0.42, 1.17, 1.27, 'p_arancio')
    m.push(Xf(t=(0.28, 0.25, 0), r=(0, 0, 90))); m.prism(6, 0.2, 0.2, -0.25, 0.25, 'p_arancio', top='p_arancio'); m.pop()
    m.cbox(0, -0.17, 0.42, 0.05, 0.49, 0.75, 'p_giallo')
    return _obj(m)


def dng_diga_pilone():
    """Il pilone del Ponte di Comando: bitta di legno grossa (≈ 1,4 m di diametro, 2,35 m) con due bande di ferro, la testa larga e la gomena
    avvolta col capo che pende (il moncone fracassato lo mette il client)."""
    m = Mesh('dng_diga_pilone')
    m.prism(8, 0.7, 0.62, 0, 2.1, 'p_legno_scuro')
    for y in (0.3, 1.7):
        m.prism(8, 0.66, 0.66, y, y + 0.12, 'p_roccia')
    m.prism(8, 0.62, 0.7, 2.05, 2.35, 'p_legno', top='p_legno')
    for y in (1.0, 1.15, 1.3):
        m.prism(10, 0.74, 0.74, y - 0.05, y + 0.05, 'p_sabbia')
    m.push(Xf(t=(0.66, 0.6, 0.2), r=(0, 0, 17))); m.cbox(0, 0, 0.12, 0.12, -0.35, 0.35, 'p_sabbia'); m.pop()
    return _obj(m)


def dng_diga_ponte():
    """Il ponte mobile: tavolato 6 × 4 m con la cerniera a x = 0 e le tavole verso −X (il client lo tiene alzato in verticale e lo abbassa
    sulla falla quando giri la sua ruota), tre traverse e la cerniera di ferro."""
    m = Mesh('dng_diga_ponte')
    for k in range(8):
        z0 = -2 + k * 0.5
        m.box(-6, 0, z0 + 0.03, 0, 0.12, z0 + 0.47, 'p_legno_chiaro' if k % 2 else 'p_legno', skip=('bottom',))
    for x in (0.4, 3.0, 5.6):
        m.box(-x - 0.09, 0.12, -2, -x + 0.09, 0.2, 2, 'p_legno_scuro', skip=('bottom',))
    m.push(Xf(t=(-0.05, 0.1, 0), r=(90, 0, 0))); m.prism(6, 0.08, 0.08, -2, 2, 'p_roccia', top='p_roccia', bottom='p_roccia'); m.pop()
    return _obj(m)


# ------------------------------------------------------------------ nemici (statici, il client li anima)
def nem_guardiano():
    """La Guardia della Paratia: colosso a torso nudo coi tatuaggi, lo scafandro di rame come elmo (oblò che brilla), l'ancora spezzata
    nella destra. Il portello di quercia ferrata (con l'icona gialla dello scudo incrinato) è un oggetto a parte, `portello`."""
    m = Mesh('nem_guardiano')
    for sx in (-1, 1):
        m.cbox(sx * 0.3, 0.05, 0.42, 0.42, 0, 0.9, 'p_legno_scuro')                                    # calzoni
        m.cbox(sx * 0.3, -0.02, 0.5, 0.6, 0, 0.16, 'p_nero_caldo', skip=('bottom',))                  # stivali
    m.cbox(0, 0.05, 0.95, 0.62, 0.88, 1.02, 'p_ombra_calda')                                           # cintura
    m.cbox(0, 0.05, 1.15, 0.7, 1.02, 1.87, 'p_legno_chiaro')                                           # il torace
    _quad(m, [(-0.4, 1.45, -0.31), (-0.05, 1.62, -0.31), (-0.05, 1.67, -0.31), (-0.4, 1.5, -0.31)], 'p_acqua_profonda')  # tatuaggi
    m.cbox(0.78, 0, 0.36, 0.36, 0.9, 1.8, 'p_legno_chiaro'); m.cbox(0.78, 0, 0.38, 0.38, 1.39, 1.51, 'p_acqua_profonda')  # braccio destro
    m.push(Xf(t=(-0.72, 1.45, -0.25), r=(40, 0, 0))); m.cbox(0, 0, 0.36, 0.36, -0.35, 0.35, 'p_legno_chiaro'); m.pop()
    m.prism(8, 0.4, 0.38, 1.84, 2.46, 'p_arancio', top='p_arancio', cz=0.05)                           # lo scafandro di rame
    m.prism(8, 0.42, 0.42, 1.81, 1.91, 'p_legno', cz=0.05)
    m.push(Xf(t=(0, 2.17, -0.36), r=(90, 0, 0))); m.prism(8, 0.13, 0.13, -0.02, 0.02, 'p_acqua_bassa', top='p_acqua_bassa', mat=EM); m.pop()  # l'oblò
    m.push(Xf(t=(0.85, 0.95, -0.25), r=(14, 0, 0))); m.prism(5, 0.06, 0.06, -0.85, 0.85, 'p_roccia'); m.pop()  # l'ancora: il fuso
    m.cbox(0.85, -0.45, 0.85, 0.12, 0.19, 0.31, 'p_roccia')                                            # la marra (una sola punta)
    m.cone(4, 0.12, 0.2, 0.45, 'p_pietra_scura', cx=1.28, cz=-0.45)
    p = Mesh('portello')
    p.box(-0.925, 0.1, -0.78, 0.425, 2.0, -0.62, 'p_legno_scuro')                                      # il portello di quercia
    for y in (0.65, 1.45):
        p.box(-0.95, y, -0.82, 0.45, y + 0.12, -0.6, 'p_roccia', skip=('bottom', 'top'))               # le bande di ferro
    p.box(-0.4, 2.0, -0.75, -0.1, 2.38, -0.69, 'p_giallo')                                             # l'icona dello scudo incrinato
    _quad(p, [(-0.24, 2.05, -0.76), (-0.2, 2.05, -0.76), (-0.18, 2.33, -0.76), (-0.22, 2.33, -0.76)], 'p_nero_caldo')
    return _obj(m, p)


def nem_fuciliere():
    """Il Fuciliere d'Acquafonda: smilzo, cerata gialla con le macchie di catrame, bandana rossa, tricorno di cuoio sugli occhi (la faccia
    in ombra, niente volto), il moschetto lungo imbracciato con la baionetta arrugginita."""
    m = Mesh('nem_fuciliere')
    for sx in (-1, 1):
        m.cbox(sx * 0.13, 0, 0.18, 0.2, 0, 0.8, 'p_ombra_calda')
        m.cbox(sx * 0.13, -0.05, 0.2, 0.3, 0, 0.12, 'p_nero_caldo', skip=('bottom',))
    m.prism(6, 0.3, 0.2, 0.6, 1.5, 'p_giallo')                                                         # la cerata
    m.cbox(0, 0, 0.44, 0.34, 0.87, 0.93, 'p_nero_caldo', skip=('bottom', 'top'))                       # il catrame
    m.cbox(0, 0, 0.26, 0.26, 1.52, 1.78, 'p_nero_caldo')                                               # la faccia in ombra
    m.cbox(0, 0.02, 0.3, 0.3, 1.71, 1.81, 'p_rosso')                                                   # la bandana
    m.prism(3, 0.32, 0.32, 1.79, 1.87, 'p_legno_scuro', top='p_legno_scuro'); m.prism(6, 0.2, 0.16, 1.85, 1.99, 'p_legno_scuro', top='p_legno_scuro')  # tricorno
    for sx, rx in ((-1, 52), (1, 46)):
        m.push(Xf(t=(sx * 0.3, 1.22, -0.18), r=(rx, 0, -sx * 11))); m.cbox(0, 0, 0.14, 0.14, -0.3, 0.3, 'p_giallo'); m.pop()
    m.cbox(0.05, -0.1, 0.08, 0.7, 1.24, 1.36, 'p_legno_scuro')                                         # il calcio
    m.push(Xf(t=(0.05, 1.35, -1.05), r=(90, 0, 0))); m.prism(5, 0.035, 0.035, -0.7, 0.7, 'p_roccia'); m.pop()  # la canna
    m.cbox(0.05, -1.9, 0.03, 0.4, 1.295, 1.325, 'p_legno')                                             # la baionetta arrugginita
    return _obj(m)


def nem_albatros():
    """L'Albatros di Pece: grosso uccello marino scheletrico impeciato (il client lo fa volare), le ali larghe con le ossa bianche, il becco
    d'osso, gli occhi arancio che brillano e il barilotto rosso di polvere da sparo tra gli artigli."""
    m = Mesh('nem_albatros')
    m.cbox(0, 0, 0.45, 1.0, 0.35, 0.75, 'p_roccia', top='p_nero_caldo')                                # il corpo, la pece sulla schiena
    m.cbox(0, -0.6, 0.3, 0.32, 0.55, 0.85, 'p_roccia'); m.cbox(0, -0.98, 0.1, 0.5, 0.61, 0.71, 'p_pietra_chiara')  # testa e becco d'osso
    for sx in (-1, 1):
        m.push(Xf(t=(sx * 0.95, 0.66, 0), r=(0, 0, -sx * 10))); m.cbox(0, 0, 1.6, 0.45, -0.03, 0.03, 'p_roccia', top='p_nero_caldo')
        for x in (-0.35, 0.15, 0.6):
            m.cbox(x * sx, 0.08, 0.06, 0.5, 0.03, 0.07, 'p_pietra_chiara')                              # le ossa delle ali
        m.pop()
        _quad(m, [(sx * 0.07, 0.73, -0.79), (sx * 0.13, 0.73, -0.79), (sx * 0.13, 0.79, -0.79), (sx * 0.07, 0.79, -0.79)], 'p_arancio', EM)  # occhi
    m.push(Xf(t=(0, 0.2, 0.05), r=(0, 0, 90))); m.prism(8, 0.2, 0.2, -0.18, 0.18, 'p_rosso', top='p_legno_scuro', bottom='p_legno_scuro'); m.pop()  # il barilotto
    for sx in (-1, 1):
        m.cbox(sx * 0.1, 0.05, 0.04, 0.04, 0.26, 0.5, 'p_pietra_chiara')                               # gli artigli
    return _obj(m)


def nem_vaelen():
    """Il Capitano Vaelen, l'Ancora dei Giusti (boss, ≈ 3 m): cappotto da ammiraglio blu scuro lacero, incrostato di sale e cirripedi, le
    spalline d'oro, il tricorno spezzato, gli occhi azzurri da spettro; il braccio sinistro avvolto nelle catene dell'ancora (una pende),
    nella destra il tronco spezzato dell'albero maestro come lancia (≈ 4,6 m) con la ghiera, la punta d'acciaio e il brandello di vela
    bianca sotto la punta (`mat_emissivo`: nell'Ultima Marea il client lo accende d'azzurro). La corona gialla la mette il client."""
    m = Mesh('nem_vaelen')
    for sx in (-1, 1):
        m.cbox(sx * 0.32, 0, 0.45, 0.5, 0, 1.08, 'p_ombra_calda')
        m.cbox(sx * 0.32, -0.05, 0.5, 0.66, 0, 0.18, 'p_nero_caldo', skip=('bottom',))
    m.prism(6, 0.85, 0.62, 0.6, 2.1, 'p_abisso', cz=0.05)                                              # il cappotto lungo
    m.cbox(0, 0.05, 1.4, 0.85, 1.68, 2.62, 'p_abisso')                                                  # il busto
    m.cbox(0, -0.4, 0.5, 0.06, 1.62, 2.58, 'p_acqua_profonda')                                          # il bavero
    for x in (-0.45, 0.45):
        m.cbox(x, 0.05, 0.45, 0.5, 2.38, 2.52, 'p_giallo')                                              # le spalline
    for x, y, z in ((-0.3, 1.2, -0.62), (0.35, 0.9, -0.66), (0.15, 2.0, -0.44), (-0.55, 1.7, -0.55), (0.5, 1.5, -0.6)):
        m.cbox(x, z, 0.12, 0.08, y - 0.06, y + 0.06, 'p_pietra_chiara')                                 # sale e cirripedi
    m.cbox(0, 0.05, 0.45, 0.45, 2.61, 3.09, 'p_pietra')                                                 # la testa grigia
    _quad(m, [(-0.16, 2.88, -0.18), (0.16, 2.88, -0.18), (0.16, 2.93, -0.18), (-0.16, 2.93, -0.18)], 'p_acqua_bassa', EM)  # gli occhi
    m.prism(3, 0.55, 0.55, 3.09, 3.21, 'p_nero_caldo', top='p_nero_caldo', cz=0.05)                     # il tricorno
    m.push(Xf(t=(0.06, 3.28, 0.05), r=(0, 0, 20))); m.prism(6, 0.3, 0.24, -0.1, 0.1, 'p_nero_caldo', top='p_nero_caldo'); m.pop()  # spezzato
    m.cbox(-0.85, 0.05, 0.4, 0.4, 1.48, 2.52, 'p_abisso')                                               # il braccio sinistro
    for k, y in enumerate((1.65, 1.85, 2.05, 2.25)):
        _anello(m, (-0.85, y, 0.05), 0.26, 0.05, 'p_roccia', n=8)                                        # le catene dell'ancora
    m.push(Xf(t=(-0.85, 1.45, 0.4), r=(34, 0, 0))); m.cbox(0, 0, 0.06, 0.9, -0.03, 0.03, 'p_roccia'); m.pop()  # la catena che pende
    m.push(Xf(t=(0.85, 2.1, -0.2), r=(29, 0, 0))); m.cbox(0, 0, 0.4, 0.4, -0.45, 0.45, 'p_abisso'); m.pop()  # il braccio destro
    m.push(Xf(t=(0.9, 1.75, -1.2), r=(83, 0, 0))); m.prism(6, 0.17, 0.13, -2.3, 2.3, 'p_legno', top='p_legno_chiaro', bottom='p_legno_chiaro'); m.pop()  # l'albero maestro
    m.push(Xf(t=(0.9, 1.53, -3.3), r=(83, 0, 0))); m.prism(6, 0.2, 0.2, -0.06, 0.06, 'p_roccia'); m.pop()   # la ghiera
    m.push(Xf(t=(0.9, 1.47, -3.75), r=(-97, 0, 0))); m.cone(4, 0.16, -0.3, 0.3, 'p_pietra'); m.pop()        # la punta d'acciaio
    m.push(Xf(t=(0.9, 1.25, -3.05), r=(7, 0, 0))); m.cbox(0, 0, 0.06, 0.62, -0.27, 0.27, 'p_sabbia_chiara', mat=EM); m.pop()  # la vela
    return _obj(m)


MODELS_MAIN = [prop_ingresso_diga]
MODELS_RPG = [dng_diga_pavimento, dng_diga_muro, dng_diga_muro_basso, dng_diga_colonna, dng_diga_ruota, dng_diga_pilone, dng_diga_ponte,
              nem_guardiano, nem_fuciliere, nem_albatros, nem_vaelen]
MODELS = {f.__name__: f for f in MODELS_MAIN + MODELS_RPG}
