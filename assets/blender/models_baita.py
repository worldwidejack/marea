# Il Tempio della «Doppia Nera» (Isola dell'Adrenalina): la baita alpina d'ingresso col cannone spara-neve, il kit di larice e moquette col
# battiscopa innevato, i cannoni spara-neve sui tralicci (colonne), la Turbina Spara-Neve, il pupazzo di neve corazzato, il cancelletto di
# slalom e i nemici (il Controllore dello Skipass col tornello `portello`, il Maestro della Racchetta d'Oro, la Cornacchia da Bombardino e
# il boss Jean-Claude «Valanga»). Scritto senza Blender: finché i modelli non vengono rigenerati su Mac/PC con Blender, il gioco usa i
# segnaposto in codice di apps/client/src/rpg/baita.ts e apps/client/src/game/ingressi_forme.ts (`chalet`).
from lib import Mesh, Xf

EM = 'mat_emissivo'


def _obj(*ms, **info):
    out = [m.build() for m in ms]
    return (out, info) if info else out


def _quad(m, pts, reg, mat=None):
    m.poly(pts, reg, mat)


# ------------------------------------------------------------------ manifest principale: ingresso
def prop_ingresso_baita():
    """Baita alpina di larice col tetto a due falde innevato, sci rosa fluo incrociati sopra la porta, cartello «Doppia Nera» e cannone spara-neve."""
    m = Mesh('prop_ingresso_baita')
    m.cbox(0, 0.2, 3.8, 3.0, 0, 0.24, 'p_pietra', skip=('bottom',))
    m.cbox(0, 0.3, 3.2, 2.4, 0.24, 2.44, 'p_legno', skip=('bottom',))
    for y in (0.85, 1.85):
        m.cbox(0, 0.3, 3.3, 2.5, y - 0.08, y + 0.08, 'p_legno_scuro', skip=('bottom', 'top'))
    for sx in (-1, 1):
        m.push(Xf(t=(sx * 0.9, 2.85, 0.3), r=(0, 0, -sx * 31)))
        m.cbox(0, 0, 2.3, 2.8, -0.11, 0.11, 'p_legno_scuro')
        m.cbox(0, 0, 2.35, 2.85, 0.11, 0.27, 'p_sabbia_chiara')
        m.pop()
    m.cbox(0, 0.3, 1.4, 2.3, 2.3, 3.0, 'p_legno', skip=('bottom',))
    m.cbox(0, -0.92, 1.35, 0.14, 0.24, 1.89, 'p_nero_caldo', skip=('bottom',))
    m.cbox(0, -0.95, 1.6, 0.24, 1.83, 2.01, 'p_legno_chiaro')
    for sx in (-1, 1):
        m.push(Xf(t=(0, 2.55, -0.95), r=(0, 0, sx * 26))); m.cbox(0, 0, 1.7, 0.06, -0.06, 0.06, 'p_rosa_neon'); m.pop()
    m.push(Xf(t=(0, 3.15, -0.95), r=(0, 0, 45))); m.cbox(0, 0, 0.45, 0.06, -0.22, 0.22, 'p_giallo'); m.pop()
    m.push(Xf(t=(-1.45, 0.85, -1.25), r=(63, -17, 0))); m.prism(8, 0.28, 0.28, -0.42, 0.42, 'p_giallo', top='p_acqua_bassa'); m.pop()
    m.prism(5, 0.1, 0.1, 0, 0.68, 'p_roccia', cx=-1.45, cz=-1.25)
    m.cbox(1.35, -1.2, 1.1, 0.8, 0, 0.35, 'p_sabbia_chiara', skip=('bottom',))
    return _obj(m, footprint=[5, 5])


# ------------------------------------------------------------------ kit del dungeon (≤ 60 tri i moduli)
def dng_baita_pavimento():
    """Tavolato di larice 2×2 con striscia di gomma antiscivolo per gli scarponi da sci."""
    m = Mesh('dng_baita_pavimento')
    m.box(-1, -0.3, -1, 1, 0, 1, 'p_legno_scuro', top='p_legno', skip=('bottom',))
    y = 0.004
    for z in (-0.5, 0.5):
        _quad(m, [(-1, y, z + 0.025), (1, y, z + 0.025), (1, y, z - 0.025), (-1, y, z - 0.025)], 'p_legno_scuro')
    _quad(m, [(-1, y * 2, 0.18), (1, y * 2, 0.18), (1, y * 2, -0.18), (-1, y * 2, -0.18)], 'p_nero_caldo')
    return _obj(m)


