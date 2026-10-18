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
from lib import Mesh, Xf, beam, face


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
    t = 0.09                                           # spessore delle pareti
    # 4 piedini dorati sagomati
    for sx in (-0.58, 0.58):
        for sz in (-0.28, 0.28):
            m.cone(5, 0.07, 0.0, 0.16, 'oro', cx=sx, cz=sz)
            m.cbox(sx, sz, 0.11, 0.11, 0.14, 0.2, 'oro', top='oro')
    # Fondo e quattro pareti (la vasca e' cava: dentro si vede l'acqua)
    m.cbox(0.0, 0.0, cw, cd, 0.16, 0.3, 'p_pietra_chiara', top='p_pietra_chiara')
    m.box(-cw / 2, 0.3, -cd / 2, cw / 2, 0.66, -cd / 2 + t, 'p_pietra_chiara', top='p_pietra_chiara')
    m.box(-cw / 2, 0.3, cd / 2 - t, cw / 2, 0.66, cd / 2, 'p_pietra_chiara', top='p_pietra_chiara')
    m.box(-cw / 2, 0.3, -cd / 2 + t, -cw / 2 + t, 0.66, cd / 2 - t, 'p_pietra_chiara', top='p_pietra_chiara')
    m.box(cw / 2 - t, 0.3, -cd / 2 + t, cw / 2, 0.66, cd / 2 - t, 'p_pietra_chiara', top='p_pietra_chiara')
    # Bordo sporgente a cornice
    m.box(-cw / 2 - 0.04, 0.66, -cd / 2 - 0.04, cw / 2 + 0.04, 0.72, -cd / 2 + t, 'p_pietra_chiara', top='p_pietra_chiara')
    m.box(-cw / 2 - 0.04, 0.66, cd / 2 - t, cw / 2 + 0.04, 0.72, cd / 2 + 0.04, 'p_pietra_chiara', top='p_pietra_chiara')
    m.box(-cw / 2 - 0.04, 0.66, -cd / 2 + t, -cw / 2 + t, 0.72, cd / 2 - t, 'p_pietra_chiara', top='p_pietra_chiara')
    m.box(cw / 2 - t, 0.66, -cd / 2 + t, cw / 2 + 0.04, 0.72, cd / 2 - t, 'p_pietra_chiara', top='p_pietra_chiara')
    # Acqua turchese all'interno
    m.cbox(0.0, 0.0, cw - 2 * t, cd - 2 * t, 0.3, 0.55, 'p_acqua', top='p_acqua')
    # Gruppo rubinetteria vintage dorata sul lato destro (+X)
    rx = cw / 2 - 0.06
    beam(m, (rx, 0.72, 0.0), (rx, 1.0, 0.0), 0.05, 0.05, 'oro', end='oro')
    beam(m, (rx, 1.0, 0.0), (rx - 0.2, 0.94, 0.0), 0.045, 0.045, 'oro', end='oro')
    m.cbox(rx, -0.14, 0.07, 0.07, 0.72, 0.8, 'oro', top='p_rosso')
    m.cbox(rx, 0.14, 0.07, 0.07, 0.72, 0.8, 'oro', top='p_acqua')
    # DETTAGLIO: paperella di gomma gialla che galleggia molesta
    m.prism(6, 0.09, 0.07, 0.55, 0.66, 'p_giallo', top='p_giallo', cx=-0.22, cz=0.04)
    m.cone(4, 0.05, 0.6, 0.67, 'p_arancio', cx=-0.3, cz=0.04)
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
    # Corpo della tenda (otto lati, una faccia guarda a -Z) e cupola
    m.prism(8, 0.78, 0.42, 0.06, 0.82, 'p_acqua', top='p_acqua')
    m.cone(8, 0.44, 0.82, 1.28, 'p_acqua')
    # Cuffia di aerazione superiore a contrasto
    m.cone(8, 0.22, 1.18, 1.32, 'p_arancio')
    # Archi flessibili della paleria a incrocio, sul telo
    beam(m, (-0.65, 0.06, -0.6), (0.65, 0.06, 0.7), 0.03, 0.03, 'p_nero_caldo')
    beam(m, (0.65, 0.06, -0.6), (-0.65, 0.06, 0.7), 0.03, 0.03, 'p_nero_caldo')

    # Apertura d'ingresso: trapezio scuro appoggiato sulla faccia frontale (inclinata) della tenda
    def zf(y):
        return -(0.78 * 0.9239 - (y - 0.06) * (0.78 - 0.42) * 0.9239 / 0.76) - 0.012
    m.poly([(0.27, 0.06, zf(0.06)), (-0.27, 0.06, zf(0.06)), (-0.14, 0.6, zf(0.6)), (0.14, 0.6, zf(0.6))], 'p_ombra_calda')
    # Telo porta arrotolato di lato con laccetto giallo
    m.prism(6, 0.06, 0.06, 0.12, 0.62, 'p_acqua_profonda', top='p_giallo', cx=-0.4, cz=-0.62)
    # DETTAGLIO: cartello di cartone SUBAFFITTO su un paletto davanti alla tenda
    beam(m, (0.5, 0.0, -0.85), (0.5, 0.62, -0.85), 0.04, 0.04, 'p_legno_scuro', end='p_legno_scuro')
    m.box(0.32, 0.6, -0.89, 0.68, 0.9, -0.87, 'carta', skip=('back',))
    m.box(0.36, 0.67, -0.895, 0.64, 0.83, -0.885, 'p_nero_caldo', skip=('back',))
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
    cw, cd = 1.1, 0.4
    t = 0.05
    # Zoccolo e spalle (con fondo scuro per far leggere i vani)
    m.cbox(0.0, 0.0, cw, cd, 0.0, 0.1, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(-cw / 2 + t / 2, 0.0, t, cd, 0.1, 1.85, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(cw / 2 - t / 2, 0.0, t, cd, 0.1, 1.85, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(0.0, 0.0, cw, cd, 1.85, 1.91, 'p_pietra_chiara', top='p_pietra_chiara')
    m.box(-cw / 2 + t, 0.1, cd / 2 - 0.02, cw / 2 - t, 1.85, cd / 2, 'p_pietra', skip=('back', 'top', 'bottom'))
    # 3 ripiani intermedi
    for y in (0.6, 1.1, 1.5):
        m.box(-cw / 2 + t, y, -cd / 2, cw / 2 - t, y + 0.04, cd / 2 - 0.02, 'p_pietra_chiara', top='p_pietra_chiara')
    # Vano 1 (basso): fila di libri colorati
    for i, col in enumerate(('p_rosso', 'p_acqua', 'p_giallo', 'p_arancio', 'p_erba', 'p_viola')):
        m.box(-0.4 + i * 0.1, 0.1, -0.12, -0.32 + i * 0.1, 0.42 + (i % 2) * 0.06, 0.12, col, top='pagine')
    # Vano 2: scatola portaoggetti blu
    m.cbox(-0.2, 0.0, 0.4, cd - 0.1, 0.64, 1.0, 'tessuto_blu', top='tessuto_blu')
    # Vano 3: due libri spessi
    m.box(0.1, 1.14, -0.12, 0.32, 1.38, 0.12, 'p_legno_scuro', top='pagine')
    m.box(-0.35, 1.14, -0.1, -0.15, 1.3, 0.1, 'p_rosso', top='pagine')
    # Vano 4 (alto): una pianta spoglia nel vaso
    m.prism(6, 0.09, 0.07, 1.54, 1.68, 'p_arancio', top='p_arancio', cx=0.2, cz=0.0)
    m.cone(5, 0.12, 1.68, 1.82, 'p_erba', cx=0.2, cz=0.0)
    # DETTAGLIO: chiave a brugola a L d'acciaio avanzata dal montaggio, sul ripiano
    beam(m, (-0.05, 1.145, -0.1), (0.05, 1.145, -0.1), 0.02, 0.02, 'ferro', end='ferro')
    beam(m, (-0.05, 1.145, -0.1), (-0.05, 1.145, -0.02), 0.02, 0.02, 'ferro', end='ferro')
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
    # Targhetta dorata sul davanti (-Z)
    m.box(-0.06, 0.02, -0.215, 0.06, 0.07, -0.205, 'oro')
    # Strato di neve interna sul fondo
    m.prism(8, 0.17, 0.17, 0.10, 0.13, 'p_pietra_chiara', top='p_pietra_chiara')
    # DETTAGLIO: castello in miniatura al centro con tetti blu e fiocchi di neve (un po' piu' grande: si deve vedere)
    m.cbox(0.0, 0.0, 0.14, 0.1, 0.13, 0.23, 'p_pietra', top='p_pietra')
    m.box(-0.025, 0.13, -0.055, 0.025, 0.2, -0.05, 'p_nero_caldo')
    # Torretta sinistra
    m.prism(6, 0.035, 0.035, 0.13, 0.27, 'p_pietra', cx=-0.075, cz=0.0)
    m.cone(6, 0.05, 0.27, 0.35, 'p_acqua_profonda', cx=-0.075, cz=0.0)
    # Torretta destra
    m.prism(6, 0.035, 0.035, 0.13, 0.27, 'p_pietra', cx=0.075, cz=0.0)
    m.cone(6, 0.05, 0.27, 0.35, 'p_acqua_profonda', cx=0.075, cz=0.0)
    # Maschio centrale piu' alto con tetto a cono
    m.prism(6, 0.05, 0.05, 0.23, 0.32, 'p_pietra', cx=0.0, cz=0.0)
    m.cone(6, 0.065, 0.32, 0.41, 'p_acqua_profonda', cx=0.0, cz=0.0)
    # Neve in cima al tetto centrale e fiocchi sparsi
    m.cone(6, 0.03, 0.38, 0.42, 'p_pietra_chiara', cx=0.0, cz=0.0)
    m.cbox(-0.11, -0.07, 0.025, 0.025, 0.19, 0.215, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(0.1, -0.06, 0.025, 0.025, 0.22, 0.245, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(-0.05, 0.1, 0.02, 0.02, 0.28, 0.3, 'p_pietra_chiara', top='p_pietra_chiara')
    # Cupola di vetro: solo la meta' dietro (+Z) e i fianchi, aperta davanti e sopra: il castello resta visibile dalla camera
    rings = [(0.19, 0.10), (0.215, 0.22), (0.2, 0.34), (0.12, 0.46)]
    rs = [m.ring(8, r, y, a0=math.pi / 8) for r, y in rings]
    for a, b in zip(rs, rs[1:]):
        for i in (0, 1, 2, 3, 7):
            j = (i + 1) % 8
            m.poly([a[j], a[i], b[i], b[j]], 'vetro')
    # Nervature d'ottone sul davanti
    for i in (4, 7):
        for (r0, y0), (r1, y1) in zip(rings, rings[1:]):
            p0 = m.ring(8, r0, y0, a0=math.pi / 8)[i]
            p1 = m.ring(8, r1, y1, a0=math.pi / 8)[i]
            beam(m, p0, p1, 0.02, 0.02, 'oro', end='oro')
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
    # Fondo del barattolo in vetro
    m.prism(8, 0.15, 0.17, 0.0, 0.03, 'vetro', bottom='vetro', top='vetro')
    # Pareti in vetro: solo dietro e di lato (il vetro qui e' opaco): davanti restano le nervature e si vedono le lucine
    rings = [(0.17, 0.03), (0.17, 0.24), (0.12, 0.28)]
    rs = [m.ring(8, r, y, a0=math.pi / 8) for r, y in rings]
    for a, b in zip(rs, rs[1:]):
        for i in (0, 1, 2, 3, 7):
            j = (i + 1) % 8
            m.poly([a[j], a[i], b[i], b[j]], 'vetro')
    for i in (4, 7):
        beam(m, rs[0][i], rs[1][i], 0.02, 0.02, 'vetro')
        beam(m, rs[1][i], rs[2][i], 0.02, 0.02, 'vetro')
    # Coperchio a vite in latta zigrinata con fori di sfiato
    m.prism(8, 0.13, 0.13, 0.28, 0.32, 'p_pietra_scura', top='p_pietra_scura')
    # DETTAGLIO: cordino di iuta attorno al collo con cartellino in carta
    m.prism(8, 0.135, 0.135, 0.26, 0.28, 'corda')
    m.box(0.09, 0.17, -0.12, 0.15, 0.25, -0.115, 'carta')
    # DETTAGLIO: filo di rame con 5 LED luminosi sospesi all'interno (non sono lucciole, sono LED)
    beam(m, (0.0, 0.03, 0.0), (-0.05, 0.10, 0.03), 0.012, 0.012, 'oro')
    beam(m, (-0.05, 0.10, 0.03), (0.04, 0.15, -0.02), 0.012, 0.012, 'oro')
    beam(m, (0.04, 0.15, -0.02), (-0.02, 0.21, 0.02), 0.012, 0.012, 'oro')
    # Cubetti LED emissivi ambra e verde lime
    m.cbox(-0.05, 0.03, 0.04, 0.04, 0.08, 0.12, 'em_neon_ambra', top='em_neon_ambra')
    m.cbox(0.05, -0.04, 0.04, 0.04, 0.13, 0.17, 'em_neon_verde', top='em_neon_verde')
    m.cbox(-0.03, 0.0, 0.04, 0.04, 0.2, 0.24, 'em_neon_ambra', top='em_neon_ambra')
    m.cbox(0.07, 0.05, 0.04, 0.04, 0.05, 0.09, 'em_neon_ambra', top='em_neon_ambra')
    m.cbox(-0.08, -0.06, 0.04, 0.04, 0.15, 0.19, 'em_neon_verde', top='em_neon_verde')
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
    return _obj(m, footprint=[W, D])


def mob_tavolo_da_biliardo():
    """Tavolo da biliardo rettangolare (2x1 celle): panno verde, sponde in legno scuro con finitura, 6 buche, stecca, biglie e vestiti appoggiati sopra."""
    m = Mesh('mob_tavolo_da_biliardo')
    W, D = ingombro((2, 1))
    tw, td = 2.6, 1.4
    ty = 0.82
    # 6 gambe massicce a sezione quadrata con piedini
    for sx in (-1.05, 0.0, 1.05):
        for sz in (-0.52, 0.52):
            m.cbox(sx, sz, 0.16, 0.16, 0.0, ty - 0.14, 'p_legno_scuro', top='p_legno_scuro')
            m.cbox(sx, sz, 0.18, 0.18, 0.0, 0.06, 'ferro', top='ferro')
    # Fascia perimetrale di telaio in legno scuro
    m.cbox(0.0, 0.0, tw, td, ty - 0.14, ty - 0.04, 'p_legno_scuro', top='p_legno_scuro')
    # Piano panno verde da gioco
    m.cbox(0.0, 0.0, tw - 0.24, td - 0.24, ty - 0.04, ty, 'p_bosco', top='p_bosco')
    # Sponde rialzate perimetrali in legno scuro con bordo superiore laccato
    m.box(-tw / 2, ty - 0.04, -td / 2, tw / 2, ty + 0.07, -td / 2 + 0.12, 'p_legno_scuro', top='p_legno_chiaro')
    m.box(-tw / 2, ty - 0.04, td / 2 - 0.12, tw / 2, ty + 0.07, td / 2, 'p_legno_scuro', top='p_legno_chiaro')
    m.box(-tw / 2, ty - 0.04, -td / 2 + 0.12, -tw / 2 + 0.12, ty + 0.07, td / 2 - 0.12, 'p_legno_scuro', top='p_legno_chiaro')
    m.box(tw / 2 - 0.12, ty - 0.04, -td / 2 + 0.12, tw / 2, ty + 0.07, td / 2 - 0.12, 'p_legno_scuro', top='p_legno_chiaro')
    # 6 buche nere
    for sx in (-tw / 2 + 0.13, 0.0, tw / 2 - 0.13):
        for sz in (-td / 2 + 0.13, td / 2 - 0.13):
            m.cbox(sx, sz, 0.09, 0.09, ty - 0.01, ty + 0.005, 'p_nero_caldo', top='p_nero_caldo')
    # Biglie e stecca da biliardo
    m.prism(5, 0.035, 0.035, ty, ty + 0.06, 'p_pietra_chiara', top='p_pietra_chiara', cx=-0.4, cz=0.1)
    m.prism(5, 0.035, 0.035, ty, ty + 0.06, 'p_rosso', top='p_rosso', cx=0.5, cz=0.0)
    m.prism(5, 0.035, 0.035, ty, ty + 0.06, 'p_giallo', top='p_giallo', cx=0.56, cz=0.04)
    beam(m, (-0.95, ty + 0.015, 0.35), (0.75, ty + 0.015, -0.25), 0.025, 0.025, 'p_legno_chiaro', end='p_pietra_chiara')
    # DETTAGLIO: pila di vestiti e felpa appoggiati sopra («usarlo per appoggiarci sopra i vestiti»)
    m.cbox(-0.75, -0.15, 0.48, 0.38, ty, ty + 0.07, 'tessuto_blu', top='tessuto_blu')
    m.cbox(-0.62, -0.12, 0.36, 0.30, ty + 0.07, ty + 0.12, 'p_rosso', top='p_rosso')
    return _obj(m, footprint=[W, D])


def mob_tavolo_kotatsu():
    """Tavolo Kotatsu quadrato giapponese basso con piumone rosso trapuntato, vassoio con mandarini e tè caldo."""
    m = Mesh('mob_tavolo_kotatsu')
    W, D = ingombro((1, 1))
    # 4 gambe corte in legno chiaro
    for sx in (-0.38, 0.38):
        for sz in (-0.38, 0.38):
            m.cbox(sx, sz, 0.08, 0.08, 0.0, 0.34, 'p_legno_chiaro', top='p_legno_chiaro')
    # Piumone/trapunta pesante che sborda ai quattro lati verso terra
    m.cbox(0.0, 0.0, 1.42, 1.42, 0.04, 0.38, 'tessuto_rosso', top='p_rosso')
    m.cbox(0.0, 0.0, 1.48, 1.48, 0.0, 0.06, 'p_sabbia_chiara', top='p_sabbia_chiara')
    # Piano superiore quadrato rimovibile in legno chiaro
    m.cbox(0.0, 0.0, 1.12, 1.12, 0.38, 0.44, 'p_legno_chiaro', top='tavole')
    m.cbox(0.0, 0.0, 1.16, 1.16, 0.41, 0.44, 'p_legno', top='p_legno_chiaro')
    # DETTAGLIO: vassoio in legno con due mandarini arancioni e tazza di tè verde («trappola mortale d'inverno»)
    m.prism(8, 0.16, 0.18, 0.44, 0.46, 'p_legno_scuro', top='p_legno_scuro', cx=0.15, cz=0.1)
    m.prism(6, 0.042, 0.038, 0.46, 0.525, 'p_arancio', top='p_erba', cx=0.12, cz=0.08)
    m.prism(6, 0.036, 0.032, 0.46, 0.515, 'p_arancio', top='p_erba', cx=0.18, cz=0.12)
    m.prism(6, 0.04, 0.045, 0.44, 0.51, 'p_pietra_chiara', top='p_bosco', cx=-0.22, cz=-0.12)
    return _obj(m, footprint=[W, D])


def mob_sgabello_da_pianoforte():
    """Sgabello da pianoforte nero con seduta in finta pelle, manopole laterali a vite, tazzina appoggiata e zeppa sotto la zampa."""
    m = Mesh('mob_sgabello_da_pianoforte')
    W, D = ingombro((1, 1))
    # 4 gambe nere con piedini in ottone
    for sx in (-0.28, 0.28):
        for sz in (-0.16, 0.16):
            m.prism(5, 0.035, 0.03, 0.0, 0.05, 'p_giallo', top='p_giallo', cx=sx, cz=sz)
            m.cbox(sx, sz, 0.055, 0.055, 0.05, 0.44, 'p_nero_caldo', top='p_nero_caldo')
    # Fascia telaio perimetrale nero
    m.cbox(0.0, 0.0, 0.65, 0.39, 0.39, 0.45, 'p_nero_caldo', top='p_nero_caldo')
    # Manopole laterali dorate/nere per regolazione altezza
    for sx in (-0.35, 0.35):
        m.cbox(sx, 0.0, 0.04, 0.04, 0.41, 0.44, 'p_giallo')
        m.prism(6, 0.045, 0.045, 0.40, 0.45, 'p_nero_caldo', top='p_giallo', cx=sx + (0.02 if sx > 0 else -0.02), cz=0.0)
    # Seduta imbottita in cuoio scuro
    m.cbox(0.0, 0.0, 0.70, 0.43, 0.45, 0.52, 'cuoio', top='p_nero_caldo')
    # DETTAGLIO: tazzina con piattino («funge da tavolo») e zeppa di cartone sotto una zampa («traballante»)
    m.prism(6, 0.08, 0.09, 0.52, 0.535, 'p_pietra_chiara', top='p_pietra_chiara', cx=0.08, cz=0.0)
    m.prism(6, 0.04, 0.045, 0.535, 0.60, 'p_pietra_chiara', top='p_legno_scuro', cx=0.08, cz=0.0)
    beam(m, (0.04, 0.54, -0.04), (0.13, 0.54, 0.04), 0.012, 0.008, 'ferro')
    m.box(-0.31, 0.0, -0.19, -0.25, 0.025, -0.13, 'carta', top='carta')
    return _obj(m, footprint=[W, D])


def mob_botte_di_rovere_in_verticale():
    """Botte di rovere verticale a doghe con cerchi di ferro, piano d'appoggio superiore, bottiglia e moneta dorata."""
    m = Mesh('mob_botte_di_rovere_in_verticale')
    W, D = ingombro((1, 1))
    # Corpo botte a doghe di rovere (pancia più larga a metà)
    m.loft([m.ring(8, 0.42, 0.0), m.ring(8, 0.52, 0.48), m.ring(8, 0.42, 0.95)], 'barile', top='taglio', bottom='taglio')
    # 4 cerchi di rinforzo in ferro
    m.prism(8, 0.44, 0.45, 0.12, 0.18, 'ferro')
    m.prism(8, 0.515, 0.525, 0.36, 0.42, 'ferro')
    m.prism(8, 0.515, 0.525, 0.54, 0.60, 'ferro')
    m.prism(8, 0.44, 0.45, 0.78, 0.84, 'ferro')
    # Bordo superiore e piano d'appoggio incassato
    m.prism(8, 0.41, 0.43, 0.94, 0.98, 'p_legno', top='p_legno_scuro')
    m.prism(8, 0.38, 0.38, 0.94, 0.95, 'p_legno', top='tavole')
    # DETTAGLIO: moneta d'oro sul ripiano e bottiglia di vetro scuro con tappo («trovi delle monete, ma per ora ci appoggi la roba»)
    m.prism(6, 0.05, 0.05, 0.95, 0.965, 'oro', top='oro', cx=0.12, cz=0.1)
    m.prism(6, 0.05, 0.045, 0.95, 1.10, 'p_bosco', top='p_legno_chiaro', cx=-0.1, cz=-0.08)
    m.prism(6, 0.02, 0.02, 1.10, 1.16, 'p_bosco', top='p_sabbia', cx=-0.1, cz=-0.08)
    return _obj(m, footprint=[W, D])


def mob_pila_di_vecchi_pneumatici():
    """Pila di tre vecchi pneumatici disallineati con lastra circolare in vetro, lattina di soda e graffito."""
    m = Mesh('mob_pila_di_vecchi_pneumatici')
    W, D = ingombro((1, 1))
    # 3 copertoni impilati leggermente sfalsati
    m.prism(8, 0.48, 0.48, 0.0, 0.19, 'cs_gomme', top='p_nero_caldo', bottom='p_nero_caldo', cx=0.02, cz=-0.01)
    m.prism(8, 0.22, 0.22, 0.05, 0.20, 'p_pietra_scura', top='p_nero_caldo', cx=0.02, cz=-0.01)
    m.prism(8, 0.48, 0.48, 0.19, 0.38, 'cs_gomme', top='p_nero_caldo', a0=0.35, cx=-0.03, cz=0.02)
    m.prism(8, 0.48, 0.48, 0.38, 0.57, 'cs_gomme', top='p_nero_caldo', a0=0.15, cx=0.01, cz=-0.02)
    # Supporti per la lastra di vetro
    for a in (0.0, math.pi / 2, math.pi, 3 * math.pi / 2):
        vx, vz = 0.01 + math.cos(a) * 0.38, -0.02 + math.sin(a) * 0.38
        m.cbox(vx, vz, 0.05, 0.05, 0.57, 0.59, 'p_nero_caldo', top='p_nero_caldo')
    # Lastra di vetro circolare superiore
    m.prism(10, 0.58, 0.58, 0.59, 0.63, 'vetro', top='vetro', bottom='vetro', cx=0.0, cz=0.0)
    m.prism(10, 0.585, 0.585, 0.605, 0.62, 'p_acqua_bassa', cx=0.0, cz=0.0)
    # DETTAGLIO: lattina di soda sul vetro e macchia di vernice spray gialla sul copertone («stile underground molto opinabile»)
    m.prism(6, 0.035, 0.035, 0.63, 0.72, 'p_rosso', top='metallo', cx=-0.15, cz=0.1)
    m.box(0.38, 0.22, -0.25, 0.49, 0.35, -0.15, 'p_giallo')
    return _obj(m, footprint=[W, D])


def mob_tavolo_da_pranzo_quadrato_in_legno():
    """Tavolo da pranzo quadrato in legno massiccio con piano liscio a doghe, buste della posta e tazza."""
    m = Mesh('mob_tavolo_da_pranzo_quadrato_in_legno')
    W, D = ingombro((1, 1))
    # 4 gambe massicce in legno scuro
    for sx in (-0.50, 0.50):
        for sz in (-0.50, 0.50):
            m.cbox(sx, sz, 0.10, 0.10, 0.0, 0.71, 'p_legno_scuro', top='p_legno_scuro')
    # Traversi perimetrali di supporto sotto il piano
    m.cbox(0.0, -0.50, 0.92, 0.04, 0.61, 0.71, 'p_legno_scuro')
    m.cbox(0.0, 0.50, 0.92, 0.04, 0.61, 0.71, 'p_legno_scuro')
    m.cbox(-0.50, 0.0, 0.04, 0.92, 0.61, 0.71, 'p_legno_scuro')
    m.cbox(0.50, 0.0, 0.04, 0.92, 0.61, 0.71, 'p_legno_scuro')
    # Piano quadrato spesso in legno
    m.cbox(0.0, 0.0, 1.25, 1.25, 0.71, 0.78, 'p_legno', top='tavole')
    # DETTAGLIO: due buste della posta con francobollo rosso e tazzina («ci appoggi la posta»)
    m.box(0.12, 0.78, 0.10, 0.36, 0.788, 0.28, 'carta', top='carta')
    m.box(0.30, 0.789, 0.12, 0.35, 0.793, 0.17, 'p_rosso', top='p_rosso')
    m.box(0.18, 0.788, 0.16, 0.40, 0.796, 0.34, 'p_pietra_chiara', top='p_pietra_chiara')
    m.prism(6, 0.06, 0.08, 0.78, 0.84, 'p_pietra_chiara', top='p_legno_scuro', cx=-0.25, cz=-0.15)
    return _obj(m, footprint=[W, D])


def mob_scrivania_semplice():
    """Scrivania essenziale con gambe a telaio metallico nero, piano laminato chiaro e computer portatile aperto acceso."""
    m = Mesh('mob_scrivania_semplice')
    W, D = ingombro((1, 1))
    # Gambe a U metalliche sui due fianchi
    for sx in (-0.60, 0.60):
        beam(m, (sx, 0.02, -0.32), (sx, 0.02, 0.32), 0.04, 0.04, 'ferro', end='ferro')
        beam(m, (sx, 0.02, -0.32), (sx, 0.69, -0.32), 0.04, 0.04, 'ferro')
        beam(m, (sx, 0.02, 0.32), (sx, 0.69, 0.32), 0.04, 0.04, 'ferro')
        beam(m, (sx, 0.69, -0.32), (sx, 0.69, 0.32), 0.04, 0.04, 'ferro', end='ferro')
    # Traversa posteriore di rinforzo
    beam(m, (-0.58, 0.40, 0.32), (0.58, 0.40, 0.32), 0.03, 0.03, 'ferro')
    # Piano rettangolare in laminato chiaro
    m.cbox(0.0, 0.0, 1.35, 0.75, 0.70, 0.75, 'p_legno_chiaro', top='p_legno_chiaro')
    m.cbox(0.0, 0.0, 1.37, 0.77, 0.73, 0.75, 'p_legno', top='p_legno_chiaro')
    # DETTAGLIO: PC portatile aperto con schermo azzurro neon, tastiera e mousepad («per piazzare il PC»)
    m.cbox(0.0, 0.05, 0.34, 0.24, 0.75, 0.765, 'p_nero_caldo', top='p_pietra_scura')
    m.cbox(0.0, 0.08, 0.30, 0.12, 0.765, 0.772, 'p_pietra_chiara', top='p_pietra_chiara')
    beam(m, (0.0, 0.765, 0.17), (0.0, 0.98, 0.22), 0.34, 0.02, 'p_nero_caldo', end='p_nero_caldo')
    m.cbox(0.0, 0.18, 0.30, 0.02, 0.79, 0.96, 'em_neon_ciano', top='p_nero_caldo')
    m.box(0.24, 0.751, -0.05, 0.42, 0.755, 0.15, 'p_nero_caldo', top='p_nero_caldo')
    m.cbox(0.33, 0.05, 0.06, 0.09, 0.755, 0.78, 'p_pietra_chiara', top='p_pietra_chiara')
    return _obj(m, footprint=[W, D])


def mob_tavolino_da_salotto_basso():
    """Tavolino basso rettangolare da salotto in noce scuro con doppio ripiano, telecomando TV e paraspigolo giallo salva-stinchi."""
    m = Mesh('mob_tavolino_da_salotto_basso')
    W, D = ingombro((1, 1))
    # 4 gambe angolari robuste
    for sx in (-0.52, 0.52):
        for sz in (-0.26, 0.26):
            m.cbox(sx, sz, 0.08, 0.08, 0.0, 0.40, 'p_legno_scuro', top='p_legno_scuro')
    # Ripiano inferiore portariviste
    m.cbox(0.0, 0.0, 0.96, 0.48, 0.16, 0.19, 'p_legno', top='p_legno')
    m.box(-0.25, 0.19, -0.15, 0.0, 0.21, 0.10, 'p_rosso', top='pagine')
    m.box(-0.10, 0.19, -0.05, 0.18, 0.205, 0.16, 'tessuto_blu', top='pagine')
    # Piano superiore in noce scuro con cornice sagomata
    m.cbox(0.0, 0.0, 1.20, 0.65, 0.38, 0.42, 'p_legno_scuro', top='tavole_scure')
    m.cbox(0.0, 0.0, 1.24, 0.69, 0.40, 0.42, 'p_legno', top='p_legno_scuro')
    # DETTAGLIO: telecomando TV con pulsante rosso e paraspigolo giallo fluorescente («sbatterci gli stinchi al buio»)
    m.box(0.20, 0.42, -0.10, 0.27, 0.438, 0.12, 'p_nero_caldo', top='p_nero_caldo')
    m.box(0.22, 0.438, 0.07, 0.25, 0.445, 0.10, 'p_rosso', top='p_rosso')
    m.box(-0.62, 0.37, -0.345, -0.52, 0.425, -0.245, 'p_giallo', top='p_giallo')
    return _obj(m, footprint=[W, D])


def mob_comodino_in_laminato():
    """Comodino compatto a due cassetti (il superiore socchiuso) con maniglie cromate, sveglia rossa da comodino e bicchiere."""
    m = Mesh('mob_comodino_in_laminato')
    W, D = ingombro((1, 1))
    # 4 piedini cilindrici metallici
    for sx in (-0.28, 0.28):
        for sz in (-0.20, 0.20):
            m.prism(6, 0.03, 0.025, 0.0, 0.08, 'ferro', top='ferro', cx=sx, cz=sz)
    # Scocca principale del comodino
    m.cbox(0.0, 0.0, 0.68, 0.52, 0.08, 0.58, 'p_pietra_chiara', top='p_pietra_chiara')
    m.cbox(0.0, 0.0, 0.70, 0.54, 0.56, 0.58, 'p_pietra', top='p_pietra_chiara')
    # Cassetto inferiore chiuso con maniglia
    m.box(-0.30, 0.12, -0.27, 0.30, 0.31, -0.25, 'p_pietra', top='p_pietra_chiara')
    beam(m, (-0.10, 0.22, -0.285), (0.10, 0.22, -0.285), 0.02, 0.02, 'ferro')
    beam(m, (-0.10, 0.22, -0.285), (-0.10, 0.22, -0.27), 0.015, 0.015, 'ferro')
    beam(m, (0.10, 0.22, -0.285), (0.10, 0.22, -0.27), 0.015, 0.015, 'ferro')
    # Cassetto superiore socchiuso che sporge in fuori in -Z («si aprono tutti e due i cassetti»)
    m.box(-0.30, 0.34, -0.32, 0.30, 0.53, -0.30, 'p_pietra', top='p_pietra_chiara')
    m.box(-0.29, 0.35, -0.30, -0.27, 0.51, -0.25, 'p_legno_chiaro')
    m.box(0.27, 0.35, -0.30, 0.29, 0.51, -0.25, 'p_legno_chiaro')
    beam(m, (-0.10, 0.44, -0.335), (0.10, 0.44, -0.335), 0.02, 0.02, 'ferro')
    beam(m, (-0.10, 0.44, -0.335), (-0.10, 0.44, -0.32), 0.015, 0.015, 'ferro')
    beam(m, (0.10, 0.44, -0.335), (0.10, 0.44, -0.32), 0.015, 0.015, 'ferro')
    # DETTAGLIO: sveglia rossa vintage da comodino con campanelle e bicchiere d'acqua («sveglia»)
    m.box(-0.16, 0.58, -0.06, -0.14, 0.60, -0.04, 'ferro')
    m.box(-0.08, 0.58, -0.06, -0.06, 0.60, -0.04, 'ferro')
    m.prism(8, 0.06, 0.06, 0.59, 0.68, 'p_rosso', top='p_pietra_chiara', cx=-0.11, cz=-0.05)
    m.prism(5, 0.025, 0.01, 0.68, 0.72, 'ferro', top='ferro', cx=-0.15, cz=-0.05)
    m.prism(5, 0.025, 0.01, 0.68, 0.72, 'ferro', top='ferro', cx=-0.07, cz=-0.05)
    beam(m, (-0.11, 0.68, -0.05), (-0.11, 0.71, -0.05), 0.01, 0.01, 'ferro')
    m.prism(6, 0.035, 0.04, 0.58, 0.67, 'vetro', top='p_acqua_bassa', cx=0.14, cz=0.08)
    return _obj(m, footprint=[W, D])


def mob_piano_di_marmo_su_due_cavalletti():
    """Piano di marmo bianco venato su due cavalletti da pittore in legno grezzo, con un cartone di pizza aperto sopra."""
    m = Mesh('mob_piano_di_marmo_su_due_cavalletti')
    W, D = ingombro((1, 1))
    for sx in (-0.52, 0.52):
        m.cbox(sx, 0.0, 0.08, 0.68, 0.66, 0.72, 'p_legno', top='p_legno')
        for sz in (-1, 1):
            beam(m, (sx - 0.03, 0.68, sz * 0.12), (sx - 0.03, 0.0, sz * 0.32), 0.05, 0.05, 'p_legno', end='p_legno')
            beam(m, (sx + 0.03, 0.68, sz * 0.12), (sx + 0.03, 0.0, sz * 0.32), 0.05, 0.05, 'p_legno', end='p_legno')
        m.cbox(sx, 0.0, 0.06, 0.54, 0.24, 0.28, 'p_legno_chiaro')
    m.cbox(0.0, 0.0, 1.55, 0.82, 0.72, 0.78, 'marmo_muro', top='marmo_muro')
    m.cbox(0.0, 0.0, 1.57, 0.84, 0.74, 0.77, 'p_pietra_chiara')
    m.cbox(0.25, -0.05, 0.36, 0.36, 0.78, 0.81, 'p_pietra_chiara', top='p_rosso')
    m.cbox(0.25, 0.15, 0.36, 0.02, 0.81, 1.05, 'p_pietra_chiara')
    m.cbox(0.25, -0.05, 0.18, 0.18, 0.81, 0.83, 'p_giallo', top='p_rosso')
    return _obj(m, footprint=[W, D])


def mob_tavolo_da_stiro_pieghevole():
    """Tavolo da stiro con telo azzurro, gambe metalliche a X incrociate, pile di scartoffie e una piantina grassa sul piano."""
    m = Mesh('mob_tavolo_da_stiro_pieghevole')
    W, D = ingombro((1, 1))
    for sx in (-0.45, 0.45):
        m.cbox(sx, 0.0, 0.05, 0.52, 0.0, 0.04, 'metallo', top='metallo')
    beam(m, (-0.45, 0.03, -0.16), (0.42, 0.80, -0.16), 0.035, 0.035, 'ferro', end='ferro')
    beam(m, (-0.45, 0.03, 0.16), (0.42, 0.80, 0.16), 0.035, 0.035, 'ferro', end='ferro')
    beam(m, (0.45, 0.03, -0.14), (-0.42, 0.80, -0.14), 0.035, 0.035, 'ferro', end='ferro')
    beam(m, (0.45, 0.03, 0.14), (-0.42, 0.80, 0.14), 0.035, 0.035, 'ferro', end='ferro')
    m.cbox(0.0, 0.0, 0.06, 0.36, 0.40, 0.44, 'metallo')
    m.cbox(-0.56, 0.0, 0.22, 0.34, 0.80, 0.82, 'metallo', top='metallo')
    m.cbox(-0.66, 0.0, 0.04, 0.34, 0.82, 0.86, 'metallo')
    m.box(-0.45, 0.80, -0.22, 0.25, 0.86, 0.22, 'p_acqua', top='tessuto_blu')
    m.prism(5, 0.24, 0.24, 0.80, 0.86, 'p_acqua', top='tessuto_blu', cx=0.42, cz=0.0)
    m.cbox(-0.15, -0.02, 0.26, 0.30, 0.86, 0.94, 'carta', top='carta')
    m.cbox(-0.12, 0.02, 0.24, 0.26, 0.94, 0.98, 'p_giallo', top='carta')
    m.prism(6, 0.07, 0.09, 0.86, 0.97, 'p_arancio', top='terra', cx=0.18, cz=-0.04)
    m.prism(6, 0.08, 0.04, 0.97, 1.09, 'p_erba', top='p_erba', cx=0.18, cz=-0.04)
    return _obj(m, footprint=[W, D])


def mob_tavolino_da_caffe_in_vetro():
    """Tavolino basso da salotto in vetro trasparente con telaio nero opaco, pieno di ditate e una tazzina di caffè sul ripiano."""
    m = Mesh('mob_tavolino_da_caffe_in_vetro')
    W, D = ingombro((1, 1))
    w, d = 1.25, 0.75
    for sx in (-w / 2 + 0.03, w / 2 - 0.03):
        m.box(sx - 0.02, 0.0, -d / 2 + 0.01, sx + 0.02, 0.04, d / 2 - 0.01, 'p_nero_caldo')
    for sx in (-w / 2 + 0.03, w / 2 - 0.03):
        for sz in (-d / 2 + 0.03, d / 2 - 0.03):
            m.cbox(sx, sz, 0.04, 0.04, 0.0, 0.42, 'p_nero_caldo', top='p_nero_caldo')
    for sz in (-d / 2 + 0.03, d / 2 - 0.03):
        m.box(-w / 2 + 0.03, 0.38, sz - 0.02, w / 2 - 0.03, 0.42, sz + 0.02, 'p_nero_caldo')
    for sx in (-w / 2 + 0.03, w / 2 - 0.03):
        m.box(sx - 0.02, 0.38, -d / 2 + 0.03, sx + 0.02, 0.42, d / 2 - 0.03, 'p_nero_caldo')
    m.cbox(0.0, 0.0, w - 0.08, d - 0.08, 0.16, 0.18, 'vetro', top='vetro')
    m.cbox(0.0, 0.0, w, d, 0.42, 0.46, 'vetro', top='vetro')
    m.prism(6, 0.11, 0.12, 0.46, 0.475, 'p_pietra_chiara', top='p_pietra_chiara', cx=-0.25, cz=-0.1)
    m.prism(6, 0.06, 0.07, 0.475, 0.54, 'p_pietra_chiara', top='p_legno_scuro', cx=-0.25, cz=-0.1)
    m.cbox(-0.17, -0.1, 0.025, 0.04, 0.49, 0.52, 'p_pietra_chiara')
    m.cbox(0.18, 0.12, 0.09, 0.06, 0.461, 0.465, 'p_pietra_chiara')
    m.cbox(0.24, -0.08, 0.08, 0.05, 0.461, 0.465, 'p_pietra_chiara')
    m.cbox(-0.05, 0.16, 0.07, 0.05, 0.461, 0.465, 'p_pietra_chiara')
    return _obj(m, footprint=[W, D])


def mob_scatolone_di_cartone_rovesciato():
    """Grande scatolone di cartone da trasloco rovesciato, nastrato col nastro da pacchi, etichetta 'ALTO' capovolta e una tazza sopra."""
    m = Mesh('mob_scatolone_di_cartone_rovesciato')
    W, D = ingombro((1, 1))
    bw, bd, bh = 0.90, 0.80, 0.58
    m.cbox(0.0, 0.0, bw, bd, 0.0, bh, 'p_sabbia', top='p_sabbia')
    m.cbox(0.0, 0.0, bw - 0.02, bd - 0.02, bh, bh + 0.015, 'p_sabbia_chiara', top='p_sabbia_chiara')
    m.cbox(0.0, 0.0, bw + 0.005, 0.10, bh + 0.005, bh + 0.02, 'p_legno', top='p_legno')
    m.cbox(0.0, 0.0, 0.10, bd + 0.005, bh + 0.005, bh + 0.02, 'p_legno', top='p_legno')
    m.box(-bw / 2 - 0.005, bh - 0.18, -0.05, -bw / 2, bh + 0.01, 0.05, 'p_legno')
    m.box(bw / 2, bh - 0.18, -0.05, bw / 2 + 0.005, bh + 0.01, 0.05, 'p_legno')
    m.box(-0.05, bh - 0.18, -bd / 2 - 0.005, 0.05, bh + 0.01, -bd / 2, 'p_legno')
    m.box(-0.05, bh - 0.18, bd / 2, 0.05, bh + 0.01, bd / 2 + 0.005, 'p_legno')
    m.box(-0.24, 0.22, -bd / 2 - 0.005, -0.06, 0.44, -bd / 2, 'p_pietra_chiara')
    m.box(-0.17, 0.25, -bd / 2 - 0.01, -0.13, 0.38, -bd / 2 - 0.005, 'p_rosso')
    m.box(-0.20, 0.25, -bd / 2 - 0.01, -0.10, 0.29, -bd / 2 - 0.005, 'p_rosso')
    m.prism(6, 0.06, 0.06, bh + 0.02, bh + 0.13, 'p_rosso', top='p_pietra_chiara', cx=0.18, cz=0.10)
    m.cbox(0.25, 0.10, 0.025, 0.035, bh + 0.05, bh + 0.10, 'p_rosso')
    return _obj(m, footprint=[W, D])


def mob_scrivania_direzionale_in_noce():
    """Scrivania presidenziale in noce scuro con cassettiere laterali, sottomano in cuoio e due monitor da ufficio gestionale."""
    m = Mesh('mob_scrivania_direzionale_in_noce')
    W, D = ingombro((1, 1))
    w, d = 1.62, 0.90
    m.cbox(0.0, 0.0, w, d, 0.70, 0.78, 'p_legno_scuro', top='legno_pieno')
    m.cbox(0.0, 0.0, w + 0.04, d + 0.04, 0.74, 0.78, 'p_legno')
    for sx in (-0.56, 0.56):
        m.cbox(sx, 0.02, 0.42, d - 0.08, 0.0, 0.70, 'p_legno_scuro', top='p_legno_scuro')
        m.cbox(sx, 0.02, 0.44, d - 0.06, 0.0, 0.05, 'p_nero_caldo')
        for y in (0.10, 0.30, 0.50):
            m.box(sx - 0.18, y, -d / 2 + 0.01, sx + 0.18, y + 0.16, -d / 2 + 0.03, 'p_legno')
            m.cbox(sx, -d / 2 - 0.01, 0.04, 0.03, y + 0.06, y + 0.10, 'oro')
    m.box(-0.35, 0.15, d / 2 - 0.08, 0.35, 0.70, d / 2 - 0.04, 'p_legno_scuro')
    m.cbox(0.0, -0.05, 0.54, 0.36, 0.78, 0.788, 'cuoio', top='cuoio')
    m.cbox(-0.26, 0.18, 0.14, 0.12, 0.78, 0.795, 'p_nero_caldo')
    beam(m, (-0.26, 0.79, 0.18), (-0.26, 0.88, 0.18), 0.03, 0.03, 'p_nero_caldo')
    m.box(-0.46, 0.88, 0.14, -0.06, 1.10, 0.17, 'p_nero_caldo')
    m.box(-0.44, 0.90, 0.135, -0.08, 1.08, 0.14, 'p_ciano_neon')
    m.cbox(0.26, 0.18, 0.14, 0.12, 0.78, 0.795, 'p_nero_caldo')
    beam(m, (0.26, 0.79, 0.18), (0.26, 0.88, 0.18), 0.03, 0.03, 'p_nero_caldo')
    m.box(0.06, 0.88, 0.14, 0.46, 1.10, 0.17, 'p_nero_caldo')
    m.box(0.08, 0.90, 0.135, 0.44, 1.08, 0.14, 'p_ciano_neon')
    return _obj(m, footprint=[W, D])


def mob_comodino_scassato():
    """Vecchio comodino in legno sbeccato: zoccolo traballante con zeppa, cassetto inferiore incastrato e sbilenco, robusto piano d'appoggio."""
    m = Mesh('mob_comodino_scassato')
    W, D = ingombro((1, 1))
    w, d, h = 0.62, 0.52, 0.64
    for sx, sz in ((-1, 1), (1, -1), (1, 1)):
        m.box(sx * (w / 2 - 0.05) - 0.03, 0.0, sz * (d / 2 - 0.05) - 0.03,
              sx * (w / 2 - 0.05) + 0.03, 0.10, sz * (d / 2 - 0.05) + 0.03, 'p_legno_scuro')
    m.box(-w / 2 + 0.02, 0.03, -d / 2 + 0.02, -w / 2 + 0.08, 0.10, -d / 2 + 0.08, 'p_legno_scuro')
    m.box(-w / 2 + 0.01, 0.0, -d / 2 + 0.01, -w / 2 + 0.09, 0.03, -d / 2 + 0.09, 'p_sabbia')
    m.cbox(0.0, 0.0, w, d, 0.10, h - 0.04, 'p_legno', top='p_legno')
    m.cbox(0.0, 0.0, w + 0.06, d + 0.06, h - 0.04, h, 'p_legno_chiaro', top='p_legno')
    m.box(-w / 2 + 0.05, 0.38, -d / 2 - 0.015, w / 2 - 0.05, 0.56, -d / 2, 'p_legno_scuro')
    m.cbox(0.0, -d / 2 - 0.02, 0.03, 0.01, 0.46, 0.48, 'p_nero_caldo')
    beam(m, (-w / 2 + 0.05, 0.15, -d / 2 - 0.08), (w / 2 - 0.05, 0.17, -d / 2 - 0.03), 0.04, 0.18, 'p_legno_scuro')
    m.cbox(-0.12, -d / 2 - 0.09, 0.03, 0.02, 0.22, 0.26, 'ferro')
    m.prism(6, 0.07, 0.07, h, h + 0.14, 'p_pietra_chiara', top='p_pietra_chiara', cx=0.12, cz=-0.05)
    return _obj(m, footprint=[W, D])


def mob_isola_da_cucina_in_marmo():
    """Isola centrale da cucina monolitica con base moderna in pietra antracite, spessa lastra in marmo freddo e tagliere con coltello."""
    m = Mesh('mob_isola_da_cucina_in_marmo')
    W, D = ingombro((1, 1))
    w, d = 1.48, 0.95
    m.cbox(0.0, 0.0, w - 0.10, d - 0.10, 0.0, 0.08, 'p_nero_caldo')
    m.cbox(0.0, 0.0, w, d, 0.08, 0.82, 'p_roccia', top='p_roccia')
    for x in (-0.36, 0.36):
        m.box(x - 0.01, 0.10, -d / 2 - 0.005, x + 0.01, 0.80, -d / 2, 'p_nero_caldo')
    m.box(-w / 2 + 0.05, 0.76, -d / 2 - 0.005, w / 2 + 0.05, 0.78, -d / 2, 'p_nero_caldo')
    m.cbox(0.0, 0.0, w + 0.12, d + 0.12, 0.82, 0.90, 'marmo_muro', top='marmo_muro')
    m.cbox(0.0, 0.0, w + 0.14, d + 0.14, 0.85, 0.88, 'p_pietra_chiara')
    m.cbox(-0.25, 0.05, 0.38, 0.28, 0.90, 0.935, 'p_legno_chiaro', top='p_legno')
    m.box(-0.16, 0.935, -0.02, 0.02, 0.95, 0.01, 'metallo')
    m.box(0.02, 0.935, -0.015, 0.12, 0.955, 0.005, 'p_nero_caldo')
    m.prism(6, 0.12, 0.15, 0.90, 0.98, 'p_pietra_chiara', top='p_arancio', cx=0.32, cz=-0.08)
    return _obj(m, footprint=[W, D])


def mob_cattedra_scolastica():
    """Cattedra scolastica verde militare anni '80 con fusto metallico, modesty panel forato, piano in formica con graffi da compasso."""
    m = Mesh('mob_cattedra_scolastica')
    W, D = ingombro((1, 1))
    w, d = 1.35, 0.78
    for sx in (-w / 2 + 0.06, w / 2 - 0.06):
        for sz in (-d / 2 + 0.06, d / 2 - 0.06):
            m.cbox(sx, sz, 0.05, 0.05, 0.0, 0.72, 'p_bosco', top='p_bosco')
            m.cbox(sx, sz, 0.055, 0.055, 0.0, 0.04, 'p_nero_caldo')
    m.box(-w / 2 + 0.06, 0.12, -d / 2 + 0.04, -w / 2 + 0.10, 0.16, d / 2 - 0.04, 'p_bosco')
    m.box(w / 2 - 0.10, 0.12, -d / 2 + 0.04, w / 2 - 0.06, 0.16, d / 2 - 0.04, 'p_bosco')
    m.box(-w / 2 + 0.08, 0.18, -d / 2 + 0.04, w / 2 - 0.08, 0.70, -d / 2 + 0.06, 'p_bosco')
    m.box(0.18, 0.22, -d / 2 + 0.08, w / 2 - 0.08, 0.70, d / 2 - 0.08, 'p_bosco_ombra')
    for y in (0.28, 0.44, 0.58):
        m.box(0.20, y, d / 2 - 0.08, w / 2 - 0.10, y + 0.12, d / 2 - 0.07, 'p_bosco')
        m.cbox(0.38, d / 2 - 0.065, 0.06, 0.02, y + 0.04, y + 0.08, 'metallo')
    m.cbox(0.0, 0.0, w, d, 0.72, 0.77, 'p_legno_chiaro', top='p_legno_chiaro')
    m.cbox(0.0, 0.0, w + 0.02, d + 0.02, 0.73, 0.76, 'p_nero_caldo')
    m.cbox(-0.25, -0.08, 0.14, 0.02, 0.771, 0.775, 'p_legno_scuro')
    m.cbox(-0.25, -0.08, 0.02, 0.14, 0.771, 0.775, 'p_legno_scuro')
    m.prism(6, 0.08, 0.08, 0.771, 0.775, 'p_legno_scuro', cx=0.05, cz=0.10)
    m.prism(6, 0.04, 0.04, 0.77, 0.88, 'p_pietra_chiara', top='p_nero_caldo', cx=-0.42, cz=0.18)
    beam(m, (-0.42, 0.86, 0.18), (-0.44, 0.96, 0.16), 0.015, 0.015, 'p_rosso', end='p_rosso')
    return _obj(m, footprint=[W, D])


def mob_bancone_da_bar_in_mogano():
    """Bancone da pub in mogano scuro con pannelli bugnati, poggiapiedi in ottone lucido e due bicchieri sul ripiano con aloni."""
    m = Mesh('mob_bancone_da_bar_in_mogano')
    W, D = ingombro((1, 1))
    w, d, h = 1.68, 0.82, 1.08
    m.cbox(0.0, 0.0, w - 0.06, d - 0.06, 0.0, 0.06, 'p_nero_caldo')
    beam(m, (-w / 2 + 0.10, 0.14, -d / 2 - 0.08), (w / 2 - 0.10, 0.14, -d / 2 - 0.08), 0.04, 0.04, 'oro', end='oro')
    for x in (-w / 2 + 0.20, 0.0, w / 2 - 0.20):
        beam(m, (x, 0.14, -d / 2 - 0.08), (x, 0.14, -d / 2), 0.03, 0.03, 'oro', end='oro')
    m.cbox(0.0, 0.0, w, d, 0.06, 0.98, 'p_legno_scuro', top='p_legno_scuro')
    for cx in (-0.50, 0.0, 0.50):
        m.box(cx - 0.20, 0.20, -d / 2 - 0.02, cx + 0.20, 0.85, -d / 2, 'p_legno')
        m.box(cx - 0.17, 0.23, -d / 2 - 0.03, cx + 0.17, 0.82, -d / 2 - 0.02, 'legno_pieno')
    m.cbox(0.0, 0.0, w + 0.10, d + 0.10, 0.98, 1.08, 'p_legno_scuro', top='legno_pieno')
    m.box(-w / 2 - 0.06, 1.04, -d / 2 - 0.06, w / 2 + 0.06, 1.09, -d / 2 - 0.01, 'p_legno')
    m.prism(6, 0.05, 0.06, 1.08, 1.20, 'vetro', top='p_arancio', cx=-0.22, cz=-0.08)
    m.prism(6, 0.05, 0.06, 1.08, 1.18, 'vetro', top='p_giallo', cx=-0.05, cz=-0.12)
    m.prism(6, 0.07, 0.07, 1.081, 1.083, 'p_legno', cx=0.28, cz=-0.05)
    return _obj(m, footprint=[W, D])


def mob_cassettiera_anni_70():
    """Cassettiera vintage anni '70 in teak con piedini conici a spillo, 3 cassetti arancio, ocra e viola, e palline di naftalina sul ripiano."""
    m = Mesh('mob_cassettiera_anni_70')
    W, D = ingombro((1, 1))
    w, d, h = 1.10, 0.58, 0.86
    for sx in (-w / 2 + 0.12, w / 2 - 0.12):
        for sz in (-d / 2 + 0.10, d / 2 - 0.10):
            beam(m, (sx, 0.22, sz), (sx + (0.05 if sx > 0 else -0.05), 0.0, sz + (0.04 if sz > 0 else -0.04)), 0.06, 0.04, 'p_legno_scuro', end='p_giallo')
    m.cbox(0.0, 0.0, w, d, 0.22, h, 'p_legno', top='p_legno')
    m.cbox(0.0, 0.0, w + 0.02, d + 0.02, h - 0.03, h, 'p_legno_chiaro')
    colors = ('p_viola', 'p_giallo', 'p_arancio')
    for i, c in enumerate(colors):
        y0 = 0.25 + i * 0.19
        m.box(-w / 2 + 0.04, y0, -d / 2 - 0.02, w / 2 - 0.04, y0 + 0.17, -d / 2, c)
        for mx in (-0.28, 0.28):
            m.cbox(mx, -d / 2 - 0.035, 0.04, 0.03, y0 + 0.06, y0 + 0.11, 'p_giallo')
    for nx, nz in ((0.22, 0.05), (0.28, 0.08), (0.25, 0.12), (0.32, 0.04)):
        m.prism(5, 0.02, 0.02, h, h + 0.03, 'p_pietra_chiara', top='p_pietra_chiara', cx=nx, cz=nz)
    m.prism(6, 0.07, 0.11, h, h + 0.18, 'p_arancio', top='p_viola', cx=-0.30, cz=0.0)
    return _obj(m, footprint=[W, D])


def mob_lavagna_in_sughero():
    """Lavagna in sughero a parete: cornice in legno, pannello in sughero con foglietto della spesa, post-it colorati e puntine."""
    m = Mesh('mob_lavagna_in_sughero')
    W, D = ingombro((1, 1))
    # Cornice in legno scuro a parete (z da -0.05 a 0.0)
    m.box(-0.60, 1.50, -0.05, 0.60, 2.30, 0.0, 'p_legno_scuro', skip=('back',))
    # Pannello centrale in sughero
    m.box(-0.55, 1.55, -0.04, 0.55, 2.25, -0.01, 'p_sabbia', skip=('back',))
    # Lista della spesa lunga a sinistra
    m.box(-0.46, 1.62, -0.043, -0.28, 2.08, -0.04, 'p_pietra_chiara', skip=('back',))
    for i in range(5):
        m.box(-0.43, 2.00 - i * 0.08, -0.044, -0.31, 2.02 - i * 0.08, -0.043, 'p_nero_caldo', skip=('back',))
    m.box(-0.38, 2.05, -0.05, -0.36, 2.07, -0.043, 'p_rosso', skip=('back',))
    # Post-it colorati sparsi
    m.box(-0.18, 1.88, -0.044, -0.06, 2.00, -0.04, 'p_giallo', skip=('back',))
    m.box(-0.13, 1.97, -0.05, -0.11, 1.99, -0.044, 'p_acqua', skip=('back',))
    m.box(0.04, 1.68, -0.044, 0.16, 1.80, -0.04, 'p_arancio', skip=('back',))
    m.box(0.09, 1.77, -0.05, 0.11, 1.79, -0.044, 'p_erba', skip=('back',))
    m.box(0.22, 1.90, -0.044, 0.34, 2.02, -0.04, 'p_rosa_neon', skip=('back',))
    m.box(0.27, 1.99, -0.05, 0.29, 2.01, -0.044, 'p_giallo', skip=('back',))
    m.box(0.06, 2.02, -0.044, 0.18, 2.14, -0.04, 'p_ciano_neon', skip=('back',))
    m.box(0.11, 2.11, -0.05, 0.13, 2.13, -0.044, 'p_rosso', skip=('back',))
    m.box(0.30, 1.58, -0.045, 0.46, 1.72, -0.04, 'carta', skip=('back',))
    # Due gancetti neri di fissaggio in alto
    m.box(-0.40, 2.30, -0.02, -0.36, 2.34, 0.0, 'p_nero_caldo', skip=('back',))
    m.box(0.36, 2.30, -0.02, 0.40, 2.34, 0.0, 'p_nero_caldo', skip=('back',))
    return _obj(m, footprint=[W, D])


def mob_specchio_ovale_con_cornice_d_oro():
    """Specchio ovale a parete con cornice d'oro, fregi barocchi in testa e riflesso pulito sul vetro."""
    m = Mesh('mob_specchio_ovale_con_cornice_d_oro')
    W, D = ingombro((1, 1))
    cx, cy = 0.0, 1.95
    n = 12
    rx_out, ry_out = 0.42, 0.58
    rx_in, ry_in = 0.33, 0.49
    # Cornice d'oro a n lati: bordo esterno ed interno
    for i in range(n):
        a0 = 2 * math.pi * i / n
        a1 = 2 * math.pi * (i + 1) / n
        c0, s0 = math.cos(a0), math.sin(a0)
        c1, s1 = math.cos(a1), math.sin(a1)
        # Faccia frontale della cornice
        pts_front = [
            (cx + c0 * rx_out, cy + s0 * ry_out, -0.04),
            (cx + c1 * rx_out, cy + s1 * ry_out, -0.04),
            (cx + c1 * rx_in, cy + s1 * ry_in, -0.04),
            (cx + c0 * rx_in, cy + s0 * ry_in, -0.04),
        ]
        face(m, pts_front, 'oro', (0, 0, -1))
        # Bordo esterno verso il muro
        pts_side = [
            (cx + c0 * rx_out, cy + s0 * ry_out, 0.0),
            (cx + c1 * rx_out, cy + s1 * ry_out, 0.0),
            (cx + c1 * rx_out, cy + s1 * ry_out, -0.04),
            (cx + c0 * rx_out, cy + s0 * ry_out, -0.04),
        ]
        n_side = (c0 + c1, s0 + s1, 0)
        face(m, pts_side, 'p_giallo', n_side)
    # Specchio interno in vetro
    glass_pts = [(cx + math.cos(2 * math.pi * i / n) * rx_in, cy + math.sin(2 * math.pi * i / n) * ry_in, -0.02) for i in range(n)]
    face(m, glass_pts, 'vetro', (0, 0, -1))
    # Fregio barocco in cima
    m.box(-0.09, cy + 0.54, -0.05, 0.09, cy + 0.65, -0.01, 'oro', top='oro')
    m.box(-0.04, cy + 0.65, -0.045, 0.04, cy + 0.72, -0.01, 'oro', top='oro')
    m.box(-0.06, cy - 0.63, -0.045, 0.06, cy - 0.55, -0.01, 'oro', bottom='oro')
    # Riflesso lucido sul vetro (due fasci diagonali)
    beam(m, (-0.18, cy - 0.15, -0.025), (0.14, cy + 0.25, -0.025), 0.035, 0.005, 'p_pietra_chiara', end='p_pietra_chiara')
    beam(m, (-0.10, cy - 0.25, -0.025), (0.05, cy - 0.07, -0.025), 0.020, 0.005, 'p_pietra_chiara', end='p_pietra_chiara')
    return _obj(m, footprint=[W, D])


def mob_testa_di_t_rex_in_plastica():
    """Testa di T-Rex in plastica a parete: scudo in legno, testa verde con fauci aperte, denti aguzzi e targhetta premio."""
    m = Mesh('mob_testa_di_t_rex_in_plastica')
    W, D = ingombro((1, 1))
    # Scudo trofeo in legno sagomato
    m.box(-0.24, 1.62, -0.04, 0.24, 2.20, 0.0, 'p_legno_scuro', skip=('back',))
    m.box(-0.19, 1.58, -0.035, 0.19, 2.24, 0.0, 'p_legno', skip=('back',))
    # Base/collo del T-Rex che esce dalla parete
    m.box(-0.16, 1.82, -0.16, 0.16, 2.12, -0.04, 'p_erba', top='p_erba')
    # Cranio superiore verde
    m.box(-0.14, 1.90, -0.44, 0.14, 2.16, -0.16, 'p_erba', top='p_erba')
    # Muso anteriore affusolato
    m.box(-0.10, 1.90, -0.48, 0.10, 2.10, -0.44, 'p_erba')
    # Arcate sopraccigliari e creste
    m.box(-0.15, 2.14, -0.32, -0.07, 2.20, -0.20, 'p_erba_scura', top='p_erba_scura')
    m.box(0.07, 2.14, -0.32, 0.15, 2.20, -0.20, 'p_erba_scura', top='p_erba_scura')
    # Occhietti finti da sala giochi
    m.box(-0.155, 2.02, -0.28, -0.135, 2.10, -0.22, 'p_giallo')
    m.box(-0.158, 2.04, -0.26, -0.152, 2.08, -0.24, 'p_nero_caldo')
    m.box(0.135, 2.02, -0.28, 0.155, 2.10, -0.22, 'p_giallo')
    m.box(0.152, 2.04, -0.26, 0.158, 2.08, -0.24, 'p_nero_caldo')
    # Mascella inferiore aperta
    m.box(-0.11, 1.74, -0.42, 0.11, 1.84, -0.16, 'p_erba', bottom='p_erba')
    # Bocca rossa interna
    m.box(-0.10, 1.84, -0.40, 0.10, 1.90, -0.18, 'p_rosso')
    # Denti aguzzi superiori e inferiori
    for i in range(4):
        z_tooth = -0.42 + i * 0.07
        m.box(-0.11, 1.87, z_tooth, -0.095, 1.92, z_tooth + 0.035, 'p_pietra_chiara')
        m.box(0.095, 1.87, z_tooth, 0.11, 1.92, z_tooth + 0.035, 'p_pietra_chiara')
        m.box(-0.09, 1.82, z_tooth + 0.02, -0.075, 1.86, z_tooth + 0.05, 'p_pietra_chiara')
        m.box(0.075, 1.82, z_tooth + 0.02, 0.09, 1.86, z_tooth + 0.05, 'p_pietra_chiara')
    # Targhetta dorata da sala giochi
    m.box(-0.14, 1.63, -0.05, 0.14, 1.71, -0.038, 'p_giallo', skip=('back',))
    m.box(-0.04, 1.65, -0.052, 0.04, 1.69, -0.05, 'p_rosso', skip=('back',))
    return _obj(m, footprint=[W, D])


def mob_telecamera_di_sicurezza_a_circuito_chiuso():
    """Telecamera di sicurezza a circuito chiuso a parete: staffa nera, corpo bianco con visiera, obiettivo scuro e LED rosso spia."""
    m = Mesh('mob_telecamera_di_sicurezza_a_circuito_chiuso')
    W, D = ingombro((1, 1))
    # Piastra di montaggio al muro
    m.box(-0.10, 2.25, -0.03, 0.10, 2.45, 0.0, 'p_nero_caldo', skip=('back',))
    # Braccio snodato metallico
    m.box(-0.04, 2.32, -0.13, 0.04, 2.38, -0.03, 'p_pietra_scura')
    m.prism(6, 0.045, 0.045, 2.29, 2.41, 'p_nero_caldo', cx=0, cz=-0.13)
    m.box(-0.03, 2.26, -0.20, 0.03, 2.34, -0.13, 'p_pietra_scura')
    # Corpo telecamera squadrato bianco
    m.box(-0.09, 2.14, -0.38, 0.09, 2.30, -0.18, 'p_pietra_chiara', top='p_pietra_chiara', bottom='p_pietra_chiara')
    # Visiera tettuccio parasole grigia
    m.box(-0.10, 2.30, -0.42, 0.10, 2.33, -0.17, 'p_pietra', top='p_pietra')
    # Frontale nero e obiettivo lente
    m.box(-0.08, 2.15, -0.39, 0.08, 2.29, -0.38, 'p_nero_caldo', skip=('back',))
    m.prism(6, 0.045, 0.045, 2.18, 2.26, 'p_abisso', top='vetro', cx=0, cz=-0.395)
    # LED rosso acceso ("finto occhio del Grande Fratello")
    m.box(-0.015, 2.265, -0.405, 0.015, 2.29, -0.39, 'p_rosso_neon')
    # Cavo penzolante dal retro al muro
    beam(m, (0.05, 2.20, -0.18), (0.07, 2.10, -0.10), 0.018, 0.018, 'p_nero_caldo', end='p_nero_caldo')
    beam(m, (0.07, 2.10, -0.10), (0.04, 2.06, -0.01), 0.018, 0.018, 'p_nero_caldo', end='p_nero_caldo')
    # Adesivo giallo di avviso sul lato
    m.box(0.091, 2.19, -0.30, 0.093, 2.25, -0.22, 'p_giallo', skip=('back',))
    return _obj(m, footprint=[W, D])


def mob_diploma_incorniciato():
    """Diploma incorniciato a parete: cornice in legno scuro con filetto oro, testo accademico e sigillo in ceralacca con nastrini."""
    m = Mesh('mob_diploma_incorniciato')
    W, D = ingombro((1, 1))
    # Cornice in legno scuro
    m.box(-0.36, 1.68, -0.04, 0.36, 2.22, 0.0, 'p_legno_scuro', skip=('back',))
    # Filetto interno in oro
    m.box(-0.33, 1.71, -0.038, 0.33, 2.19, -0.02, 'oro', skip=('back',))
    # Pergamena del diploma
    m.box(-0.31, 1.73, -0.035, 0.31, 2.17, -0.01, 'carta', skip=('back',))
    # Lastra di vetro protettiva
    m.box(-0.31, 1.73, -0.036, 0.31, 2.17, -0.035, 'vetro', skip=('back',))
    # Intestazione e righe calligrafiche del diploma
    m.box(-0.20, 2.09, -0.037, 0.20, 2.12, -0.035, 'p_nero_caldo', skip=('back',))
    for y in (2.02, 1.95, 1.88, 1.81):
        m.box(-0.24, y, -0.037, 0.16, y + 0.018, -0.035, 'p_pietra_scura', skip=('back',))
    # Sigillo di ceralacca rosso con nastri accademici
    m.prism(8, 0.04, 0.04, 1.75, 1.83, 'p_rosso', top='p_rosso', cx=0.18, cz=-0.038)
    beam(m, (0.17, 1.76, -0.039), (0.15, 1.69, -0.037), 0.018, 0.005, 'p_rosso', end='p_rosso')
    beam(m, (0.19, 1.76, -0.039), (0.21, 1.68, -0.037), 0.018, 0.005, 'p_rosso', end='p_rosso')
    # Gancio metallico in cima
    m.box(-0.04, 2.22, -0.015, 0.04, 2.26, 0.0, 'metallo', skip=('back',))
    return _obj(m, footprint=[W, D])


def mob_chitarra_elettrica_appesa():
    """Chitarra elettrica appesa al muro: supporto a parete, corpo rosso asimmetrico, manico, pickup, plettro e corde scordate."""
    m = Mesh('mob_chitarra_elettrica_appesa')
    W, D = ingombro((1, 1))
    # Supporto a parete per chitarra
    m.box(-0.06, 2.44, -0.025, 0.06, 2.52, 0.0, 'p_nero_caldo', skip=('back',))
    m.box(-0.05, 2.46, -0.14, -0.03, 2.50, -0.025, 'p_nero_caldo')
    m.box(0.03, 2.46, -0.14, 0.05, 2.50, -0.025, 'p_nero_caldo')
    # Paletta con meccaniche
    m.box(-0.045, 2.38, -0.13, 0.045, 2.54, -0.10, 'p_legno_chiaro', top='p_legno_chiaro')
    for i in range(3):
        y_peg = 2.40 + i * 0.05
        m.box(-0.065, y_peg, -0.12, -0.045, y_peg + 0.025, -0.11, 'metallo')
        m.box(0.045, y_peg, -0.12, 0.065, y_peg + 0.025, -0.11, 'metallo')
    # Manico e tastiera
    m.box(-0.025, 1.82, -0.12, 0.025, 2.38, -0.09, 'p_legno_chiaro')
    m.box(-0.025, 1.82, -0.125, 0.025, 2.38, -0.12, 'p_legno_scuro', skip=('back',))
    for y in (1.94, 2.06, 2.18, 2.30):
        m.box(-0.006, y, -0.127, 0.006, y + 0.012, -0.125, 'p_pietra_chiara')
    # Corpo sagomato rosso
    m.box(-0.16, 1.35, -0.14, 0.16, 1.78, -0.08, 'p_rosso', top='p_rosso', bottom='p_rosso')
    m.box(-0.18, 1.75, -0.14, -0.07, 1.94, -0.08, 'p_rosso', top='p_rosso')
    m.box(0.07, 1.75, -0.14, 0.16, 1.86, -0.08, 'p_rosso', top='p_rosso')
    m.box(-0.13, 1.30, -0.14, 0.13, 1.35, -0.08, 'p_rosso', bottom='p_rosso')
    # Battipenna bianco
    m.box(-0.10, 1.48, -0.145, 0.08, 1.80, -0.14, 'p_pietra_chiara', skip=('back',))
    # Pickup e ponte
    for y in (1.68, 1.60, 1.52):
        m.box(-0.03, y, -0.15, 0.03, y + 0.04, -0.142, 'p_nero_caldo')
    m.box(-0.04, 1.40, -0.15, 0.04, 1.46, -0.142, 'metallo')
    m.box(0.06, 1.42, -0.155, 0.09, 1.46, -0.145, 'p_giallo')
    # Corde tese e corde scordate
    beam(m, (-0.015, 1.43, -0.15), (-0.015, 2.45, -0.125), 0.005, 0.005, 'metallo')
    beam(m, (0.015, 1.43, -0.15), (0.015, 2.45, -0.125), 0.005, 0.005, 'metallo')
    beam(m, (-0.03, 2.48, -0.12), (-0.08, 2.56, -0.15), 0.005, 0.005, 'metallo')
    beam(m, (0.03, 2.48, -0.12), (0.09, 2.40, -0.16), 0.005, 0.005, 'metallo')
    # Plettro giallo infilato sotto le corde
    m.box(-0.015, 2.08, -0.133, 0.015, 2.12, -0.126, 'p_giallo')
    return _obj(m, footprint=[W, D])


def mob_orologio_da_parete_analogico():
    """Orologio da parete analogico: cornice bianca circolare, quadrante bianco con 12 tacche, lancette nere e secondi rossi."""
    m = Mesh('mob_orologio_da_parete_analogico')
    W, D = ingombro((1, 1))
    cx, cy = 0.0, 1.95
    n = 12
    r_out, r_in = 0.28, 0.23
    # Cornice circolare bianca
    for i in range(n):
        a0 = 2 * math.pi * i / n
        a1 = 2 * math.pi * (i + 1) / n
        c0, s0 = math.cos(a0), math.sin(a0)
        c1, s1 = math.cos(a1), math.sin(a1)
        # Faccia frontale
        pts_front = [
            (cx + c0 * r_out, cy + s0 * r_out, -0.06),
            (cx + c1 * r_out, cy + s1 * r_out, -0.06),
            (cx + c1 * r_in, cy + s1 * r_in, -0.06),
            (cx + c0 * r_in, cy + s0 * r_in, -0.06),
        ]
        face(m, pts_front, 'p_pietra_chiara', (0, 0, -1))
        # Bordo esterno
        pts_side = [
            (cx + c0 * r_out, cy + s0 * r_out, 0.0),
            (cx + c1 * r_out, cy + s1 * r_out, 0.0),
            (cx + c1 * r_out, cy + s1 * r_out, -0.06),
            (cx + c0 * r_out, cy + s0 * r_out, -0.06),
        ]
        face(m, pts_side, 'p_pietra_chiara', (c0 + c1, s0 + s1, 0))
    # Quadrante interno bianco
    dial_pts = [(cx + math.cos(2 * math.pi * i / n) * r_in, cy + math.sin(2 * math.pi * i / n) * r_in, -0.04) for i in range(n)]
    face(m, dial_pts, 'p_pietra_chiara', (0, 0, -1))
    # 12 tacche delle ore nere
    for i in range(12):
        ang = 2 * math.pi * i / 12
        tx = cx + math.sin(ang) * 0.18
        ty = cy + math.cos(ang) * 0.18
        m.box(tx - 0.008, ty - 0.008, -0.045, tx + 0.008, ty + 0.008, -0.04, 'p_nero_caldo', skip=('back',))
    # Lancette nere (ore a ore 10, minuti a ore 2)
    beam(m, (cx, cy, -0.047), (cx - 0.07, cy + 0.05, -0.047), 0.016, 0.006, 'p_nero_caldo')
    beam(m, (cx, cy, -0.049), (cx + 0.08, cy + 0.11, -0.049), 0.012, 0.006, 'p_nero_caldo')
    # Lancetta rossa dei secondi a ore 6
    beam(m, (cx, cy, -0.051), (cx, cy - 0.14, -0.051), 0.005, 0.005, 'p_rosso')
    # Perno centrale
    m.box(cx - 0.015, cy - 0.015, -0.055, cx + 0.015, cy + 0.015, -0.04, 'p_nero_caldo')
    # Vetro protettivo
    glass_pts = [(cx + math.cos(2 * math.pi * i / n) * r_in, cy + math.sin(2 * math.pi * i / n) * r_in, -0.062) for i in range(n)]
    face(m, glass_pts, 'vetro', (0, 0, -1))
    return _obj(m, footprint=[W, D])


def mob_specchio_rettangolare_semplice():
    """Specchio rettangolare semplice: cornice minimal in pietra scura, lastra di vetro con clip metalliche e pettine sul bordo."""
    m = Mesh('mob_specchio_rettangolare_semplice')
    W, D = ingombro((1, 1))
    # Bordo / cornice minimal
    m.box(-0.29, 1.51, -0.03, 0.29, 2.39, 0.0, 'p_pietra_scura', skip=('back',))
    # Lastra di vetro a specchio
    m.box(-0.27, 1.53, -0.026, 0.27, 2.37, -0.005, 'vetro', skip=('back',))
    # 4 clip metalliche di supporto
    for sx in (-0.29, 0.26):
        for sy in (1.51, 2.36):
            m.box(sx, sy, -0.035, sx + 0.03, sy + 0.03, -0.02, 'metallo')
    # Riflesso lucido a lama di luce
    beam(m, (-0.18, 1.70, -0.028), (0.14, 2.22, -0.028), 0.035, 0.005, 'p_pietra_chiara', end='p_pietra_chiara')
    beam(m, (-0.10, 1.62, -0.028), (0.05, 1.88, -0.028), 0.020, 0.005, 'p_pietra_chiara', end='p_pietra_chiara')
    # Pettine nero appoggiato sul bordo
    m.box(0.06, 1.52, -0.045, 0.20, 1.56, -0.028, 'p_nero_caldo')
    return _obj(m, footprint=[W, D])


def mob_mensola_singola_in_legno():
    """Mensola singola in legno a parete: ripiano in legno chiaro su staffe in ferro a squadra, con vasetto di succulenta e libri."""
    m = Mesh('mob_mensola_singola_in_legno')
    W, D = ingombro((1, 1))
    # Ripiano in legno chiaro
    m.box(-0.55, 1.80, -0.25, 0.55, 1.84, 0.0, 'p_legno_chiaro', top='tavole', bottom='p_legno_chiaro', skip=('back',))
    # Due staffe in ferro a squadra
    for sx in (-0.38, 0.38):
        m.box(sx - 0.02, 1.76, -0.23, sx + 0.02, 1.80, 0.0, 'ferro', skip=('top', 'back'))
        m.box(sx - 0.02, 1.56, -0.03, sx + 0.02, 1.80, 0.0, 'ferro', skip=('back',))
        beam(m, (sx, 1.58, -0.02), (sx, 1.78, -0.21), 0.03, 0.03, 'ferro', end='ferro')
    # Vasetto in terracotta con pianta succulenta a destra
    m.prism(6, 0.07, 0.09, 1.84, 1.96, 'p_arancio', top='terra', cx=0.30, cz=-0.12)
    m.prism(6, 0.09, 0.03, 1.96, 2.06, 'p_bosco', top='p_erba_chiara', cx=0.30, cz=-0.12)
    # Due libri a sinistra
    m.box(-0.35, 1.84, -0.18, -0.31, 2.06, -0.06, 'p_rosso', top='p_rosso')
    m.box(-0.30, 1.84, -0.18, -0.26, 2.01, -0.06, 'p_acqua', top='p_acqua')
    # Cristallo decorativo al centro
    m.prism(5, 0.04, 0.01, 1.84, 1.91, 'p_pietra_chiara', top='p_pietra_chiara', cx=-0.05, cz=-0.14)
    return _obj(m, footprint=[W, D])


def mob_appendiabiti_da_ingresso_in_legno():
    """Appendiabiti da ingresso in legno a parete: asse in legno, tre ganci dritti in ferro con berretto rosso e sciarpa appesi."""
    m = Mesh('mob_appendiabiti_da_ingresso_in_legno')
    W, D = ingombro((1, 1))
    # Asse in legno orizzontale
    m.box(-0.50, 1.88, -0.04, 0.50, 2.04, 0.0, 'p_legno', top='p_legno_scuro', bottom='p_legno_scuro', skip=('back',))
    m.box(-0.46, 1.94, -0.045, -0.42, 1.98, -0.04, 'metallo')
    m.box(0.42, 1.94, -0.045, 0.46, 1.98, -0.04, 'metallo')
    # Tre ganci dritti in ferro
    for gx in (-0.28, 0.0, 0.28):
        m.box(gx - 0.025, 1.91, -0.045, gx + 0.025, 2.01, -0.04, 'p_nero_caldo')
        m.box(gx - 0.015, 1.94, -0.15, gx + 0.015, 1.98, -0.045, 'p_nero_caldo')
        m.box(gx - 0.015, 1.98, -0.15, gx + 0.015, 2.05, -0.12, 'p_nero_caldo', top='p_nero_caldo')
    # Berretto rosso sul gancio sinistro
    m.prism(6, 0.11, 0.08, 1.88, 2.06, 'p_rosso', top='p_rosso', cx=-0.28, cz=-0.16)
    m.prism(6, 0.16, 0.16, 1.86, 1.89, 'p_rosso', bottom='p_rosso', cx=-0.28, cz=-0.16)
    m.prism(6, 0.115, 0.115, 1.89, 1.93, 'p_nero_caldo', cx=-0.28, cz=-0.16)
    # Sciarpa blu appesa al gancio centrale
    m.box(-0.04, 1.62, -0.14, 0.04, 1.96, -0.11, 'tessuto_blu')
    return _obj(m, footprint=[W, D])


def mob_quadro_con_paesaggio_sereno():
    """Quadro con paesaggio sereno: cornice in legno chiaro, tela a olio con collinetta verde, cielo, alberello e cordicella al muro."""
    m = Mesh('mob_quadro_con_paesaggio_sereno')
    W, D = ingombro((1, 1))
    # Cornice in legno chiaro
    m.box(-0.47, 1.65, -0.05, 0.47, 2.31, 0.0, 'p_legno_chiaro', top='p_legno', bottom='p_legno', skip=('back',))
    # Cielo azzurro sereno
    m.box(-0.425, 1.92, -0.038, 0.425, 2.265, -0.01, 'p_acqua_bassa', skip=('back',))
    # Nuvola bianca soffice
    m.box(-0.25, 2.12, -0.041, -0.05, 2.20, -0.038, 'p_pietra_chiara', skip=('back',))
    m.box(-0.20, 2.20, -0.041, -0.10, 2.24, -0.038, 'p_pietra_chiara', skip=('back',))
    # Sole nell'angolo in alto a destra
    m.prism(6, 0.04, 0.04, 2.15, 2.23, 'p_giallo', top='p_giallo', cx=0.30, cz=-0.04)
    # Collinetta verde in primo piano e collinette di sfondo
    m.box(-0.425, 1.695, -0.039, 0.425, 1.92, -0.01, 'p_erba', skip=('back',))
    m.box(-0.425, 1.92, -0.039, -0.05, 2.04, -0.01, 'p_erba_chiara', skip=('back',))
    m.box(0.08, 1.92, -0.039, 0.425, 1.98, -0.01, 'p_bosco', skip=('back',))
    # Alberello solitario sulla collina
    m.box(-0.26, 2.04, -0.042, -0.24, 2.11, -0.039, 'p_legno_scuro')
    m.prism(6, 0.035, 0.035, 2.11, 2.21, 'p_bosco', top='p_bosco', cx=-0.25, cz=-0.042)
    # Chiodo e cordicella dorata per appenderlo
    m.box(-0.015, 2.37, -0.03, 0.015, 2.40, -0.01, 'metallo', skip=('back',))
    beam(m, (0.0, 2.38, -0.025), (-0.20, 2.31, -0.035), 0.01, 0.005, 'p_giallo')
    beam(m, (0.0, 2.38, -0.025), (0.20, 2.31, -0.035), 0.01, 0.005, 'p_giallo')
    return _obj(m, footprint=[W, D])


def mob_ventaglio_gigante_decorativo():
    """Grande ventaglio orientale da parete aperto a semicerchio: stecche in bambu, tela rossa, accento oro e polvere sopra."""
    m = Mesh('mob_ventaglio_gigante_decorativo')
    W, D = ingombro((1, 1))
    cy = 1.55
    m.cbox(0.0, -0.04, 0.12, 0.08, cy - 0.05, cy + 0.05, 'oro', top='oro')
    beam(m, (0.0, cy - 0.05, -0.04), (0.0, cy - 0.28, -0.04), 0.04, 0.04, 'p_giallo', end='p_giallo')
    angoli = (-70, -50, -30, -10, 10, 30, 50, 70)
    r_stecca = 0.72
    for deg in angoli:
        rad = math.radians(deg)
        tx = math.sin(rad) * r_stecca
        ty = cy + math.cos(rad) * r_stecca
        beam(m, (0.0, cy, -0.03), (tx, ty, -0.03), 0.03, 0.03, 'bambu', end='bambu')
    r_in = 0.28
    r_out = 0.68
    settori = (-70, -50, -30, -10, 10, 30, 50, 70)
    for a0, a1 in zip(settori, settori[1:]):
        rad0, rad1 = math.radians(a0), math.radians(a1)
        p0 = (math.sin(rad0) * r_in, cy + math.cos(rad0) * r_in, -0.04)
        p1 = (math.sin(rad1) * r_in, cy + math.cos(rad1) * r_in, -0.04)
        p2 = (math.sin(rad1) * r_out, cy + math.cos(rad1) * r_out, -0.04)
        p3 = (math.sin(rad0) * r_out, cy + math.cos(rad0) * r_out, -0.04)
        m.poly([p0, p1, p2, p3], 'p_rosso')
        amid = math.radians((a0 + a1) / 2)
        pm_in = (math.sin(amid) * (r_in + 0.05), cy + math.cos(amid) * (r_in + 0.05), -0.06)
        pm_out = (math.sin(amid) * (r_out - 0.05), cy + math.cos(amid) * (r_out - 0.05), -0.06)
        beam(m, pm_in, pm_out, 0.02, 0.02, 'p_arancio', end='p_arancio')
    m.prism(6, 0.12, 0.12, cy + 0.22, cy + 0.26, 'oro', top='oro', cx=0.0, cz=-0.05)
    for a0, a1 in zip(settori, settori[1:]):
        rad0, rad1 = math.radians(a0), math.radians(a1)
        p_a = (math.sin(rad0) * r_out, cy + math.cos(rad0) * r_out, -0.04)
        p_b = (math.sin(rad1) * r_out, cy + math.cos(rad1) * r_out, -0.04)
        beam(m, p_a, p_b, 0.035, 0.02, 'p_pietra_chiara', end='p_pietra_chiara')
    return _obj(m, footprint=[W, D])


def mob_specchio_a_forma_di_cuore_con_cornice_dorata():
    """Specchio a parete a forma di cuore con spessa cornice dorata, superficie riflettente e nastro rosso."""
    m = Mesh('mob_specchio_a_forma_di_cuore_con_cornice_dorata')
    W, D = ingombro((1, 1))
    for sx in (-0.22, 0.22):
        m.prism(8, 0.26, 0.26, 1.95, 2.03, 'oro', top='oro', bottom='oro', cx=sx, cz=-0.04)
        m.prism(8, 0.2, 0.2, 1.96, 2.04, 'p_pietra_chiara', top='p_pietra_chiara', cx=sx, cz=-0.05)
    m.box(-0.35, 1.72, -0.08, 0.35, 1.98, 0.0, 'oro')
    m.box(-0.28, 1.73, -0.09, 0.28, 1.97, -0.01, 'p_pietra_chiara', skip=('back',))
    beam(m, (-0.35, 1.75, -0.04), (0.0, 1.48, -0.04), 0.1, 0.08, 'oro', end='oro')
    beam(m, (0.35, 1.75, -0.04), (0.0, 1.48, -0.04), 0.1, 0.08, 'oro', end='oro')
    face(m, [(-0.26, 1.74, -0.05), (0.26, 1.74, -0.05), (0.0, 1.54, -0.05)], 'p_pietra_chiara', (0, 0, -1))
    m.cbox(0.0, -0.05, 0.14, 0.06, 2.2, 2.28, 'p_rosso', top='p_rosso')
    beam(m, (-0.1, 2.16, -0.05), (0.1, 2.26, -0.05), 0.05, 0.05, 'p_rosso', end='p_rosso')
    beam(m, (0.1, 2.16, -0.05), (-0.1, 2.26, -0.05), 0.05, 0.05, 'p_rosso', end='p_rosso')
    beam(m, (-0.08, 1.95, -0.06), (0.05, 1.78, -0.06), 0.015, 0.015, 'p_nero_caldo')
    beam(m, (0.05, 1.78, -0.06), (0.12, 1.72, -0.06), 0.012, 0.012, 'p_nero_caldo')
    m.box(0.06, 1.82, -0.07, 0.18, 1.94, -0.06, 'p_giallo', skip=('back',))
    return _obj(m, footprint=[W, D])


def mob_orologio_a_cucu_in_legno():
    """Orologio a cucu della Foresta Nera: casetta in legno, tetto spiovente, pesi a pigna e uccellino scattato fuori."""
    m = Mesh('mob_orologio_a_cucu_in_legno')
    W, D = ingombro((1, 1))
    m.box(-0.22, 1.62, -0.22, 0.22, 2.12, 0.0, 'p_legno_scuro', skip=('back',))
    m.box(-0.25, 1.58, -0.24, 0.25, 1.63, 0.0, 'p_legno', skip=('back',))
    roof_y = 2.32
    beam(m, (-0.28, 2.08, -0.12), (0.0, roof_y, -0.12), 0.1, 0.28, 'tavole_scure', end='tavole_scure')
    beam(m, (0.28, 2.08, -0.12), (0.0, roof_y, -0.12), 0.1, 0.28, 'tavole_scure', end='tavole_scure')
    m.prism(8, 0.12, 0.12, 1.74, 1.84, 'p_pietra_chiara', top='p_pietra_chiara', cx=0.0, cz=-0.23)
    m.box(-0.015, 1.79, -0.25, 0.015, 1.89, -0.23, 'p_nero_caldo', skip=('back',))
    m.box(-0.015, 1.78, -0.25, 0.06, 1.81, -0.23, 'p_nero_caldo', skip=('back',))
    for sx in (-0.08, 0.08):
        beam(m, (sx, 1.58, -0.11), (sx, 1.34, -0.11), 0.015, 0.015, 'oro', end='oro')
        m.prism(6, 0.035, 0.01, 1.22, 1.34, 'oro', top='oro', bottom='oro', cx=sx, cz=-0.11)
    beam(m, (0.0, 1.58, -0.06), (0.0, 1.28, -0.06), 0.02, 0.02, 'p_legno')
    m.prism(6, 0.06, 0.06, 1.22, 1.3, 'oro', top='oro', cx=0.0, cz=-0.06)
    m.box(-0.06, 1.95, -0.23, 0.06, 2.08, -0.21, 'p_nero_caldo', skip=('back',))
    m.box(-0.11, 1.95, -0.24, -0.06, 2.08, -0.22, 'p_legno', skip=('back',))
    beam(m, (0.0, 2.0, -0.21), (0.0, 2.01, -0.32), 0.02, 0.02, 'metallo')
    m.cbox(0.0, -0.34, 0.07, 0.08, 1.98, 2.05, 'p_giallo', top='p_giallo')
    m.cone(4, 0.025, 2.0, 2.03, 'p_arancio', cx=0.0, cz=-0.38)
    return _obj(m, footprint=[W, D])


def mob_poster_di_mostro_tascabile():
    """Poster su carta lucida a parete con il dragone verde iconico, nastro adesivo e angolo arricciato."""
    m = Mesh('mob_poster_di_mostro_tascabile')
    W, D = ingombro((1, 1))
    m.box(-0.38, 1.5, -0.015, 0.38, 2.42, 0.0, 'carta', skip=('back',))
    m.box(-0.4, 2.36, -0.022, -0.32, 2.44, -0.014, 'p_sabbia_chiara', skip=('back',))
    m.box(0.32, 2.36, -0.022, 0.4, 2.44, -0.014, 'p_sabbia_chiara', skip=('back',))
    m.box(-0.4, 1.48, -0.022, -0.32, 1.56, -0.014, 'p_sabbia_chiara', skip=('back',))
    m.box(-0.34, 1.54, -0.02, 0.34, 2.38, -0.015, 'p_pietra_chiara', skip=('back',))
    m.cbox(0.0, -0.024, 0.28, 0.01, 1.82, 2.12, 'p_erba', top='p_erba', skip=('back',))
    m.cbox(0.0, -0.026, 0.18, 0.01, 2.08, 2.24, 'p_erba', top='p_erba', skip=('back',))
    m.box(-0.28, 1.95, -0.025, -0.12, 2.22, -0.018, 'p_bosco', skip=('back',))
    m.box(0.12, 1.95, -0.025, 0.28, 2.22, -0.018, 'p_bosco', skip=('back',))
    m.cbox(0.0, -0.028, 0.14, 0.01, 1.84, 2.0, 'p_sabbia_chiara', top='p_sabbia_chiara', skip=('back',))
    beam(m, (0.08, 2.14, -0.028), (0.24, 2.18, -0.028), 0.05, 0.04, 'p_rosso', end='p_giallo')
    face(m, [(0.26, 1.5, 0.0), (0.38, 1.62, 0.0), (0.32, 1.58, -0.06)], 'carta', (0, 0, -1))
    return _obj(m, footprint=[W, D])


def mob_condizionatore_d_aria():
    """Unita split interna di condizionatore bianco da parete, griglia, aletta aperta e stalattiti di ghiaccio."""
    m = Mesh('mob_condizionatore_d_aria')
    W, D = ingombro((1, 1))
    m.box(-0.58, 2.18, -0.32, 0.58, 2.58, 0.0, 'p_pietra_chiara', skip=('back',))
    m.box(-0.54, 2.56, -0.28, 0.54, 2.6, -0.04, 'p_pietra_scura', top='p_pietra_scura')
    m.box(-0.52, 2.2, -0.28, 0.52, 2.26, -0.06, 'p_nero_caldo', skip=('top', 'back'))
    beam(m, (-0.52, 2.21, -0.26), (0.52, 2.21, -0.26), 0.08, 0.02, 'p_pietra_chiara', end='p_pietra_chiara')
    m.cbox(0.38, -0.325, 0.12, 0.01, 2.34, 2.44, 'em_neon_ciano', top='em_neon_ciano', skip=('back',))
    m.cbox(0.48, -0.325, 0.025, 0.01, 2.36, 2.385, 'p_verde_neon', top='p_verde_neon', skip=('back',))
    for x in (-0.42, -0.22, 0.0, 0.18):
        m.cone(4, 0.03, 2.2, 2.06, 'cristallo', cx=x, cz=-0.26)
    return _obj(m, footprint=[W, D])


def mob_mensola_con_action_figures():
    """Mensola da parete in legno con staffe in ferro e tre action figures di plastica esposte con basetta."""
    m = Mesh('mob_mensola_con_action_figures')
    W, D = ingombro((1, 1))
    m.box(-0.62, 1.78, -0.3, 0.62, 1.84, 0.0, 'p_legno_chiaro', top='p_legno_chiaro', skip=('back',))
    for sx in (-0.44, 0.44):
        beam(m, (sx, 1.78, 0.0), (sx, 1.54, 0.0), 0.04, 0.04, 'p_nero_caldo', end='p_nero_caldo')
        beam(m, (sx, 1.78, -0.26), (sx, 1.78, 0.0), 0.04, 0.04, 'p_nero_caldo', end='p_nero_caldo')
        beam(m, (sx, 1.56, -0.02), (sx, 1.78, -0.24), 0.03, 0.03, 'p_nero_caldo', end='p_nero_caldo')
    m.prism(6, 0.05, 0.05, 1.84, 1.86, 'p_nero_caldo', top='p_nero_caldo', cx=-0.36, cz=-0.16)
    m.cbox(-0.36, -0.16, 0.09, 0.06, 1.86, 2.02, 'p_rosso', top='p_rosso')
    m.cbox(-0.36, -0.16, 0.07, 0.07, 2.02, 2.1, 'p_giallo', top='p_giallo')
    m.box(-0.41, 1.88, -0.13, -0.31, 2.04, -0.11, 'p_acqua_profonda', skip=('front',))
    m.prism(6, 0.055, 0.055, 1.84, 1.86, 'p_nero_caldo', top='p_nero_caldo', cx=0.0, cz=-0.16)
    m.cbox(0.0, -0.16, 0.1, 0.07, 1.86, 2.04, 'p_bosco', top='p_bosco')
    m.cbox(0.0, -0.16, 0.07, 0.07, 2.04, 2.12, 'p_nero_caldo', top='oro')
    m.box(-0.08, 1.98, -0.17, 0.08, 2.06, -0.15, 'oro')
    m.prism(6, 0.05, 0.05, 1.84, 1.86, 'p_nero_caldo', top='p_nero_caldo', cx=0.36, cz=-0.16)
    m.cbox(0.36, -0.16, 0.08, 0.06, 1.86, 2.0, 'p_viola', top='p_viola')
    m.cone(4, 0.06, 2.0, 2.14, 'p_viola', cx=0.36, cz=-0.16)
    m.box(0.46, 1.84, -0.24, 0.58, 2.08, -0.1, 'carta', top='p_arancio', skip=('back',))
    m.box(0.48, 1.86, -0.25, 0.56, 1.94, -0.23, 'p_giallo', skip=('back',))
    return _obj(m, footprint=[W, D])


def mob_gagliardetto_calcistico_biancorosso():
    """Gagliardetto calcistico biancorosso a punta: asta dorata, cordone di sospensione, strisce bicolore e frange."""
    m = Mesh('mob_gagliardetto_calcistico_biancorosso')
    W, D = ingombro((1, 1))
    beam(m, (-0.28, 2.22, -0.04), (0.28, 2.22, -0.04), 0.03, 0.03, 'oro', end='oro')
    for sx in (-0.3, 0.3):
        m.prism(6, 0.028, 0.028, 2.205, 2.235, 'oro', top='oro', cx=sx, cz=-0.04)
    beam(m, (-0.26, 2.23, -0.03), (0.0, 2.42, -0.03), 0.015, 0.015, 'fune_bandierine')
    beam(m, (0.26, 2.23, -0.03), (0.0, 2.42, -0.03), 0.015, 0.015, 'fune_bandierine')
    m.cbox(0.0, -0.03, 0.03, 0.03, 2.41, 2.44, 'ferro', top='ferro')
    strisce = ((-0.25, -0.15, 'p_rosso'), (-0.15, -0.05, 'p_pietra_chiara'),
               (-0.05, 0.05, 'p_rosso'), (0.05, 0.15, 'p_pietra_chiara'), (0.15, 0.25, 'p_rosso'))
    for x0, x1, col in strisce:
        m.box(x0, 1.85, -0.03, x1, 2.21, -0.01, col, skip=('back',))
    face(m, [(-0.25, 1.85, -0.02), (0.0, 1.85, -0.02), (0.0, 1.52, -0.02)], 'p_rosso', (0, 0, -1))
    face(m, [(0.0, 1.85, -0.02), (0.25, 1.85, -0.02), (0.0, 1.52, -0.02)], 'p_pietra_chiara', (0, 0, -1))
    beam(m, (-0.26, 1.86, -0.025), (0.0, 1.51, -0.025), 0.03, 0.02, 'oro', end='oro')
    beam(m, (0.26, 1.86, -0.025), (0.0, 1.51, -0.025), 0.03, 0.02, 'oro', end='oro')
    m.cone(4, 0.03, 1.51, 1.42, 'oro', cx=0.0, cz=-0.025)
    beam(m, (-0.24, 2.18, -0.035), (-0.08, 2.22, -0.035), 0.03, 0.015, 'p_nero_caldo')
    return _obj(m, footprint=[W, D])


def mob_insegna_al_neon_open():
    """Insegna luminosa al neon da parete 'OPEN': telaio nero, ovale ciano neon e scritta in rosa neon brillante."""
    m = Mesh('mob_insegna_al_neon_open')
    W, D = ingombro((1, 1))
    m.box(-0.48, 1.76, -0.03, 0.48, 2.24, 0.0, 'p_nero_caldo', skip=('back',))
    m.box(0.38, 1.62, -0.08, 0.54, 1.8, -0.01, 'ferro', top='ferro')
    pts = [(-0.42, 1.86), (-0.42, 2.14), (-0.2, 2.26), (0.2, 2.26),
           (0.42, 2.14), (0.42, 1.86), (0.2, 1.74), (-0.2, 1.74)]
    for p0, p1 in zip(pts, pts[1:] + [pts[0]]):
        beam(m, (p0[0], p0[1], -0.05), (p1[0], p1[1], -0.05), 0.03, 0.03, 'em_neon_ciano', end='em_neon_ciano')
    m.box(-0.34, 1.88, -0.065, -0.2, 2.12, -0.045, 'em_neon_rosa')
    m.box(-0.3, 1.93, -0.07, -0.24, 2.07, -0.04, 'p_nero_caldo')
    m.box(-0.16, 1.88, -0.065, -0.12, 2.12, -0.045, 'em_neon_rosa')
    m.box(-0.12, 2.0, -0.065, -0.04, 2.12, -0.045, 'em_neon_rosa')
    m.box(-0.1, 2.03, -0.07, -0.06, 2.09, -0.04, 'p_nero_caldo')
    m.box(0.01, 1.88, -0.065, 0.05, 2.12, -0.045, 'em_neon_rosa')
    for y in (1.88, 1.98, 2.08):
        m.box(0.05, y, -0.065, 0.13, y + 0.04, -0.045, 'em_neon_rosa')
    m.box(0.18, 1.88, -0.065, 0.22, 2.12, -0.045, 'em_neon_rosa')
    m.box(0.28, 1.88, -0.065, 0.32, 2.12, -0.045, 'em_neon_rosa')
    beam(m, (0.2, 2.1, -0.055), (0.3, 1.9, -0.055), 0.035, 0.03, 'em_neon_rosa')
    m.cbox(0.46, -0.085, 0.04, 0.01, 1.74, 1.78, 'em_neon_rosso', top='em_neon_rosso')
    beam(m, (0.46, 1.62, -0.04), (0.46, 1.25, -0.02), 0.02, 0.02, 'p_nero_caldo')
    return _obj(m, footprint=[W, D])


def mob_quadro_notte_stellata():
    """Grande quadro a parete: cornice in legno dorato modanata, cielo blu con vortici, luna crescente e cipresso."""
    m = Mesh('mob_quadro_notte_stellata')
    W, D = ingombro((1, 1))
    beam(m, (-0.6, 1.62, -0.04), (0.6, 1.62, -0.04), 0.09, 0.09, 'oro', end='oro')
    beam(m, (-0.6, 2.38, -0.04), (0.6, 2.38, -0.04), 0.09, 0.09, 'oro', end='oro')
    beam(m, (-0.56, 1.62, -0.04), (-0.56, 2.38, -0.04), 0.09, 0.09, 'oro', end='oro')
    beam(m, (0.56, 1.62, -0.04), (0.56, 2.38, -0.04), 0.09, 0.09, 'oro', end='oro')
    m.box(-0.52, 1.66, -0.03, 0.52, 2.34, 0.0, 'p_acqua_profonda', skip=('back',))
    m.box(-0.52, 1.66, -0.035, 0.52, 1.82, -0.028, 'p_bosco', skip=('back',))
    m.cone(4, 0.12, 1.68, 2.22, 'p_nero_caldo', cx=-0.34, cz=-0.04)
    m.cone(4, 0.08, 1.84, 2.3, 'p_bosco', cx=-0.34, cz=-0.042)
    m.prism(6, 0.09, 0.09, 2.12, 2.28, 'p_giallo', top='p_giallo', cx=0.34, cz=-0.038)
    m.prism(6, 0.07, 0.07, 2.14, 2.26, 'p_acqua_profonda', top='p_acqua_profonda', cx=0.31, cz=-0.04)
    for sx, sy in [(-0.1, 2.18), (0.1, 2.12), (0.24, 2.24), (-0.02, 1.98), (0.28, 1.94)]:
        m.cbox(sx, -0.038, 0.04, 0.01, sy - 0.02, sy + 0.02, 'p_giallo', top='p_giallo', skip=('back',))
    beam(m, (-0.2, 2.04, -0.036), (0.18, 2.08, -0.036), 0.035, 0.025, 'p_acqua')
    m.cbox(0.0, -0.065, 0.22, 0.01, 1.6, 1.64, 'oro', top='oro', skip=('back',))
    return _obj(m, footprint=[W, D])


def mob_spada_bastarda_incrociata_con_scudo():
    """Panoplia da parete medievale: scudo araldico in ferro e oro con spada bastarda incrociata e cartellino della fiera."""
    m = Mesh('mob_spada_bastarda_incrociata_con_scudo')
    W, D = ingombro((1, 1))
    m.box(-0.35, 1.6, -0.04, 0.35, 2.25, 0.0, 'p_legno_scuro', skip=('back',))
    p_punta = (-0.42, 1.48, -0.05)
    p_guardia = (0.24, 2.14, -0.05)
    beam(m, p_punta, p_guardia, 0.06, 0.02, 'lama', end='lama')
    p_g0 = (0.24 - 0.12, 2.14 + 0.12, -0.05)
    p_g1 = (0.24 + 0.12, 2.14 - 0.12, -0.05)
    beam(m, p_g0, p_g1, 0.04, 0.03, 'oro', end='oro')
    p_pomolo = (0.38, 2.28, -0.05)
    beam(m, p_guardia, p_pomolo, 0.035, 0.03, 'cuoio', end='cuoio')
    m.prism(6, 0.035, 0.035, 2.26, 2.31, 'oro', top='oro', cx=p_pomolo[0], cz=p_pomolo[2])
    m.box(-0.28, 1.82, -0.11, 0.28, 2.18, -0.06, 'ferro', skip=('back',))
    face(m, [(-0.28, 1.82, -0.1), (0.28, 1.82, -0.1), (0.0, 1.54, -0.1)], 'ferro', (0, 0, -1))
    beam(m, (-0.28, 2.18, -0.11), (0.28, 2.18, -0.11), 0.04, 0.04, 'oro', end='oro')
    beam(m, (-0.28, 1.82, -0.11), (0.0, 1.54, -0.11), 0.04, 0.04, 'oro', end='oro')
    beam(m, (0.28, 1.82, -0.11), (0.0, 1.54, -0.11), 0.04, 0.04, 'oro', end='oro')
    m.cbox(0.0, -0.115, 0.34, 0.01, 1.94, 2.02, 'p_rosso', top='p_rosso', skip=('back',))
    m.cbox(0.0, -0.115, 0.08, 0.01, 1.76, 2.14, 'p_rosso', top='p_rosso', skip=('back',))
    beam(m, (0.26, 2.12, -0.05), (0.28, 2.04, -0.06), 0.01, 0.01, 'fune_bandierine')
    m.box(0.24, 1.96, -0.07, 0.32, 2.04, -0.06, 'carta', skip=('back',))
    return _obj(m, footprint=[W, D])


def mob_targa_stradale_via_rossi():
    """Targa stradale blu 'Via Rossi' rubata (parete): targa metallica leggermente storta, bordo bianco, simbolo di vicolo cieco e fori dei bulloni forzati."""
    m = Mesh('mob_targa_stradale_via_rossi')
    W, D = ingombro((1, 1))
    m.push(Xf(r=(0, 0, 2.5)))
    m.box(-0.46, 1.85, -0.03, 0.46, 2.18, 0.0, 'p_acqua_profonda', top='p_acqua_profonda', skip=('back',))
    for sx in (-0.45, 0.43):
        m.box(sx, 1.86, -0.035, sx + 0.02, 2.17, -0.03, 'p_pietra_chiara', skip=('back',))
    for sy in (1.86, 2.15):
        m.box(-0.45, sy, -0.035, 0.45, sy + 0.02, -0.03, 'p_pietra_chiara', skip=('back',))
    m.box(-0.34, 1.98, -0.036, -0.16, 2.06, -0.03, 'p_pietra_chiara', skip=('back',))
    m.box(-0.10, 1.98, -0.036, 0.16, 2.06, -0.03, 'p_pietra_chiara', skip=('back',))
    m.box(0.24, 1.92, -0.038, 0.38, 2.10, -0.03, 'p_nero_caldo', skip=('back',))
    m.box(0.295, 1.94, -0.042, 0.325, 2.05, -0.038, 'p_pietra_chiara', skip=('back',))
    m.box(0.265, 2.04, -0.044, 0.355, 2.08, -0.038, 'p_rosso', skip=('back',))
    for bx in (-0.42, 0.42):
        for by in (1.89, 2.14):
            m.box(bx - 0.015, by - 0.015, -0.04, bx + 0.015, by + 0.015, -0.03, 'ferro', skip=('back',))
    m.box(0.40, 2.12, -0.042, 0.46, 2.18, -0.028, 'ferro', skip=('back',))
    m.pop()
    return _obj(m, footprint=[W, D])


def mob_orologio_da_stazione_con_doppio_quadrante():
    """Orologio da stazione con doppio quadrante a sbalzo (parete): staffa in ferro battuto, cassa cilindrica con due orari diversi sui due lati."""
    m = Mesh('mob_orologio_da_stazione_con_doppio_quadrante')
    W, D = ingombro((1, 1))
    m.box(-0.06, 1.7, -0.03, 0.06, 2.3, 0.0, 'ferro', skip=('back',))
    beam(m, (0.0, 2.2, -0.02), (0.0, 2.2, -0.38), 0.04, 0.04, 'ferro', end='ferro')
    beam(m, (0.0, 1.8, -0.02), (0.0, 2.2, -0.32), 0.03, 0.03, 'ferro')
    beam(m, (0.0, 2.2, -0.38), (0.0, 2.08, -0.38), 0.04, 0.04, 'ferro', end='ferro')
    cz = -0.38
    m.box(-0.09, 1.82, cz - 0.22, 0.09, 2.08, cz + 0.22, 'p_nero_caldo', top='p_nero_caldo')
    m.box(-0.09, 1.76, cz - 0.16, 0.09, 2.14, cz + 0.16, 'p_nero_caldo', top='p_nero_caldo')
    for sx in (-1, 1):
        x_face = sx * 0.095
        m.box(x_face - 0.005 if sx < 0 else x_face, 1.85, cz - 0.18, x_face if sx < 0 else x_face + 0.005, 2.05, cz + 0.18, 'p_pietra_chiara')
        m.box(x_face - 0.005 if sx < 0 else x_face, 1.80, cz - 0.13, x_face if sx < 0 else x_face + 0.005, 2.10, cz + 0.13, 'p_pietra_chiara')
        m.box(x_face - 0.012 if sx < 0 else x_face, 1.935, cz - 0.015, x_face if sx < 0 else x_face + 0.012, 1.965, cz + 0.015, 'ferro')
    m.box(-0.11, 1.95, cz - 0.08, -0.095, 2.04, cz - 0.06, 'p_nero_caldo')
    m.box(-0.11, 1.95, cz + 0.06, -0.095, 2.03, cz + 0.08, 'p_nero_caldo')
    m.box(-0.112, 1.87, cz - 0.01, -0.095, 1.95, cz + 0.01, 'p_rosso')
    m.box(0.095, 1.84, cz - 0.015, 0.11, 1.95, cz + 0.015, 'p_nero_caldo')
    m.box(0.095, 1.82, cz + 0.01, 0.11, 1.95, cz + 0.03, 'p_nero_caldo')
    m.box(0.095, 1.95, cz - 0.01, 0.112, 2.05, cz + 0.01, 'p_rosso')
    return _obj(m, footprint=[W, D])


def mob_poster_di_un_film_inesistente():
    """Poster di un film inesistente (parete): sfondo scuro con eroe solitario, enorme esplosione arancione, data sbagliata e nastro adesivo agli angoli."""
    m = Mesh('mob_poster_di_un_film_inesistente')
    W, D = ingombro((1, 1))
    m.box(-0.35, 1.45, -0.015, 0.35, 2.45, 0.0, 'carta', top='carta', skip=('back',))
    m.box(-0.33, 1.47, -0.018, 0.33, 2.43, -0.015, 'p_acqua_profonda', skip=('back',))
    m.cbox(0.0, -0.021, 0.42, 0.005, 1.95, 2.25, 'p_arancio', skip=('back',))
    m.cbox(0.0, -0.024, 0.26, 0.005, 2.02, 2.18, 'p_giallo', skip=('back',))
    m.cbox(0.0, -0.027, 0.12, 0.005, 2.06, 2.14, 'p_pietra_chiara', skip=('back',))
    m.box(-0.06, 1.62, -0.025, 0.06, 1.92, -0.018, 'p_nero_caldo', skip=('back',))
    m.box(-0.04, 1.92, -0.025, 0.04, 1.99, -0.018, 'p_nero_caldo', skip=('back',))
    m.box(-0.05, 1.52, -0.025, -0.01, 1.62, -0.018, 'p_nero_caldo', skip=('back',))
    m.box(0.01, 1.52, -0.025, 0.05, 1.62, -0.018, 'p_nero_caldo', skip=('back',))
    m.box(-0.28, 2.30, -0.022, 0.28, 2.38, -0.018, 'p_giallo', skip=('back',))
    m.box(-0.24, 1.50, -0.022, 0.24, 1.55, -0.018, 'p_rosso', skip=('back',))
    m.box(-0.16, 1.51, -0.025, 0.16, 1.54, -0.021, 'p_pietra_chiara', skip=('back',))
    for sx in (-0.32, 0.26):
        for sy in (1.46, 2.40):
            m.box(sx, sy, -0.025, sx + 0.06, sy + 0.03, -0.014, 'p_sabbia_chiara', skip=('back',))
    return _obj(m, footprint=[W, D])


def mob_cornice_con_foto_di_un_pesce_rosso():
    """Cornice con foto di un pesce rosso (parete): quadro in legno con chiodo e filo, foto del pesce rosso che ti giudica con l'occhio spalancato."""
    m = Mesh('mob_cornice_con_foto_di_un_pesce_rosso')
    W, D = ingombro((1, 1))
    m.box(-0.015, 2.22, -0.025, 0.015, 2.24, 0.0, 'ferro', skip=('back',))
    beam(m, (0.0, 2.23, -0.02), (-0.22, 2.08, -0.02), 0.012, 0.012, 'p_nero_caldo')
    beam(m, (0.0, 2.23, -0.02), (0.22, 2.08, -0.02), 0.012, 0.012, 'p_nero_caldo')
    m.cbox(0.0, -0.02, 0.54, 0.04, 1.66, 2.10, 'p_legno', top='p_legno', skip=('back',))
    m.cbox(0.0, -0.024, 0.44, 0.035, 1.72, 2.04, 'p_pietra_chiara', skip=('back',))
    m.cbox(0.0, -0.026, 0.36, 0.03, 1.76, 2.00, 'p_acqua_bassa', skip=('back',))
    m.cbox(0.02, -0.030, 0.18, 0.02, 1.84, 1.93, 'p_arancio', skip=('back',))
    m.box(0.11, 1.82, -0.030, 0.16, 1.95, -0.025, 'p_giallo', skip=('back',))
    m.box(0.01, 1.93, -0.030, 0.06, 1.97, -0.025, 'p_giallo', skip=('back',))
    beam(m, (-0.04, 1.88, -0.030), (-0.04, 1.88, -0.033), 0.06, 0.06, 'p_pietra_chiara', end='p_pietra_chiara', n=6)
    beam(m, (-0.045, 1.88, -0.032), (-0.045, 1.88, -0.035), 0.03, 0.03, 'p_nero_caldo', end='p_nero_caldo', n=6)
    m.box(-0.12, 1.76, -0.029, -0.08, 1.85, -0.025, 'p_erba', skip=('back',))
    beam(m, (-0.08, 1.95, -0.028), (-0.08, 1.95, -0.030), 0.024, 0.024, 'vetro', end='vetro', n=6)
    return _obj(m, footprint=[W, D])


def mob_mensola_con_barattoli_di_conserve():
    """Mensola con barattoli di conserve (parete): ripiano in legno su staffe in ferro, tre barattoli normali e uno col liquido verde misterioso che si muove."""
    m = Mesh('mob_mensola_con_barattoli_di_conserve')
    W, D = ingombro((1, 1))
    for sx in (-0.36, 0.36):
        m.box(sx - 0.02, 1.55, -0.03, sx + 0.02, 1.80, 0.0, 'ferro', skip=('back',))
        m.box(sx - 0.02, 1.78, -0.22, sx + 0.02, 1.80, 0.0, 'ferro', skip=('back',))
        beam(m, (sx, 1.57, -0.02), (sx, 1.78, -0.20), 0.025, 0.025, 'ferro')
    m.cbox(0.0, -0.125, 1.05, 0.25, 1.80, 1.84, 'p_legno_chiaro', top='p_legno')
    m.prism(6, 0.07, 0.07, 1.84, 2.02, 'vetro', bottom='p_rosso', cx=-0.35, cz=-0.12)
    m.prism(6, 0.06, 0.06, 1.85, 1.99, 'p_rosso', top='p_rosso', cx=-0.35, cz=-0.12)
    m.prism(6, 0.075, 0.08, 2.01, 2.04, 'tessuto_rosso', top='tessuto_rosso', cx=-0.35, cz=-0.12)
    m.prism(6, 0.065, 0.065, 1.84, 2.05, 'vetro', bottom='p_giallo', cx=-0.12, cz=-0.13)
    m.prism(6, 0.055, 0.055, 1.85, 2.01, 'p_giallo', top='p_giallo', cx=-0.12, cz=-0.13)
    m.prism(6, 0.068, 0.068, 2.04, 2.06, 'ferro', top='ferro', cx=-0.12, cz=-0.13)
    m.prism(6, 0.075, 0.075, 1.84, 2.08, 'vetro', bottom='p_bosco', cx=0.13, cz=-0.12)
    m.prism(6, 0.065, 0.065, 1.85, 2.02, 'p_verde_neon', top='p_verde_neon', cx=0.13, cz=-0.12)
    m.box(0.11, 1.90, -0.14, 0.16, 2.04, -0.10, 'p_bosco', top='p_bosco')
    m.prism(5, 0.02, 0.02, 2.02, 2.06, 'p_erba_chiara', top='p_verde_neon', cx=0.14, cz=-0.11)
    m.prism(6, 0.078, 0.078, 2.07, 2.10, 'p_nero_caldo', top='p_nero_caldo', cx=0.13, cz=-0.12)
    m.prism(6, 0.06, 0.06, 1.84, 1.98, 'vetro', bottom='p_viola', cx=0.34, cz=-0.12)
    m.prism(6, 0.05, 0.05, 1.85, 1.95, 'p_viola', top='p_viola', cx=0.34, cz=-0.12)
    m.prism(6, 0.062, 0.062, 1.97, 2.00, 'p_sabbia', top='p_sabbia', cx=0.34, cz=-0.12)
    return _obj(m, footprint=[W, D])


def mob_arazzo_con_paesaggio_montano():
    """Arazzo con paesaggio montano (parete): asta in legno con pomelli d'oro, tessuto intessuto con tramonto, baita e cervo, angolo sollevato con crepa e segreto."""
    m = Mesh('mob_arazzo_con_paesaggio_montano')
    W, D = ingombro((1, 1))
    beam(m, (0.0, 2.45, -0.03), (-0.48, 2.28, -0.03), 0.015, 0.015, 'corda')
    beam(m, (0.0, 2.45, -0.03), (0.48, 2.28, -0.03), 0.015, 0.015, 'corda')
    m.box(-0.54, 2.26, -0.04, 0.54, 2.30, -0.02, 'p_legno_scuro', top='p_legno_scuro')
    for sx in (-0.56, 0.54):
        m.box(sx, 2.25, -0.045, sx + 0.02, 2.31, -0.015, 'oro', top='oro')
    m.box(-0.47, 2.05, -0.025, 0.47, 2.25, -0.01, 'p_arancio', skip=('back',))
    m.box(-0.35, 2.12, -0.028, 0.35, 2.22, -0.024, 'p_giallo', skip=('back',))
    m.box(-0.47, 1.78, -0.025, 0.47, 2.05, -0.01, 'p_pietra_scura', skip=('back',))
    for mx in (-0.28, 0.05, 0.32):
        m.box(mx - 0.08, 1.95, -0.028, mx + 0.08, 2.05, -0.024, 'p_pietra_chiara', skip=('back',))
        m.box(mx - 0.04, 2.05, -0.028, mx + 0.04, 2.12, -0.024, 'p_pietra_chiara', skip=('back',))
    m.box(-0.47, 1.48, -0.025, 0.47, 1.78, -0.01, 'p_bosco', skip=('back',))
    m.box(-0.30, 1.54, -0.030, -0.16, 1.66, -0.024, 'p_legno', skip=('back',))
    m.box(-0.32, 1.66, -0.032, -0.14, 1.72, -0.024, 'p_rosso', skip=('back',))
    m.box(0.18, 1.54, -0.029, 0.28, 1.68, -0.024, 'p_legno_scuro', skip=('back',))
    m.box(0.24, 1.68, -0.030, 0.30, 1.75, -0.024, 'p_legno_scuro', skip=('back',))
    m.box(0.26, 1.75, -0.032, 0.32, 1.80, -0.024, 'p_giallo', skip=('back',))
    m.box(-0.47, 1.40, -0.025, 0.30, 1.48, -0.01, 'p_sabbia', skip=('back',))
    m.box(0.30, 1.40, -0.005, 0.47, 1.52, 0.0, 'p_pietra_chiara', skip=('back',))
    m.box(0.35, 1.43, -0.008, 0.38, 1.50, -0.002, 'p_nero_caldo', skip=('back',))
    m.box(0.40, 1.44, -0.012, 0.43, 1.48, -0.003, 'oro', skip=('back',))
    m.box(0.30, 1.48, -0.05, 0.47, 1.54, -0.025, 'p_sabbia', top='p_bosco')
    return _obj(m, footprint=[W, D])


def mob_bersaglio_da_freccette_storto():
    """Bersaglio da freccette storto (parete): bersaglio inclinato con mobiletto in legno, vuoto al centro, con tre freccette conficcate nel muro accanto."""
    m = Mesh('mob_bersaglio_da_freccette_storto')
    W, D = ingombro((1, 1))
    m.push(Xf(t=(-0.12, 1.90, 0.0), r=(0, 0, -11.0)))
    m.box(-0.31, -0.32, -0.04, 0.31, 0.32, 0.0, 'p_legno_scuro', skip=('back',))
    m.box(-0.46, -0.30, -0.05, -0.31, 0.30, -0.01, 'p_legno', skip=('back',))
    m.box(0.31, -0.30, -0.05, 0.46, 0.30, -0.01, 'p_legno', skip=('back',))
    beam(m, (0.0, 0.0, -0.02), (0.0, 0.0, -0.05), 0.50, 0.50, 'p_nero_caldo', end='p_nero_caldo', n=8)
    beam(m, (0.0, 0.0, -0.048), (0.0, 0.0, -0.052), 0.44, 0.44, 'p_pietra_chiara', end='p_pietra_chiara', n=8)
    beam(m, (0.0, 0.0, -0.050), (0.0, 0.0, -0.054), 0.32, 0.32, 'p_rosso', end='p_rosso', n=8)
    beam(m, (0.0, 0.0, -0.052), (0.0, 0.0, -0.056), 0.22, 0.22, 'p_erba', end='p_erba', n=8)
    beam(m, (0.0, 0.0, -0.054), (0.0, 0.0, -0.058), 0.08, 0.08, 'p_erba', end='p_erba', n=6)
    beam(m, (0.0, 0.0, -0.056), (0.0, 0.0, -0.060), 0.04, 0.04, 'p_rosso', end='p_rosso', n=6)
    m.pop()
    beam(m, (0.32, 2.08, 0.0), (0.35, 2.09, -0.16), 0.012, 0.012, 'ferro')
    m.box(0.33, 2.07, -0.22, 0.37, 2.11, -0.16, 'p_rosso')
    beam(m, (0.38, 1.86, 0.0), (0.42, 1.83, -0.17), 0.012, 0.012, 'ferro')
    m.box(0.40, 1.81, -0.23, 0.44, 1.85, -0.17, 'p_giallo')
    beam(m, (0.28, 1.65, 0.0), (0.30, 1.67, -0.15), 0.012, 0.012, 'ferro')
    m.box(0.29, 1.65, -0.21, 0.32, 1.69, -0.15, 'p_rosso')
    return _obj(m, footprint=[W, D])


def mob_tabellone_da_biliardo_con_gessetti():
    """Tabellone da biliardo con gessetti (parete): segnapunti in mogano con aste in ottone, dischetti scorrevoli, lavagnetta coi punti e tre cubetti di gesso blu."""
    m = Mesh('mob_tabellone_da_biliardo_con_gessetti')
    W, D = ingombro((1, 1))
    m.box(-0.44, 1.65, -0.04, 0.44, 2.27, 0.0, 'p_legno_scuro', top='p_legno_scuro', skip=('back',))
    for sx in (-0.21, 0.21):
        m.box(sx - 0.18, 1.73, -0.045, sx + 0.18, 2.19, -0.02, 'p_roccia', skip=('back',))
    for y in (1.85, 2.05):
        beam(m, (-0.38, y, -0.045), (0.38, y, -0.045), 0.014, 0.014, 'oro', end='oro')
    for i, x in enumerate((-0.34, -0.28, -0.22, 0.16, 0.22, 0.28, 0.34)):
        col = 'p_pietra_chiara' if i < 3 else 'p_rosso'
        m.box(x - 0.015, 1.83, -0.06, x + 0.015, 1.87, -0.03, col)
    for i, x in enumerate((-0.32, -0.26, 0.12, 0.18, 0.24, 0.30)):
        col = 'p_pietra_chiara' if i < 2 else 'p_rosso'
        m.box(x - 0.015, 2.03, -0.06, x + 0.015, 2.07, -0.03, col)
    m.box(-0.32, 2.10, -0.048, -0.18, 2.16, -0.042, 'p_pietra_chiara', skip=('back',))
    m.box(0.12, 2.10, -0.048, 0.26, 2.16, -0.042, 'p_pietra_chiara', skip=('back',))
    m.box(-0.41, 1.65, -0.10, 0.41, 1.69, -0.02, 'p_legno', top='p_legno_chiaro')
    for gx in (-0.18, 0.02, 0.22):
        m.box(gx - 0.022, 1.69, -0.088, gx + 0.022, 1.735, -0.042, 'p_acqua_profonda', top='p_acqua')
        m.box(gx - 0.024, 1.69, -0.090, gx + 0.024, 1.705, -0.040, 'p_pietra_chiara')
        beam(m, (gx, 1.734, -0.065), (gx, 1.737, -0.065), 0.02, 0.02, 'p_pietra_chiara', end='p_pietra_chiara', n=6)
    return _obj(m, footprint=[W, D])


def mob_insegna_vietato_lingresso_ai_venditori():
    """Insegna 'Vietato l'ingresso ai venditori' (parete): targa smaltata con bordo e cerchio di divieto rosso, sagoma del venditore con valigetta, e volantino promozionale incastrato."""
    m = Mesh('mob_insegna_vietato_lingresso_ai_venditori')
    W, D = ingombro((1, 1))
    m.box(-0.36, 1.75, -0.025, 0.36, 2.21, 0.0, 'p_pietra_chiara', top='p_pietra_chiara', skip=('back',))
    for sx in (-0.35, 0.33):
        m.box(sx, 1.76, -0.03, sx + 0.02, 2.20, -0.025, 'p_rosso', skip=('back',))
    for sy in (1.76, 2.18):
        m.box(-0.35, sy, -0.03, 0.35, sy + 0.02, -0.025, 'p_rosso', skip=('back',))
    beam(m, (-0.17, 1.98, -0.026), (-0.17, 1.98, -0.032), 0.24, 0.24, 'p_rosso', end='p_rosso', n=8)
    beam(m, (-0.17, 1.98, -0.031), (-0.17, 1.98, -0.035), 0.18, 0.18, 'p_pietra_chiara', end='p_pietra_chiara', n=8)
    beam(m, (-0.23, 1.92, -0.037), (-0.11, 2.04, -0.037), 0.025, 0.025, 'p_rosso')
    m.box(-0.19, 1.92, -0.036, -0.15, 2.03, -0.034, 'p_nero_caldo', skip=('back',))
    m.box(-0.18, 2.03, -0.036, -0.16, 2.07, -0.034, 'p_nero_caldo', skip=('back',))
    m.box(-0.23, 1.89, -0.036, -0.19, 1.94, -0.034, 'p_nero_caldo', skip=('back',))
    m.box(0.01, 2.08, -0.03, 0.31, 2.13, -0.025, 'p_nero_caldo', skip=('back',))
    m.box(0.01, 1.99, -0.03, 0.28, 2.04, -0.025, 'p_nero_caldo', skip=('back',))
    m.box(0.01, 1.90, -0.03, 0.32, 1.95, -0.025, 'p_rosso', skip=('back',))
    for vx in (-0.33, 0.33):
        for vy in (1.78, 2.18):
            m.box(vx - 0.012, vy - 0.012, -0.032, vx + 0.012, vy + 0.012, -0.025, 'ferro', skip=('back',))
    m.box(0.24, 2.12, -0.04, 0.39, 2.27, -0.022, 'p_giallo', skip=('back',))
    m.box(0.26, 2.15, -0.042, 0.37, 2.24, -0.039, 'p_arancio', skip=('back',))
    return _obj(m, footprint=[W, D])


def mob_stendardo_medievale_con_stemma_inventato():
    """Stendardo medievale con stemma inventato (parete): drappo viola a due punte su lancia in ferro, scudo con leone rampante giallo che suona un liuto."""
    m = Mesh('mob_stendardo_medievale_con_stemma_inventato')
    W, D = ingombro((1, 1))
    m.box(-0.47, 2.435, -0.045, 0.47, 2.465, -0.015, 'ferro', top='ferro')
    beam(m, (-0.47, 2.45, -0.03), (-0.54, 2.45, -0.03), 0.05, 0.02, 'ferro', end='ferro')
    beam(m, (0.47, 2.45, -0.03), (0.52, 2.45, -0.03), 0.035, 0.035, 'ferro', end='ferro')
    for px in (-0.34, -0.12, 0.12, 0.34):
        m.box(px - 0.025, 2.39, -0.035, px + 0.025, 2.44, -0.025, 'oro')
    m.box(-0.40, 1.50, -0.025, 0.40, 2.39, -0.01, 'p_viola', skip=('back',))
    m.box(-0.40, 1.25, -0.025, -0.15, 1.50, -0.01, 'p_viola', skip=('back',))
    m.box(0.15, 1.25, -0.025, 0.40, 1.50, -0.01, 'p_viola', skip=('back',))
    for bx in (-0.39, 0.37):
        m.box(bx, 1.50, -0.028, bx + 0.02, 2.38, -0.025, 'p_giallo', skip=('back',))
    m.box(-0.21, 1.70, -0.035, 0.21, 2.20, -0.025, 'p_giallo', skip=('back',))
    m.box(-0.19, 1.72, -0.038, 0.19, 2.18, -0.032, 'p_rosso', skip=('back',))
    m.box(-0.08, 1.82, -0.042, 0.06, 2.02, -0.036, 'p_giallo', skip=('back',))
    m.box(-0.06, 2.02, -0.042, 0.04, 2.12, -0.036, 'p_giallo', skip=('back',))
    m.box(-0.12, 1.74, -0.042, -0.05, 1.84, -0.036, 'p_giallo', skip=('back',))
    m.box(0.03, 1.74, -0.042, 0.09, 1.84, -0.036, 'p_giallo', skip=('back',))
    m.box(0.05, 2.06, -0.042, 0.12, 2.14, -0.036, 'p_giallo', skip=('back',))
    m.box(-0.14, 1.84, -0.040, -0.08, 1.98, -0.036, 'p_giallo', skip=('back',))
    beam(m, (0.01, 1.92, -0.038), (0.01, 1.92, -0.044), 0.08, 0.10, 'p_legno', end='p_legno_chiaro', n=6)
    beam(m, (0.01, 1.95, -0.044), (0.07, 2.06, -0.044), 0.018, 0.018, 'p_legno_scuro')
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
        mob_tavolo_da_biliardo,
        mob_tavolo_kotatsu,
        mob_sgabello_da_pianoforte,
        mob_botte_di_rovere_in_verticale,
        mob_pila_di_vecchi_pneumatici,
        mob_tavolo_da_pranzo_quadrato_in_legno,
        mob_scrivania_semplice,
        mob_tavolino_da_salotto_basso,
        mob_comodino_in_laminato,
        mob_piano_di_marmo_su_due_cavalletti,
        mob_tavolo_da_stiro_pieghevole,
        mob_tavolino_da_caffe_in_vetro,
        mob_scatolone_di_cartone_rovesciato,
        mob_scrivania_direzionale_in_noce,
        mob_comodino_scassato,
        mob_isola_da_cucina_in_marmo,
        mob_cattedra_scolastica,
        mob_bancone_da_bar_in_mogano,
        mob_cassettiera_anni_70,
        mob_lavagna_in_sughero,
        mob_specchio_ovale_con_cornice_d_oro,
        mob_testa_di_t_rex_in_plastica,
        mob_telecamera_di_sicurezza_a_circuito_chiuso,
        mob_diploma_incorniciato,
        mob_chitarra_elettrica_appesa,
        mob_orologio_da_parete_analogico,
        mob_specchio_rettangolare_semplice,
        mob_mensola_singola_in_legno,
        mob_appendiabiti_da_ingresso_in_legno,
        mob_quadro_con_paesaggio_sereno,
        mob_ventaglio_gigante_decorativo,
        mob_specchio_a_forma_di_cuore_con_cornice_dorata,
        mob_orologio_a_cucu_in_legno,
        mob_poster_di_mostro_tascabile,
        mob_condizionatore_d_aria,
        mob_mensola_con_action_figures,
        mob_gagliardetto_calcistico_biancorosso,
        mob_insegna_al_neon_open,
        mob_quadro_notte_stellata,
        mob_spada_bastarda_incrociata_con_scudo,
        mob_targa_stradale_via_rossi,
        mob_orologio_da_stazione_con_doppio_quadrante,
        mob_poster_di_un_film_inesistente,
        mob_cornice_con_foto_di_un_pesce_rosso,
        mob_mensola_con_barattoli_di_conserve,
        mob_arazzo_con_paesaggio_montano,
        mob_bersaglio_da_freccette_storto,
        mob_tabellone_da_biliardo_con_gessetti,
        mob_insegna_vietato_lingresso_ai_venditori,
        mob_stendardo_medievale_con_stemma_inventato,
    )
}

