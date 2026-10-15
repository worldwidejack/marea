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


def mob_caminetto_in_mattoni_finiti():
    """Caminetto rustico in mattoni con focolare, mensola in legno, fiamme vive e tizzone caduto."""
    m = Mesh('mob_caminetto_in_mattoni_finiti')
    W, D = ingombro((1, 1))
    cz = 0.25
    # Basamento a terra
    m.cbox(0.0, cz, 1.4, 0.75, 0.0, 0.15, 'mattoni_fucina', top='p_pietra_scura')
    # Spalle laterali in mattoni
    m.cbox(-0.5, cz, 0.35, 0.65, 0.15, 1.15, 'mattoni_fucina', top='mattoni_fucina')
    m.cbox(0.5, cz, 0.35, 0.65, 0.15, 1.15, 'mattoni_fucina', top='mattoni_fucina')
    # Parete di fondo del focolare
    m.cbox(0.0, cz + 0.22, 0.7, 0.2, 0.15, 1.15, 'p_nero_caldo', top='p_nero_caldo')
    # Architrave / cappa in mattoni
    m.cbox(0.0, cz, 1.4, 0.68, 1.15, 1.35, 'mattoni_fucina', top='mattoni_fucina')
    # Mensola superiore in legno scuro
    m.cbox(0.0, cz - 0.04, 1.5, 0.78, 1.35, 1.45, 'p_legno_scuro', top='legno_pieno')
    # Canna fumaria rastremata in alto
    m.cbox(0.0, cz + 0.08, 0.85, 0.48, 1.45, 1.95, 'mattoni_fucina', top='mattoni_fucina')
    # Ceppi di legna nel focolare
    beam(m, (-0.24, 0.18, cz), (0.22, 0.22, cz + 0.08), 0.09, 0.09, 'corteccia', end='taglio')
    beam(m, (-0.18, 0.22, cz + 0.08), (0.24, 0.18, cz - 0.04), 0.09, 0.09, 'corteccia', end='taglio')
    # Fiamme ardenti al centro
    m.cone(5, 0.18, 0.22, 0.62, 'em_fuoco', cx=0.0, cz=cz)
    m.cone(4, 0.1, 0.25, 0.72, 'p_giallo', cx=0.04, cz=cz - 0.02)
    # DETTAGLIO: tizzone ardente rotolato fuori sul bordo a terra («se lo accendi dai fuoco a tutta la planimetria»)
    m.cbox(-0.18, cz - 0.42, 0.08, 0.08, 0.0, 0.06, 'p_arancio', top='p_rosso')
    m.cbox(-0.16, cz - 0.41, 0.04, 0.04, 0.06, 0.09, 'p_giallo')
    return _obj(m, footprint=[W, D])


def mob_distributore_di_bibite():
    """Distributore automatico di bibite refrigerato con vetrina illuminata, pulsanti e lattina ghiacciata."""
    m = Mesh('mob_distributore_di_bibite')
    W, D = ingombro((1, 1))
    # Piedini metallici
    for sx in (-0.38, 0.38):
        for sz in (-0.28, 0.28):
            m.cbox(sx, sz, 0.08, 0.08, 0.0, 0.08, 'p_nero_caldo', top='p_nero_caldo')
    # Cassone principale rosso
    m.cbox(0.0, 0.0, 0.96, 0.78, 0.08, 1.88, 'p_rosso', top='p_rosso')
    # Insegna luminosa superiore
    m.cbox(0.0, -0.385, 0.86, 0.04, 1.62, 1.82, 'em_neon_ciano', top='p_rosso')
    # Vetrina espositiva frontale incassata (-Z)
    m.box(-0.42, 0.62, -0.405, 0.12, 1.58, -0.38, 'p_nero_caldo')
    m.box(-0.41, 0.63, -0.415, 0.11, 1.57, -0.405, 'vetro')
    # Ripiani con lattine colorate dietro al vetro
    for y in (0.75, 1.05, 1.35):
        m.box(-0.4, y, -0.395, 0.1, y + 0.02, -0.385, 'ferro')
        for i, col in enumerate(('p_rosso', 'p_acqua', 'p_giallo', 'p_erba')):
            m.prism(6, 0.03, 0.03, y + 0.02, y + 0.15, col, top='ferro', cx=-0.34 + i * 0.11, cz=-0.39)
    # Tastiera e fessura monete a destra
    m.box(0.18, 0.95, -0.405, 0.4, 1.52, -0.385, 'p_nero_caldo')
    m.box(0.22, 1.38, -0.41, 0.36, 1.46, -0.402, 'ferro')
    for row in range(3):
        for col in range(2):
            m.cbox(0.24 + col * 0.08, -0.408, 0.04, 0.02, 1.05 + row * 0.09, 1.1 + row * 0.09, 'p_giallo')
    # Vano di prelievo orizzontale in basso
    m.box(-0.35, 0.18, -0.415, 0.35, 0.44, -0.28, 'p_nero_caldo', top='p_nero_caldo')
    # Griglia di aerazione laterale che "ronza"
    for gy in (0.25, 0.35, 0.45, 0.55):
        m.box(0.482, gy, -0.15, 0.486, gy + 0.04, 0.15, 'p_nero_caldo')
    # DETTAGLIO: lattina azzurra ghiacciata pronta nello scomparto («ha sempre le lattine ghiacciate»)
    m.prism(6, 0.04, 0.04, 0.2, 0.34, 'p_acqua', top='ferro', cx=0.08, cz=-0.33)
    return _obj(m, footprint=[W, D])


def mob_vasca_da_bagno_con_piedini():
    """Vasca da bagno vintage con piedini a zampa di leone dorati, rubinetto e papera di gomma."""
    m = Mesh('mob_vasca_da_bagno_con_piedini')
    W, D = ingombro((1, 1))
    cw, cd = 1.55, 0.82
    # 4 piedini dorati sagomati
    for sx in (-0.58, 0.58):
        for sz in (-0.28, 0.28):
            m.cone(5, 0.07, 0.0, 0.16, 'oro', cx=sx, cz=sz)
            m.cbox(sx, sz, 0.11, 0.11, 0.14, 0.2, 'oro', top='oro')
    # Conca esterna della vasca smaltata
    m.cbox(0.0, 0.0, cw, cd, 0.16, 0.66, 'p_pietra_chiara', top='p_pietra_chiara')
    # Bordo svasato superiore
    m.cbox(0.0, 0.0, cw + 0.08, cd + 0.08, 0.66, 0.72, 'p_pietra_chiara', top='p_pietra_chiara')
    # Incavo interno della vasca
    m.cbox(0.0, 0.0, cw - 0.18, cd - 0.18, 0.22, 0.68, 'p_pietra_chiara')
    # Acqua turchese all'interno
    m.cbox(0.0, 0.0, cw - 0.2, cd - 0.2, 0.42, 0.48, 'p_acqua', top='p_acqua')
    # Gruppo rubinetteria vintage dorata a parete destra (+X)
    rx = cw / 2 - 0.06
    beam(m, (rx, 0.66, 0.0), (rx, 0.92, 0.0), 0.04, 0.04, 'oro', end='oro')
    beam(m, (rx, 0.92, 0.0), (rx - 0.16, 0.86, 0.0), 0.035, 0.035, 'oro', end='oro')
    # Manopole calda/fredda
    m.cbox(rx, -0.1, 0.06, 0.06, 0.78, 0.84, 'oro', top='p_rosso')
    m.cbox(rx, 0.1, 0.06, 0.06, 0.78, 0.84, 'oro', top='p_acqua')
    # DETTAGLIO: paperella di gomma gialla che galleggia molesta («interior design volutamente moleste»)
    m.prism(6, 0.05, 0.04, 0.48, 0.56, 'p_giallo', top='p_giallo', cx=-0.22, cz=0.04)
    m.cone(4, 0.03, 0.52, 0.56, 'p_arancio', cx=-0.27, cz=0.04)
    return _obj(m, footprint=[W, D])


def mob_sacco_da_boxe():
    """Sacco da boxe pesante sospeso a piantana metallica con catena e guantone da boxe alla base."""
    m = Mesh('mob_sacco_da_boxe')
    W, D = ingombro((1, 1))
    # Piastra di base zavorrata a terra
    m.prism(8, 0.52, 0.48, 0.0, 0.08, 'p_nero_caldo', top='p_nero_caldo', cx=0.0, cz=0.15)
    # Asta portante verticale posteriore (+Z)
    beam(m, (0.0, 0.08, 0.38), (0.0, 1.95, 0.38), 0.08, 0.08, 'ferro', end='p_nero_caldo')
    # Braccio a sbalzo verso il centro (-Z)
    beam(m, (0.0, 1.95, 0.38), (0.0, 2.05, -0.05), 0.07, 0.07, 'ferro', end='p_nero_caldo')
    # Puntone di rinforzo angolare
    beam(m, (0.0, 1.6, 0.38), (0.0, 1.95, 0.1), 0.05, 0.05, 'ferro')
    # Catene di sospensione
    beam(m, (0.0, 2.02, -0.05), (0.0, 1.7, -0.05), 0.03, 0.03, 'ferro')
    # Gancio e cono superiore del sacco
    m.cone(6, 0.16, 1.58, 1.7, 'p_nero_caldo', cx=0.0, cz=-0.05)
    # Cilindro del sacco in pelle/tessuto rosso
    m.prism(8, 0.24, 0.24, 0.65, 1.58, 'tessuto_rosso', top='p_nero_caldo', cx=0.0, cz=-0.05)
    # Fascia centrale rinforzata nera
    m.prism(8, 0.245, 0.245, 1.05, 1.2, 'p_nero_caldo', cx=0.0, cz=-0.05)
    # Calotta inferiore del sacco
    m.prism(8, 0.24, 0.18, 0.55, 0.65, 'p_nero_caldo', bottom='p_nero_caldo', cx=0.0, cz=-0.05)
    # DETTAGLIO: guantone da boxe rosso poggiato sulla base («per sfogare la frustrazione»)
    m.cbox(0.24, 0.05, 0.18, 0.22, 0.08, 0.22, 'p_rosso', top='p_rosso')
    m.box(0.2, 0.08, 0.12, 0.28, 0.16, 0.18, 'p_pietra_chiara')
    return _obj(m, footprint=[W, D])


