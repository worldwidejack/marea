# MAREA — atlas unico 1024x1024 generato da codice (riproducibile, niente random: hash deterministico).
# Uso standalone: python3 assets/blender/atlas.py <out.png>   ·   dagli script bpy: import atlas; atlas.REGIONS
# Regole: ART_BIBLE §2 (solo palette) e §3 (16 texel/m, righe 0-511 terreni/edifici, 512-767 prop,
# 768-895 avatar, 896-1023 emissivi/UI). Unica eccezione: le «maschere di tinta» dell'avatar sono bianche
# (#FFFFFF) perché il client le moltiplica per il colore scelto (pelle/capelli/vestito): a schermo resta palette.
import struct, sys, zlib

SIZE = 1024
TPM = 16  # texel per metro (mondo)

P = {  # ART_BIBLE §2
    'sabbia_chiara': '#F4E3C1', 'sabbia': '#E2B97F', 'legno_chiaro': '#C98A4B', 'legno': '#8E5A2B', 'legno_scuro': '#5A3A1E', 'ombra_calda': '#2E1E14',
    'erba_chiara': '#D9E872', 'erba': '#8FC35B', 'erba_scura': '#4E9A46', 'bosco': '#2C6B3F', 'bosco_ombra': '#1E4A3A',
    'acqua_bassa': '#7FE3E0', 'acqua': '#3FB9C9', 'acqua_profonda': '#2478A8', 'abisso': '#163F73',
    'pietra_chiara': '#E8E1D6', 'pietra': '#B9AFA3', 'pietra_scura': '#7F7568', 'roccia': '#4A4340', 'nero_caldo': '#23201F',
    'rosso': '#E8433F', 'arancio': '#F2A33A', 'giallo': '#F5D547', 'viola': '#A64DFF',
    'rosa_neon': '#FF3DA6', 'ciano_neon': '#3DF5FF', 'verde_neon': '#B6FF3D', 'ambra_neon': '#FFB03D', 'viola_neon': '#8A5CFF', 'rosso_neon': '#FF5C3D',
}
SKIN = ['#FBE2C8', '#EFC29B', '#D9A070', '#B8784C', '#8C5636', '#5A3A28']
MASK = '#FFFFFF'  # maschera di tinta (solo zona avatar)


def rgb(h):
    h = P.get(h, h)
    return (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255)


# Regioni: nome -> (x, y, w, h) in texel, y dall'alto. Tessere 64x64 = 4 m a 16 texel/m, ripetibili ogni 32.
REGIONS = {}


