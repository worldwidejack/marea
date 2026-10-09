# MAREA — animali piloti dell'Isola delle Corse, gruppo b (#178). Vedi models_corse_piloti.py per lo stile.
import math
from lib import Mesh, Xf, beam
from corse_kit import C, sfera, casco


def _obj(m):
    return [m.build()]


MODELS = {}