def mob_pianoforte_a_coda():
    """Pianoforte a coda nero lucido con coperchio aperto, tastiera avorio e spartito di Fra Martino."""
    m = Mesh('mob_pianoforte_a_coda')
    W, D = ingombro((1, 1))
    # 3 gambe tornite nere con rotelle dorate
    gambe = ((-0.55, -0.42), (0.55, -0.42), (-0.1, 0.48))
    for gx, gz in gambe:
        m.prism(6, 0.04, 0.03, 0.0, 0.06, 'oro', top='oro', cx=gx, cz=gz)
        m.prism(6, 0.045, 0.04, 0.06, 0.68, 'p_nero_caldo', top='p_nero_caldo', cx=gx, cz=gz)
    # Lira centrale dei pedali in ottone
    m.cbox(0.0, -0.2, 0.12, 0.04, 0.18, 0.68, 'oro', top='oro')
    for px in (-0.03, 0.0, 0.03):
        m.box(px - 0.01, 0.12, -0.28, px + 0.01, 0.18, -0.2, 'oro')
    # Cassa armonica: blocco tastiera e corpo sagomato
    m.cbox(0.0, -0.4, 1.25, 0.38, 0.68, 0.94, 'p_nero_caldo', top='nero_lacca')
    m.cbox(-0.18, 0.08, 0.88, 0.65, 0.68, 0.94, 'p_nero_caldo', top='nero_lacca')
    m.cbox(-0.1, 0.42, 0.6, 0.42, 0.68, 0.94, 'p_nero_caldo', top='nero_lacca')
    # Cornice interna in ghisa/oro
    m.cbox(-0.15, 0.06, 0.72, 0.55, 0.88, 0.92, 'oro', top='oro')
    # Tastiera a -Z: tasti bianchi e coperchio ribaltato
    m.box(-0.48, 0.72, -0.62, 0.48, 0.78, -0.5, 'p_pietra_chiara', top='p_pietra_chiara')
    m.box(-0.45, 0.76, -0.58, 0.45, 0.8, -0.5, 'p_nero_caldo', top='p_nero_caldo')
    # Coperchio sollevato obliquo sorretto da asta in legno
    beam(m, (-0.6, 0.95, -0.4), (0.42, 1.38, 0.48), 0.85, 0.04, 'p_nero_caldo', end='nero_lacca')
    beam(m, (0.35, 0.94, 0.1), (0.28, 1.3, 0.1), 0.02, 0.02, 'p_legno_scuro')
    # DETTAGLIO: spartito aperto sul leggio («non sai nemmeno fare Fra Martino»)
    m.cbox(0.0, -0.48, 0.32, 0.03, 0.94, 1.08, 'carta', top='pagine')
    m.box(-0.14, 0.98, -0.49, -0.02, 1.05, -0.48, 'p_nero_caldo')
    m.box(0.02, 0.98, -0.49, 0.14, 1.05, -0.48, 'p_nero_caldo')
    return _obj(m, footprint=[W, D])


def mob_tenda_da_campeggio():
    """Tenda igloo da campeggio con archi incrociati, telo turchese e cartello di subaffitto."""
    m = Mesh('mob_tenda_da_campeggio')
    W, D = ingombro((1, 1))
    # Telo cerato di base a terra
    m.cbox(0.0, 0.05, 1.55, 1.55, 0.0, 0.06, 'p_nero_caldo', top='p_nero_caldo')
    # Corpo piramidale/cupola della tenda
    m.prism(8, 0.78, 0.42, 0.06, 0.82, 'p_acqua', top='p_acqua')
    m.cone(8, 0.44, 0.82, 1.28, 'p_acqua')
    # Cuffia di aerazione superiore a contrasto
    m.cone(8, 0.22, 1.18, 1.32, 'p_arancio')
    # Archi flessibili della paleria a incrocio
    beam(m, (-0.65, 0.06, -0.6), (0.65, 0.06, 0.7), 0.03, 0.03, 'p_nero_caldo')
    beam(m, (0.65, 0.06, -0.6), (-0.65, 0.06, 0.7), 0.03, 0.03, 'p_nero_caldo')
    # Apertura dell'ingresso sul fronte (-Z)
    m.box(-0.32, 0.06, -0.72, 0.32, 0.75, -0.58, 'p_ombra_calda', top='p_ombra_calda')
    # Telo porta arrotolato di lato con laccetto giallo
    m.prism(6, 0.06, 0.06, 0.15, 0.7, 'p_acqua_profonda', top='p_giallo', cx=-0.36, cz=-0.65)
    # Sacco a pelo visibile all'interno
    m.cbox(0.0, -0.15, 0.45, 0.75, 0.06, 0.22, 'tessuto_rosso', top='tessuto_rosso')
    # DETTAGLIO: cartellino di cartone «SUBAFFITTO» appeso all'ingresso («subaffittare il salotto»)
    m.box(0.24, 0.52, -0.73, 0.42, 0.68, -0.72, 'carta', skip=('back',))
    m.box(0.26, 0.55, -0.735, 0.4, 0.65, -0.725, 'p_nero_caldo')
    return _obj(m, footprint=[W, D])


def mob_divano_a_due_posti_in_tessuto():
    """Classico divano a due posti in tessuto grigio con cuscini morbidi e tazza sul bracciolo."""
    m = Mesh('mob_divano_a_due_posti_in_tessuto')
    W, D = ingombro((1, 1))
    cw, cd = 1.55, 0.82
    # 4 piedini cilindrici in legno scuro
    for sx in (-cw / 2 + 0.12, cw / 2 - 0.12):
        for sz in (-cd / 2 + 0.1, cd / 2 - 0.1):
            m.prism(6, 0.04, 0.03, 0.0, 0.14, 'p_legno_scuro', top='p_legno_scuro', cx=sx, cz=sz)
    # Telaio base rivestito in tessuto grigio
    m.cbox(0.0, 0.0, cw, cd, 0.14, 0.34, 'p_pietra', top='p_pietra')
    # Schienale posteriore (+Z)
    m.cbox(0.0, cd / 2 - 0.14, cw, 0.28, 0.34, 0.82, 'p_pietra', top='pietra_liscia')
    # Due cuscini imbottiti per lo schienale
    for sx in (-0.35, 0.35):
        m.cbox(sx, cd / 2 - 0.18, 0.65, 0.18, 0.36, 0.78, 'p_pietra_chiara', top='p_pietra_chiara')
    # Due grandi cuscini di seduta
    for sx in (-0.35, 0.35):
        m.cbox(sx, -0.06, 0.66, cd * 0.62, 0.34, 0.48, 'p_pietra_chiara', top='pietra_liscia')
    # Braccioli squadrati laterali
    for sx in (-1, 1):
        m.cbox(sx * (cw / 2 - 0.11), 0.0, 0.22, cd, 0.3, 0.62, 'p_pietra', top='pietra_liscia')
    # DETTAGLIO: tazza da tè dell'ospite sul bracciolo destro («gli ospiti ci si siedono sopra»)
    bx = cw / 2 - 0.11
    m.prism(6, 0.05, 0.04, 0.62, 0.72, 'p_pietra_chiara', top='p_legno_scuro', cx=bx, cz=-0.05)
    m.box(bx - 0.07, 0.62, -0.12, bx + 0.07, 0.63, 0.02, 'p_pietra_chiara')
    return _obj(m, footprint=[W, D])


def mob_sedia_in_legno_massello():
    """Sedia rustica in legno massiccio con traverse, schienale a stecche e maglione appoggiato."""
    m = Mesh('mob_sedia_in_legno_massello')
    W, D = ingombro((1, 1))
    cw, cd = 0.55, 0.52
    # 4 gambe massicce a sezione quadra
    for sx in (-cw / 2 + 0.04, cw / 2 - 0.04):
        for sz in (-cd / 2 + 0.04, cd / 2 - 0.04):
            m.cbox(sx, sz, 0.07, 0.07, 0.0, 0.46, 'p_legno', top='legno_pieno')
    # Traverse di rinforzo tra le gambe
    beam(m, (-cw / 2 + 0.04, 0.16, -cd / 2 + 0.04), (cw / 2 - 0.04, 0.16, -cd / 2 + 0.04), 0.04, 0.04, 'p_legno_scuro')
    beam(m, (-cw / 2 + 0.04, 0.16, cd / 2 - 0.04), (cw / 2 - 0.04, 0.16, cd / 2 - 0.04), 0.04, 0.04, 'p_legno_scuro')
    beam(m, (-cw / 2 + 0.04, 0.22, 0.0), (cw / 2 - 0.04, 0.22, 0.0), 0.04, 0.04, 'p_legno_scuro')
    # Seduta in legno pieno
    m.cbox(0.0, 0.0, cw + 0.04, cd + 0.04, 0.44, 0.5, 'p_legno', top='tavole')
    # Montanti posteriori dello schienale (+Z)
    for sx in (-cw / 2 + 0.04, cw / 2 - 0.04):
        m.cbox(sx, cd / 2 - 0.04, 0.06, 0.06, 0.5, 0.98, 'p_legno', top='legno_pieno')
    # Fascia superiore curva dello schienale
    m.cbox(0.0, cd / 2 - 0.04, cw + 0.02, 0.05, 0.9, 0.98, 'p_legno', top='legno_pieno')
    # 3 stecche verticali dello schienale
    for sx in (-0.12, 0.0, 0.12):
        m.cbox(sx, cd / 2 - 0.04, 0.035, 0.03, 0.5, 0.9, 'p_legno_chiaro')
    # DETTAGLIO: maglione/camicia appoggiata sullo schienale («appoggiarci i vestiti la sera»)
    m.cbox(0.04, cd / 2 - 0.02, 0.38, 0.12, 0.82, 0.99, 'tessuto_rosso', top='tessuto_rosso')
    beam(m, (cw / 2 - 0.02, 0.92, cd / 2 - 0.02), (cw / 2 + 0.06, 0.62, cd / 2 - 0.02), 0.08, 0.06, 'tessuto_rosso')
    return _obj(m, footprint=[W, D])


def mob_mobile_tv_basso():
    """Mobile TV basso in truciolato laminato con anta, vani a giorno e fori passacavi sul retro."""
    m = Mesh('mob_mobile_tv_basso')
    W, D = ingombro((1, 1))
    cw, cd = 1.62, 0.52
    # 4 piedini neri minimali
    for sx in (-cw / 2 + 0.1, cw / 2 - 0.1):
        for sz in (-cd / 2 + 0.08, cd / 2 - 0.08):
            m.cbox(sx, sz, 0.05, 0.05, 0.0, 0.1, 'p_nero_caldo', top='p_nero_caldo')
    # Struttura del mobile in truciolato
    m.cbox(0.0, 0.0, cw, cd, 0.1, 0.14, 'p_legno_chiaro', top='tavole')
    m.cbox(0.0, 0.0, cw, cd, 0.54, 0.58, 'p_legno_chiaro', top='tavole')
    # Fiancate laterali
    m.cbox(-cw / 2 + 0.02, 0.0, 0.04, cd, 0.14, 0.54, 'p_legno_chiaro')
    m.cbox(cw / 2 - 0.02, 0.0, 0.04, cd, 0.14, 0.54, 'p_legno_chiaro')
    # Anta chiusa a sinistra (-X)
    m.box(-cw / 2 + 0.04, 0.14, -cd / 2 - 0.01, -0.15, 0.54, cd / 2 - 0.02, 'p_legno_chiaro', top='p_legno_chiaro')
    m.box(-0.22, 0.32, -cd / 2 - 0.03, -0.18, 0.36, -cd / 2 - 0.01, 'p_nero_caldo')
    # Vano a giorno destro con ripiano orizzontale
    m.cbox(0.35, 0.0, 0.8, cd - 0.04, 0.32, 0.35, 'p_legno_chiaro', top='tavole')
    # Console/decoder sul ripiano
    m.cbox(0.35, -0.05, 0.34, 0.24, 0.35, 0.41, 'p_nero_caldo', top='p_nero_caldo')
    m.cbox(0.48, -0.18, 0.02, 0.02, 0.37, 0.39, 'em_neon_ciano')
    # Pannello posteriore con fori passacavi (+Z)
    m.box(-0.15, 0.14, cd / 2 - 0.03, cw / 2 - 0.04, 0.54, cd / 2 - 0.01, 'p_legno_scuro')
    # DETTAGLIO: buchi passacavi neri vuoti («i buchi dietro per i cavi che non collegherai mai»)
    m.prism(6, 0.045, 0.045, 0.2, 0.27, 'p_nero_caldo', top='p_nero_caldo', cx=0.18, cz=cd / 2 - 0.035)
    m.prism(6, 0.045, 0.045, 0.42, 0.49, 'p_nero_caldo', top='p_nero_caldo', cx=0.48, cz=cd / 2 - 0.035)
    beam(m, (0.18, 0.2, cd / 2 - 0.04), (0.28, 0.14, cd / 2 - 0.1), 0.015, 0.015, 'p_nero_caldo')
    return _obj(m, footprint=[W, D])


