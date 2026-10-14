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
    )
}
