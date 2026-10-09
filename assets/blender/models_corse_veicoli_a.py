# MAREA — veicoli dell'Isola delle Corse, gruppo a (#178). Vedi models_corse_veicoli.py per lo stile e docs/CORSE.md A6.
import math
from lib import Mesh, Xf, beam
from corse_kit import C, ruota, sfera, volante, fascia


def _obj(m):
    return [m.build()]


MODELS = {}