def _parete_baita(m, H):
    m.box(-1, 0, -1, 1, H, 1, 'p_legno', top='p_sabbia_chiara', skip=('bottom',))
    if H > 1:
        for y in (0.8, 1.6):
            m.box(-1.01, y, -1.01, 1.01, y + 0.06, 1.01, 'p_legno_scuro', skip=('bottom', 'top'))
        m.box(-1.02, 0, -1.02, 1.02, 0.22, 1.02, 'p_sabbia_chiara', skip=('bottom', 'top'))


def dng_baita_muro():
    m = Mesh('dng_baita_muro')
    _parete_baita(m, 2.4)
    return _obj(m)


def dng_baita_muro_basso():
    m = Mesh('dng_baita_muro_basso')
    _parete_baita(m, 0.6)
    return _obj(m)


def dng_baita_colonna():
    """Cannone spara-neve giallo/azzurro su traliccio metallico."""
    m = Mesh('dng_baita_colonna')
    m.cbox(0, 0, 1.1, 1.1, 0, 0.22, 'p_roccia', skip=('bottom',))
    m.prism(6, 0.18, 0.14, 0.22, 1.15, 'p_pietra_scura')
    m.push(Xf(t=(0, 1.25, -0.05), r=(72, 0, 0)))
    m.prism(8, 0.34, 0.42, -0.55, 0.55, 'p_giallo', top='p_acqua_bassa', bottom='p_nero_caldo')
    m.pop()
    m.cbox(0, 0.52, 0.22, 0.22, 1.1, 1.32, 'p_rosso')
    return _obj(m)


def dng_baita_ruota():
    """Quadro elettrico della Turbina Spara-Neve (la ventola d'ottone che gira la mette il client)."""
    m = Mesh('dng_baita_ruota')
    m.prism(8, 0.5, 0.45, 0, 0.2, 'p_pietra_scura', top='p_pietra_scura')
    m.cbox(0, 0, 0.46, 0.34, 0.2, 1.25, 'p_giallo')
    m.cbox(0, -0.18, 0.36, 0.04, 0.5, 1.05, 'p_nero_caldo')
    m.cbox(-0.08, -0.2, 0.08, 0.04, 0.84, 0.92, 'p_rosso')
    m.cbox(0.08, -0.2, 0.08, 0.04, 0.84, 0.92, 'p_erba_chiara')
    return _obj(m)


def dng_baita_pilone():
    """Pupazzo di neve corazzato sulla Terrazza VIP (tre palle di neve, cilindro, sciarpa rosa e naso a carota)."""
    m = Mesh('dng_baita_pilone')
    m.prism(8, 0.72, 0.65, 0, 0.95, 'p_sabbia_chiara', top='p_sabbia_chiara')
    m.prism(8, 0.54, 0.48, 0.9, 1.65, 'p_sabbia_chiara', top='p_sabbia_chiara')
    m.prism(8, 0.38, 0.34, 1.6, 2.15, 'p_sabbia_chiara', top='p_sabbia_chiara')
    m.prism(8, 0.46, 0.46, 1.54, 1.68, 'p_rosa_neon')
    m.prism(8, 0.42, 0.42, 2.12, 2.2, 'p_nero_caldo', top='p_nero_caldo')
    m.prism(8, 0.28, 0.3, 2.2, 2.55, 'p_nero_caldo', top='p_nero_caldo')
    m.push(Xf(t=(0, 1.88, -0.45), r=(-90, 0, 0))); m.cone(5, 0.08, -0.18, 0.18, 'p_arancio'); m.pop()
    return _obj(m)