def mob_libreria_componibile_svedese():
    """Libreria essenziale bianca tipo Billy/Kallax a 4 vani con libri, scatola e brugola avanzata."""
    m = Mesh('mob_libreria_componibile_svedese')
    W, D = ingombro((1, 1))
    cw, cd = 0.85, 0.38
    # Zoccolino e base
    m.cbox(0.0, 0.0, cw, cd, 0.0, 0.08, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(0.0, 0.0, cw, cd, 0.08, 0.12, 'p_pietra_chiara', top='p_pietra_chiara')
    # Spalle verticali laterali alte 1.85m
    m.cbox(-cw / 2 + 0.02, 0.0, 0.04, cd, 0.12, 1.85, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(cw / 2 - 0.02, 0.0, 0.04, cd, 0.12, 1.85, 'p_pietra_chiara', top='p_pietra_chiara')
    # Cappello superiore
    m.cbox(0.0, 0.0, cw, cd, 1.85, 1.89, 'p_pietra_chiara', top='p_pietra_chiara')
    # Pannello di fondo bianco
    m.box(-cw / 2 + 0.04, 0.12, cd / 2 - 0.02, cw / 2 - 0.04, 1.85, cd / 2, 'p_pietra_chiara')
    # 3 ripiani intermedi equidistanti
    for y in (0.54, 0.98, 1.42):
        m.cbox(0.0, -0.01, cw - 0.08, cd - 0.02, y, y + 0.035, 'p_pietra_chiara', top='p_pietra_chiara')
    # Fila di libri ordinati sul ripiano inferiore
    for i, col in enumerate(('p_rosso', 'p_acqua', 'p_giallo', 'p_arancio', 'p_bosco')):
        m.box(-0.35 + i * 0.08, 0.12, -cd / 2 + 0.05, -0.28 + i * 0.08, 0.44, cd / 2 - 0.05, col, top='pagine')
    # Scatola portaoggetti sul secondo ripiano
    m.cbox(-0.16, -0.02, 0.32, cd - 0.06, 0.575, 0.88, 'tessuto_blu', top='tessuto_blu')
    # Due libri spessi sul terzo ripiano
    m.box(0.12, 1.015, -0.1, 0.28, 1.35, 0.12, 'p_legno_scuro', top='pagine')
    # DETTAGLIO: chiavetta a brugola a L d'acciaio avanzata dal montaggio («Bianca, economica, essenziale»)
    beam(m, (-0.05, 1.02, -0.08), (0.05, 1.02, -0.08), 0.012, 0.012, 'ferro', end='ferro')
    beam(m, (-0.05, 1.02, -0.08), (-0.05, 1.02, -0.02), 0.012, 0.012, 'ferro', end='ferro')
    return _obj(m, footprint=[W, D])


def mob_tappeto_rettangolare_a_tinta_unita():
    """Tappeto rettangolare rosso con frange chiare, angolo piegato e crepa nel pavimento nascosta."""
    m = Mesh('mob_tappeto_rettangolare_a_tinta_unita')
    W, D = ingombro((1, 1))
    rw, rd = 1.68, 1.18
    # Telo principale in tessuto rosso caldo a pelo corto
    m.cbox(0.0, 0.0, rw, rd, 0.0, 0.03, 'tessuto_rosso', top='p_rosso')
    # Bordo rifinito a contrasto
    for sx in (-rw / 2, rw / 2):
        m.cbox(sx, 0.0, 0.04, rd, 0.0, 0.035, 'p_arancio', top='p_arancio')
    for sz in (-rd / 2, rd / 2):
        m.cbox(0.0, sz, rw, 0.04, 0.0, 0.035, 'p_arancio', top='p_arancio')
    # Frange chiare sui lati corti (destra e sinistra)
    for sx in (-1, 1):
        for iz in range(7):
            fz = -rd / 2 + 0.09 + iz * (rd - 0.18) / 6
            m.box(sx * (rw / 2 + 0.02) - 0.04, 0.0, fz - 0.02, sx * (rw / 2 + 0.02) + 0.04, 0.02, fz + 0.02, 'p_sabbia_chiara')
    # DETTAGLIO: angolo anteriore piegato/arricciato che rivela la crepa nel pavimento («Nasconde i difetti del pavimento»)
    # Crepa nera nel pavimento svelata dall'angolo rialzato
    m.box(-rw / 2 + 0.02, 0.001, -rd / 2 + 0.02, -rw / 2 + 0.22, 0.003, -rd / 2 + 0.18, 'p_nero_caldo')
    m.box(-rw / 2 + 0.06, 0.001, -rd / 2 + 0.12, -rw / 2 + 0.26, 0.003, -rd / 2 + 0.24, 'p_pietra_scura')
    # Lembo ripiegato all'insù
    beam(m, (-rw / 2 + 0.25, 0.03, -rd / 2), (-rw / 2, 0.08, -rd / 2 + 0.25), 0.12, 0.025, 'p_arancio', end='p_sabbia_chiara')
    return _obj(m, footprint=[W, D])


def mob_letto_singolo_con_materasso_a_molle():
    """Letto singolo con telaio in legno, testiera a doghe, coperta azzurra e molla visibile sul fianco."""
    m = Mesh('mob_letto_singolo_con_materasso_a_molle')
    W, D = ingombro((1, 1))
    cw, cd = 1.05, 1.82
    # 4 piedini in legno tornito
    for sx in (-cw / 2 + 0.06, cw / 2 - 0.06):
        for sz in (-cd / 2 + 0.06, cd / 2 - 0.06):
            m.prism(6, 0.05, 0.04, 0.0, 0.18, 'p_legno_scuro', top='p_legno_scuro', cx=sx, cz=sz)
    # Longheroni e telaio perimetrale in legno
    m.cbox(0.0, 0.0, cw, cd, 0.16, 0.32, 'p_legno', top='p_legno')
    # Testiera alta contro il muro (+Z)
    m.cbox(0.0, cd / 2 - 0.04, cw, 0.08, 0.16, 0.88, 'p_legno', top='legno_pieno')
    for y in (0.42, 0.62):
        m.cbox(0.0, cd / 2 - 0.04, cw * 0.88, 0.04, y, y + 0.12, 'p_legno_chiaro')
    # Pediera bassa (-Z)
    m.cbox(0.0, -cd / 2 + 0.04, cw, 0.08, 0.16, 0.46, 'p_legno', top='legno_pieno')
    # Materasso a molle spesso bianco
    m.cbox(0.0, -0.02, cw - 0.08, cd - 0.16, 0.32, 0.52, 'p_pietra_chiara', top='p_pietra_chiara')
    # Coperta azzurra rimboccata a metà
    m.cbox(0.0, -0.22, cw - 0.06, cd * 0.58, 0.52, 0.56, 'p_acqua', top='tessuto_blu')
    m.cbox(0.0, 0.08, cw - 0.06, 0.14, 0.54, 0.57, 'p_pietra_chiara')
    # Cuscino morbido appoggiato alla testiera
    m.cbox(0.0, cd / 2 - 0.28, cw * 0.68, 0.34, 0.52, 0.64, 'p_pietra_chiara', top='p_pietra_chiara')
    # DETTAGLIO: molla d'acciaio a spirale che spunta dal bordo del materasso («materasso a molle»)
    for i, my in enumerate((0.36, 0.41, 0.46)):
        m.cbox(cw / 2 - 0.03, -0.3 + (i % 2) * 0.02, 0.03, 0.03, my, my + 0.03, 'ferro', top='ferro')
    return _obj(m, footprint=[W, D])

def mob_lume_a_olio_mezzo_vuoto():
    """Lume a olio d'ottone e vetro mezzo vuoto: serbatoio trasparente con combustibile a metà, ghiera con stoppino e tubo in vetro rastremato."""
    m = Mesh('mob_lume_a_olio_mezzo_vuoto')
    W, D = ingombro((1, 1))
    # Base circolare in metallo sagomata
    m.prism(8, 0.20, 0.17, 0.0, 0.04, 'metallo', top='metallo')
    m.prism(8, 0.17, 0.13, 0.04, 0.08, 'metallo', top='metallo')
    m.prism(8, 0.13, 0.14, 0.08, 0.12, 'metallo', top='metallo')
    # Manico ad ansa in metallo sul lato (+X) per sollevarlo
    beam(m, (0.13, 0.08, 0.0), (0.24, 0.08, 0.0), 0.03, 0.03, 'metallo')
    beam(m, (0.24, 0.08, 0.0), (0.24, 0.24, 0.0), 0.03, 0.03, 'metallo')
    beam(m, (0.24, 0.24, 0.0), (0.14, 0.24, 0.0), 0.03, 0.03, 'metallo', end='metallo')
    # Serbatoio in vetro trasparente
    m.prism(8, 0.18, 0.18, 0.12, 0.26, 'vetro', top='metallo')
    # DETTAGLIO: livello del liquido a metà del serbatoio («mezzo vuoto»)
    m.prism(8, 0.165, 0.165, 0.125, 0.19, 'p_arancio', top='p_arancio')
    # Ghiera porta-stoppino d'ottone con rotellina laterale
    m.prism(8, 0.11, 0.09, 0.26, 0.31, 'oro', top='oro')
    m.box(0.09, 0.27, -0.02, 0.14, 0.29, 0.02, 'oro', top='oro')
    # Stoppino annerito con fiammella
    beam(m, (0.0, 0.31, 0.0), (0.0, 0.34, 0.0), 0.02, 0.02, 'p_nero_caldo')
    m.cone(6, 0.025, 0.33, 0.38, 'em_fuoco')
    # Tubo/camino in vetro trasparente svasato e rastremato in alto
    m.prism(8, 0.09, 0.12, 0.31, 0.40, 'vetro')
    m.prism(8, 0.12, 0.07, 0.40, 0.52, 'vetro')
    m.prism(8, 0.07, 0.08, 0.52, 0.55, 'vetro', top='p_nero_caldo')
    return _obj(m, footprint=[W, D])


def mob_lampada_lava_con_liquido_scolorito():
    """Lampada lava vintage con fusto conico in metallo, ampolla di liquido violaceo scolorito e bolle di cera ambrata a mezz'aria."""
    m = Mesh('mob_lampada_lava_con_liquido_scolorito')
    W, D = ingombro((1, 1))
    # Base svasata in metallo
    m.prism(8, 0.18, 0.13, 0.0, 0.16, 'metallo', top='metallo')
    # Ampolla in vetro con liquido violaceo sbiadito
    m.prism(8, 0.13, 0.15, 0.16, 0.34, 'p_viola', top='p_viola')
    m.prism(8, 0.15, 0.10, 0.34, 0.50, 'p_viola', top='p_viola')
    # Coperchio a cono superiore in metallo
    m.prism(8, 0.105, 0.05, 0.50, 0.60, 'metallo', top='metallo')
    # DETTAGLIO: bolle di cera ambrate e lentissime («le bolle salgono lentissime»)
    m.prism(6, 0.10, 0.08, 0.16, 0.22, 'p_arancio', top='p_arancio', cz=0.01)
    m.prism(6, 0.05, 0.055, 0.28, 0.35, 'em_neon_ambra', top='em_neon_ambra', cx=-0.03, cz=-0.02)
    m.cone(6, 0.045, 0.41, 0.48, 'em_neon_ambra', cx=0.02, cz=0.01)
    # Filo nero con interruttore a navicella sul retro a terra
    beam(m, (0.0, 0.02, 0.12), (0.08, 0.0, 0.24), 0.015, 0.015, 'p_nero_caldo')
    m.box(0.06, 0.0, 0.24, 0.10, 0.025, 0.30, 'p_nero_caldo', top='p_nero_caldo')
    return _obj(m, footprint=[W, D])


def mob_sfera_di_cristallo_con_neve_e_castello():
    """Sfera di cristallo con neve: basamento in legno tornito, cupola di vetro e castello fantasy con torrette coniche blu e neve."""
    m = Mesh('mob_sfera_di_cristallo_con_neve_e_castello')
    W, D = ingombro((1, 1))
    # Piedistallo circolare in legno scuro a gradini
    m.prism(8, 0.23, 0.21, 0.0, 0.05, 'p_legno_scuro', top='p_legno_scuro')
    m.prism(8, 0.21, 0.19, 0.05, 0.10, 'p_legno_scuro', top='p_legno_scuro')
    # Targhetta dorata sul davanti (−Z)
    m.box(-0.06, 0.02, -0.215, 0.06, 0.07, -0.205, 'oro')
    # Strato di neve interna sul fondo
    m.prism(8, 0.17, 0.17, 0.10, 0.13, 'p_pietra_chiara', top='p_pietra_chiara')
    # DETTAGLIO: castello in miniatura al centro con tetti blu e fiocchi di neve
    m.cbox(0.0, 0.0, 0.10, 0.08, 0.13, 0.23, 'p_pietra', top='p_pietra')
    m.box(-0.02, 0.13, -0.045, 0.02, 0.18, -0.038, 'p_nero_caldo')
    # Torretta sinistra
    m.prism(6, 0.03, 0.03, 0.13, 0.25, 'p_pietra', cx=-0.06, cz=0.0)
    m.cone(6, 0.04, 0.25, 0.31, 'p_acqua_profonda', cx=-0.06, cz=0.0)
    # Torretta destra
    m.prism(6, 0.03, 0.03, 0.13, 0.25, 'p_pietra', cx=0.06, cz=0.0)
    m.cone(6, 0.04, 0.25, 0.31, 'p_acqua_profonda', cx=0.06, cz=0.0)
    # Maschio centrale più alto con tetto a cono
    m.prism(6, 0.04, 0.04, 0.23, 0.30, 'p_pietra', cx=0.0, cz=0.0)
    m.cone(6, 0.05, 0.30, 0.37, 'p_acqua_profonda', cx=0.0, cz=0.0)
    # Neve in cima al tetto centrale e fiocchi sparsi
    m.cone(6, 0.025, 0.35, 0.38, 'p_pietra_chiara', cx=0.0, cz=0.0)
    m.cbox(-0.08, -0.06, 0.02, 0.02, 0.19, 0.21, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(0.07, 0.05, 0.02, 0.02, 0.22, 0.24, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(-0.04, 0.07, 0.015, 0.015, 0.28, 0.295, 'p_pietra_chiara', top='p_pietra_chiara')
    # Cupola in vetro sfaccettata
    m.prism(8, 0.18, 0.21, 0.10, 0.22, 'vetro')
    m.prism(8, 0.21, 0.19, 0.22, 0.34, 'vetro')
    m.prism(8, 0.19, 0.11, 0.34, 0.43, 'vetro', top='vetro')
    return _obj(m, footprint=[W, D])


def mob_robot_giocattolo_con_occhi_led():
    """Robot giocattolo di latta vintage azzurra con occhi LED rossi luminosi, chiavetta di carica a farfalla e antenna a molla."""
    m = Mesh('mob_robot_giocattolo_con_occhi_led')
    W, D = ingombro((1, 1))
    # Piedoni di latta azzurra a terra
    m.cbox(-0.09, 0.0, 0.08, 0.14, 0.0, 0.05, 'p_acqua', top='p_acqua')
    m.cbox(0.09, 0.0, 0.08, 0.14, 0.0, 0.05, 'p_acqua', top='p_acqua')
    # Gambe a fisarmonica in metallo
    m.cbox(-0.09, 0.0, 0.05, 0.05, 0.05, 0.14, 'ferro')
    m.cbox(0.09, 0.0, 0.05, 0.05, 0.05, 0.14, 'ferro')
    # Tronco squadrato di latta azzurra con pannello strumenti sul petto (−Z)
    m.cbox(0.0, 0.0, 0.24, 0.16, 0.14, 0.32, 'p_acqua', top='p_acqua')
    m.box(-0.08, 0.18, -0.085, 0.08, 0.28, -0.078, 'p_pietra_chiara')
    m.box(-0.05, 0.22, -0.09, -0.02, 0.25, -0.082, 'p_rosso')
    m.box(0.01, 0.22, -0.09, 0.05, 0.25, -0.082, 'p_giallo')
    # Braccia snodate con pinze
    m.box(-0.16, 0.20, -0.03, -0.12, 0.30, 0.03, 'ferro')
    m.box(-0.17, 0.15, -0.04, -0.12, 0.20, 0.02, 'p_giallo')
    m.box(0.12, 0.20, -0.03, 0.16, 0.30, 0.03, 'ferro')
    m.box(0.12, 0.15, -0.04, 0.17, 0.20, 0.02, 'p_giallo')
    # DETTAGLIO: chiavetta di ricarica dorata a farfalla sul fianco destro (+X)
    m.box(0.12, 0.22, -0.015, 0.18, 0.24, 0.015, 'oro')
    m.box(0.18, 0.19, -0.04, 0.19, 0.27, 0.04, 'oro', top='oro')
    # Collo
    m.prism(6, 0.04, 0.04, 0.32, 0.35, 'ferro')
    # Testa cubica di latta con fessura per la bocca
    m.cbox(0.0, 0.0, 0.18, 0.15, 0.35, 0.48, 'p_acqua', top='p_acqua')
    m.box(-0.05, 0.37, -0.078, 0.05, 0.39, -0.073, 'p_nero_caldo')
    # DETTAGLIO: due occhi LED rossi accesi che ti fissano («occhi LED inquietanti»)
    m.box(-0.07, 0.41, -0.085, -0.02, 0.46, -0.074, 'em_neon_rosso', top='em_neon_rosso')
    m.box(0.02, 0.41, -0.085, 0.07, 0.46, -0.074, 'em_neon_rosso', top='em_neon_rosso')
    # Orecchie a vite e antenna con bulbo giallo
    m.box(-0.11, 0.40, -0.02, -0.09, 0.43, 0.02, 'ferro')
    m.box(0.09, 0.40, -0.02, 0.11, 0.43, 0.02, 'ferro')
    beam(m, (0.0, 0.48, 0.0), (0.0, 0.54, 0.0), 0.015, 0.015, 'ferro')
    m.prism(6, 0.025, 0.025, 0.54, 0.58, 'p_giallo', top='p_giallo')
    return _obj(m, footprint=[W, D])


def mob_lampada_a_forma_di_fungo():
    """Lampada a forma di fungo con cappello a cupola rosso acceso, grandi pois gialli e stelo avorio con interruttore a levetta."""
    m = Mesh('mob_lampada_a_forma_di_fungo')
    W, D = ingombro((1, 1))
    # Base d'appoggio svasata in plastica avorio
    m.prism(8, 0.16, 0.14, 0.0, 0.03, 'p_sabbia_chiara', top='p_sabbia_chiara')
    # Stelo del fungo rastremato al centro e svasato in alto
    m.prism(8, 0.10, 0.075, 0.03, 0.18, 'p_sabbia_chiara')
    m.prism(8, 0.075, 0.13, 0.18, 0.25, 'p_sabbia_chiara')
    # DETTAGLIO: levetta metallica dell'interruttore sul basamento davanti (−Z)
    beam(m, (0.0, 0.03, -0.11), (0.0, 0.06, -0.13), 0.01, 0.01, 'metallo')
    m.prism(6, 0.015, 0.015, 0.06, 0.075, 'p_rosso', top='p_rosso', cz=-0.13)
    # Parte inferiore della cappella: diffusore luminoso («fa luce»)
    m.prism(8, 0.13, 0.28, 0.23, 0.27, 'em_neon_ambra', bottom='em_neon_ambra')
    # Cappella a fungo bombata in rosso acceso
    m.prism(8, 0.28, 0.26, 0.27, 0.34, 'p_rosso')
    m.prism(8, 0.26, 0.18, 0.34, 0.40, 'p_rosso')
    m.prism(8, 0.18, 0.08, 0.40, 0.44, 'p_rosso', top='p_rosso')
    # DETTAGLIO: 5 pois gialli a contrasto sulle falde della cappella
    m.box(-0.035, 0.31, -0.275, 0.035, 0.37, -0.265, 'p_giallo')
    m.box(-0.275, 0.31, -0.035, -0.265, 0.37, 0.035, 'p_giallo')
    m.box(0.265, 0.31, -0.035, 0.275, 0.37, 0.035, 'p_giallo')
    m.box(-0.035, 0.31, 0.265, 0.035, 0.37, 0.275, 'p_giallo')
    m.cbox(0.04, -0.04, 0.07, 0.07, 0.44, 0.445, 'p_giallo', top='p_giallo')
    return _obj(m, footprint=[W, D])


def mob_teschio_con_candela_sciolta():
    """Teschio gotico in pietra chiara da scrivania, con candela in cera sciolta accesa in cima e colature dense lungo le orbite."""
    m = Mesh('mob_teschio_con_candela_sciolta')
    W, D = ingombro((1, 1))
    # Mandibola inferiore d'appoggio
    m.cbox(0.0, -0.01, 0.15, 0.14, 0.0, 0.05, 'p_pietra_chiara', top='p_pietra_chiara')
    # Denti anteriori con fessura orizzontale
    m.box(-0.05, 0.04, -0.09, 0.05, 0.08, -0.075, 'p_pietra_chiara')
    m.box(-0.04, 0.055, -0.092, 0.04, 0.065, -0.088, 'p_nero_caldo')
    # Zigomi e arcata mascellare
    m.cbox(0.0, 0.0, 0.18, 0.16, 0.06, 0.13, 'p_pietra_chiara', top='p_pietra_chiara')
    # Cavità nasale e orbite oculari nere sul davanti (−Z)
    m.box(-0.015, 0.09, -0.088, 0.015, 0.12, -0.082, 'p_nero_caldo')
    m.box(-0.07, 0.13, -0.092, -0.02, 0.19, -0.082, 'p_nero_caldo')
    m.box(0.02, 0.13, -0.092, 0.07, 0.19, -0.082, 'p_nero_caldo')
    # Scatola cranica
    m.cbox(0.0, 0.02, 0.20, 0.20, 0.12, 0.23, 'p_pietra_chiara', top='p_pietra_chiara')
    m.prism(8, 0.10, 0.07, 0.23, 0.27, 'p_pietra_chiara', top='p_pietra_chiara', cz=0.02)
    # Candela piantata sulla sommità del cranio
    m.prism(6, 0.035, 0.03, 0.27, 0.40, 'p_sabbia_chiara', top='p_sabbia_chiara', cz=0.02)
    beam(m, (0.0, 0.40, 0.02), (0.0, 0.43, 0.02), 0.01, 0.01, 'p_nero_caldo')
    m.cone(6, 0.02, 0.42, 0.48, 'em_fuoco', cx=0.0, cz=0.02)
    # DETTAGLIO: colature perenni di cera sciolta che scendono dal cranio («la cera cola perennemente»)
    m.box(-0.02, 0.19, -0.086, 0.02, 0.27, -0.078, 'p_sabbia_chiara')
    m.box(-0.09, 0.08, -0.02, -0.078, 0.25, 0.02, 'p_sabbia_chiara')
    m.cbox(-0.09, 0.0, 0.04, 0.04, 0.0, 0.03, 'p_sabbia_chiara', top='p_sabbia_chiara')
    m.box(0.078, 0.10, -0.01, 0.088, 0.24, 0.03, 'p_sabbia_chiara')
    return _obj(m, footprint=[W, D])


def mob_radiosveglia_rotante():
    """Radiosveglia da comodino con display LED frontale, tasto snooze e proiettore laser rotante inclinato verso l'alto."""
    m = Mesh('mob_radiosveglia_rotante')
    W, D = ingombro((1, 1))
    # Scocca principale nera compatta
    m.cbox(0.0, 0.0, 0.30, 0.20, 0.0, 0.12, 'p_nero_caldo', top='p_nero_caldo')
    # Gommini d'appoggio ai quattro angoli
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cbox(sx * 0.12, sz * 0.07, 0.03, 0.03, 0.0, 0.01, 'p_pietra_scura')
    # Display digitale sul frontale (−Z) con cornice nera e numeri rossi
    m.box(-0.12, 0.025, -0.104, 0.04, 0.095, -0.10, 'p_nero_caldo')
    m.box(-0.10, 0.04, -0.106, -0.07, 0.08, -0.103, 'em_neon_rosso')
    m.box(-0.05, 0.04, -0.106, -0.02, 0.08, -0.103, 'em_neon_rosso')
    m.box(-0.01, 0.05, -0.106, -0.005, 0.07, -0.103, 'em_neon_rosso')
    m.box(0.005, 0.04, -0.106, 0.035, 0.08, -0.103, 'em_neon_rosso')
    # Tasto grande SNOOZE sulla plancia superiore
    m.cbox(-0.04, -0.03, 0.10, 0.04, 0.12, 0.135, 'p_pietra_scura', top='p_pietra_scura')
    # Fessure altoparlante radio sul retro della plancia
    for sz in (0.03, 0.06):
        m.cbox(-0.04, sz, 0.08, 0.015, 0.12, 0.125, 'p_pietra_scura')
    # DETTAGLIO: torretta cilindrica del proiettore rotante orientata verso il soffitto («proietta l'ora sul soffitto»)
    m.cbox(0.09, 0.0, 0.07, 0.08, 0.12, 0.16, 'p_nero_caldo')
    m.prism(8, 0.04, 0.04, 0.15, 0.25, 'p_pietra_scura', top='p_pietra_scura', cx=0.09, cz=0.0)
    m.prism(8, 0.032, 0.032, 0.25, 0.27, 'em_neon_rosso', top='em_neon_rosso', cx=0.09, cz=0.0)
    return _obj(m, footprint=[W, D])


def mob_ventilatore_usb_a_forma_di_cactus():
    """Ventilatore USB a forma di cactus: vasetto di terracotta, corpo spinoso verde con pale gialle incastonate al centro e cavo USB."""
    m = Mesh('mob_ventilatore_usb_a_forma_di_cactus')
    W, D = ingombro((1, 1))
    # Vasetto di terracotta svasato
    m.prism(8, 0.13, 0.17, 0.0, 0.14, 'p_arancio', bottom='p_arancio')
    m.prism(8, 0.18, 0.18, 0.14, 0.17, 'p_arancio', top='p_legno_scuro')
    # Fusto del cactus verde a prismi
    m.prism(8, 0.07, 0.07, 0.17, 0.38, 'p_erba', top='p_erba')
    # Braccio sinistro del cactus (−X)
    beam(m, (-0.05, 0.24, 0.0), (-0.13, 0.24, 0.0), 0.04, 0.04, 'p_erba')
    beam(m, (-0.13, 0.24, 0.0), (-0.13, 0.33, 0.0), 0.04, 0.04, 'p_erba', end='p_erba')
    # Braccio destro del cactus (+X)
    beam(m, (0.05, 0.28, 0.0), (0.12, 0.28, 0.0), 0.04, 0.04, 'p_erba')
    beam(m, (0.12, 0.28, 0.0), (0.12, 0.35, 0.0), 0.04, 0.04, 'p_erba', end='p_erba')
    # Fiorellino decorativo rosso e giallo in cima
    m.prism(6, 0.025, 0.035, 0.38, 0.41, 'p_rosso', top='p_giallo')
    # DETTAGLIO: gabbietta rotonda con le pale del ventilatore sul davanti (−Z)
    m.prism(8, 0.075, 0.075, 0.22, 0.32, 'p_pietra_chiara', cz=-0.04)
    m.prism(6, 0.02, 0.02, 0.25, 0.29, 'p_nero_caldo', top='p_nero_caldo', cz=-0.045)
    # Pale della ventola a stella gialla
    m.box(-0.05, 0.26, -0.05, -0.015, 0.28, -0.042, 'p_giallo')
    m.box(0.015, 0.26, -0.05, 0.05, 0.28, -0.042, 'p_giallo')
    m.box(-0.01, 0.285, -0.05, 0.01, 0.315, -0.042, 'p_giallo')
    m.box(-0.01, 0.225, -0.05, 0.01, 0.255, -0.042, 'p_giallo')
    # DETTAGLIO: cavo USB che esce dal retro del vasetto con spinotto a terra
    beam(m, (0.0, 0.08, 0.14), (0.06, 0.0, 0.22), 0.012, 0.012, 'p_nero_caldo')
    m.box(0.04, 0.0, 0.22, 0.08, 0.018, 0.27, 'metallo', top='metallo')
    return _obj(m, footprint=[W, D])


def mob_barattolo_di_lucciole_finte():
    """Barattolo di vetro con coperchio metallico forato, cordino di iuta e lucine LED che brillano come lucciole all'interno."""
    m = Mesh('mob_barattolo_di_lucciole_finte')
    W, D = ingombro((1, 1))
    # Fondo e pareti cilindriche del barattolo in vetro
    m.prism(8, 0.15, 0.17, 0.0, 0.03, 'vetro', bottom='vetro')
    m.prism(8, 0.17, 0.17, 0.03, 0.24, 'vetro')
    m.prism(8, 0.17, 0.12, 0.24, 0.28, 'vetro')
    # Coperchio a vite in latta zigrinata con fori di sfiato
    m.prism(8, 0.13, 0.13, 0.28, 0.32, 'p_pietra_scura', top='p_pietra_scura')
    # DETTAGLIO: cordino di iuta attorno al collo con cartellino in carta
    m.prism(8, 0.135, 0.135, 0.26, 0.28, 'corda')
    m.box(0.09, 0.17, -0.08, 0.14, 0.25, -0.075, 'carta')
    # DETTAGLIO: filo di rame con 5 LED luminosi sospesi all'interno («non sono lucciole, sono LED»)
    beam(m, (0.0, 0.03, 0.0), (-0.05, 0.10, 0.03), 0.008, 0.008, 'oro')
    beam(m, (-0.05, 0.10, 0.03), (0.04, 0.15, -0.02), 0.008, 0.008, 'oro')
    beam(m, (0.04, 0.15, -0.02), (-0.02, 0.21, 0.02), 0.008, 0.008, 'oro')
    # Micro cubetti LED emissivi ambra e verde lime
    m.cbox(-0.05, 0.03, 0.025, 0.025, 0.09, 0.115, 'em_neon_ambra', top='em_neon_ambra')
    m.cbox(0.04, -0.02, 0.025, 0.025, 0.14, 0.165, 'em_neon_verde', top='em_neon_verde')
    m.cbox(-0.02, 0.02, 0.025, 0.025, 0.20, 0.225, 'em_neon_ambra', top='em_neon_ambra')
    m.cbox(0.05, 0.04, 0.025, 0.025, 0.06, 0.085, 'em_neon_ambra', top='em_neon_ambra')
    m.cbox(-0.04, -0.04, 0.025, 0.025, 0.16, 0.185, 'em_neon_verde', top='em_neon_verde')
    return _obj(m, footprint=[W, D])


def mob_orologio_da_tavolo_a_forma_di_gatto():
    """Orologio stile Kit-Cat Klock nero con papillon, quadrante sul pancino, occhi gialli mobili e coda a pendolo laterale."""
    m = Mesh('mob_orologio_da_tavolo_a_forma_di_gatto')
    W, D = ingombro((1, 1))
    # Piedistallo ovale nero d'appoggio a terra
    m.prism(8, 0.15, 0.13, 0.0, 0.03, 'p_nero_caldo', top='p_nero_caldo')
    # Corpo affusolato nero del gatto
    m.cbox(0.0, 0.0, 0.18, 0.14, 0.03, 0.28, 'p_nero_caldo', top='p_nero_caldo')
    # Quadrante orologio rotondo sul pancino (−Z) con lancette nere
    m.prism(8, 0.07, 0.07, 0.09, 0.21, 'p_pietra_chiara', top='p_pietra_chiara', cz=-0.07)
    m.box(-0.004, 0.15, -0.078, 0.025, 0.16, -0.072, 'p_nero_caldo')
    m.box(-0.004, 0.15, -0.078, 0.004, 0.195, -0.072, 'p_nero_caldo')
    # Papillon bianco ed elegante con nodo rosso sotto al mento
    m.box(-0.06, 0.25, -0.08, -0.01, 0.29, -0.068, 'p_pietra_chiara')
    m.box(0.01, 0.25, -0.08, 0.06, 0.29, -0.068, 'p_pietra_chiara')
    m.box(-0.015, 0.26, -0.085, 0.015, 0.28, -0.068, 'p_rosso')
    # Testa rotonda con orecchie a punta
    m.prism(8, 0.11, 0.11, 0.29, 0.44, 'p_nero_caldo', top='p_nero_caldo')
    m.cone(4, 0.035, 0.44, 0.50, 'p_nero_caldo', cx=-0.07, cz=0.0)
    m.cone(4, 0.035, 0.44, 0.50, 'p_nero_caldo', cx=0.07, cz=0.0)
    # Nasino e baffi
    m.box(-0.012, 0.35, -0.115, 0.012, 0.365, -0.108, 'p_rosso')
    # DETTAGLIO: grandi occhi gialli che ti seguono («gli occhi ti seguono»)
    m.box(-0.07, 0.38, -0.112, -0.02, 0.42, -0.108, 'p_giallo')
    m.box(-0.05, 0.39, -0.115, -0.03, 0.41, -0.111, 'p_nero_caldo')
    m.box(0.02, 0.38, -0.112, 0.07, 0.42, -0.108, 'p_giallo')
    m.box(0.04, 0.39, -0.115, 0.06, 0.41, -0.111, 'p_nero_caldo')
    # DETTAGLIO: coda a pendolo inclinata di lato come se oscillasse («la coda si muove a ogni secondo»)
    beam(m, (0.0, 0.06, 0.06), (-0.10, 0.01, 0.06), 0.025, 0.025, 'p_nero_caldo')
    beam(m, (-0.10, 0.01, 0.06), (-0.14, 0.08, 0.06), 0.025, 0.025, 'p_nero_caldo', end='p_nero_caldo')


def mob_cassa_di_legno_della_frutta_rovesciata():
    """Cassa di legno della frutta rovesciata usata come tavolino, con una candela accesa e cera colata sopra."""
    m = Mesh('mob_cassa_di_legno_della_frutta_rovesciata')
    W, D = ingombro((1, 1))
    cw, cd = 0.92, 0.64
    # 4 montanti angolari squadrati in legno scuro
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.box(sx * (cw / 2 - 0.04) - 0.035, 0.0, sz * (cd / 2 - 0.04) - 0.035,
                  sx * (cw / 2 - 0.04) + 0.035, 0.44, sz * (cd / 2 - 0.04) + 0.035,
                  'p_legno_scuro', skip=('bottom',))
    # Doghe laterali orizzontali (due fasce per lato)
    for y0, y1 in ((0.05, 0.19), (0.24, 0.38)):
        m.box(-cw / 2, y0, -cd / 2, cw / 2, y1, -cd / 2 + 0.025, 'tavole', skip=('bottom', 'top'))
        m.box(-cw / 2, y0, cd / 2 - 0.025, cw / 2, y1, cd / 2, 'tavole', skip=('bottom', 'top'))
        m.box(-cw / 2, y0, -cd / 2, -cw / 2 + 0.025, y1, cd / 2, 'tavole', skip=('bottom', 'top'))
        m.box(cw / 2 - 0.025, y0, -cd / 2, cw / 2, y1, cd / 2, 'tavole', skip=('bottom', 'top'))
    # Piano superiore: fondo della cassa rovesciata (4 doghe con fessura)
    for i in range(4):
        z0 = -cd / 2 + 0.02 + i * 0.15
        m.box(-cw / 2, 0.40, z0, cw / 2, 0.44, z0 + 0.13, 'tavole', top='tavole', skip=('bottom',))
    # Due listelli trasversali di rinforzo del fondo
    for sx in (-cw / 2 + 0.1, cw / 2 - 0.14):
        m.box(sx, 0.44, -cd / 2 + 0.02, sx + 0.04, 0.46, cd / 2 - 0.02, 'p_legno_scuro', top='p_legno_scuro')
    # DETTAGLIO: candela d'arredo accesa («se ci metti sopra una candela diventa arredo di design»)
    cx, cz = 0.16, 0.02
    m.prism(6, 0.045, 0.045, 0.44, 0.62, 'p_pietra_chiara', top='p_pietra_chiara', cx=cx, cz=cz)
    beam(m, (cx, 0.62, cz), (cx, 0.65, cz), 0.012, 0.012, 'p_nero_caldo', end='p_nero_caldo')
    m.cone(6, 0.03, 0.65, 0.73, 'p_giallo', cx=cx, cz=cz)
    # Cera colata sul bordo del listello
    m.box(cx + 0.03, 0.44, cz - 0.02, cx + 0.07, 0.47, cz + 0.03, 'p_pietra_chiara')
    return _obj(m, footprint=[W, D])


def mob_banco_da_macellaio_in_marmo():
    """Pesante banco da lavoro in legno massiccio con piano in marmo spesso, tagliere e mannaia conficcata."""
    m = Mesh('mob_banco_da_macellaio_in_marmo')
    W, D = ingombro((1, 1))
    cw, cd = 1.32, 0.84
    # 4 gambe massicce in legno scuro
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cbox(sx * (cw / 2 - 0.12), sz * (cd / 2 - 0.12), 0.14, 0.14, 0.0, 0.72, 'p_legno_scuro', top='p_legno_scuro')
    # Fasce di collegamento superiori in legno
    m.box(-cw / 2 + 0.08, 0.60, -cd / 2 + 0.08, cw / 2 - 0.08, 0.72, -cd / 2 + 0.14, 'p_legno_scuro', skip=('bottom',))
    m.box(-cw / 2 + 0.08, 0.60, cd / 2 - 0.14, cw / 2 - 0.08, 0.72, cd / 2 - 0.08, 'p_legno_scuro', skip=('bottom',))
    m.box(-cw / 2 + 0.08, 0.60, -cd / 2 + 0.08, -cw / 2 + 0.14, 0.72, cd / 2 - 0.08, 'p_legno_scuro', skip=('bottom',))
    m.box(cw / 2 - 0.14, 0.60, -cd / 2 + 0.08, cw / 2 - 0.08, 0.72, cd / 2 - 0.08, 'p_legno_scuro', skip=('bottom',))
    # Traversi inferiori di rinforzo e ripiano a doghe
    for y, z in ((0.16, -cd / 2 + 0.12), (0.16, cd / 2 - 0.12)):
        m.box(-cw / 2 + 0.08, y, z - 0.04, cw / 2 - 0.08, y + 0.06, z + 0.04, 'p_legno_scuro')
    for i in range(5):
        x = -cw / 2 + 0.22 + i * 0.20
        m.box(x, 0.20, -cd / 2 + 0.08, x + 0.10, 0.23, cd / 2 - 0.08, 'tavole', top='tavole')
    # Piano spesso in marmo bianco con smusso visivo
    m.cbox(0.0, 0.0, cw + 0.08, cd + 0.08, 0.72, 0.88, 'p_pietra_chiara', top='marmo_muro')
    # DETTAGLIO: tagliere spesso in legno con mannaia da macellaio conficcata
    m.cbox(-0.24, -0.04, 0.44, 0.34, 0.88, 0.94, 'p_legno', top='taglio')
    # Lama della mannaia in metallo conficcata verticalmente
    m.box(-0.26, 0.93, -0.08, -0.22, 1.07, 0.06, 'metallo', top='metallo')
    # Manico in legno della mannaia
    beam(m, (-0.24, 1.05, 0.05), (-0.24, 1.15, 0.17), 0.035, 0.035, 'p_legno_scuro', end='p_legno_scuro')
    return _obj(m, footprint=[W, D])


def mob_tavolo_da_ping_pong_piegato():
    """Tavolo da ping pong piegato in verticale con carrello a ruote, rete centrale, racchetta rossa e vestiti appesi."""
    m = Mesh('mob_tavolo_da_ping_pong_piegato')
    W, D = ingombro((1, 1))
    # Carrello inferiore nero su 4 rotelle
    m.cbox(0.0, 0.0, 0.84, 0.48, 0.06, 0.16, 'p_nero_caldo', top='p_nero_caldo')
    for sx in (-0.36, 0.36):
        for sz in (-0.20, 0.20):
            m.prism(6, 0.04, 0.04, 0.0, 0.06, 'ferro', top='p_nero_caldo', cx=sx, cz=sz)
    # Montanti a V del telaio
    for sx in (-0.36, 0.36):
        beam(m, (sx, 0.16, 0.0), (sx, 0.52, -0.16), 0.05, 0.05, 'ferro', end='ferro')
        beam(m, (sx, 0.16, 0.0), (sx, 0.52, 0.16), 0.05, 0.05, 'ferro', end='ferro')
    # I due semipiani verdi verticali ripiegati a libro (leggermente inclinati)
    w_t = 1.48
    # Semipiano anteriore (-Z)
    m.cbox(0.0, -0.16, w_t, 0.06, 0.45, 1.62, 'p_bosco', top='p_bosco')
    # Bordo e linea bianca perimetrale del tavolo
    m.box(-w_t / 2, 1.60, -0.191, w_t / 2, 1.62, -0.189, 'p_pietra_chiara')
    m.box(-w_t / 2, 0.45, -0.191, w_t / 2, 0.47, -0.189, 'p_pietra_chiara')
    m.box(-0.015, 0.45, -0.191, 0.015, 1.62, -0.189, 'p_pietra_chiara')
    # Semipiano posteriore (+Z)
    m.cbox(0.0, 0.16, w_t, 0.06, 0.45, 1.62, 'p_bosco', top='p_bosco')
    # Rete piegata e stipata nel mezzo tra i due piani
    m.box(-w_t / 2 - 0.06, 0.48, -0.03, w_t / 2 + 0.06, 0.66, 0.03, 'rete', skip=('bottom', 'top'))
    # DETTAGLIO 1: racchetta rossa da ping pong appoggiata sul montante
    rx, rz = 0.42, -0.22
    m.prism(8, 0.08, 0.08, 0.52, 0.54, 'p_rosso', top='p_rosso', cx=rx, cz=rz)
    beam(m, (rx, 0.53, rz), (rx, 0.53, rz - 0.11), 0.024, 0.02, 'p_legno', end='p_legno')
    # DETTAGLIO 2: pila di vestiti colorati appoggiati a cavallo del piano («deposito per vestiti»)
    m.cbox(-0.35, -0.16, 0.38, 0.16, 1.58, 1.66, 'tessuto_rosso', top='tessuto_rosso')
    m.cbox(-0.32, -0.16, 0.32, 0.18, 1.66, 1.72, 'tessuto_blu', top='tessuto_blu')
    return _obj(m, footprint=[W, D])


def mob_valigia_rigida_vintage():
    """Valigia rigida vintage marrone aperta su piedini come tavolino basso, con angolari dorati e ricordi all'interno."""
    m = Mesh('mob_valigia_rigida_vintage')
    W, D = ingombro((1, 1))
    vw, vd = 1.05, 0.68
    # 4 piedini conici torniti stile modernariato
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.prism(6, 0.015, 0.035, 0.0, 0.16, 'oro', top='oro', cx=sx * (vw / 2 - 0.10), cz=sz * (vd / 2 - 0.10))
    # Guscio inferiore (base del tavolino) in cuoio/legno
    m.cbox(0.0, 0.0, vw, vd, 0.16, 0.36, 'cuoio', top='p_sabbia_chiara', skip=('bottom',))
    m.cbox(0.0, 0.0, vw + 0.02, vd + 0.02, 0.14, 0.17, 'p_legno_scuro', skip=('bottom',))
    # Angolari protettivi dorati sui 4 angoli inferiori
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cbox(sx * (vw / 2), sz * (vd / 2), 0.08, 0.08, 0.15, 0.24, 'oro', top='oro')
    # Coperchio aperto sollevato verso il retro (+Z)
    m.box(-vw / 2, 0.36, vd / 2 - 0.08, vw / 2, 0.88, vd / 2, 'cuoio', top='p_sabbia_chiara')
    for sx in (-vw / 2 + 0.04, vw / 2 - 0.04):
        m.cbox(sx, vd / 2 - 0.04, 0.06, 0.06, 0.82, 0.88, 'oro', top='oro')
    # Cerniere e tiranti di arresto in metallo
    beam(m, (-vw / 2 + 0.05, 0.35, 0.0), (-vw / 2 + 0.05, 0.65, vd / 2 - 0.06), 0.015, 0.015, 'oro')
    beam(m, (vw / 2 - 0.05, 0.35, 0.0), (vw / 2 - 0.05, 0.65, vd / 2 - 0.06), 0.015, 0.015, 'oro')
    # Maniglia centrale frontale sul davanti (-Z)
    m.box(-0.10, 0.22, -vd / 2 - 0.04, 0.10, 0.26, -vd / 2, 'p_legno_scuro')
    # DETTAGLIO: vecchie lettere e una cartolina ingiallita dentro la valigia («contiene ricordi»)
    m.cbox(-0.20, -0.05, 0.30, 0.22, 0.36, 0.368, 'carta', top='carta')
    m.cbox(0.18, 0.08, 0.24, 0.18, 0.36, 0.37, 'p_sabbia_chiara', top='p_sabbia_chiara')
    m.prism(6, 0.04, 0.04, 0.36, 0.38, 'oro', top='oro', cx=0.12, cz=-0.14)
    return _obj(m, footprint=[W, D])


def mob_pila_di_libri_enormi():
    """Pila elicoidale di enormi tomi rilegati in pelle colorata, con pagine dorate e un segnalibro rosso che pende."""
    m = Mesh('mob_pila_di_libri_enormi')
    W, D = ingombro((1, 1))
    books = [
        (0.00, 0.00, 0.98, 0.72, 'cuoio', 0.00, 0.14),
        (0.02, -0.02, 0.94, 0.70, 'rosso_lacca', 0.14, 0.28),
        (-0.02, 0.03, 0.90, 0.68, 'p_bosco', 0.28, 0.42),
        (0.03, 0.01, 0.88, 0.66, 'tessuto_blu', 0.42, 0.56),
        (0.00, 0.00, 0.84, 0.64, 'p_legno_scuro', 0.56, 0.70),
    ]
    for cx, cz, w, d, cover, y0, y1 in books:
        # Piatto inferiore della copertina
        m.cbox(cx, cz, w, d, y0, y0 + 0.02, cover, top=cover)
        # Piatto superiore della copertina
        m.cbox(cx, cz, w, d, y1 - 0.02, y1, cover, top=cover)
        # Dorso del tomo sul retro (+Z)
        m.box(cx - w / 2, y0, cz + d / 2 - 0.04, cx + w / 2, y1, cz + d / 2, cover, top=cover)
        # Blocco delle pagine incavato visibile davanti (-Z) e sui fianchi
        m.cbox(cx, cz - 0.02, w - 0.04, d - 0.06, y0 + 0.02, y1 - 0.02, 'pagine', top='pagine')
        # Nervature dorate sul dorso
        m.box(cx - w / 2 + 0.04, y0 + 0.04, cz + d / 2 - 0.01, cx + w / 2 - 0.04, y0 + 0.06, cz + d / 2 + 0.01, 'oro')
        m.box(cx - w / 2 + 0.04, y1 - 0.06, cz + d / 2 - 0.01, cx + w / 2 - 0.04, y1 - 0.04, cz + d / 2 + 0.01, 'oro')
    # DETTAGLIO 1: lungo nastro segnalibro rosso che pende lungo il fianco dei libri
    beam(m, (0.42, 0.56, -0.05), (0.47, 0.32, -0.08), 0.045, 0.012, 'p_rosso', end='p_rosso')
    beam(m, (0.47, 0.32, -0.08), (0.45, 0.16, -0.06), 0.045, 0.012, 'p_rosso', end='p_rosso')
    # DETTAGLIO 2: occhiali da lettura posati sul libro in cima
    m.prism(6, 0.035, 0.035, 0.70, 0.715, 'oro', top='vetro', cx=-0.08, cz=0.0)
    m.prism(6, 0.035, 0.035, 0.70, 0.715, 'oro', top='vetro', cx=0.08, cz=0.0)
    beam(m, (-0.05, 0.71, 0.0), (0.05, 0.71, 0.0), 0.01, 0.01, 'oro')
    return _obj(m, footprint=[W, D])


def mob_banco_da_scuola_con_sedile_attaccato():
    """Banco scolastico monoposto con telaio verde militare, seduta e schienale in legno, graffiti incisi e quaderno aperto."""
    m = Mesh('mob_banco_da_scuola_con_sedile_attaccato')
    W, D = ingombro((1, 1))
    col_tubo = 'p_bosco'
    # Slitte metalliche tubolari a terra collegate tra banco e sedia
    for sx in (-0.36, 0.36):
        beam(m, (sx, 0.03, -0.55), (sx, 0.03, 0.45), 0.05, 0.05, col_tubo, end=col_tubo)
        # Gamba montante banco (-Z)
        beam(m, (sx, 0.03, -0.40), (sx, 0.65, -0.40), 0.045, 0.045, col_tubo, end=col_tubo)
        # Gamba montante sedia (+Z)
        beam(m, (sx, 0.03, 0.28), (sx, 0.42, 0.28), 0.045, 0.045, col_tubo, end=col_tubo)
        # Montante schienale
        beam(m, (sx, 0.42, 0.36), (sx, 0.76, 0.40), 0.04, 0.04, col_tubo, end=col_tubo)
    # Traversini di collegamento orizzontale
    beam(m, (-0.36, 0.03, 0.0), (0.36, 0.03, 0.0), 0.04, 0.04, col_tubo, end=col_tubo)
    beam(m, (-0.36, 0.58, -0.40), (0.36, 0.58, -0.40), 0.04, 0.04, col_tubo, end=col_tubo)
    # Vano portalibri sotto il banco in lamiera verde
    m.cbox(0.0, -0.38, 0.82, 0.44, 0.54, 0.58, col_tubo, top=col_tubo)
    m.box(-0.41, 0.54, -0.18, 0.41, 0.68, -0.16, col_tubo)
    # Piano del banco in legno chiaro/formica
    m.cbox(0.0, -0.38, 0.88, 0.52, 0.68, 0.72, 'p_legno_chiaro', top='p_legno_chiaro')
    # Seduta della sedia in legno
    m.cbox(0.0, 0.25, 0.56, 0.34, 0.42, 0.46, 'p_legno', top='p_legno')
    # Schienale curvato
    m.cbox(0.0, 0.40, 0.56, 0.04, 0.66, 0.78, 'p_legno', top='p_legno')
    # DETTAGLIO 1: graffiti colorati e incisioni sulla superficie del banco («pieno di graffiti»)
    m.box(-0.28, 0.721, -0.45, -0.16, 0.723, -0.38, 'p_rosso')
    m.box(-0.14, 0.721, -0.32, -0.04, 0.723, -0.24, 'p_giallo')
    m.box(0.18, 0.721, -0.50, 0.30, 0.723, -0.44, 'p_nero_caldo')
    # DETTAGLIO 2: quaderno aperto con righe e matita («ci appoggi il quaderno»)
    m.cbox(0.06, -0.36, 0.24, 0.20, 0.721, 0.726, 'carta', top='carta')
    beam(m, (0.22, 0.726, -0.42), (0.22, 0.726, -0.28), 0.015, 0.015, 'p_giallo', end='p_nero_caldo')
    return _obj(m, footprint=[W, D])


def mob_tavolino_da_campeggio_richiudibile():
    """Tavolino pieghevole in alluminio con gambe a forbice incrociate, maniglia da trasporto e spessore sotto un piede."""
    m = Mesh('mob_tavolino_da_campeggio_richiudibile')
    W, D = ingombro((1, 1))
    tw, td = 1.08, 0.76
    # Piano pieghevole in alluminio/resina azzurra con bordo profilato
    m.cbox(0.0, 0.0, tw, td, 0.60, 0.64, 'metallo', top='p_acqua')
    # Giuntura centrale di piegatura
    m.box(-tw / 2, 0.638, -0.01, tw / 2, 0.642, 0.01, 'p_nero_caldo')
    # Cornice perimetrale in alluminio
    for sx in (-1, 1):
        m.box(sx * (tw / 2 - 0.02), 0.57, -td / 2, sx * (tw / 2), 0.64, td / 2, 'metallo')
    for sz in (-1, 1):
        m.box(-tw / 2, 0.57, sz * (td / 2 - 0.02), tw / 2, 0.64, sz * (td / 2), 'metallo')
    # Gambe a forbice (X) in tubolare metallico su entrambi i lati
    for sx in (-tw / 2 + 0.08, tw / 2 - 0.08):
        beam(m, (sx, 0.0, -0.28), (sx, 0.60, 0.28), 0.035, 0.035, 'metallo', end='metallo')
        beam(m, (sx, 0.0, 0.28), (sx, 0.60, -0.28), 0.035, 0.035, 'metallo', end='metallo')
        # Perno centrale dell'incrocio
        m.cbox(sx, 0.0, 0.05, 0.05, 0.28, 0.32, 'ferro', top='ferro')
    # Tiranti orizzontali di stabilizzazione tra i piedi
    beam(m, (-tw / 2 + 0.08, 0.02, -0.28), (tw / 2 - 0.08, 0.02, -0.28), 0.03, 0.03, 'metallo', end='metallo')
    beam(m, (-tw / 2 + 0.08, 0.02, 0.28), (tw / 2 - 0.08, 0.02, 0.28), 0.03, 0.03, 'metallo', end='metallo')
    # DETTAGLIO 1: maniglia pieghevole in plastica nera sul fianco («l’unico che puoi spostare in giro»)
    m.box(-0.10, 0.58, -td / 2 - 0.045, 0.10, 0.62, -td / 2, 'p_nero_caldo')
    # DETTAGLIO 2: sassolino/spessore sotto il piede anteriore sinistro («traballa su ogni superficie»)
    m.prism(5, 0.04, 0.025, 0.0, 0.035, 'p_pietra', top='p_pietra_chiara', cx=-tw / 2 + 0.08, cz=-0.28)
    return _obj(m, footprint=[W, D])


def mob_banco_da_lavoro_con_morsa():
    """Robusto banco da lavoro da officina con morsa d'acciaio sul bordo, ripiano inferiore e martello posato sul piano."""
    m = Mesh('mob_banco_da_lavoro_con_morsa')
    W, D = ingombro((1, 1))
    bw, bd = 1.36, 0.82
    # 4 gambe robuste e traversi in legno scuro
    for sx in (-1, 1):
        for sz in (-1, 1):
            m.cbox(sx * (bw / 2 - 0.12), sz * (bd / 2 - 0.12), 0.13, 0.13, 0.0, 0.74, 'p_legno_scuro', top='p_legno_scuro')
    # Telaio superiore in legno
    m.box(-bw / 2 + 0.08, 0.62, -bd / 2 + 0.08, bw / 2 - 0.08, 0.74, -bd / 2 + 0.14, 'p_legno_scuro', skip=('bottom',))
    m.box(-bw / 2 + 0.08, 0.62, bd / 2 - 0.14, bw / 2 - 0.08, 0.74, bd / 2 - 0.08, 'p_legno_scuro', skip=('bottom',))
    m.box(-bw / 2 + 0.08, 0.62, -bd / 2 + 0.08, -bw / 2 + 0.14, 0.74, bd / 2 - 0.08, 'p_legno_scuro', skip=('bottom',))
    m.box(bw / 2 - 0.14, 0.62, -bd / 2 + 0.08, bw / 2 - 0.08, 0.74, bd / 2 - 0.08, 'p_legno_scuro', skip=('bottom',))
    # Ripiano inferiore a doghe
    m.cbox(0.0, 0.0, bw - 0.16, bd - 0.16, 0.16, 0.20, 'tavole', top='tavole')
    # Piano di lavoro massiccio in legno scuro e tavole
    m.cbox(0.0, 0.0, bw + 0.06, bd + 0.06, 0.74, 0.86, 'p_legno', top='tavole')
    # DETTAGLIO 1: morsa da banco in ghisa con vite di serraggio sul bordo anteriore sinistro
    mx, mz = -bw / 2 + 0.10, -bd / 2 - 0.04
    m.cbox(mx, mz, 0.16, 0.18, 0.82, 0.98, 'ferro', top='ferro')
    # Ganasce della morsa
    m.cbox(mx, mz - 0.05, 0.18, 0.04, 0.90, 0.99, 'metallo', top='metallo')
    # Vite e leva a T della morsa
    beam(m, (mx, 0.88, mz - 0.04), (mx, 0.88, mz - 0.15), 0.03, 0.03, 'metallo', end='metallo')
    beam(m, (mx - 0.08, 0.88, mz - 0.15), (mx + 0.08, 0.88, mz - 0.15), 0.018, 0.018, 'ferro', end='ferro')
    # DETTAGLIO 2: martello da carpentiere appoggiato («ci appoggi sopra il martello e poi non lo trovi più»)
    beam(m, (0.12, 0.88, -0.16), (0.12, 0.88, 0.14), 0.03, 0.025, 'p_legno', end='p_legno')
    m.cbox(0.12, -0.17, 0.14, 0.06, 0.865, 0.92, 'ferro', top='ferro')
    return _obj(m, footprint=[W, D])


def mob_tavolo_da_dj_con_lucine_rotte():
    """Consolle da DJ nera con due piatti rotanti, mixer centrale, fader luminosi e una bibita appoggiata."""
    m = Mesh('mob_tavolo_da_dj_con_lucine_rotte')
    W, D = ingombro((1, 1))
    dw, dd = 1.34, 0.74
    # Basamento e pannello frontale nero della postazione
    m.cbox(0.0, 0.0, dw - 0.10, dd - 0.12, 0.0, 0.06, 'p_nero_caldo', top='p_nero_caldo')
    m.cbox(0.0, 0.0, dw, dd, 0.06, 0.86, 'p_nero_caldo', top='p_nero_caldo')
    # Piano consolle sagomato
    m.cbox(0.0, 0.0, dw + 0.06, dd + 0.06, 0.86, 0.90, 'p_roccia', top='p_nero_caldo')
    # Due piatti per vinili (giradischi a sinistra e destra)
    for px, lbl_col in ((-0.38, 'p_rosso'), (0.38, 'p_ciano_neon')):
        # Piastra quadrata del giradischi
        m.cbox(px, 0.0, 0.44, 0.44, 0.90, 0.925, 'p_roccia', top='p_roccia')
        # Piatto circolare nero
        m.prism(8, 0.17, 0.17, 0.925, 0.945, 'p_nero_caldo', top='p_nero_caldo', cx=px, cz=0.0)
        # Etichetta centrale del disco
        m.prism(6, 0.055, 0.055, 0.945, 0.948, lbl_col, top=lbl_col, cx=px, cz=0.0)
        # Braccio di lettura puntina
        beam(m, (px + 0.16, 0.94, 0.16), (px + 0.08, 0.95, -0.04), 0.015, 0.015, 'metallo', end='metallo')
    # Mixer centrale tra i piatti
    m.cbox(0.0, 0.0, 0.26, 0.44, 0.90, 0.93, 'p_roccia', top='p_nero_caldo')
    # Manopole e fader sul mixer
    for fy in (-0.10, 0.0, 0.10):
        m.cbox(0.0, fy, 0.03, 0.08, 0.93, 0.945, 'p_pietra_chiara', top='p_pietra_chiara')
    # DETTAGLIO 1: serie di led/lucine sul frontale, di cui una spenta/rotta («lucine rotte»)
    leds = ['em_neon_ciano', 'em_neon_rosa', 'p_nero_caldo', 'em_neon_ambra', 'em_neon_verde']
    for i, col in enumerate(leds):
        m.cbox(-0.40 + i * 0.20, -dd / 2 - 0.01, 0.06, 0.02, 0.76, 0.82, col, top=col)
    # DETTAGLIO 2: lattina di bibita appoggiata sul tavolo con macchia («ci appoggi le bibite»)
    m.prism(6, 0.038, 0.038, 0.90, 1.01, 'p_rosso', top='metallo', cx=-0.52, cz=-0.22)
    m.box(-0.55, 0.901, -0.27, -0.45, 0.903, -0.17, 'p_rosso')
    return _obj(m, footprint=[W, D])


def mob_cassettone_da_farmacia_antica():
    """Cassettone d'erboristeria/farmacia in legno scuro con matrice di piccoli cassetti, etichette e boccetta da speziale."""
    m = Mesh('mob_cassettone_da_farmacia_antica')
    W, D = ingombro((1, 1))
    cw, cd = 1.34, 0.66
    # Zoccolo inferiore modanato
    m.cbox(0.0, 0.0, cw + 0.02, cd + 0.02, 0.0, 0.08, 'p_legno_scuro', top='p_legno_scuro')
    # Corpo principale del mobile
    m.cbox(0.0, 0.0, cw, cd, 0.08, 0.94, 'legno_scuro', top='p_legno_scuro')
    # Piano superiore sagomato con cornice
    m.cbox(0.0, 0.0, cw + 0.06, cd + 0.06, 0.94, 1.00, 'p_legno_scuro', top='p_legno')
    # Matrice di cassettini (4 colonne x 3 righe = 12 cassetti) sul davanti (-Z)
    for col in range(4):
        xc = -cw / 2 + 0.20 + col * 0.31
        for row in range(3):
            yc = 0.22 + row * 0.24
            # Pannello frontale del cassetto leggermente in rilievo
            m.box(xc - 0.13, yc - 0.09, -cd / 2 - 0.015, xc + 0.13, yc + 0.09, -cd / 2, 'p_legno', top='p_legno')
            # Maniglietta a conchiglia / pomolo dorato
            m.box(xc - 0.03, yc - 0.04, -cd / 2 - 0.035, xc + 0.03, yc - 0.01, -cd / 2 - 0.015, 'oro', top='oro')
            # DETTAGLIO: etichetta cartacea rettangolare per le erbe/rimedi («etichetta illeggibile»)
            m.box(xc - 0.06, yc + 0.02, -cd / 2 - 0.02, xc + 0.06, yc + 0.065, -cd / 2 - 0.015, 'carta', top='carta')
    # Sopra il piano: vecchia boccetta farmaceutica in vetro con tappo e pergamena arrotolata («ricetta del 1908»)
    m.prism(6, 0.05, 0.045, 1.00, 1.14, 'vetro', top='vetro', cx=-0.38, cz=0.0)
    m.prism(6, 0.028, 0.032, 1.14, 1.19, 'p_sabbia', top='p_sabbia', cx=-0.38, cz=0.0)
    # Pergamena arrotolata
    m.prism(6, 0.03, 0.03, 1.00, 1.04, 'carta', top='carta', cx=0.28, cz=-0.06, a0=math.pi / 2)
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
        mob_caminetto_in_mattoni_finiti,
        mob_distributore_di_bibite,
        mob_vasca_da_bagno_con_piedini,
        mob_sacco_da_boxe,
        mob_pianoforte_a_coda,
        mob_tenda_da_campeggio,
        mob_divano_a_due_posti_in_tessuto,
        mob_sedia_in_legno_massello,
        mob_mobile_tv_basso,
        mob_libreria_componibile_svedese,
        mob_tappeto_rettangolare_a_tinta_unita,
        mob_letto_singolo_con_materasso_a_molle,
        mob_lume_a_olio_mezzo_vuoto,
        mob_lampada_lava_con_liquido_scolorito,
        mob_sfera_di_cristallo_con_neve_e_castello,
        mob_robot_giocattolo_con_occhi_led,
        mob_lampada_a_forma_di_fungo,
        mob_teschio_con_candela_sciolta,
        mob_radiosveglia_rotante,
        mob_ventilatore_usb_a_forma_di_cactus,
        mob_barattolo_di_lucciole_finte,
        mob_orologio_da_tavolo_a_forma_di_gatto,
        mob_cassa_di_legno_della_frutta_rovesciata,
        mob_banco_da_macellaio_in_marmo,
        mob_tavolo_da_ping_pong_piegato,
        mob_valigia_rigida_vintage,
        mob_pila_di_libri_enormi,
        mob_banco_da_scuola_con_sedile_attaccato,
        mob_tavolino_da_campeggio_richiudibile,
        mob_banco_da_lavoro_con_morsa,
        mob_tavolo_da_dj_con_lucine_rotte,
        mob_cassettone_da_farmacia_antica,
    )
}
