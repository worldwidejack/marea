# Mobili della casa (#304): un modello per ogni riga di packages/content/src/mobili.json, nome `mob_<id>`. SCRITTO SENZA BLENDER: le ricette
# non sono mai state eseguite. Sul PC con Blender: `npm run assets mob_<id> mob_<id> ...` (tutti: `npm run assets $(node tools/mobili_stato.mjs --ricette)`),
# poi guardare le anteprime (assets/export/preview) e il foglio dei contatti. Finché un modello manca dal manifest_mobili.json il gioco
# disegna il segnaposto (scatola di ingombro giusto, render/mobili.ts): collegare un modello NON richiede di toccare il codice.
#
# CONVENZIONI (docs/MOBILI.md)
# - Come tutti i modelli di lib.py: x destra, y su, DAVANTI −Z, 1 unità = 1 m, solo colori/regioni dell'atlas (`p_<colore>` = campioni piatti
#   della palette; testure: tavole, legno_scuro, tessuto_rosso, tessuto_blu, metallo, ferro, intonaco, oro, ...: `python3 assets/blender/atlas.py`).
# - Pivot a terra, al CENTRO dell'ingombro (tutte le celle del mobile). UNA CELLA = 2 × 2 m. Il mobile sta dentro il suo ingombro con un
#   po' di margine: `ingombro(celle)` dà la misura utile (1 cella = 1,9 × 1,9 m; 2×1 celle = 3,9 × 1,9 m; ...). A terra fino a ~2,6 m di altezza.
# - A PARETE (`posto: parete`): ingombro 1 cella di muro (1,5 m di larghezza utile), il RETRO sta a z = +0 (appoggiato al muro) e il mobile
#   sporge verso −Z fino a ~0,5 m; altezza dal pavimento ~1,3-2,6 m (il muro è alto 3,2 m). Il davanti −Z è quello che si vede.
# - Budget: ≤ 600 triangoli (build_assets.mjs); i mobili piccoli ne usano 60-250. Facce piatte, niente smussi, niente curve lisce:
#   prismi a 5-8 lati per il tondo. Un oggetto è fatto di pochi volumi leggibili dalla camera alta di casa (come Animal Crossing).
# - Il nome della ricetta è IDENTICO all'id del mobile con prefisso: id `cabina_telefonica` → `def mob_cabina_telefonica()`.
# - Ogni ricetta ritorna `_obj(m, footprint=[larghezza_m, profondita_m])` (l'ingombro a terra, in metri: celle × 2).
from lib import Mesh, beam


def ingombro(celle=(1, 1)):
    """Larghezza e profondità utili (m) di un mobile di `celle` celle: 2 m a cella, meno 0,1 m di margine."""
    return celle[0] * 2.0 - 0.1, celle[1] * 2.0 - 0.1


def _obj(m, **info):
    return ([m.build()], info) if info else [m.build()]


# ------------------------------------------------------------------ esempio completo (1 cella, a terra): è il modello di tutti gli altri
def mob_comodino_lampada():
    """Comodino a due cassetti con la lampada sopra (paralume giallo): ricalca il segnaposto procedurale di render/mobili.ts."""
    m = Mesh('mob_comodino_lampada')
    W, D = ingombro((1, 1))
    cw, cd = W * 0.78, D * 0.62                      # il corpo occupa meno dell'ingombro: il resto è respiro attorno
    m.cbox(0, 0, cw, cd, 0.12, 1.15, 'p_legno', top='p_legno_scuro', skip=('bottom',))              # corpo
    for y in (0.35, 0.78):                            # due cassetti sul davanti (−Z) con la maniglia gialla
        m.box(-cw * 0.42, y, -cd / 2 - 0.02, cw * 0.42, y + 0.34, -cd / 2, 'p_legno_scuro', skip=('bottom', 'top', 'back'))
        m.box(-0.14, y + 0.13, -cd / 2 - 0.06, 0.14, y + 0.2, -cd / 2 - 0.02, 'p_giallo', skip=('bottom', 'back'))
    for sx in (-1, 1):                               # quattro piedini
        for sz in (-1, 1):
            m.box(sx * cw * 0.42 - 0.07, 0.0, sz * cd * 0.38 - 0.07, sx * cw * 0.42 + 0.07, 0.12, sz * cd * 0.38 + 0.07, 'p_legno_scuro', skip=('bottom',))
    m.prism(6, 0.2, 0.26, 1.15, 1.25, 'p_legno_scuro', top='p_legno_scuro', cx=0.25, cz=0.05)      # base della lampada
    beam(m, (0.25, 1.25, 0.05), (0.25, 1.7, 0.05), 0.07, 0.07, 'p_nero_caldo', end='p_nero_caldo')  # stelo
    m.prism(6, 0.22, 0.4, 1.7, 2.1, 'p_giallo', top='p_giallo', cx=0.25, cz=0.05)                    # paralume
    return _obj(m, footprint=[W, D])


# ------------------------------------------------------------------ da qui: le ricette nuove (una per mobile di mobili.json)
# Aggiungile qui sotto, nello stesso stile, e registrale in MODELS.


def mob_cabina_telefonica_rossa_smontata():
    """Cabina telefonica rossa smontata su 2 slot: cabina aperta a sinistra col gettone incastrato, pezzi smontati a destra."""
    m = Mesh('mob_cabina_telefonica_rossa_smontata')
    W, D = ingombro((2, 1))
    cx = -0.9
    # Piattaforma e base cabina
    m.cbox(cx, 0.0, 1.1, 1.1, 0.0, 0.1, 'p_nero_caldo', top='p_nero_caldo')
    # 4 montanti verticali rossi
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cbox(cx + sx * 0.48, sz * 0.48, 0.1, 0.1, 0.1, 2.05, 'p_rosso', top='p_rosso')
    # Vetrate laterali e posteriore
    m.box(cx - 0.48, 0.35, -0.42, cx - 0.44, 1.9, 0.42, 'vetro')
    m.box(cx + 0.44, 0.35, -0.42, cx + 0.48, 1.9, 0.42, 'vetro')
    m.box(cx - 0.42, 0.35, 0.44, cx + 0.42, 1.9, 0.48, 'vetro')
    # Tetto a cupola rossa
    m.cbox(cx, 0.0, 1.16, 1.16, 2.05, 2.22, 'p_rosso', top='p_rosso')
    m.cbox(cx, 0.0, 0.9, 0.9, 2.22, 2.32, 'p_rosso', top='p_rosso')
    # Apparecchio telefonico interno a parete
    m.cbox(cx, 0.38, 0.32, 0.14, 1.05, 1.45, 'p_nero_caldo', top='p_nero_caldo')
    # Cornetta
    m.cbox(cx - 0.18, 0.36, 0.07, 0.09, 1.1, 1.4, 'p_nero_caldo')
    # DETTAGLIO: gettone giallo incastrato nella fessura in cima al telefono
    m.box(cx - 0.04, 1.45, 0.35, cx + 0.04, 1.52, 0.4, 'p_giallo')
    # DETTAGLIO: foglietto con numero scritto col pennarello
    m.box(cx + 0.06, 1.15, 0.44, cx + 0.22, 1.32, 0.445, 'carta')
    # Pezzi smontati a terra nello slot destro
    m.cbox(0.7, 0.0, 0.85, 0.08, 0.05, 1.85, 'p_rosso', top='p_rosso')
    m.cbox(0.7, 0.0, 0.65, 0.04, 0.25, 1.7, 'vetro')
    m.cbox(0.85, 0.45, 0.75, 0.55, 0.0, 0.05, 'ferro', top='p_rosso')
    m.cbox(1.25, -0.35, 0.42, 0.26, 0.0, 0.22, 'p_rosso', top='ferro')
    return _obj(m, footprint=[W, D])