def dng_baita_ponte():
    """Cancelletto di slalom gigante con striscioni «FINISH / VIP» tra i pali rosso/blu."""
    m = Mesh('dng_baita_ponte')
    for k in range(8):
        z0 = -2 + k * 0.5
        m.box(-6, 0, z0 + 0.03, 0, 0.12, z0 + 0.47, 'p_sabbia_chiara' if k % 2 else 'p_acqua_bassa', skip=('bottom',))
    for x in (0.4, 3.0, 5.6):
        m.box(-x - 0.08, 0.12, -2, -x + 0.08, 0.2, 2, 'p_rosso' if x < 3 else 'p_acqua', skip=('bottom',))
    return _obj(m)


# ------------------------------------------------------------------ nemici
def nem_controllore():
    """Il Controllore dello Skipass: giacca a vento blu/gialla, berretto da capitano, scanner laser nella destra e tornello `portello` nella sinistra."""
    m = Mesh('nem_controllore')
    for sx in (-1, 1):
        m.cbox(sx * 0.28, 0.05, 0.4, 0.4, 0, 0.88, 'p_nero_caldo')
        m.cbox(sx * 0.28, -0.02, 0.46, 0.56, 0, 0.18, 'p_arancio', skip=('bottom',))
    m.cbox(0, 0.05, 1.12, 0.72, 0.88, 1.88, 'p_acqua')
    m.cbox(0, -0.32, 1.0, 0.08, 1.25, 1.5, 'p_giallo')
    m.cbox(0.76, 0, 0.34, 0.34, 0.9, 1.78, 'p_acqua')
    m.push(Xf(t=(-0.7, 1.45, -0.25), r=(40, 0, 0))); m.cbox(0, 0, 0.34, 0.34, -0.35, 0.35, 'p_acqua'); m.pop()
    m.cbox(0, 0.05, 0.42, 0.42, 1.88, 2.3, 'p_sabbia')
    m.cbox(0, -0.18, 0.44, 0.1, 2.04, 2.18, 'p_rosa_neon', mat=EM)
    m.prism(8, 0.32, 0.28, 2.28, 2.48, 'p_abisso', top='p_giallo', cz=0.05)
    m.cbox(0.84, -0.35, 0.14, 0.9, 0.5, 1.4, 'p_giallo')
    m.cbox(0.84, -0.45, 0.38, 0.28, 0.14, 0.52, 'p_rosso', mat=EM)
    p = Mesh('portello')
    p.box(-0.92, 0.1, -0.78, 0.42, 2.0, -0.62, 'p_pietra_chiara')
    for y in (0.65, 1.45):
        p.box(-0.95, y, -0.82, 0.45, y + 0.12, -0.6, 'p_rosso', skip=('bottom', 'top'))
    p.box(-0.42, 2.0, -0.75, -0.08, 2.38, -0.69, 'p_giallo')
    return _obj(m, p)


def nem_maestro():
    """Il Maestro della Racchetta d'Oro: tuta aerodinamica rossa con banda bianca, casco dorato e bastoncino da sci d'oro puntato."""
    m = Mesh('nem_maestro')
    for sx in (-1, 1):
        m.cbox(sx * 0.13, 0, 0.18, 0.2, 0, 0.8, 'p_rosso')
        m.cbox(sx * 0.13, -0.05, 0.22, 0.34, 0, 0.14, 'p_giallo', skip=('bottom',))
    m.prism(6, 0.28, 0.22, 0.6, 1.5, 'p_rosso')
    m.cbox(0, 0, 0.46, 0.36, 1.05, 1.19, 'p_sabbia_chiara', skip=('bottom', 'top'))
    m.cbox(0, 0, 0.26, 0.26, 1.52, 1.78, 'p_sabbia')
    m.cbox(0, -0.14, 0.3, 0.08, 1.61, 1.71, 'p_acqua_bassa', mat=EM)
    m.prism(8, 0.24, 0.2, 1.72, 1.98, 'p_giallo', top='p_giallo')
    for sx, rx in ((-1, 52), (1, 46)):
        m.push(Xf(t=(sx * 0.28, 1.22, -0.18), r=(rx, 0, -sx * 11))); m.cbox(0, 0, 0.14, 0.14, -0.3, 0.3, 'p_rosso'); m.pop()
    m.push(Xf(t=(0.05, 1.35, -1.0), r=(90, 0, 0))); m.prism(5, 0.03, 0.03, -0.75, 0.75, 'p_giallo'); m.pop()
    m.cbox(0.05, -1.85, 0.04, 0.3, 1.3, 1.34, 'p_acqua_bassa', mat=EM)
    return _obj(m)


