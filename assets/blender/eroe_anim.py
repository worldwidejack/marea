"""Cicli del protagonista. Coordinate Blender: +Y avanti, +Z alto."""
import math

from models_chr import X, Y, Z, S, hips_loc


def clips(rig, bones):
    hip = bones['UpperLeg.L'][0][1]
    knee = bones['LowerLeg.L'][0][1]
    ankle = bones['Foot.L'][0][1]
    thigh, shin = hip - knee, knee - ankle

    def legs(pose, side, forward, height, pelvis, pitch=0):
        # IK planare. Il ginocchio punta avanti; l'ultimo osso compensa le due rotazioni.
        down = hip + pelvis - height
        reach = math.hypot(forward, down)
        bend = math.acos(max(-1, min(1, (reach**2 - thigh**2 - shin**2) / (2 * thigh * shin))))
        upper = math.atan2(forward, down) + math.atan2(shin * math.sin(bend), thigh + shin * math.cos(bend))
        pose[f'UpperLeg.{side}'] = [(X, math.degrees(upper))]
        pose[f'LowerLeg.{side}'] = [(X, -math.degrees(bend))]
        pose[f'Foot.{side}'] = [(X, pitch + math.degrees(bend - upper))]

    def idle(t):
        breath = math.sin(math.tau * 2 * t)
        shift = math.sin(math.tau * t)
        pelvis = -.014 + .004 * breath
        pose = {'loc': hips_loc(rig, dz=pelvis),
                'Spine': [(X, -1.5 * breath), (Y, 2 * shift), (Z, 2 * shift)],
                'Head': [(X, math.sin(math.tau * 2 * t - .4)), (Z, 9 * math.sin(math.tau * 2 * t)), (Y, -1.5 * shift)]}
        for side in 'LR':
            sign = S[side]
            legs(pose, side, .012 * sign, ankle, pelvis)
            pose[f'UpperArm.{side}'] = [(Y, sign * (3 + breath)), (X, 2 * shift * sign)]
            pose[f'LowerArm.{side}'] = [(X, 9 + 2 * breath + 2 * sign)]
        return pose

    def gait(t, run):
        # Distanza per ciclo alle velocità di riferimento del client (2,6 e 4,4 m/s).
        distance, stance = (4.4 / 3, .38) if run else (2.6 * .4, .54)
        travel = distance * stance
        swing = 1 - stance
        poses = []
        for side, offset in (('L', 0), ('R', .5)):
            p = (t + offset) % 1
            u = max(0, (p - stance) / swing)
            lift = math.sin(math.pi * u)
            if p <= stance:
                y = travel / 2 - distance * p
            else:
                # Hermite con la stessa velocità ai confini dell'appoggio.
                y = travel * (u*u*(3 - 2*u) - .5) - distance * swing * u*(1-u)*(1-2*u)
            z = ankle + (.145 if run else .085) * lift**2
            poses.append((side, p, y, z, -20 * lift**2 * math.cos(math.pi * u)))
        ph = math.tau * t
        # Compressione dopo il contatto, estensione prima del volo. Abbassiamo
        # il bacino quanto basta per raggiungere entrambi gli appoggi.
        pelvis = (-.041 if run else -.031) - (.022 if run else .012) * math.cos(2 * ph - .65)
        for _, _, y, z, _ in poses:
            max_down = math.sqrt(max(0, (thigh + shin - .006)**2 - y*y))
            pelvis = min(pelvis, z + max_down - hip)
        pose = {'loc': hips_loc(rig, dz=pelvis),
                'Spine': [(X, -12 if run else -4), (Z, -7 * math.cos(ph)), (Y, 3 * math.sin(ph))],
                'Head': [(X, 8 if run else 2), (Z, 3 * math.cos(ph - .3))]}
        for side, p, y, z, pitch in poses:
            legs(pose, side, y, z, pelvis, pitch)
            phase = math.tau * p
            pose[f'UpperArm.{side}'] = [(Y, S[side] * (5 if run else 3)),
                                       (X, -(34 if run else 20) * math.cos(phase - .2))]
            pose[f'LowerArm.{side}'] = [(X, (67 if run else 15) - (11 if run else 6) * math.cos(phase - .55))]
        return pose

    def tool(t):
        pose = idle(t)
        breath = math.sin(math.tau * 2 * t - .2)
        pose['UpperArm.R'] = [(Y, -5), (X, 18 + 2 * breath)]
        pose['LowerArm.R'] = [(X, 57 + 3 * breath)]
        return pose

    return {'idle_tool': (tool, 180), 'idle': (idle, 180), 'walk': (lambda t: gait(t, False), 12), 'run': (lambda t: gait(t, True), 10)}