def mob_divano_gonfiabile_a_forma_di_coccodrillo():
    """Divano gonfiabile a forma di coccodrillo verde, con creste sul dorso e muso/scivolo frontale."""
    m = Mesh('mob_divano_gonfiabile_a_forma_di_coccodrillo')
    W, D = ingombro((1, 1))
    cw, cd = W * 0.75, D * 0.65
    # Cuscino/seduta gonfiabile verde
    m.cbox(0, 0.05, cw, cd, 0.08, 0.42, 'p_erba', top='p_erba_chiara')
    # Schienale (corpo posteriore del coccodrillo)
    m.cbox(0, cd * 0.4, cw, 0.32, 0.42, 0.78, 'p_erba', top='p_erba')
    # Cresta triangolare sul dorso
    for x in (-0.45, -0.15, 0.15, 0.45):
        m.prism(3, 0.08, 0.0, 0.78, 0.94, 'p_bosco', cx=x, cz=cd * 0.4)
    # Braccioli
    m.cbox(-cw * 0.46, 0.0, 0.18, cd * 0.85, 0.08, 0.55, 'p_erba', top='p_erba')
    m.cbox(cw * 0.46, 0.0, 0.18, cd * 0.85, 0.08, 0.55, 'p_erba', top='p_erba')
    # Muso del coccodrillo che sporge in avanti (-Z, uso scivolo)
    m.cbox(0, -cd * 0.48, 0.62, 0.42, 0.06, 0.34, 'p_erba', top='p_erba_chiara')
    # Occhi sporgenti in cima allo schienale
    for x in (-0.22, 0.22):
        m.prism(6, 0.09, 0.06, 0.76, 0.92, 'p_giallo', top='p_nero_caldo', cx=x, cz=cd * 0.35)
    # Denti
    m.box(-0.25, 0.18, -cd * 0.48 - 0.22, -0.18, 0.26, -cd * 0.48 - 0.21, 'p_giallo')
    m.box(0.18, 0.18, -cd * 0.48 - 0.22, 0.25, 0.26, -cd * 0.48 - 0.21, 'p_giallo')
    # DETTAGLIO: valvola d'aria di plastica gialla sul fianco
    m.prism(6, 0.045, 0.045, 0.28, 0.38, 'p_giallo', top='p_giallo', cx=cw * 0.46 + 0.1, cz=0.0)
    return _obj(m, footprint=[W, D])


def mob_trono_di_plastica_dorata():
    """Trono in plastica sagomata dorata, con schienale a corona e graffi evidenti sulla seduta."""
    m = Mesh('mob_trono_di_plastica_dorata')
    W, D = ingombro((1, 1))
    # Seduta sagomata
    m.cbox(0, 0.05, 0.88, 0.78, 0.44, 0.52, 'p_giallo', top='oro')
    # Schienale alto
    m.cbox(0, 0.38, 0.84, 0.1, 0.52, 1.42, 'p_giallo', top='oro')
    # Corona / pinnacoli intagliati in cima allo schienale
    m.prism(3, 0.18, 0.0, 1.42, 1.66, 'p_giallo', cx=0.0, cz=0.38)
    m.prism(3, 0.13, 0.0, 1.42, 1.58, 'p_giallo', cx=-0.26, cz=0.38)
    m.prism(3, 0.13, 0.0, 1.42, 1.58, 'p_giallo', cx=0.26, cz=0.38)
    # Braccioli curvi con volute
    m.cbox(-0.43, 0.05, 0.12, 0.74, 0.52, 0.82, 'p_giallo', top='oro')
    m.cbox(0.43, 0.05, 0.12, 0.74, 0.52, 0.82, 'p_giallo', top='oro')
    # 4 gambe in plastica stampata
    for sx in (-0.36, 0.36):
        for sz in (-0.28, 0.38):
            m.cbox(sx, sz, 0.11, 0.11, 0.0, 0.44, 'p_giallo')
    # DETTAGLIO: graffio scuro sulla seduta («si graffia»)
    m.box(-0.16, 0.522, -0.06, 0.18, 0.525, 0.02, 'p_ombra_calda', skip=('bottom',))
    return _obj(m, footprint=[W, D])


def mob_amaca_da_interno_con_supporto_in_bambu():
    """Amaca sospesa su telaio ad arco in bambù, con il distributore di bibite posizionato sotto."""
    m = Mesh('mob_amaca_da_interno_con_supporto_in_bambu')
    W, D = ingombro((1, 1))
    # Base del supporto a terra: traverse in bambù
    m.cbox(-0.65, 0.0, 0.14, 1.4, 0.0, 0.1, 'bambu', top='bambu')
    m.cbox(0.65, 0.0, 0.14, 1.4, 0.0, 0.1, 'bambu', top='bambu')
    m.cbox(0.0, -0.6, 1.25, 0.12, 0.0, 0.09, 'bambu', top='bambu')
    m.cbox(0.0, 0.6, 1.25, 0.12, 0.0, 0.09, 'bambu', top='bambu')
    # Montanti inclinati in bambù che sostengono l'amaca
    for sx in (-1, 1):
        beam(m, (sx * 0.65, 0.08, -0.45), (sx * 0.72, 1.15, 0.0), 0.1, 0.1, 'bambu', end='p_legno_chiaro')
        beam(m, (sx * 0.65, 0.08, 0.45), (sx * 0.72, 1.15, 0.0), 0.1, 0.1, 'bambu', end='p_legno_chiaro')
    # Telo dell'amaca sospesa (in tessuto chiaro ad avvallamento)
    m.box(-0.62, 0.85, -0.32, -0.25, 0.95, 0.32, 'p_sabbia_chiara', top='tela')
    m.cbox(0.0, 0.0, 0.6, 0.68, 0.46, 0.54, 'p_sabbia_chiara', top='tela')
    m.box(0.25, 0.85, -0.32, 0.62, 0.95, 0.32, 'p_sabbia_chiara', top='tela')
    # Corde di aggancio ai poli
    beam(m, (-0.72, 1.15, 0.0), (-0.62, 0.9, 0.0), 0.04, 0.04, 'corda')
    beam(m, (0.72, 1.15, 0.0), (0.62, 0.9, 0.0), 0.04, 0.04, 'corda')
    # DETTAGLIO: distributore compatto di bibite posizionato proprio sotto l'amaca
    m.cbox(0.0, 0.0, 0.44, 0.38, 0.0, 0.42, 'p_rosso', top='p_nero_caldo')
    m.box(-0.16, 0.06, -0.195, 0.16, 0.16, -0.185, 'p_nero_caldo')
    m.box(-0.1, 0.08, -0.19, -0.02, 0.14, -0.17, 'p_acqua')
    m.box(0.02, 0.08, -0.19, 0.1, 0.14, -0.17, 'p_giallo')
    return _obj(m, footprint=[W, D])