def _grid(names, x0, y0, w=64, h=64, cols=16):
    for i, n in enumerate(names):
        if n:
            REGIONS[n] = (x0 + (i % cols) * w, y0 + (i // cols) * h, w, h)


# righe 0-511: terreni ed edifici
_grid(['sabbia', 'sabbia_lato', 'sabbia_bagnata', 'erba_a', 'erba_b', 'erba_lato', 'roccia', 'roccia_lato',
       'tavole', 'tavole_v', 'tavole_scure', 'tegole', 'carta', 'pietra_muro', 'intonaco', 'terra'], 0, 0)
_grid(['corteccia', 'taglio', 'paglia', 'acqua_bassa', 'metallo', 'cemento', 'legno_scuro', 'legno_pieno',
       'rosso_lacca', 'nero_lacca', 'pietra_liscia', 'ghiaia', 'erba_alta', 'muschio', 'faro_bianco', 'faro_rosso'], 0, 64)
# righe 512-767: prop (tessere 32x32 = 2 m)
_grid(['corda', 'carta_lanterna', 'cassa', 'barile', 'foglia_palma', 'tronco_palma', 'cocco', 'insegna_fondo',
       'ferro', 'tela', 'remo', 'scafo', 'scafo_chiglia', 'lacca_rossa_p', 'nero_p', 'pietra_p',
       'panca', 'bandiera', 'secchio', 'rete', 'vetro', 'oro_perla', 'tessuto_rosso', 'tessuto_blu'], 0, 512, 32, 32, 32)
# M1 (30 set 2026) — solo aggiunte in zone libere, le regioni esistenti non si spostano.
_grid(['tegole_rame', 'namako', 'intonaco_rosso', 'bambu'], 0, 128)                       # edifici L2/L3 e Porto
_grid(['noren_blu', 'noren_rosso', 'oro', 'boa_strisce', 'telo_blu', 'legno_lacca', 'carta_tesa', 'fune_bandierine'], 0, 544, 32, 32, 32)
REGIONS['insegna_sfide'] = (0, 576, 64, 32)   # «SFIDE» laccato, 32 texel/m (2 × 1 m)
REGIONS['insegna_v'] = (64, 576, 16, 48)      # insegna verticale di bottega, 3 segni astratti
REGIONS['insegna_h'] = (80, 576, 48, 16)      # insegna orizzontale di bottega
# righe 768-895: avatar (maschere di tinta bianche + parti a colore fisso)
REGIONS['testa'] = (0, 768, 14, 18)        # viso dipinto, proiezione frontale 0,22 × 0,28 m → 64 texel/m (a 32 gli occhi sarebbero puntini)
REGIONS['pelle'] = (16, 768, 16, 16)       # pelle liscia (maschera)
REGIONS['capelli'] = (32, 768, 32, 32)     # ciocche (maschera)
REGIONS['vestito'] = (64, 768, 32, 32)     # camicia/kimono corto (maschera)
REGIONS['pantaloni'] = (96, 768, 32, 32)   # colore fisso legno scuro
REGIONS['scarpe'] = (128, 768, 16, 16)
REGIONS['cappello_paglia'] = (144, 768, 32, 32)
REGIONS['cintura'] = (176, 768, 16, 16)
REGIONS['mano'] = (192, 768, 16, 16)       # pelle (maschera) con nocche
REGIONS['cappello'] = (208, 768, 16, 16)   # maschera bianca: tutti i cappelli, tinta = colore finale
# righe 896-1023: emissivi e UI
_grid(['em_lanterna', 'em_neon_rosa', 'em_neon_ciano', 'em_neon_viola', 'em_finestra', 'em_faro', 'em_neon_verde', 'em_neon_ambra'], 0, 896, 32, 32, 32)
REGIONS['em_insegna'] = (256, 896, 64, 32)  # scritta «BAR» a pixel, 32 texel/m
REGIONS['ui_legno'] = (320, 896, 16, 16)
REGIONS['ui_pietra'] = (336, 896, 16, 16)
REGIONS['ui_perle'] = (352, 896, 16, 16)

# Mondo Sotterraneo (6 ott 2026) — solo aggiunte in zone libere, le regioni esistenti non si spostano.
_grid(['grotta_pav', 'grotta_muro', 'cripta_pav', 'cripta_muro', 'vuoto_pav', 'vuoto_muro', 'vetro_serra'], 256, 128)   # dungeon e serra
_grid(['ossa', 'pelliccia', 'chitina', 'cristallo', 'ferro_rotto', 'cuoio', 'pagine', 'foglie'], 768, 512, 32, 32, 32)  # nemici e prop
_grid(['tela_sacco', 'cappuccio', 'lacca_scura', 'pietra_cripta'], 256, 544, 32, 32, 32)
REGIONS['teschio'] = (128, 576, 14, 18)       # viso del teschio, proiezione frontale come `testa`
# campioni piatti 8x8 di ogni colore della palette (dettagli piccoli: occhi, fiori, liquidi, segni)
for _i, _n in enumerate(P):
    REGIONS['p_' + _n] = (_i * 8, 640, 8, 8)
REGIONS['testa_bandito'] = (224, 768, 14, 18)  # viso a colore fisso (cappuccio e fazzoletto), 64 texel/m come `testa`
REGIONS['pelle_bandito'] = (240, 768, 8, 8)
REGIONS['lama'] = (248, 768, 16, 16)           # maschera bianca delle lame (mat_lama): il client la tinge col colore del materiale
_grid(['em_fuoco', 'em_cristallo', 'em_neon_rosso', 'em_scala', 'em_vuoto', 'em_spettro', 'em_runa'], 0, 928, 32, 32, 32)

EMISSIVE = {n for n in REGIONS if n.startswith('em_')}
TINT_MASK = {'testa', 'pelle', 'capelli', 'vestito', 'mano', 'cappello', 'lama'}


# ---------------------------------------------------------------- pittura
def h01(x, y, s=0):
    n = (x * 374761393 + y * 668265263 + s * 2246822519) & 0xFFFFFFFF
    n = ((n ^ (n >> 13)) * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 65536.0


class Canvas:
    def __init__(self):
        self.px = bytearray(rgb('ombra_calda') * (SIZE * SIZE))

    def set(self, x, y, c):
        if 0 <= x < SIZE and 0 <= y < SIZE:
            i = (y * SIZE + x) * 4
            self.px[i:i + 4] = bytes(rgb(c))

    def region(self, name, fn):
        x0, y0, w, h = REGIONS[name]
        for y in range(h):
            for x in range(w):
                c = fn(x, y, w, h)
                if c:
                    self.set(x0 + x, y0 + y, c)

    def png(self, path):
        raw = b''.join(b'\x00' + bytes(self.px[y * SIZE * 4:(y + 1) * SIZE * 4]) for y in range(SIZE))
        def chunk(t, d):
            return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)
        data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', SIZE, SIZE, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
        with open(path, 'wb') as f:
            f.write(data)


def speckle(base, spots, seed, period=32):
    """base + macchie: spots = [(colore, probabilità)]; ripetibile ogni `period` texel."""
    def f(x, y, w, h):
        r = h01(x % period, y % period, seed)
        acc = 0
        for c, p in spots:
            acc += p
            if r < acc:
                return c
        return base
    return f


def planks(base, seam, dark, light, plank=4, period=32, vertical=False, seed=3):
    def f(x, y, w, h):
        if vertical:
            x, y = y, x
        row = y // plank
        if y % plank == plank - 1:
            return seam
        off = int(h01(row, 0, seed) * 16)
        xx = (x + off) % period
        if xx == 0:
            return seam
        if xx in (2, 17) and y % plank == 1:
            return dark  # chiodi
        r = h01(xx, y % period, seed + row)
        if r < 0.10:
            return dark if (xx + y) % 3 else light
        if r < 0.16:
            return light
        return base
    return f


def blocks(base, alt, mortar, hi, bw=8, bh=5, seed=5, period=32):
    def f(x, y, w, h):
        x %= period; y %= period
        row = y // bh
        xx = (x + (bw // 2 if row % 2 else 0)) % period
        if y % bh == bh - 1 or xx % bw == 0:
            return mortar
        cell = (xx // bw, row)
        c = alt if h01(*cell, seed) < 0.35 else base
        if y % bh == 0 and h01(xx, y, seed) < 0.6:
            return hi
        if h01(x, y, seed + 1) < 0.06:
            return mortar
        return c
    return f


def paint(cv):
    R = cv.region
    # --- terreni
    R('sabbia', speckle('sabbia', [('sabbia_chiara', 0.09), ('legno_chiaro', 0.04)], 11))
    R('sabbia_bagnata', speckle('legno_chiaro', [('sabbia', 0.18), ('legno', 0.05)], 12))

    def sabbia_lato(x, y, w, h):
        band = (y + int(h01(x // 3, 0, 7) * 2)) % 6
        if band == 0:
            return 'legno_chiaro'
        return speckle('sabbia', [('sabbia_chiara', 0.06), ('legno_chiaro', 0.08)], 13)(x, y, w, h)
    R('sabbia_lato', sabbia_lato)

    def erba(base, dark, light, seed):
        def f(x, y, w, h):
            xx, yy = x % 32, y % 32
            r = h01(xx, yy, seed)
            if r < 0.07 or (h01(xx, (yy + 1) % 32, seed) < 0.07):
                return dark  # ciuffi a 2 texel verticali
            if r < 0.12:
                return light
            return base
        return f
    R('erba_a', erba('erba', 'erba_scura', 'erba_chiara', 21))
    R('erba_b', erba('erba_scura', 'bosco', 'erba', 22))
    R('erba_alta', erba('erba_scura', 'bosco_ombra', 'erba', 23))
    R('muschio', speckle('erba_scura', [('bosco', 0.2), ('erba', 0.08)], 24))

    def erba_lato(x, y, w, h):
        xx = x % 32
        edge = 3 + int(h01(xx // 2, 0, 25) * 3) + (2 if h01(xx, 1, 25) < 0.12 else 0)
        if y < edge - 1:
            return 'erba' if h01(xx, y, 26) > 0.15 else 'erba_chiara'
        if y < edge:
            return 'erba_scura'
        if y < edge + 2 and h01(xx, y, 28) < 0.3:
            return 'erba_scura'
        return 'legno_scuro' if h01(xx, y % 32, 27) < 0.07 else 'legno'
    R('erba_lato', erba_lato)
    R('terra', speckle('legno', [('legno_scuro', 0.14), ('legno_chiaro', 0.05)], 27))

    def roccia(seed, lato=False):
        def f(x, y, w, h):
            xx, yy = x % 32, y % 32
            # celle a «sfaccettature»: voronoi grezzo su 5 punti
            best, second, bi = 1e9, 1e9, 0
            for i in range(6):
                px, py = h01(i, 1, seed) * 32, h01(i, 2, seed) * 32
                for ox in (-32, 0, 32):
                    for oy in (-32, 0, 32):
                        d = (xx - px - ox) ** 2 + ((yy - py - oy) * (1.6 if lato else 1)) ** 2
                        if d < best:
                            best, second, bi = d, best, i
                        elif d < second:
                            second = d
            gap = second ** 0.5 - best ** 0.5
            if gap < 1.0:
                return 'roccia'
            if gap < 2.0 and lato:
                return 'pietra_scura'
            c = ['pietra_scura', 'pietra', 'pietra_scura', 'pietra', 'pietra_scura', 'pietra_chiara' if not lato else 'pietra'][bi]
            if h01(xx, yy, seed + 9) < 0.07:
                return 'pietra' if c == 'pietra_scura' else 'pietra_scura'
            return c
        return f
    R('roccia', roccia(31))
    R('roccia_lato', roccia(32, True))
    R('ghiaia', speckle('pietra', [('pietra_scura', 0.25), ('pietra_chiara', 0.12)], 33))
    R('pietra_liscia', speckle('pietra', [('pietra_chiara', 0.05), ('pietra_scura', 0.05)], 34))
    # --- legno
    R('tavole', planks('legno_chiaro', 'legno_scuro', 'legno', 'sabbia', seed=41))
    R('tavole_v', planks('legno_chiaro', 'legno_scuro', 'legno', 'sabbia', vertical=True, seed=42))
    R('tavole_scure', planks('legno', 'ombra_calda', 'legno_scuro', 'legno_chiaro', vertical=True, seed=43))
    R('legno_scuro', planks('legno_scuro', 'ombra_calda', 'ombra_calda', 'legno', vertical=True, seed=44))
    R('legno_pieno', speckle('legno', [('legno_scuro', 0.08), ('legno_chiaro', 0.05)], 45))

    def corteccia(x, y, w, h):
        xx = x % 32
        s = (xx + int(h01(y // 4, 0, 46) * 2)) % 4
        if s == 0:
            return 'ombra_calda'
        return 'legno' if h01(xx, y % 32, 47) < 0.25 else 'legno_scuro'
    R('corteccia', corteccia)

    def taglio(x, y, w, h):  # anelli, un ceppo ogni 8 texel (0,5 m)
        cx, cy = x % 8 - 3.5, y % 8 - 3.5
        d = (cx * cx + cy * cy) ** 0.5
        if d > 3.6:
            return 'legno'
        return ['sabbia', 'legno_chiaro', 'sabbia', 'legno_chiaro'][min(3, int(d))]
    R('taglio', taglio)

    def paglia(x, y, w, h):
        xx, yy = x % 32, y % 32
        if yy % 4 == 3:
            return 'legno_chiaro'
        r = h01(xx, yy, 48)
        return 'sabbia_chiara' if r < 0.2 else ('legno_chiaro' if r < 0.3 else 'sabbia')
    R('paglia', paglia)

    def tegole(x, y, w, h):  # file di coppi scuri, 4 texel = 0,25 m
        xx, yy = x % 32, y % 32
        row = yy // 4
        xx = (xx + (2 if row % 2 else 0)) % 32
        if yy % 4 == 3:
            return 'nero_caldo'
        if xx % 4 == 0:
            return 'nero_caldo' if yy % 4 != 0 else 'roccia'
        if yy % 4 == 0:
            return 'pietra_scura' if xx % 4 in (1, 2) else 'roccia'
        return 'roccia'
    R('tegole', tegole)

    def carta(x, y, w, h):  # shoji: griglia di listelli ogni 6 texel
        xx, yy = x % 24, y % 24
        if xx % 6 == 0 or yy % 8 == 0:
            return 'legno'
        return 'sabbia_chiara' if h01(xx, yy, 49) > 0.05 else 'pietra_chiara'
    R('carta', carta)
    R('pietra_muro', blocks('pietra', 'pietra_scura', 'roccia', 'pietra_chiara', seed=51))
    R('intonaco', speckle('sabbia_chiara', [('pietra_chiara', 0.1), ('sabbia', 0.04)], 52))
    R('cemento', speckle('pietra', [('pietra_scura', 0.08), ('pietra_chiara', 0.04)], 53))

    def metallo(x, y, w, h):
        xx, yy = x % 16, y % 16
        if xx == 0 or yy == 0:
            return 'nero_caldo'
        if (xx, yy) in ((2, 2), (14, 2), (2, 14), (14, 14)):
            return 'pietra_scura'
        return 'roccia' if h01(xx, yy, 54) > 0.1 else 'pietra_scura'
    R('metallo', metallo)

    def acqua_bassa(x, y, w, h):
        xx, yy = x % 32, y % 32
        if (xx + 2 * (yy // 8)) % 12 < 3 and yy % 8 == 0:
            return 'sabbia_chiara' if h01(xx, yy, 55) < 0.2 else 'acqua_bassa'
        return 'acqua' if (xx + yy * 3) % 17 == 0 else 'acqua_bassa'
    R('acqua_bassa', acqua_bassa)
    R('rosso_lacca', speckle('rosso', [('arancio', 0.03)], 56))
    R('nero_lacca', speckle('nero_caldo', [('roccia', 0.05)], 57))

    def faro(c1, c2):
        return lambda x, y, w, h: c1 if (y // 8) % 2 == 0 else c2
    R('faro_bianco', speckle('pietra_chiara', [('pietra', 0.06)], 58))
    R('faro_rosso', speckle('rosso', [('arancio', 0.03)], 59))

    # --- prop (32x32 = 2 m)
    def corda(x, y, w, h):
        return 'legno_chiaro' if (x + y) % 4 < 2 else ('sabbia' if (x + y) % 4 == 2 else 'legno')
    R('corda', corda)

    def carta_lanterna(x, y, w, h):  # carta rossa con costole scure
        if y % 4 == 0:
            return 'legno_scuro'
        return 'rosso' if h01(x, y, 61) > 0.08 else 'arancio'
    R('carta_lanterna', carta_lanterna)
    R('cassa', planks('legno_chiaro', 'legno', 'legno', 'sabbia', plank=5, seed=62))

    def barile(x, y, w, h):
        if y % 16 in (2, 3, 12, 13):
            return 'roccia' if y % 16 in (2, 12) else 'nero_caldo'
        if x % 4 == 0:
            return 'legno_scuro'
        return 'legno' if h01(x, y, 63) < 0.15 else 'legno_chiaro'
    R('barile', barile)

    def foglia(x, y, w, h):  # foglioline diagonali
        if (x + y) % 4 == 0:
            return 'bosco'
        if y % 16 == 0:
            return 'erba_chiara'
        return 'erba' if (x - y) % 7 == 0 else 'erba_scura'
    R('foglia_palma', foglia)

    def tronco_palma(x, y, w, h):
        if y % 3 == 0:
            return 'legno'
        return 'legno_chiaro' if (x + (y // 3)) % 5 else 'sabbia'
    R('tronco_palma', tronco_palma)
    R('cocco', speckle('legno_scuro', [('legno', 0.2)], 64))

    def insegna_fondo(x, y, w, h):
        return 'nero_caldo' if 1 <= x < w - 1 and 1 <= y < h - 1 else 'roccia'
    R('insegna_fondo', insegna_fondo)
    R('ferro', speckle('roccia', [('nero_caldo', 0.1), ('pietra_scura', 0.06)], 65))
    R('tela', speckle('sabbia_chiara', [('sabbia', 0.1)], 66))
    R('remo', planks('legno_chiaro', 'legno', 'legno', 'sabbia', plank=8, vertical=True, seed=67))

    def scafo(x, y, w, h):  # fasciame orizzontale, fascia rossa al bordo
        if y < 2:
            return 'legno_scuro'
        if y < 4:
            return 'rosso'
        if (y - 4) % 3 == 2:
            return 'legno_scuro'
        return 'legno' if h01(x, y, 68) < 0.12 else 'legno_chiaro'
    R('scafo', scafo)
    R('scafo_chiglia', planks('legno', 'legno_scuro', 'legno_scuro', 'legno_chiaro', plank=3, seed=69))
    R('lacca_rossa_p', speckle('rosso', [('arancio', 0.02)], 70))
    R('nero_p', speckle('nero_caldo', [('roccia', 0.06)], 71))
    R('pietra_p', blocks('pietra', 'pietra_scura', 'roccia', 'pietra_chiara', bw=6, bh=4, seed=72))
    R('panca', planks('legno_chiaro', 'legno', 'legno', 'sabbia', plank=4, seed=73))
    def bandiera(x, y, w, h):  # stendardo rosso con bordo chiaro e onda
        if x < 2 or x >= w - 2 or y < 2:
            return 'sabbia_chiara'
        wy = 16 + int(3 * __import__('math').sin(x / 3.0))
        if abs(y - wy) < 2:
            return 'sabbia_chiara'
        return 'rosso'
    R('bandiera', bandiera)
    R('secchio', speckle('legno', [('legno_scuro', 0.1)], 74))
    R('rete', lambda x, y, w, h: 'legno_scuro' if (x % 4 == 0 or y % 4 == 0) else 'legno')
    R('vetro', lambda x, y, w, h: 'acqua_profonda' if (x + y) % 6 else 'acqua')
    R('oro_perla', lambda x, y, w, h: 'pietra_chiara')
    R('tessuto_rosso', speckle('rosso', [('arancio', 0.04)], 75))
    R('tessuto_blu', speckle('acqua_profonda', [('abisso', 0.08)], 76))

    # --- avatar (maschere di tinta bianche: il client moltiplica per il colore scelto)
    def testa(x, y, w, h):  # 14x18 (64 texel/m), x=0 a sinistra di chi guarda; righe 0-6 fronte (capelli), occhi 8-9, bocca 13
        e = x if x < 7 else 13 - x  # simmetrico
        F = {(3, 6): 'legno', (4, 6): 'legno_scuro',                                      # sopracciglia
             (4, 8): 'nero_caldo', (4, 9): 'nero_caldo',                                   # occhio: barretta 1×2
             (6, 11): 'pietra',                                                            # ombra del naso
             (6, 13): 'legno'}                                                             # bocca (2 texel)
        if (x, y) == (7, 11):
            return MASK  # naso asimmetrico: ombra solo a sinistra
        return F.get((e, y), MASK)
    R('testa', testa)
    R('pelle', lambda x, y, w, h: MASK)
    R('mano', lambda x, y, w, h: SKIN[1] if (y == 4 and x % 3 == 0) else MASK)
    R('capelli', lambda x, y, w, h: 'pietra_chiara' if (x + (y // 3)) % 5 == 0 else MASK)

    def vestito(x, y, w, h):
        if y % 32 in (0,):
            return 'pietra_chiara'
        if x % 32 == 16 and y % 32 < 20:
            return 'pietra_chiara'  # abbottonatura
        return MASK
    R('vestito', vestito)
    R('pantaloni', lambda x, y, w, h: 'legno_scuro' if (x % 16 == 0 or h01(x, y, 81) < 0.06) else 'legno')
    R('scarpe', speckle('ombra_calda', [('legno_scuro', 0.15)], 82))
    R('cintura', lambda x, y, w, h: 'ombra_calda' if y % 4 else 'legno_scuro')

    def cappello(x, y, w, h):  # paglia intrecciata
        if (x + y) % 3 == 0:
            return 'legno_chiaro'
        return 'giallo' if h01(x, y, 83) < 0.15 else 'sabbia'
    R('cappello_paglia', cappello)
    R('cappello', lambda x, y, w, h: MASK)

    # --- emissivi
    def lanterna(x, y, w, h):
        if y % 4 == 0:
            return 'rosso'
        return 'giallo' if abs(x - 16) < 6 else 'arancio'
    R('em_lanterna', lanterna)
    R('em_neon_rosa', lambda x, y, w, h: 'rosa_neon')
    R('em_neon_ciano', lambda x, y, w, h: 'ciano_neon')
    R('em_neon_viola', lambda x, y, w, h: 'viola_neon')
    R('em_neon_verde', lambda x, y, w, h: 'verde_neon')
    R('em_neon_ambra', lambda x, y, w, h: 'ambra_neon')
    R('em_finestra', lambda x, y, w, h: 'legno' if (x % 8 == 0 or y % 8 == 0) else ('giallo' if (x + y) % 5 else 'arancio'))
    R('em_faro', lambda x, y, w, h: 'giallo' if (x + y) % 4 else 'sabbia_chiara')

    font = {  # 5x7
        'B': ['1111.', '1...1', '1...1', '1111.', '1...1', '1...1', '1111.'],
        'A': ['.111.', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'],
        'R': ['1111.', '1...1', '1...1', '1111.', '1.1..', '1..1.', '1...1'],
    }

    def insegna(x, y, w, h):  # 64x32: bordo ciano, scritta rosa «BAR» (scala 2)
        if x in (1, w - 2) or y in (1, h - 2):
            return 'ciano_neon'
        if x in (0, w - 1) or y in (0, h - 1):
            return 'nero_caldo'
        tx, ty = (x - 9) // 2, (y - 9) // 2
        if 0 <= ty < 7 and 0 <= tx < 3 * 6:
            ch, cx = 'BAR'[tx // 6], tx % 6
            if cx < 5 and font[ch][ty][cx] == '1':
                return 'rosa_neon'
        return 'nero_caldo'
    R('em_insegna', insegna)

    # --- icone UI 16x16
    def ico_legno(x, y, w, h):
        if 5 <= y <= 11 and 1 <= x <= 12:
            if x >= 11:
                return 'sabbia' if (x, y) not in ((11, 5), (11, 11)) else None
            return 'legno_scuro' if y in (5, 11) else ('legno' if (x + y) % 4 else 'legno_scuro')
        if 6 <= y <= 10 and x in (13, 14) and not (x == 14 and y in (6, 10)):
            return 'legno_chiaro' if (x + y) % 2 else 'sabbia'
        return None

    def ico_pietra(x, y, w, h):
        d = ((x - 7.5) / 6.5) ** 2 + ((y - 9) / 5) ** 2
        if d <= 1:
            if d > 0.75:
                return 'roccia'
            return 'pietra_chiara' if (y < 8 and x < 8) else 'pietra'
        return None

    def ico_perla(x, y, w, h):
        d = ((x - 7.5) ** 2 + (y - 7.5) ** 2) ** 0.5
        if d <= 6:
            if d > 5:
                return 'viola'
            if (x - 5.5) ** 2 + (y - 5.5) ** 2 < 3:
                return 'pietra_chiara'
            return 'rosa_neon' if d < 3.5 else 'viola'
        return None
    for n, f in (('ui_legno', ico_legno), ('ui_pietra', ico_pietra), ('ui_perle', ico_perla)):
        R(n, lambda x, y, w, h, f=f: f(x, y, w, h) or 'ombra_calda')


def paint_m1(cv):
    """Regioni della fetta M1: tetti di rame, kura, tende noren, insegne, boa, cantiere."""
    import math
    R = cv.region

    def tegole_rame(x, y, w, h):  # coppi di rame ossidato (verde), file sfalsate come `tegole`
        xx, yy = x % 32, y % 32
        row = yy // 4
        xx = (xx + (2 if row % 2 else 0)) % 32
        if yy % 4 == 3:
            return 'bosco_ombra'
        if xx % 4 == 0:
            return 'bosco_ombra' if yy % 4 != 0 else 'bosco'
        if yy % 4 == 0:
            return 'erba_scura' if xx % 4 in (1, 2) else 'bosco'
        return 'bosco' if h01(xx, yy, 91) > 0.12 else 'erba_scura'
    R('tegole_rame', tegole_rame)

    def namako(x, y, w, h):  # muro kura: piastrelle scure con giunti bianchi a rombo
        xx, yy = x % 8, y % 8
        if xx == yy or xx == 7 - yy:
            return 'pietra_chiara'
        return 'roccia' if h01(x % 32, y % 32, 92) > 0.1 else 'pietra_scura'
    R('namako', namako)
    R('intonaco_rosso', speckle('rosso', [('arancio', 0.05)], 93))

    def bambu(x, y, w, h):  # canne verticali con nodi
        xx = x % 4
        if xx == 0:
            return 'legno'
        if y % 12 == 0:
            return 'legno_chiaro'
        return 'sabbia' if xx == 1 else 'legno_chiaro'
    R('bambu', bambu)

    def noren(fondo, segno):
        def f(x, y, w, h):  # tenda a 3 strisce con un segno bianco al centro, orlo scuro in alto
            if y < 3:
                return 'ombra_calda'
            if x % 11 == 10 and y > 8:
                return 'ombra_calda'  # tagli tra le strisce
            cx, cy = x - 16, y - 16
            if (abs(cx) <= 5 and cy in (-3, 3)) or (cx == 0 and -6 <= cy <= 6) or (abs(cx) == 4 and -1 <= cy <= 5):
                return segno
            return fondo
        return f
    R('noren_blu', noren('acqua_profonda', 'sabbia_chiara'))
    R('noren_rosso', noren('rosso', 'sabbia_chiara'))
    R('oro', speckle('giallo', [('arancio', 0.12), ('sabbia_chiara', 0.05)], 94))

    def boa_strisce(x, y, w, h):  # bande orizzontali rosso / bianco ogni 8 texel (0,5 m)
        return ('rosso' if h01(x, y, 95) > 0.06 else 'arancio') if (y // 8) % 2 == 0 else ('pietra_chiara' if h01(x, y, 96) > 0.08 else 'pietra')
    R('boa_strisce', boa_strisce)

    def telo_blu(x, y, w, h):  # telo di cantiere: tela blu con cuciture chiare
        if y % 16 == 0 or x % 16 == 0:
            return 'sabbia_chiara'
        return 'acqua_profonda' if h01(x, y, 97) > 0.1 else 'abisso'
    R('telo_blu', telo_blu)
    R('legno_lacca', speckle('rosso', [('legno_scuro', 0.05)], 98))

    def carta_tesa(x, y, w, h):  # carta dei pannelli illuminata dall'esterno (non emissiva)
        if x % 8 == 0 or y % 10 == 0:
            return 'legno_scuro'
        return 'sabbia_chiara' if h01(x, y, 99) > 0.06 else 'sabbia'
    R('carta_tesa', carta_tesa)

    def fune_bandierine(x, y, w, h):
        return ['rosso', 'giallo', 'acqua', 'sabbia_chiara'][(x // 8) % 4] if y > 4 else 'legno'
    R('fune_bandierine', fune_bandierine)

    font = {
        'S': ['.1111', '1....', '1....', '.111.', '....1', '....1', '1111.'],
        'F': ['11111', '1....', '1....', '1111.', '1....', '1....', '1....'],
        'I': ['.111.', '..1..', '..1..', '..1..', '..1..', '..1..', '.111.'],
        'D': ['1111.', '1...1', '1...1', '1...1', '1...1', '1...1', '1111.'],
        'E': ['11111', '1....', '1....', '1111.', '1....', '1....', '11111'],
    }

    def sfide(x, y, w, h):  # tavola laccata nera, bordo rosso, lettere oro a scala 2
        if x in (0, w - 1) or y in (0, h - 1):
            return 'ombra_calda'
        if x in (1, 2, w - 2, w - 3) or y in (1, 2, h - 2, h - 3):
            return 'rosso'
        tx, ty = (x - 3) // 2, (y - 9) // 2
        if 0 <= ty < 7 and 0 <= tx < 30:
            ch, cx = 'SFIDE'[tx // 6], tx % 6
            if cx < 5 and font[ch][ty][cx] == '1':
                return 'giallo' if (x + y) % 5 else 'arancio'
        return 'nero_caldo'
    R('insegna_sfide', sfide)

    # segni astratti 7x7 (non sono caratteri veri: niente testo da tradurre, niente IP)
    glyphs = [
        ['1111111', '...1...', '.11111.', '...1...', '.1.1.1.', '1..1..1', '...1...'],
        ['.1...1.', '1111111', '.1...1.', '.11111.', '.1...1.', '.11111.', '1.....1'],
        ['...1...', '1111111', '..1.1..', '.1...1.', '1111111', '...1...', '..111..'],
    ]

    def bottega(vertical):
        def f(x, y, w, h):
            if x in (0, w - 1) or y in (0, h - 1):
                return 'ombra_calda'
            a, b = (y, x) if vertical else (x, y)  # a = lungo l'insegna
            k, off = (a - 1) // 15, (a - 1) % 15
            gx, gy = off - 4, b - 4
            if k < 3 and 0 <= gx < 7 and 0 <= gy < 7:
                g = glyphs[k]
                if (g[gx][gy] if vertical else g[gy][gx]) == '1':
                    return 'nero_caldo'
            return 'sabbia_chiara' if h01(x, y, 100) > 0.08 else 'sabbia'
        return f
    R('insegna_v', bottega(True))
    R('insegna_h', bottega(False))


def paint_rpg(cv):
    """Regioni del Mondo Sotterraneo: kit dei 3 dungeon, nemici, prop, lame, fuoco e cristalli emissivi."""
    R = cv.region

    def voronoi(cols, edge, seed, period=32, n=6, squash=1.0, vein=None):
        def f(x, y, w, h):
            xx, yy = x % period, y % period
            best, second, bi = 1e9, 1e9, 0
            for i in range(n):
                px, py = h01(i, 1, seed) * period, h01(i, 2, seed) * period
                for ox in (-period, 0, period):
                    for oy in (-period, 0, period):
                        d = (xx - px - ox) ** 2 + ((yy - py - oy) * squash) ** 2
                        if d < best:
                            best, second, bi = d, best, i
                        elif d < second:
                            second = d
            gap = second ** 0.5 - best ** 0.5
            if gap < 1.0:
                if vein and h01(xx // 2, yy // 2, seed + 5) < vein[1]:
                    return vein[0]
                return edge
            c = cols[bi % len(cols)]
            if h01(xx, yy, seed + 9) < 0.06:
                return cols[(bi + 1) % len(cols)]
            return c
        return f

    # --- grotta: terra battuta con ciottoli, roccia scura
    def grotta_pav(x, y, w, h):
        xx, yy = x % 32, y % 32
        for i in range(7):  # ciottoli 2x2 / 3x2
            px, py = int(h01(i, 3, 201) * 30), int(h01(i, 4, 201) * 30)
            if px <= xx <= px + 1 + (i % 2) and py <= yy <= py + 1:
                return 'pietra_scura' if yy == py else 'roccia'
        r = h01(xx, yy, 202)
        return 'ombra_calda' if r < 0.12 else ('legno' if r < 0.18 else 'legno_scuro')
    R('grotta_pav', grotta_pav)
    R('grotta_muro', voronoi(['roccia', 'pietra_scura', 'roccia', 'roccia'], 'nero_caldo', 203, squash=1.5))
    # --- cripta: lastre grandi con fughe, blocchi scuri con fascia incisa
    def cripta_pav(x, y, w, h):
        xx, yy = x % 32, y % 32
        row = yy // 16
        xo = (xx + (8 if row % 2 else 0)) % 32
        if yy % 16 == 15 or xo % 16 == 0:
            return 'nero_caldo'
        if yy % 16 == 0 and h01(xo, yy, 204) < 0.7:
            return 'pietra'
        c = 'pietra_scura' if h01(xo // 16, row, 205) < 0.6 else 'roccia'
        if h01(xx, yy, 206) < 0.05:
            return 'roccia' if c == 'pietra_scura' else 'pietra_scura'
        if (xx * 7 + yy * 3) % 41 == 0:
            return 'nero_caldo'  # crepa
        return c
    R('cripta_pav', cripta_pav)

    def cripta_muro(x, y, w, h):
        yy = y % 32
        if yy in (12, 13):  # fascia incisa con motivo a meandro
            return 'nero_caldo' if (x % 6 < 3) == (yy == 12) else 'roccia'
        return blocks('pietra_scura', 'roccia', 'nero_caldo', 'pietra', bw=10, bh=6, seed=207)(x, y, w, h)
    R('cripta_muro', cripta_muro)
    # --- vuoto: roccia nera con vene viola e ciano (non emissive: il bagliore lo fanno i cristalli)
    R('vuoto_pav', voronoi(['nero_caldo', 'roccia', 'nero_caldo'], 'roccia', 208, vein=('viola', 0.22)))
    R('vuoto_muro', voronoi(['nero_caldo', 'roccia', 'nero_caldo', 'nero_caldo'], 'roccia', 209, squash=1.7, vein=('viola', 0.18)))

    def vetro_serra(x, y, w, h):  # lastre di vetro con riflesso diagonale a pixel e listelli
        xx, yy = x % 16, y % 16
        if xx == 0 or yy == 0:
            return 'legno_chiaro'
        if (xx + yy) % 9 in (0, 1) and xx < 10:
            return 'sabbia_chiara'
        return 'acqua_bassa' if h01(x % 32, y % 32, 210) > 0.15 else 'acqua'
    R('vetro_serra', vetro_serra)

    # --- nemici e prop (32x32)
    def ossa(x, y, w, h):
        r = h01(x, y, 211)
        if (x + 2 * y) % 13 == 0:
            return 'pietra'
        return 'pietra_chiara' if r > 0.18 else ('sabbia_chiara' if r > 0.08 else 'pietra')
    R('ossa', ossa)

    def pelliccia(x, y, w, h):  # ciuffi diagonali grigi
        if (x + y // 2) % 5 == 0:
            return 'roccia'
        r = h01(x, y, 212)
        return 'pietra_scura' if r > 0.2 else ('pietra' if r > 0.1 else 'roccia')
    R('pelliccia', pelliccia)

    def chitina(x, y, w, h):  # placche lucide nere con bordi
        if y % 8 == 0:
            return 'roccia'
        if y % 8 == 1 and x % 3 == 0:
            return 'pietra_scura'
        return 'nero_caldo' if h01(x, y, 213) > 0.1 else 'roccia'
    R('chitina', chitina)

    def cristallo(x, y, w, h):  # sfaccettature viola/acqua (non emissivo)
        d = (x - y) % 12
        if d == 0:
            return 'acqua_bassa'
        if d < 4:
            return 'viola'
        return 'abisso' if h01(x, y, 214) < 0.1 else ('acqua_profonda' if d < 8 else 'viola')
    R('cristallo', cristallo)
    R('ferro_rotto', speckle('roccia', [('legno_scuro', 0.18), ('legno', 0.06), ('pietra_scura', 0.08), ('nero_caldo', 0.06)], 215))

    def cuoio(x, y, w, h):
        if y % 10 == 0 or (x % 16 == 0 and y % 2 == 0):
            return 'ombra_calda'  # cuciture
        return 'legno' if h01(x, y, 216) > 0.12 else 'legno_scuro'
    R('cuoio', cuoio)

    def pagine(x, y, w, h):  # pagine scritte a righe, bordo scuro
        if x in (0, w - 1) or y in (0, h - 1):
            return 'legno_chiaro'
        if y % 3 == 0 and 2 <= x % 16 <= 13 and h01(x, y, 217) > 0.25:
            return 'legno'
        return 'sabbia_chiara'
    R('pagine', pagine)

    def foglie(x, y, w, h):  # fogliame folto della serra
        r = h01(x, y, 218)
        if (x * 3 + y) % 7 == 0:
            return 'erba_chiara'
        return 'erba' if r > 0.45 else ('erba_scura' if r > 0.1 else 'bosco')
    R('foglie', foglie)

    def tela_sacco(x, y, w, h):  # iuta a trama
        if (x % 2) ^ (y % 2):
            return 'sabbia' if h01(x, y, 219) > 0.1 else 'legno_chiaro'
        return 'legno_chiaro'
    R('tela_sacco', tela_sacco)
    R('cappuccio', speckle('bosco_ombra', [('nero_caldo', 0.12), ('bosco', 0.06)], 220))
    R('lacca_scura', speckle('legno_scuro', [('ombra_calda', 0.1), ('rosso', 0.02)], 221))
    R('pietra_cripta', blocks('pietra_chiara', 'pietra', 'pietra_scura', 'sabbia_chiara', bw=8, bh=5, seed=222))

    def teschio(x, y, w, h):  # 14x18: orbite grandi, naso a cuore rovesciato, denti
        e = x if x < 7 else 13 - x
        if 7 <= y <= 10 and 2 <= e <= 5:
            return 'nero_caldo' if not (y == 7 and e in (2, 5)) else 'pietra'
        if y in (11, 12) and e == 6:
            return 'nero_caldo'
        if y == 15 and 2 <= e <= 6:
            return 'nero_caldo' if x % 2 else 'pietra_chiara'
        if y == 14 or y == 16:
            return 'pietra' if 2 <= e <= 6 else 'pietra_chiara'
        if y >= 17:
            return 'pietra'
        return 'pietra_chiara' if h01(x, y, 223) > 0.1 else 'sabbia_chiara'
    R('teschio', teschio)
    for n in P:
        R('p_' + n, lambda x, y, w, h, n=n: n)

    # --- bandito: viso a colore fisso, ombra del cappuccio in alto, fazzoletto rosso sotto gli occhi
    def testa_bandito(x, y, w, h):
        e = x if x < 7 else 13 - x
        if y <= 3:
            return 'nero_caldo' if y <= 1 else 'ombra_calda'
        if y == 6 and e in (2, 3, 4):
            return 'ombra_calda'                      # sopracciglia aggrottate
        if (e, y) in ((4, 8), (4, 9), (3, 8)):
            return 'nero_caldo'                       # occhi
        if y >= 11:
            if y == 11:
                return 'legno_scuro'                  # orlo del fazzoletto
            if (x + y) % 5 == 0:
                return 'arancio'
            return 'rosso'
        return SKIN[3]
    R('testa_bandito', testa_bandito)
    R('pelle_bandito', lambda x, y, w, h: SKIN[3])
    R('lama', lambda x, y, w, h: 'pietra_chiara' if (x == 0 or (x + y) % 11 == 0) else MASK)

    # --- emissivi
    def fuoco(x, y, w, h):  # lingue di fuoco a pixel: giallo al centro, arancio, rosso ai bordi
        xx, yy = x % 32, y % 32
        wob = int(h01(xx // 3, 0, 224) * 4)
        d = abs(xx - 16) + max(0, (yy - 16) // 2) + wob
        if d < 6:
            return 'giallo'
        if d < 11:
            return 'arancio' if (xx + yy) % 7 else 'giallo'
        return 'rosso_neon' if (xx + yy) % 5 else 'arancio'
    R('em_fuoco', fuoco)

    def em_cristallo(x, y, w, h):
        d = (x + y) % 10
        if d == 0:
            return 'sabbia_chiara'
        return 'ciano_neon' if d < 4 else 'viola_neon'
    R('em_cristallo', em_cristallo)
    R('em_neon_rosso', lambda x, y, w, h: 'rosso_neon')

    def em_scala(x, y, w, h):  # luce che scende: bande verticali chiare
        return 'sabbia_chiara' if (x // 4) % 3 == 0 else ('giallo' if h01(x, y, 225) > 0.2 else 'sabbia_chiara')
    R('em_scala', em_scala)

    def em_vuoto(x, y, w, h):  # centro del portale: spirale a pixel viola con lampi rosa e ciano
        cx, cy = x - 15.5, y - 15.5
        a = (int((cx * cx + cy * cy) ** 0.5) + int(4 * (1 + __import__('math').atan2(cy, cx)))) % 6
        if a == 0:
            return 'rosa_neon' if h01(x, y, 226) < 0.3 else 'viola'
        if a == 3 and h01(x, y, 227) < 0.4:
            return 'ciano_neon'
        return 'viola_neon'
    R('em_vuoto', em_vuoto)

    def em_spettro(x, y, w, h):  # tessuto spettrale: viola neon con pieghe più scure e lampi rosa
        if x % 8 == 0 and h01(x, y // 4, 228) < 0.7:
            return 'viola'
        if h01(x, y, 229) < 0.06:
            return 'rosa_neon'
        return 'viola_neon'
    R('em_spettro', em_spettro)

    def em_runa(x, y, w, h):  # rune ciano su nero (anello del portale)
        xx, yy = x % 16, y % 16
        if yy in (0, 15):
            return 'viola_neon'
        if 4 <= yy <= 11 and ((xx in (3, 11)) or (yy in (4, 11) and 3 <= xx <= 11) or (xx == 7 and yy < 8)):
            return 'ciano_neon'
        return 'nero_caldo'
    R('em_runa', em_runa)


def build(path):
    cv = Canvas()
    paint(cv)
    paint_m1(cv)
    paint_rpg(cv)
    cv.png(path)
    return path


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'assets/atlas/atlas.png'
    build(out)
    print('[atlas] scritto', out, len(REGIONS), 'regioni')