def nem_cornacchia():
    """La Cornacchia da Bombardino: pennuto alpino nero coi paraorecchie rosa fluo e fiaschetta gialla di Bombardino bollente."""
    m = Mesh('nem_cornacchia')
    m.cbox(0, 0, 0.45, 0.95, 0.35, 0.75, 'p_nero_caldo', top='p_abisso')
    m.cbox(0, -0.58, 0.3, 0.3, 0.55, 0.85, 'p_nero_caldo')
    m.cbox(0, -0.92, 0.12, 0.42, 0.61, 0.71, 'p_giallo')
    for sx in (-1, 1):
        m.cbox(sx * 0.18, -0.58, 0.08, 0.16, 0.67, 0.83, 'p_rosa_neon')
        m.push(Xf(t=(sx * 0.9, 0.66, 0), r=(0, 0, -sx * 10))); m.cbox(0, 0, 1.5, 0.42, -0.03, 0.03, 'p_nero_caldo'); m.pop()
    m.push(Xf(t=(0, 0.2, 0.05), r=(0, 0, 90))); m.prism(8, 0.2, 0.2, -0.18, 0.18, 'p_giallo', top='p_arancio', bottom='p_arancio', mat=EM); m.pop()
    return _obj(m)


def nem_valanga():
    """Jean-Claude «Valanga» (boss, ≈ 3 m): tuta intera anni '80 rosa fluo, viola e gialla, fascia nei capelli biondi, occhiali a specchio
    azzurri e la Tavola «Valanga Pro-99» brandita come spadone."""
    m = Mesh('nem_valanga')
    for sx in (-1, 1):
        m.cbox(sx * 0.32, 0, 0.44, 0.48, 0, 1.08, 'p_viola')
        m.cbox(sx * 0.32, -0.05, 0.5, 0.66, 0, 0.22, 'p_giallo', skip=('bottom',))
    m.prism(6, 0.78, 0.6, 0.65, 2.05, 'p_rosa_neon', cz=0.05)
    m.cbox(0, 0.05, 1.42, 0.84, 1.68, 2.62, 'p_rosa_neon')
    m.cbox(0, -0.39, 1.2, 0.08, 1.98, 2.22, 'p_acqua_bassa', mat=EM)
    for x in (-0.5, 0.5):
        m.cbox(x, 0.05, 0.48, 0.52, 2.38, 2.56, 'p_giallo')
    m.cbox(0, 0.05, 0.44, 0.44, 2.61, 3.09, 'p_sabbia')
    m.cbox(0, -0.19, 0.48, 0.1, 2.82, 2.98, 'p_acqua_bassa', mat=EM)
    m.cbox(0, 0.05, 0.48, 0.48, 3.01, 3.11, 'p_rosa_neon')
    m.prism(6, 0.3, 0.22, 3.1, 3.38, 'p_giallo', top='p_giallo', cz=0.05)
    m.cbox(-0.85, 0.05, 0.38, 0.38, 1.48, 2.52, 'p_viola')
    m.push(Xf(t=(0.85, 2.1, -0.2), r=(29, 0, 0))); m.cbox(0, 0, 0.38, 0.38, -0.45, 0.45, 'p_viola'); m.pop()
    m.push(Xf(t=(0.9, 1.75, -1.2), r=(83, 0, 0)))
    m.cbox(0, 0, 0.46, 0.08, -2.1, 2.1, 'p_rosa_neon')
    m.cbox(0, -0.05, 0.24, 0.04, -1.9, 1.9, 'p_acqua_bassa', mat=EM)
    m.pop()
    return _obj(m)


MODELS_MAIN = [prop_ingresso_baita]
MODELS_RPG = [dng_baita_pavimento, dng_baita_muro, dng_baita_muro_basso, dng_baita_colonna, dng_baita_ruota, dng_baita_pilone, dng_baita_ponte,
              nem_controllore, nem_maestro, nem_cornacchia, nem_valanga]
MODELS = {f.__name__: f for f in MODELS_MAIN + MODELS_RPG}
