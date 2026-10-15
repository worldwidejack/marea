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
import math
from lib import Mesh, Xf, beam


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
    """Cabina telefonica rossa intera (1 cella): montanti rossi, vetri blu, sportello aperto, telefono col gettone incastrato e il numero scritto col pennarello."""
    m = Mesh('mob_cabina_telefonica_rossa_smontata')
    W, D = ingombro((1, 1))
    zc = 0.3                                           # la cabina sta in fondo alla cella: davanti resta il posto per lo sportello aperto
    hw, hd = 0.5, 0.45
    # Basamento nero e 4 montanti rossi
    m.cbox(0.0, zc, 1.1, 1.0, 0.0, 0.1, 'p_nero_caldo', top='p_nero_caldo')
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cbox(sx * (hw - 0.04), zc + sz * (hd - 0.04), 0.1, 0.1, 0.1, 2.0, 'p_rosso', top='p_rosso')
    # Retro e fianchi: pannello pieno in basso, vetro blu sopra con due traversi e un montante a metà
    m.box(-hw, 0.1, zc + hd - 0.05, hw, 0.85, zc + hd, 'p_rosso', skip=('bottom',))
    m.box(-hw, 0.1, zc - hd, -hw + 0.05, 0.85, zc + hd, 'p_rosso', skip=('bottom',))
    m.box(hw - 0.05, 0.1, zc - hd, hw, 0.85, zc + hd, 'p_rosso', skip=('bottom',))
    m.box(-hw + 0.05, 0.85, zc + hd - 0.04, hw - 0.05, 2.0, zc + hd - 0.01, 'vetro', skip=('bottom', 'top'))
    m.box(-hw + 0.01, 0.85, zc - hd + 0.05, -hw + 0.04, 2.0, zc + hd - 0.05, 'vetro', skip=('bottom', 'top'))
    m.box(hw - 0.04, 0.85, zc - hd + 0.05, hw - 0.01, 2.0, zc + hd - 0.05, 'vetro', skip=('bottom', 'top'))
    for y in (1.2, 1.55):
        m.box(-hw, y, zc + hd - 0.06, hw, y + 0.05, zc + hd, 'p_rosso', skip=('bottom',))
        m.box(-hw, y, zc - hd, -hw + 0.06, y + 0.05, zc + hd, 'p_rosso', skip=('bottom',))
        m.box(hw - 0.06, y, zc - hd, hw, y + 0.05, zc + hd, 'p_rosso', skip=('bottom',))
    m.box(-0.025, 0.85, zc + hd - 0.06, 0.025, 2.0, zc + hd, 'p_rosso', skip=('bottom', 'top'))
    # Cornice, tetto a due gradini e insegna gialla sul davanti
    m.box(-hw, 2.0, zc - hd, hw, 2.1, zc + hd, 'p_rosso', top='p_rosso')
    m.box(-0.56, 2.1, zc - hd - 0.06, 0.56, 2.2, zc + hd + 0.06, 'p_rosso', top='p_rosso')
    m.box(-0.4, 2.2, zc - 0.34, 0.4, 2.28, zc + 0.34, 'p_rosso', top='p_rosso')
    m.box(-0.36, 2.01, zc - hd - 0.02, 0.36, 2.09, zc - hd, 'p_giallo', skip=('bottom', 'back'))
    # DETTAGLIO: telefono nero sul fondo con il gettone giallo incastrato nella fessura, e il numero scritto col pennarello su un foglietto
    m.box(-0.14, 1.0, zc + hd - 0.17, 0.14, 1.45, zc + hd - 0.06, 'p_nero_caldo', skip=('bottom',))
    m.box(0.02, 1.3, zc + hd - 0.2, 0.12, 1.37, zc + hd - 0.17, 'p_giallo', skip=('back', 'bottom'))
    m.box(-0.22, 1.2, zc + hd - 0.15, -0.16, 1.5, zc + hd - 0.09, 'p_nero_caldo')
    m.box(-0.11, 1.56, zc + hd - 0.065, 0.11, 1.72, zc + hd - 0.06, 'p_pietra_chiara', skip=('back', 'bottom'))
    for i in range(4):
        m.box(-0.085 + i * 0.05, 1.6, zc + hd - 0.07, -0.065 + i * 0.05, 1.68, zc + hd - 0.065, 'p_nero_caldo', skip=('back', 'bottom'))
    # Sportello rosso con finestra, aperto di 60° (cerniera a sinistra)
    h = (-hw + 0.04, 1.05, zc - hd + 0.04)
    d = (0.5, 0.0, -0.866)
    t = (h[0] + d[0] * 0.82, h[1], h[2] + d[2] * 0.82)
    beam(m, h, t, 0.06, 1.9, 'p_rosso', end='p_rosso')
    beam(m, (h[0] + d[0] * 0.1, 1.45, h[2] + d[2] * 0.1), (t[0] - d[0] * 0.1, 1.45, t[2] - d[2] * 0.1), 0.07, 0.8, 'vetro')
    return _obj(m, footprint=[W, D])