def mob_flipper_anni_90():
    """Flipper da sala giochi anni '90, con piano inclinato, testata verticale e punteggio ASS sul display."""
    m = Mesh('mob_flipper_anni_90')
    W, D = ingombro((1, 1))
    # 4 gambe metalliche angolate
    for sx in (-0.32, 0.32):
        beam(m, (sx * 1.05, 0.0, -0.52), (sx * 0.9, 0.65, -0.42), 0.06, 0.06, 'metallo', end='p_nero_caldo')
        beam(m, (sx * 1.05, 0.0, 0.42), (sx * 0.9, 0.78, 0.32), 0.06, 0.06, 'metallo', end='p_nero_caldo')
    # Mobile cassone inclinato
    m.cbox(0.0, -0.05, 0.72, 1.12, 0.65, 0.95, 'p_nero_caldo', top='p_viola')
    # Vetro di copertura
    m.cbox(0.0, -0.05, 0.68, 1.08, 0.95, 0.98, 'vetro', top='vetro')
    # Bumper e respingenti interni
    m.prism(6, 0.07, 0.07, 0.92, 1.0, 'p_rosso', top='p_giallo', cx=-0.14, cz=0.08)
    m.prism(6, 0.07, 0.07, 0.92, 1.0, 'p_rosso', top='p_giallo', cx=0.14, cz=0.08)
    # Leva lancia-biglie a destra
    m.box(0.36, 0.72, -0.62, 0.42, 0.78, -0.5, 'metallo')
    # Testata posteriore verticale con grafica
    m.cbox(0.0, 0.44, 0.76, 0.26, 0.95, 1.78, 'p_nero_caldo', top='p_nero_caldo')
    m.box(-0.34, 1.15, 0.305, 0.34, 1.72, 0.315, 'p_viola', skip=('back', 'top', 'bottom'))
    # DETTAGLIO: tabellone col record massimo «ASS»
    m.box(-0.24, 1.25, 0.316, 0.24, 1.4, 0.325, 'p_nero_caldo')
    m.box(-0.18, 1.28, 0.326, -0.08, 1.37, 0.332, 'p_giallo')
    m.box(-0.05, 1.28, 0.326, 0.05, 1.37, 0.332, 'p_giallo')
    m.box(0.08, 1.28, 0.326, 0.18, 1.37, 0.332, 'p_giallo')
    return _obj(m, footprint=[W, D])


def mob_cabina_fototessera():
    """Cabina per fototessere con insegna al neon, tenda rossa all'ingresso e striscia di foto scartate."""
    m = Mesh('mob_cabina_fototessera')
    W, D = ingombro((1, 1))
    # Pareti e telaio
    m.cbox(0.0, 0.52, 1.18, 0.1, 0.0, 2.08, 'intonaco', top='p_nero_caldo')
    m.cbox(-0.54, 0.0, 0.1, 1.14, 0.0, 2.08, 'intonaco', top='p_nero_caldo')
    m.cbox(0.54, 0.0, 0.1, 1.14, 0.0, 2.08, 'intonaco', top='p_nero_caldo')
    m.cbox(0.0, 0.0, 1.22, 1.22, 2.08, 2.18, 'p_nero_caldo', top='p_nero_caldo')
    m.cbox(0.0, 0.0, 1.08, 1.08, 0.0, 0.08, 'p_nero_caldo', top='p_nero_caldo')
    # Sgabello interno tondo
    m.prism(6, 0.22, 0.22, 0.08, 0.52, 'p_rosso', top='cuoio', cx=0.0, cz=0.18)
    # Fotocamera/flash a parete interna
    m.cbox(0.0, -0.42, 0.28, 0.1, 1.25, 1.55, 'p_nero_caldo')
    # Tenda rossa d'ingresso sul davanti (-Z)
    m.cbox(-0.25, -0.52, 0.52, 0.06, 0.25, 1.95, 'tessuto_rosso')
    # DETTAGLIO: insegna neon luminosa in alto («luci al neon»)
    m.cbox(0.0, -0.58, 0.88, 0.08, 1.95, 2.08, 'em_neon_ciano', top='em_neon_ciano')
    # DETTAGLIO: striscia di foto scartate che esce dalla fessura laterale
    m.box(0.32, 0.68, -0.56, 0.48, 0.86, -0.52, 'carta')
    return _obj(m, footprint=[W, D])


def mob_albero_di_natale_a_luglio():
    """Albero di Natale con luci accese a luglio, puntale a stella e calendario dell'Avvento scaduto alla base."""
    m = Mesh('mob_albero_di_natale_a_luglio')
    W, D = ingombro((1, 1))
    # Vaso/supporto a terra
    m.prism(6, 0.32, 0.28, 0.0, 0.24, 'p_rosso', top='terra')
    # Tronco
    m.prism(6, 0.09, 0.08, 0.24, 0.6, 'corteccia', top='corteccia')
    # 3 palchi conici di rami sempreverdi
    m.prism(7, 0.72, 0.42, 0.48, 0.98, 'p_bosco', bottom='p_bosco', top='p_bosco')
    m.prism(6, 0.52, 0.28, 0.92, 1.48, 'p_bosco', bottom='p_bosco', top='p_bosco')
    m.cone(6, 0.35, 1.42, 1.96, 'p_bosco', bottom='p_bosco')
    # Puntale a stella in cima
    m.prism(5, 0.14, 0.0, 1.96, 2.14, 'p_giallo', top='p_giallo')
    # DETTAGLIO: lucine ancora accese sparse sui rami
    bulbi = [
        ((-0.42, 0.72, -0.28), 'p_rosso'),
        ((0.38, 0.76, 0.22), 'p_giallo'),
        ((-0.2, 1.18, -0.36), 'em_neon_ciano'),
        ((0.28, 1.22, -0.16), 'p_arancio'),
        ((-0.16, 1.62, 0.18), 'em_neon_rosa'),
        ((0.14, 1.58, -0.18), 'p_giallo'),
    ]
    for (x, y, z), col in bulbi:
        m.cbox(x, z, 0.07, 0.07, y, y + 0.07, col, top=col)
    # DETTAGLIO: calendario dell'Avvento scaduto appoggiato al vaso
    m.box(-0.35, 0.0, -0.46, -0.1, 0.32, -0.4, 'carta')
    m.box(-0.32, 0.04, -0.465, -0.13, 0.28, -0.455, 'p_rosso')
    return _obj(m, footprint=[W, D])