def mob_divano_gonfiabile_a_forma_di_coccodrillo():
    """Divano gonfiabile a forma di coccodrillo verde: dorso con creste dietro la seduta, zampe-braccioli con artigli, testa coi denti sul davanti."""
    m = Mesh('mob_divano_gonfiabile_a_forma_di_coccodrillo')
    W, D = ingombro((1, 1))
    m.push(Xf((0, 0, 0.14)))                           # il corpo è lungo: lo ricentro nell'ingombro
    # Corpo gonfio: dorso dietro, seduta in mezzo con la pancia chiara
    m.cbox(0, 0.42, 1.3, 0.42, 0.08, 0.66, 'p_erba', top='p_erba')
    m.cbox(0, 0.0, 1.0, 0.56, 0.08, 0.34, 'p_erba', top='p_erba_chiara')
    # Creste sul dorso (coni a punta, scuri)
    for x in (-0.5, -0.25, 0.0, 0.25, 0.5):
        m.cone(4, 0.1, 0.66, 0.9, 'p_bosco', cx=x, cz=0.42)
    # Zampe-braccioli con tre artigli chiari ciascuna
    for sx in (-1, 1):
        m.cbox(sx * 0.63, 0.12, 0.3, 0.8, 0.08, 0.5, 'p_erba', top='p_erba')
        for dx in (-0.09, 0.0, 0.09):
            m.box(sx * 0.63 + dx - 0.025, 0.08, -0.38, sx * 0.63 + dx + 0.025, 0.2, -0.28, 'p_pietra_chiara', skip=('bottom',))
    # Testa: mascella superiore, mascella inferiore chiara, denti, narici, occhi gialli
    m.cbox(0, -0.6, 0.78, 0.6, 0.2, 0.42, 'p_erba', top='p_erba')
    m.cbox(0, -0.58, 0.72, 0.56, 0.06, 0.2, 'p_erba_chiara', top='p_erba_chiara')
    for x in (-0.28, -0.14, 0.0, 0.14, 0.28):
        m.box(x - 0.03, 0.14, -0.93, x + 0.03, 0.22, -0.88, 'p_pietra_chiara', skip=('bottom', 'back'))
    for sx in (-1, 1):
        m.box(sx * 0.12 - 0.03, 0.34, -0.91, sx * 0.12 + 0.03, 0.4, -0.89, 'p_nero_caldo', skip=('bottom', 'back'))
        m.prism(6, 0.1, 0.08, 0.42, 0.56, 'p_giallo', top='p_nero_caldo', cx=sx * 0.27, cz=-0.42)
    # DETTAGLIO: valvola d'aria gialla sul braccio
    m.prism(6, 0.045, 0.045, 0.5, 0.58, 'p_giallo', top='p_giallo', cx=0.63, cz=0.3)
    m.pop()
    return _obj(m, footprint=[W, D])