def mob_letto_ad_acqua():
    """Letto ad acqua con materasso in vinile ondulato turchese, cuscini e controller abbandonato sopra."""
    m = Mesh('mob_letto_ad_acqua')
    W, D = ingombro((1, 1))
    cw, cd = W * 0.84, D * 0.86
    # Testiera alta in legno scuro a parete (+Z)
    m.cbox(0.0, cd * 0.44, cw, 0.16, 0.0, 1.05, 'p_legno_scuro', top='p_legno_scuro')
    # Telaio perimetrale massiccio
    m.cbox(0.0, -cd * 0.05, cw, cd * 0.88, 0.0, 0.44, 'p_legno_scuro', top='p_legno_scuro')
    # Materasso ad acqua turchese lucido
    m.cbox(0.0, -cd * 0.05, cw * 0.88, cd * 0.78, 0.38, 0.52, 'p_acqua', top='acqua')
    # Increspatura/onda della pozza fredda
    m.cbox(0.0, -cd * 0.12, cw * 0.68, cd * 0.32, 0.52, 0.54, 'p_acqua_bassa', top='p_acqua_bassa')
    # Due cuscini morbidi contro la testiera
    m.cbox(-0.38, cd * 0.24, 0.44, 0.28, 0.52, 0.62, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(0.38, cd * 0.24, 0.44, 0.28, 0.52, 0.62, 'p_pietra_chiara', top='p_pietra_chiara')
    # DETTAGLIO: controller da gioco sul letto («ti giudica mentre giochi»)
    m.cbox(0.0, 0.0, 0.18, 0.12, 0.53, 0.56, 'p_nero_caldo', top='p_nero_caldo')
    m.prism(6, 0.02, 0.02, 0.56, 0.58, 'p_rosso', top='p_rosso', cx=-0.04, cz=0.0)
    return _obj(m, footprint=[W, D])


def mob_scultura_astratta_in_fil_di_ferro():
    """Scultura astratta in tondini di fil di ferro su piedistallo di pietra: un groviglio a metà tra ansia e gabbiano."""
    m = Mesh('mob_scultura_astratta_in_fil_di_ferro')
    W, D = ingombro((1, 1))
    # Piedistallo da galleria d'arte in pietra
    m.cbox(0.0, 0.0, 0.52, 0.52, 0.0, 0.85, 'p_pietra_scura', top='pietra_liscia')
    # Targhetta descrittiva sul fronte del piedistallo
    m.box(-0.14, 0.58, -0.265, 0.14, 0.72, -0.258, 'oro', skip=('back', 'top', 'bottom'))
    # Basetta metallica del ferro
    m.cbox(0.0, 0.0, 0.14, 0.14, 0.85, 0.9, 'ferro', top='ferro')
    # Trama di fil di ferro angolato (tubi/beam sottili)
    beam(m, (0.0, 0.88, 0.0), (0.05, 1.25, -0.05), 0.035, 0.035, 'ferro', end='p_nero_caldo')
    beam(m, (0.05, 1.25, -0.05), (-0.1, 1.45, 0.08), 0.035, 0.035, 'ferro', end='p_nero_caldo')
    beam(m, (0.05, 1.25, -0.05), (-0.42, 1.55, -0.22), 0.03, 0.03, 'ferro', end='p_nero_caldo')
    beam(m, (-0.42, 1.55, -0.22), (-0.58, 1.4, 0.02), 0.025, 0.025, 'ferro', end='p_nero_caldo')
    beam(m, (0.05, 1.25, -0.05), (0.4, 1.58, 0.12), 0.03, 0.03, 'ferro', end='p_nero_caldo')
    beam(m, (0.4, 1.58, 0.12), (0.52, 1.34, -0.1), 0.025, 0.025, 'ferro', end='p_nero_caldo')
    beam(m, (-0.1, 1.45, 0.08), (0.02, 1.7, -0.25), 0.025, 0.025, 'ferro', end='p_nero_caldo')
    # DETTAGLIO: nodo rosso di tensione incastrato nel fil di ferro
    m.prism(6, 0.045, 0.045, 1.38, 1.47, 'p_rosso', top='p_rosso', cx=0.02, cz=-0.02)
    return _obj(m, footprint=[W, D])


def mob_cassapanca_da_pirata():
    """Cassapanca da pirata in legno scuro cerchiata di ferro, con serratura dorata, calzino e mappa del tesoro."""
    m = Mesh('mob_cassapanca_da_pirata')
    W, D = ingombro((1, 1))
    cw, cd = 1.18, 0.72
    # Corpo della cassa in legno scuro
    m.cbox(0.0, 0.0, cw, cd, 0.0, 0.48, 'p_legno_scuro', top='legno_pieno')
    # Fasce di rinforzo in ferro
    for x in (-cw * 0.45, -cw * 0.15, cw * 0.15, cw * 0.45):
        m.box(x - 0.03, 0.0, -cd / 2 - 0.015, x + 0.03, 0.48, cd / 2 + 0.015, 'ferro')
    # Coperchio bombato (base e parte superiore smussata)
    m.cbox(0.0, 0.02, cw + 0.04, cd + 0.04, 0.48, 0.58, 'p_legno_scuro', top='legno_pieno')
    m.cbox(0.0, 0.02, cw + 0.02, cd * 0.75, 0.58, 0.74, 'p_legno_scuro', top='p_legno_scuro')
    # Borchia serratura dorata sul fronte (-Z)
    m.cbox(0.0, -cd / 2 - 0.025, 0.14, 0.04, 0.35, 0.5, 'oro', top='oro')
    # DETTAGLIO: rotolo della mappa che sbuca fuori da sotto il coperchio
    m.prism(6, 0.045, 0.045, 0.46, 0.54, 'carta', top='carta', cx=-cw * 0.35, cz=-cd / 2 - 0.06)
    # DETTAGLIO: calzino colorato spaiato che penzola sul davanti
    m.box(cw * 0.22, 0.32, -cd / 2 - 0.03, cw * 0.32, 0.5, -cd / 2, 'p_rosso')
    m.box(cw * 0.22, 0.24, -cd / 2 - 0.05, cw * 0.32, 0.32, -cd / 2, 'p_giallo')
    return _obj(m, footprint=[W, D])


def mob_manichino_da_sartoria_con_cappello_da_cowboy():
    """Manichino da sartoria in tessuto chiaro su treppiede in legno scuro, con cappello da cowboy inclinato e spilli."""
    m = Mesh('mob_manichino_da_sartoria_con_cappello_da_cowboy')
    W, D = ingombro((1, 1))
    # Treppiede a 3 gambe in legno scuro
    beam(m, (0.0, 0.22, 0.0), (0.28, 0.0, 0.0), 0.06, 0.06, 'p_legno_scuro', end='p_legno_scuro')
    beam(m, (0.0, 0.22, 0.0), (-0.14, 0.0, 0.24), 0.06, 0.06, 'p_legno_scuro', end='p_legno_scuro')
    beam(m, (0.0, 0.22, 0.0), (-0.14, 0.0, -0.24), 0.06, 0.06, 'p_legno_scuro', end='p_legno_scuro')
    # Asta centrale
    m.prism(6, 0.035, 0.035, 0.0, 0.95, 'p_legno_scuro', top='p_legno_scuro', cx=0.0, cz=0.0)
    # Vite di regolazione in ottone
    m.cbox(0.0, 0.0, 0.12, 0.05, 0.55, 0.59, 'oro', top='oro')
    # Busto sagomato in tela di sacco chiara
    m.prism(8, 0.22, 0.2, 0.82, 1.05, 'tela_sacco', top='tela_sacco', bottom='tela_sacco', cx=0.0, cz=0.0)
    m.prism(8, 0.18, 0.2, 1.05, 1.22, 'tela_sacco', top='tela_sacco', cx=0.0, cz=0.0)
    m.cbox(0.0, 0.0, 0.46, 0.28, 1.22, 1.48, 'tela_sacco', top='p_legno_scuro')
    m.prism(6, 0.07, 0.06, 1.48, 1.58, 'p_legno_scuro', top='p_legno_scuro', cx=0.0, cz=0.0)
    # Cappello da cowboy inclinato
    m.cbox(0.02, -0.02, 0.52, 0.44, 1.56, 1.6, 'cuoio', top='cuoio')
    m.cbox(0.02, -0.02, 0.56, 0.38, 1.58, 1.62, 'cuoio', top='cuoio')
    m.cbox(0.02, -0.02, 0.26, 0.24, 1.62, 1.74, 'cuoio', top='cuoio')
    m.cbox(0.02, -0.02, 0.24, 0.08, 1.7, 1.73, 'p_legno_scuro')
    m.cbox(0.02, -0.02, 0.27, 0.25, 1.62, 1.65, 'p_rosso')
    # DETTAGLIO: metro da sarto giallo che scende dal collo
    m.box(-0.12, 1.15, -0.145, -0.08, 1.48, -0.14, 'p_giallo', skip=('back',))
    beam(m, (-0.08, 1.48, -0.14), (0.0, 1.52, -0.08), 0.03, 0.01, 'p_giallo')
    # DETTAGLIO: due spilli a capocchia rossa inquietanti come occhi
    m.prism(6, 0.018, 0.018, 1.34, 1.38, 'p_rosso', top='p_rosso', cx=-0.08, cz=-0.15)
    m.prism(6, 0.018, 0.018, 1.34, 1.38, 'p_rosso', top='p_rosso', cx=0.08, cz=-0.15)
    return _obj(m, footprint=[W, D])


def mob_frigorifero_anni_50_smaltato():
    """Frigorifero bombato anni ’50 in smalto turchese, con sportello socchiuso, lattina e maionese scaduta."""
    m = Mesh('mob_frigorifero_anni_50_smaltato')
    W, D = ingombro((1, 1))
    # Piedini cromati
    for sx in (-0.36, 0.36):
        for sz in (-0.32, 0.32):
            m.cbox(sx, sz, 0.09, 0.09, 0.0, 0.1, 'ferro', top='ferro')
    # Corpo in smalto turchese bombato
    m.cbox(0.0, 0.05, 0.88, 0.78, 0.1, 1.45, 'p_acqua', top='p_acqua')
    m.cbox(0.0, 0.05, 0.82, 0.72, 1.45, 1.5, 'p_acqua', top='p_acqua')
    # Vano interno visibile dallo sportello socchiuso
    m.cbox(0.0, -0.12, 0.74, 0.42, 0.22, 1.35, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(0.0, -0.12, 0.72, 0.4, 0.55, 0.57, 'ferro')
    m.cbox(0.0, -0.12, 0.72, 0.4, 0.95, 0.97, 'ferro')
    # Sportello socchiuso sul davanti
    beam(m, (-0.42, 0.15, -0.36), (0.35, 0.15, -0.52), 0.12, 1.28, 'p_acqua', end='p_acqua')
    # Maniglione cromato anni '50 sullo sportello
    beam(m, (0.18, 0.82, -0.56), (0.28, 0.82, -0.58), 0.04, 0.05, 'ferro', end='ferro')
    beam(m, (0.28, 0.7, -0.58), (0.28, 0.94, -0.58), 0.04, 0.04, 'ferro', end='ferro')
    # Fregio cromato laterale
    m.cbox(-0.45, 0.05, 0.02, 0.16, 1.25, 1.35, 'ferro')
    # DETTAGLIO: lattina rossa nel vano interno
    m.prism(6, 0.045, 0.045, 0.57, 0.71, 'p_rosso', top='ferro', cx=-0.12, cz=-0.12)
    # DETTAGLIO: mezzo barattolo di maionese scaduta con tappo giallo
    m.prism(6, 0.055, 0.055, 0.57, 0.65, 'p_sabbia_chiara', top='p_giallo', cx=0.15, cz=-0.12)
    m.prism(6, 0.045, 0.045, 0.65, 0.68, 'p_giallo', top='p_giallo', cx=0.15, cz=-0.12)
    return _obj(m, footprint=[W, D])


def mob_divano_in_pelle_vintage():
    """Divano in pelle vintage marrone logora, con braccioli arrotolati, toppa di riparazione e libro aperto."""
    m = Mesh('mob_divano_in_pelle_vintage')
    W, D = ingombro((1, 1))
    cw, cd = 1.65, 0.88
    # 4 piedini in legno torniti
    for sx in (-0.72, 0.72):
        for sz in (-0.34, 0.34):
            m.prism(6, 0.05, 0.035, 0.0, 0.14, 'p_legno_scuro', top='p_legno_scuro', cx=sx, cz=sz)
    # Telaio base in pelle
    m.cbox(0.0, 0.0, cw, cd, 0.12, 0.28, 'p_legno', top='p_legno')
    m.cbox(0.0, -cd / 2 - 0.01, cw * 0.96, 0.03, 0.14, 0.24, 'p_legno_scuro')
    # Schienale alto trapuntato posteriore (+Z)
    m.cbox(0.0, cd * 0.3, cw, 0.28, 0.28, 0.85, 'cuoio', top='p_legno')
    m.cbox(0.0, cd * 0.3, cw * 0.96, 0.24, 0.85, 0.88, 'p_legno', top='p_legno')
    # Braccioli massicci arrotolati
    for sx in (-1, 1):
        m.cbox(sx * (cw / 2 - 0.13), 0.02, 0.26, cd * 0.94, 0.28, 0.64, 'cuoio', top='p_legno')
        m.prism(6, 0.12, 0.12, 0.28, 0.64, 'p_legno', top='p_legno', cx=sx * (cw / 2 - 0.13), cz=-cd * 0.42)
    # Cuscini morbidi da seduta
    m.cbox(-0.35, -0.05, 0.66, cd * 0.62, 0.28, 0.46, 'cuoio', top='p_legno')
    m.cbox(0.35, -0.05, 0.66, cd * 0.62, 0.28, 0.46, 'cuoio', top='p_legno')
    # DETTAGLIO: toppa di riparazione su pelle usurata («logoro al punto giusto»)
    m.box(0.18, 0.462, -0.15, 0.42, 0.465, 0.05, 'p_legno_chiaro', skip=('bottom',))
    m.box(0.16, 0.461, -0.17, 0.44, 0.464, -0.15, 'p_ombra_calda', skip=('bottom',))
    # DETTAGLIO: libro aperto sul bracciolo per «sprofondare nei pensieri»
    m.cbox(-cw / 2 + 0.13, -0.02, 0.2, 0.24, 0.642, 0.67, 'carta', top='pagine')
    return _obj(m, footprint=[W, D])


def mob_poltrona_a_sacco():
    """Poltrona a sacco sgargiante e deformata, con seduta concava e telecomando incastrato tra le pieghe."""
    m = Mesh('mob_poltrona_a_sacco')
    W, D = ingombro((1, 1))
    # Base floscia a terra
    m.prism(8, 0.68, 0.62, 0.0, 0.28, 'tessuto_rosso', top='p_arancio', cx=0.0, cz=0.05)
    # Seduta intermedia con infossamento
    m.prism(8, 0.62, 0.54, 0.28, 0.48, 'p_arancio', top='p_arancio', cx=0.0, cz=0.08)
    m.prism(8, 0.38, 0.36, 0.32, 0.45, 'p_ombra_calda', top='p_arancio', cx=0.0, cz=-0.04)
    # Schienale morbido verso +Z
    m.prism(7, 0.45, 0.28, 0.48, 0.72, 'tessuto_rosso', top='p_arancio', cx=0.0, cz=0.22)
    m.prism(6, 0.22, 0.1, 0.72, 0.82, 'p_arancio', top='p_viola', cx=0.0, cz=0.26)
    # Maniglia di stoffa viola in cima
    beam(m, (-0.08, 0.82, 0.26), (0.08, 0.82, 0.26), 0.04, 0.08, 'p_viola', end='p_viola')
    # Bordo di cucitura a contrasto
    m.prism(8, 0.64, 0.64, 0.26, 0.29, 'p_viola', cx=0.0, cz=0.06)
    # DETTAGLIO: telecomando nero incastrato nella piega («non ti alzi più»)
    m.box(0.12, 0.38, 0.04, 0.22, 0.46, 0.18, 'p_nero_caldo')
    m.prism(6, 0.015, 0.015, 0.46, 0.475, 'p_rosso', top='p_rosso', cx=0.17, cz=0.08)
    m.prism(6, 0.015, 0.015, 0.46, 0.475, 'p_giallo', top='p_giallo', cx=0.17, cz=0.13)
    return _obj(m, footprint=[W, D])


def mob_cabinato_da_sala_giochi_polveroso():
    """Cabinato arcade rétro con plancia a sbalzo, joystick allentato, CRT pixel e polvere in cima."""
    m = Mesh('mob_cabinato_da_sala_giochi_polveroso')
    W, D = ingombro((1, 1))
    # Piedini
    for sx in (-0.32, 0.32):
        for sz in (-0.36, 0.36):
            m.cbox(sx, sz, 0.08, 0.08, 0.0, 0.06, 'p_nero_caldo', top='p_nero_caldo')
    # Mobile inferiore e gettoniera
    m.cbox(0.0, 0.0, 0.78, 0.84, 0.06, 0.85, 'p_nero_caldo', top='p_nero_caldo')
    m.box(-0.2, 0.25, -0.425, 0.2, 0.65, -0.42, 'ferro', skip=('back',))
    m.box(-0.1, 0.52, -0.43, -0.04, 0.58, -0.422, 'p_arancio')
    m.box(0.04, 0.52, -0.43, 0.1, 0.58, -0.422, 'p_arancio')
    # Fiancate con bordi rossi
    m.box(-0.395, 0.1, -0.42, -0.39, 1.7, 0.42, 'p_rosso')
    m.box(0.39, 0.1, -0.42, 0.395, 1.7, 0.42, 'p_rosso')
    # Plancia a sbalzo
    m.cbox(0.0, -0.3, 0.76, 0.34, 0.85, 0.98, 'p_nero_caldo', top='p_nero_caldo')
    # Vano monitor CRT inclinato
    m.cbox(0.0, 0.12, 0.74, 0.6, 0.98, 1.54, 'p_nero_caldo')
    m.box(-0.28, 1.05, -0.16, 0.28, 1.45, -0.08, 'p_acqua_profonda', skip=('back',))
    m.box(-0.06, 1.22, -0.165, 0.06, 1.3, -0.155, 'p_erba_chiara')
    # Insegna superiore marquee
    m.cbox(0.0, -0.18, 0.76, 0.26, 1.54, 1.74, 'p_giallo', top='p_nero_caldo')
    # DETTAGLIO: top impolverato
    m.cbox(0.0, 0.08, 0.78, 0.74, 1.7, 1.75, 'p_nero_caldo', top='p_pietra')
    # DETTAGLIO: joystick visibilmente allentato e storto
    m.cone(6, 0.04, 0.98, 1.01, 'p_nero_caldo', cx=-0.16, cz=-0.32)
    beam(m, (-0.16, 1.0, -0.32), (-0.21, 1.12, -0.35), 0.02, 0.02, 'ferro', end='ferro')
    m.prism(6, 0.035, 0.035, 1.1, 1.16, 'p_rosso', top='p_rosso', cx=-0.21, cz=-0.35)
    # Pulsanti arcade
    m.prism(6, 0.025, 0.025, 0.98, 1.015, 'p_giallo', top='p_giallo', cx=0.1, cz=-0.32)
    m.prism(6, 0.025, 0.025, 0.98, 1.015, 'p_acqua', top='p_acqua', cx=0.2, cz=-0.32)
    return _obj(m, footprint=[W, D])


def mob_letto_a_castello_in_ferro():
    """Letto a castello in tubolare di ferro con due livelli, sponda anticaduta, scaletta e ciabatta dimenticata."""
    m = Mesh('mob_letto_a_castello_in_ferro')
    W, D = ingombro((1, 1))
    cw, cd = 1.05, 1.78
    # 4 montanti angolari verticali in ferro
    for sx in (-cw / 2, cw / 2):
        for sz in (-cd / 2, cd / 2):
            m.cbox(sx, sz, 0.07, 0.07, 0.0, 1.85, 'ferro', top='ferro')
    # Traverse testata e pediera
    for sz in (-cd / 2, cd / 2):
        for y in (0.2, 0.65, 0.85, 1.15, 1.55, 1.75):
            m.cbox(0.0, sz, cw, 0.05, y, y + 0.05, 'ferro')
    # Letto inferiore (materasso, coperta blu e cuscino)
    m.cbox(0.0, 0.0, cw - 0.08, cd - 0.08, 0.22, 0.28, 'ferro', top='ferro')
    m.cbox(0.0, 0.0, cw - 0.12, cd - 0.12, 0.28, 0.44, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(0.0, -cd * 0.1, cw - 0.1, cd * 0.68, 0.44, 0.47, 'tessuto_blu', top='tessuto_blu')
    m.cbox(0.0, cd * 0.32, cw * 0.65, 0.3, 0.44, 0.54, 'p_pietra_chiara', top='p_pietra_chiara')
    # Letto superiore (telaio, sponda anticaduta, coperta rossa e cuscino)
    m.cbox(0.0, 0.0, cw - 0.08, cd - 0.08, 1.12, 1.18, 'ferro', top='ferro')
    m.cbox(-cw / 2, -0.1, 0.05, cd * 0.6, 1.18, 1.48, 'ferro', top='ferro')
    m.cbox(0.0, 0.0, cw - 0.12, cd - 0.12, 1.18, 1.34, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(0.0, -cd * 0.1, cw - 0.1, cd * 0.68, 1.34, 1.37, 'tessuto_rosso', top='tessuto_rosso')
    m.cbox(0.0, cd * 0.32, cw * 0.65, 0.3, 1.34, 1.44, 'p_pietra_chiara', top='p_pietra_chiara')
    # Scaletta laterale in ferro
    m.cbox(cw / 2 + 0.05, -cd * 0.25, 0.04, 0.04, 0.0, 1.5, 'ferro', top='ferro')
    m.cbox(cw / 2 + 0.05, 0.15, 0.04, 0.04, 0.0, 1.5, 'ferro', top='ferro')
    for y in (0.3, 0.6, 0.9, 1.2):
        m.cbox(cw / 2 + 0.05, -0.05, 0.04, 0.4, y, y + 0.04, 'ferro')
    # DETTAGLIO: ciabatta gialla appoggiata sul gradino basso
    m.cbox(cw / 2 + 0.05, -0.05, 0.12, 0.16, 0.34, 0.39, 'p_giallo', top='p_giallo')
    return _obj(m, footprint=[W, D])


def mob_armadio_in_quercia():
    """Armadio monumentale in quercia massiccia a due ante con cornicione intagliato e calendario sul fianco."""
    m = Mesh('mob_armadio_in_quercia')
    W, D = ingombro((1, 1))
    cw, cd = 1.45, 0.76
    # Zoccolo massiccio di base
    m.cbox(0.0, 0.0, cw, cd, 0.0, 0.18, 'p_legno_scuro', top='legno_pieno')
    for sx in (-cw / 2 + 0.1, cw / 2 - 0.1):
        m.cbox(sx, -cd / 2 - 0.02, 0.16, 0.04, 0.0, 0.18, 'p_legno_scuro')
    # Cassettone inferiore
    m.cbox(0.0, 0.0, cw * 0.96, cd * 0.96, 0.18, 0.48, 'legno_scuro', top='p_legno_scuro')
    for sx in (-0.35, 0.35):
        m.cbox(sx, -cd / 2 - 0.02, 0.12, 0.04, 0.3, 0.36, 'ferro')
    # Corpo armadio a due ante con bugne
    m.cbox(0.0, 0.0, cw * 0.94, cd * 0.94, 0.48, 1.88, 'legno_scuro', top='p_legno_scuro')
    m.cbox(0.0, -cd / 2 - 0.015, 0.04, 0.04, 0.48, 1.88, 'p_legno_scuro')
    for sx in (-0.32, 0.32):
        for y in (0.58, 1.25):
            m.box(sx - 0.22, y, -cd / 2 - 0.02, sx + 0.22, y + 0.52, -cd / 2, 'p_legno', skip=('back',))
    # Serratura e pomello
    m.cbox(-0.06, -cd / 2 - 0.03, 0.04, 0.04, 1.12, 1.2, 'ferro')
    m.prism(6, 0.02, 0.02, 1.13, 1.19, 'p_giallo', top='p_giallo', cx=0.06, cz=-cd / 2 - 0.035)
    # Cornicione superiore sporgente
    m.cbox(0.0, 0.0, cw * 0.98, cd * 0.98, 1.88, 1.96, 'p_legno_scuro', top='legno_pieno')
    m.cbox(0.0, 0.0, cw + 0.06, cd + 0.06, 1.96, 2.04, 'p_legno_scuro', top='legno_pieno')
    # DETTAGLIO: calendario appeso sul fianco («tutti i santi del calendario»)
    m.box(cw * 0.47 + 0.01, 1.25, -0.15, cw * 0.47 + 0.02, 1.55, 0.15, 'carta', skip=('left',))
    m.box(cw * 0.47 + 0.01, 1.5, -0.15, cw * 0.47 + 0.022, 1.55, 0.15, 'p_rosso', skip=('left',))
    return _obj(m, footprint=[W, D])


def mob_statua_di_procione_in_ceramica():
    """Statua in ceramica di procione / tanuki panciuto con cappello di paglia, occhi inquietanti e sacco."""
    m = Mesh('mob_statua_di_procione_in_ceramica')
    W, D = ingombro((1, 1))
    # Basamento rotondo
    m.prism(8, 0.38, 0.36, 0.0, 0.08, 'pietra_liscia', top='pietra_liscia', cx=0.0, cz=0.0)
    for sx in (-0.16, 0.16):
        m.cbox(sx, -0.06, 0.14, 0.18, 0.08, 0.16, 'p_legno')
    # Pancia panciuta in ceramica
    m.prism(8, 0.28, 0.32, 0.14, 0.34, 'p_legno', top='p_pietra_chiara', cx=0.0, cz=0.02)
    m.prism(8, 0.32, 0.26, 0.34, 0.52, 'p_legno', top='p_pietra_chiara', cx=0.0, cz=0.02)
    m.cbox(0.0, -0.15, 0.3, 0.18, 0.2, 0.45, 'p_pietra_chiara', top='p_pietra_chiara')
    # Testa e mascherina
    m.prism(8, 0.22, 0.18, 0.52, 0.72, 'p_legno', top='p_legno', cx=0.0, cz=-0.02)
    m.cone(4, 0.1, 0.56, 0.62, 'p_pietra_chiara', cx=0.0, cz=-0.18)
    m.prism(6, 0.025, 0.025, 0.6, 0.64, 'p_nero_caldo', top='p_nero_caldo', cx=0.0, cz=-0.22)
    m.cbox(0.0, -0.15, 0.32, 0.06, 0.62, 0.68, 'p_nero_caldo')
    # DETTAGLIO: occhi spalancati inquietanti da strozzino
    for sx in (-0.08, 0.08):
        m.prism(6, 0.035, 0.035, 0.63, 0.67, 'p_giallo', top='p_nero_caldo', cx=sx, cz=-0.17)
    # Cappello a cono in paglia
    m.cone(8, 0.38, 0.7, 0.84, 'paglia', bottom='p_legno_scuro', cx=0.0, cz=-0.02)
    # Coda tozza a strisce sul retro
    beam(m, (0.0, 0.12, 0.18), (0.1, 0.28, 0.34), 0.14, 0.14, 'p_legno_scuro', end='p_nero_caldo')
    # DETTAGLIO: sacco dei crediti e libretto debiti
    m.prism(6, 0.1, 0.12, 0.16, 0.35, 'tela_sacco', top='corda', cx=-0.28, cz=-0.04)
    m.box(0.24, 0.35, -0.12, 0.32, 0.48, 0.06, 'carta', skip=('left',))
    return _obj(m, footprint=[W, D])


def mob_libreria_asimmetrica():
    """Libreria di design geometrico asimmetrico con scomparti disallineati, libri inclinati e pile orizzontali."""
    m = Mesh('mob_libreria_asimmetrica')
    W, D = ingombro((1, 1))
    cw, cd = 1.35, 0.42
    # Piedini metallici neri
    for sx in (-cw / 2 + 0.08, cw / 2 - 0.08):
        for sz in (-cd / 2 + 0.06, cd / 2 - 0.06):
            m.cbox(sx, sz, 0.05, 0.05, 0.0, 0.12, 'p_nero_caldo', top='p_nero_caldo')
    # Telaio base
    m.cbox(0.0, 0.0, cw, cd, 0.12, 0.16, 'p_nero_caldo', top='tavole')
    # Montanti asimmetrici (sinistro alto 1.8m, destro 1.45m)
    m.cbox(-cw / 2 + 0.02, 0.0, 0.04, cd, 0.16, 1.8, 'p_legno_chiaro', top='p_legno_chiaro')
    m.cbox(cw / 2 - 0.02, 0.0, 0.04, cd, 0.16, 1.45, 'p_legno_chiaro', top='p_legno_chiaro')
    # Ripiani asimmetrici sfalsati
    m.cbox(0.0, 0.0, cw, cd, 0.58, 0.62, 'p_legno_chiaro', top='tavole')
    m.cbox(0.0, 0.0, cw, cd, 1.05, 1.09, 'p_legno_chiaro', top='tavole')
    m.cbox(-0.15, 0.0, cw * 0.7, cd, 1.45, 1.49, 'p_legno_chiaro', top='tavole')
    m.cbox(-0.35, 0.0, cw * 0.4, cd, 1.8, 1.84, 'p_legno_chiaro', top='tavole')
    # Divisori verticali sfalsati
    m.cbox(-0.15, 0.0, 0.03, cd, 0.16, 0.58, 'p_nero_caldo')
    m.cbox(0.25, 0.0, 0.03, cd, 0.58, 1.05, 'p_nero_caldo')
    m.cbox(-0.28, 0.0, 0.03, cd, 1.09, 1.45, 'p_nero_caldo')
    # DETTAGLIO: libri scivolati in obliquo («inutile per far stare i libri in verticale»)
    beam(m, (-0.08, 0.16, -0.05), (0.08, 0.38, -0.05), 0.12, 0.22, 'p_rosso', end='carta')
    beam(m, (0.02, 0.16, -0.05), (0.16, 0.35, -0.05), 0.08, 0.22, 'p_giallo', end='carta')
    # DETTAGLIO: pila di libri orizzontali accatastati
    m.cbox(-0.42, 0.0, 0.24, 0.28, 0.16, 0.21, 'p_acqua', top='carta')
    m.cbox(-0.41, 0.02, 0.22, 0.26, 0.21, 0.25, 'p_arancio', top='carta')
    m.cbox(-0.43, -0.01, 0.25, 0.27, 0.25, 0.29, 'p_viola', top='carta')
    # Vasetto con cactus di design
    m.cbox(0.15, 0.0, 0.14, 0.14, 1.09, 1.2, 'p_arancio', top='terra')
    m.prism(6, 0.04, 0.04, 1.2, 1.34, 'p_bosco', top='p_bosco', cx=0.15, cz=0.0)
    return _obj(m, footprint=[W, D])


def mob_pianta_di_monstera_enorme():
    """Pianta di Monstera enorme in vaso di terracotta con tutore in cocco, grandi foglie e cartellino del prezzo."""
    m = Mesh('mob_pianta_di_monstera_enorme')
    W, D = ingombro((1, 1))
    # Vano vaso in terracotta
    m.prism(8, 0.36, 0.42, 0.0, 0.52, 'p_sabbia', top='p_sabbia', cx=0.0, cz=0.0)
    m.prism(8, 0.44, 0.44, 0.5, 0.56, 'p_sabbia', top='terra', cx=0.0, cz=0.0)
    m.prism(8, 0.38, 0.38, 0.48, 0.52, 'terra', top='terra', cx=0.0, cz=0.0)
    # Tutore centrale in fibra di cocco
    m.prism(6, 0.05, 0.045, 0.52, 1.65, 'tronco_palma', top='p_legno_scuro', cx=0.0, cz=0.0)
    # Rami principali
    beam(m, (0.0, 0.7, 0.0), (-0.45, 1.05, -0.35), 0.04, 0.04, 'p_bosco', end='p_bosco')
    beam(m, (0.0, 0.9, 0.0), (0.48, 1.2, -0.25), 0.04, 0.04, 'p_bosco', end='p_bosco')
    beam(m, (0.0, 1.15, 0.0), (-0.4, 1.45, 0.35), 0.04, 0.04, 'p_bosco', end='p_bosco')
    beam(m, (0.0, 1.35, 0.0), (0.35, 1.6, 0.3), 0.04, 0.04, 'p_bosco', end='p_bosco')
    beam(m, (0.0, 1.55, 0.0), (0.05, 1.88, -0.1), 0.035, 0.035, 'p_bosco', end='p_bosco')
    # Grandi foglie sagomate di Monstera
    m.cbox(-0.52, -0.42, 0.48, 0.44, 1.02, 1.06, 'foglie', top='foglie')
    m.cbox(-0.52, -0.42, 0.12, 0.38, 1.06, 1.07, 'p_erba')
    m.cbox(0.55, -0.32, 0.52, 0.48, 1.16, 1.2, 'foglie', top='foglie')
    m.cbox(-0.48, 0.42, 0.5, 0.46, 1.4, 1.44, 'foglie', top='foglie')
    m.cbox(0.42, 0.38, 0.46, 0.44, 1.54, 1.58, 'foglie', top='foglie')
    m.cbox(0.06, -0.12, 0.54, 0.5, 1.82, 1.86, 'foglie', top='foglie')
    # DETTAGLIO: cartellino del prezzo con codice a barre ancora attaccato («probabilmente è finta»)
    beam(m, (-0.2, 0.85, -0.15), (-0.22, 0.72, -0.16), 0.01, 0.01, 'ferro')
    m.box(-0.28, 0.62, -0.17, -0.16, 0.74, -0.165, 'carta', skip=('back',))
    m.box(-0.25, 0.65, -0.175, -0.19, 0.71, -0.17, 'p_nero_caldo')
    return _obj(m, footprint=[W, D])


MODELS = {
    f.__name__: f
    for f in (
        mob_comodino_lampada,
        mob_cabina_telefonica_rossa_smontata,
        mob_divano_gonfiabile_a_forma_di_coccodrillo,
        mob_trono_di_plastica_dorata,
        mob_amaca_da_interno_con_supporto_in_bambu,
        mob_flipper_anni_90,
        mob_cabina_fototessera,
        mob_albero_di_natale_a_luglio,
        mob_letto_ad_acqua,
        mob_scultura_astratta_in_fil_di_ferro,
        mob_cassapanca_da_pirata,
        mob_manichino_da_sartoria_con_cappello_da_cowboy,
        mob_frigorifero_anni_50_smaltato,
        mob_divano_in_pelle_vintage,
        mob_poltrona_a_sacco,
        mob_cabinato_da_sala_giochi_polveroso,
        mob_letto_a_castello_in_ferro,
        mob_armadio_in_quercia,
        mob_statua_di_procione_in_ceramica,
        mob_libreria_asimmetrica,
        mob_pianta_di_monstera_enorme,
    )
}