def mob_trono_di_plastica_dorata():
    """Trono in plastica dorata: schienale a corona con gemme rosse, seduta col cuscino arancio graffiato, braccioli con bordo arancio."""
    m = Mesh('mob_trono_di_plastica_dorata')
    W, D = ingombro((1, 1))
    # Seduta sagomata e cuscino
    m.cbox(0, 0.05, 0.88, 0.78, 0.44, 0.52, 'p_giallo', top='p_giallo')
    m.cbox(0, 0.0, 0.6, 0.5, 0.52, 0.6, 'p_arancio', top='p_arancio')
    # Schienale alto con pannello imbottito arancio sul davanti
    m.cbox(0, 0.38, 0.84, 0.1, 0.52, 1.42, 'p_giallo', top='p_giallo')
    m.box(-0.3, 0.72, 0.3, 0.3, 1.3, 0.33, 'p_arancio', skip=('back',))
    # Corona / pinnacoli in cima allo schienale, con le gemme
    m.prism(3, 0.18, 0.0, 1.42, 1.66, 'p_giallo', cx=0.0, cz=0.38)
    m.prism(3, 0.13, 0.0, 1.42, 1.58, 'p_giallo', cx=-0.26, cz=0.38)
    m.prism(3, 0.13, 0.0, 1.42, 1.58, 'p_giallo', cx=0.26, cz=0.38)
    m.box(-0.045, 1.5, 0.3, 0.045, 1.59, 0.34, 'p_rosso', skip=('bottom', 'back'))
    for sx in (-0.26, 0.26):
        m.box(sx - 0.035, 1.46, 0.3, sx + 0.035, 1.53, 0.34, 'p_rosso', skip=('bottom', 'back'))
    # Braccioli: bordo superiore arancio, volute davanti
    for sx in (-0.43, 0.43):
        m.cbox(sx, 0.05, 0.12, 0.74, 0.52, 0.82, 'p_giallo', top='p_arancio')
        m.cbox(sx, -0.34, 0.16, 0.14, 0.5, 0.9, 'p_giallo', top='p_arancio')
    # 4 gambe in plastica stampata
    for sx in (-0.36, 0.36):
        for sz in (-0.28, 0.38):
            m.cbox(sx, sz, 0.11, 0.11, 0.0, 0.44, 'p_giallo')
    # DETTAGLIO: graffio scuro sul cuscino («si graffia»)
    m.box(-0.16, 0.602, -0.1, 0.18, 0.606, -0.02, 'p_ombra_calda', skip=('bottom',))
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
    # Telo a sacca: fondo piatto e due risalite, appeso con tre corde per lato ai pali
    m.cbox(0.0, 0.0, 0.64, 0.66, 0.5, 0.56, 'tela', top='tela')
    for sx in (-1, 1):
        beam(m, (sx * 0.32, 0.53, 0.0), (sx * 0.52, 0.72, 0.0), 0.66, 0.06, 'tela', end='tela')
        for z in (-0.3, 0.0, 0.3):
            beam(m, (sx * 0.52, 0.72, z), (sx * 0.71, 1.12, 0.0), 0.03, 0.03, 'corda')
    # DETTAGLIO: distributore di bibite proprio sotto l'amaca (vetrinetta con le lattine, fessura e pulsante)
    m.cbox(0.0, 0.0, 0.5, 0.42, 0.0, 0.44, 'p_rosso', top='p_nero_caldo')
    m.box(-0.2, 0.18, -0.215, 0.2, 0.38, -0.21, 'p_pietra_chiara', skip=('back',))
    for x in (-0.12, 0.0, 0.12):
        m.box(x - 0.035, 0.2, -0.222, x + 0.035, 0.3, -0.215, 'p_acqua', skip=('back',))
    m.box(-0.16, 0.06, -0.215, 0.16, 0.14, -0.21, 'p_nero_caldo', skip=('back',))
    m.box(0.2, 0.2, -0.222, 0.24, 0.26, -0.21, 'p_giallo', skip=('back',))
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
    m.cbox(0.0, -cd * 0.05, cw * 0.88, cd * 0.78, 0.38, 0.52, 'p_acqua', top='p_acqua')
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
    """Frigorifero anni ’50 turchese: guscio smaltato col cromo, sportello aperto a 45° che lascia vedere la lattina e il barattolo di maionese scaduta."""
    m = Mesh('mob_frigorifero_anni_50_smaltato')
    W, D = ingombro((1, 1))
    zf = -0.34                                         # fronte del guscio
    # Piedini cromati
    for sx in (-0.36, 0.36):
        for sz in (-0.26, 0.3):
            m.cbox(sx, sz, 0.1, 0.1, 0.0, 0.1, 'ferro', top='ferro')
    # Guscio smaltato aperto sul davanti: due fianchi, tetto, fondo e retro
    m.box(-0.44, 0.1, zf, -0.36, 1.45, 0.44, 'p_acqua', top='p_acqua', skip=('right',))
    m.box(0.36, 0.1, zf, 0.44, 1.45, 0.44, 'p_acqua', top='p_acqua', skip=('left',))
    m.box(-0.36, 1.37, zf, 0.36, 1.45, 0.44, 'p_acqua', top='p_acqua', bottom='p_pietra_chiara', skip=('left', 'right'))
    m.box(-0.36, 0.1, zf, 0.36, 0.22, 0.44, 'p_acqua', top='p_pietra_chiara', skip=('left', 'right'))
    m.box(-0.36, 0.22, 0.36, 0.36, 1.37, 0.44, 'p_acqua', skip=('left', 'right', 'bottom', 'top', 'front'))
    # Interno chiaro: rivestimenti dei fianchi e del fondo, ripiani cromati
    m.box(-0.36, 0.22, zf + 0.02, -0.35, 1.37, 0.36, 'p_pietra_chiara', skip=('left', 'bottom', 'top', 'front', 'back'))
    m.box(0.35, 0.22, zf + 0.02, 0.36, 1.37, 0.36, 'p_pietra_chiara', skip=('right', 'bottom', 'top', 'front', 'back'))
    m.box(-0.35, 0.22, 0.35, 0.35, 1.37, 0.36, 'p_pietra_chiara', skip=('left', 'right', 'bottom', 'top', 'back'))
    for y in (0.55, 0.95):
        m.cbox(0.0, 0.03, 0.7, 0.66, y, y + 0.02, 'p_pietra', top='p_pietra')
    # Sportello aperto a 45° (cerniera a destra) col maniglione cromato
    beam(m, (0.44, 0.775, zf - 0.03), (0.44 - 0.54, 0.775, zf - 0.03 - 0.54), 0.07, 1.35, 'p_acqua', end='p_acqua')
    beam(m, (0.44 - 0.35, 0.8, zf - 0.03 - 0.4 - 0.05), (0.44 - 0.35, 1.15, zf - 0.03 - 0.4 - 0.05), 0.04, 0.04, 'ferro', end='ferro')
    # DETTAGLIO: lattina rossa e mezzo barattolo di maionese scaduta (tappo giallo) sul ripiano
    m.prism(6, 0.05, 0.05, 0.57, 0.71, 'p_rosso', top='ferro', cx=-0.15, cz=-0.05)
    m.prism(6, 0.06, 0.06, 0.57, 0.65, 'p_pietra_chiara', top='p_giallo', cx=0.15, cz=-0.05)
    m.prism(6, 0.05, 0.05, 0.65, 0.68, 'p_giallo', top='p_giallo', cx=0.15, cz=-0.05)
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
    """Poltrona a sacco sgargiante e deformata: sacco arancio con schienale rosso floscio, seduta avvallata, cucitura viola e telecomando incastrato."""
    m = Mesh('mob_poltrona_a_sacco')
    W, D = ingombro((1, 1))
    a0 = math.pi / 8
    # Sacco basso e largo, più stretto in basso e in cima
    m.loft([m.ring(8, 0.5, 0.0, a0=a0), m.ring(8, 0.7, 0.2, a0=a0), m.ring(8, 0.72, 0.38, a0=a0, cz=0.02), m.ring(8, 0.62, 0.46, a0=a0, cz=0.04)],
           'p_arancio', top='p_arancio')
    # Seduta avvallata: un incavo scuro nel sacco
    m.prism(8, 0.4, 0.3, 0.45, 0.47, 'p_ombra_calda', top='p_ombra_calda', cz=-0.08)
    # Schienale floscio rosso, basso e largo, verso +Z
    m.loft([m.ring(8, 0.56, 0.3, a0=a0, rz=0.4, cz=0.3), m.ring(8, 0.55, 0.58, a0=a0, rz=0.38, cz=0.34), m.ring(8, 0.4, 0.74, a0=a0, rz=0.28, cz=0.36)],
           'p_rosso', top='p_rosso')
    # Cucitura viola e maniglia di stoffa in cima
    m.prism(8, 0.73, 0.73, 0.26, 0.3, 'p_viola', cz=0.01)
    beam(m, (-0.1, 0.76, 0.36), (0.1, 0.76, 0.36), 0.04, 0.08, 'p_viola', end='p_viola')
    # DETTAGLIO: telecomando nero incastrato nella piega («non ti alzi più»)
    m.box(0.16, 0.47, -0.14, 0.26, 0.51, 0.04, 'p_nero_caldo')
    m.box(0.19, 0.51, -0.1, 0.23, 0.515, -0.06, 'p_giallo')
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
    """Statua di procione in ceramica grigia: seduto sul piedistallo, maschera nera, sguardo da strozzino, mano tesa con la moneta, coda ad anelli."""
    m = Mesh('mob_statua_di_procione_in_ceramica')
    W, D = ingombro((1, 1))
    m.push(Xf(s=0.85))                                 # statuetta: 1 m circa
    # Piedistallo ottagonale
    m.prism(8, 0.52, 0.48, 0.0, 0.12, 'pietra_liscia', top='pietra_liscia')
    m.prism(8, 0.44, 0.4, 0.12, 0.2, 'p_pietra_scura', top='p_pietra_scura')
    # Corpo panciuto grigio con la pancia chiara e due zampe davanti
    m.prism(8, 0.3, 0.34, 0.2, 0.5, 'p_pietra', top='p_pietra')
    m.prism(8, 0.34, 0.26, 0.5, 0.72, 'p_pietra', top='p_pietra')
    m.cbox(0, -0.3, 0.34, 0.06, 0.26, 0.58, 'p_pietra_chiara')
    for sx in (-0.16, 0.16):
        m.cbox(sx, -0.3, 0.14, 0.2, 0.2, 0.28, 'p_pietra_chiara')
    # Testa larga, muso chiaro, maschera nera con occhi stretti e fissi, orecchie a punta
    m.cbox(0, -0.02, 0.6, 0.44, 0.72, 1.02, 'p_pietra', top='p_pietra')
    m.cbox(0, -0.245, 0.6, 0.05, 0.84, 0.95, 'p_nero_caldo')
    m.cbox(0, -0.3, 0.24, 0.14, 0.72, 0.84, 'p_pietra_chiara')
    m.cbox(0, -0.385, 0.09, 0.04, 0.78, 0.84, 'p_nero_caldo')
    for sx in (-1, 1):
        m.box(sx * 0.15 - 0.055, 0.88, -0.28, sx * 0.15 + 0.055, 0.92, -0.25, 'p_pietra_chiara', skip=('bottom', 'back'))
        m.box(sx * 0.15 - 0.02, 0.885, -0.285, sx * 0.15 + 0.02, 0.915, -0.28, 'p_nero_caldo', skip=('bottom', 'back'))
        m.cone(4, 0.12, 1.02, 1.22, 'p_pietra', cx=sx * 0.22, cz=0.0)
        m.cone(4, 0.05, 1.02, 1.12, 'p_nero_caldo', cx=sx * 0.22, cz=-0.1)
    # DETTAGLIO: la mano destra tesa a chiedere soldi, con la moneta sul palmo
    beam(m, (0.3, 0.6, -0.08), (0.34, 0.5, -0.46), 0.12, 0.12, 'p_pietra', end='p_pietra')
    m.cbox(0.34, -0.5, 0.2, 0.16, 0.46, 0.5, 'p_pietra_chiara')
    m.prism(6, 0.07, 0.07, 0.5, 0.53, 'p_giallo', top='p_giallo', cx=0.34, cz=-0.5)
    # Coda ad anelli grigi e neri che sale dietro
    pts = [(0.0, 0.2, 0.3), (-0.18, 0.38, 0.4), (-0.32, 0.6, 0.38), (-0.38, 0.86, 0.3), (-0.34, 1.08, 0.2)]
    for i in range(len(pts) - 1):
        beam(m, pts[i], pts[i + 1], 0.17 - 0.015 * i, 0.17 - 0.015 * i, 'p_pietra' if i % 2 == 0 else 'p_nero_caldo', end='p_nero_caldo' if i == len(pts) - 2 else None)
    m.pop()
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
