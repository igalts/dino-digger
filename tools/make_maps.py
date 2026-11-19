"""Builds the five world-map backgrounds (360x780 SVGs), each with its own road shape through the level spots.

The game places the level buttons and the world's prize dino from MAP_LAYOUTS (same coordinates as LAYOUTS here).
Run:  py -I tools/make_maps.py
"""
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_scenes as ms  # noqa: E402  (reuse the drawing kit)

OUT = ms.OUT
INK = ms.INK
W, H = 360, 780

# Every world has its own road shape. Level spots in order, then the prize, then where the road comes in from.
# Keep NODES / PRIZE in sync with MAP_LAYOUTS in game/game.js.
LAYOUTS = [
    # volcano: zig-zag up the hill
    dict(nodes=[(95, 625), (262, 530), (100, 420), (262, 305), (150, 195)], prize=(262, 120), entry=[(40, 820), (62, 720)]),
    # jungle: along the bottom, up the right bank over the river, back left, up the left side
    dict(nodes=[(85, 640), (255, 615), (285, 410), (115, 365), (110, 215)], prize=(265, 125), entry=[(-40, 700), (10, 680)]),
    # beach: hopping between little islands
    dict(nodes=[(250, 650), (95, 560), (255, 455), (90, 335), (245, 225)], prize=(95, 120), entry=[(330, 820), (300, 730)]),
    # ice: around the frozen lake, then up to the peak
    dict(nodes=[(180, 640), (295, 480), (190, 325), (65, 455), (95, 220)], prize=(265, 120), entry=[(190, 820), (185, 730)]),
    # night: straight up the lantern avenue to the castle
    dict(nodes=[(180, 655), (215, 545), (150, 435), (210, 325), (165, 215)], prize=(285, 125), entry=[(180, 830), (180, 740)]),
]


def road_pts(L):
    return L["entry"] + L["nodes"] + [L["prize"]]


def catmull(points):
    d = f"M{points[0][0]} {points[0][1]}"
    for i in range(len(points) - 1):
        p0 = points[i - 1] if i > 0 else points[i]
        p1, p2 = points[i], points[i + 1]
        p3 = points[i + 2] if i + 2 < len(points) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += f" C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]} {p2[1]}"
    return d


def pads(L):
    # shadow pads under each level spot and the prize
    return "".join(f'<ellipse cx="{x}" cy="{y + 30}" rx="40" ry="11" fill="{INK}" opacity="0.25" stroke="none"/>'
                   for x, y in L["nodes"] + [L["prize"]])


def road(L, color, edge, dash):
    d = catmull(road_pts(L))
    out = (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="38"/>'
           f'<path d="{d}" fill="none" stroke="{edge}" stroke-width="31"/>'
           f'<path d="{d}" fill="none" stroke="{color}" stroke-width="23"/>'
           f'<path d="{d}" fill="none" stroke="{dash}" stroke-width="4" stroke-dasharray="1 15"/>')
    return out + pads(L)


def boardwalk(L):
    """A wooden pier: planks across the road, laid over the water between islands."""
    d = catmull(road_pts(L))
    return (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="34"/>'
            f'<path d="{d}" fill="none" stroke="#D9A574" stroke-width="26"/>'
            f'<path d="{d}" fill="none" stroke="#A86D40" stroke-width="26" stroke-dasharray="2 10"/>') + pads(L)


def layer(y, color, seed, amp=36):
    rnd = random.Random(seed)
    a, b, c, e = (rnd.uniform(-amp, amp) for _ in range(4))
    return (f'<path d="M-10 {y + a:.0f} Q80 {y - amp + b:.0f} 170 {y + c / 2:.0f} Q270 {y + amp + e:.0f} 370 {y - a / 2:.0f} '
            f'L370 {H + 10} L-10 {H + 10} Z" fill="{color}"/>')


def wrap(body, sky):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">'
            f'<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{sky[0]}"/>'
            f'<stop offset="1" stop-color="{sky[1]}"/></linearGradient>{ms.DEFS}</defs>'
            f'<rect width="{W}" height="{H}" fill="url(#sky)"/>'
            f'<g stroke="{INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


def lantern(x, y):
    return (f'<path d="M{x} {y} L{x} {y - 46}" fill="none" stroke="#2B1B3D" stroke-width="5"/>'
            f'<circle cx="{x}" cy="{y - 54}" r="20" fill="#FFF27A" opacity="0.25" stroke="none"/>'
            f'<rect x="{x - 8}" y="{y - 64}" width="16" height="18" rx="4" fill="#FFE27A" stroke-width="4"/>')


def bridge(x, y, w=70, angle=0):
    planks = "".join(f'<path d="M{-w / 2 + i * 10 + 5} -16 L{-w / 2 + i * 10 + 5} 16" fill="none" stroke="#8A5634" stroke-width="3"/>'
                     for i in range(int(w / 10)))
    return (f'<g transform="translate({x} {y}) rotate({angle})">'
            f'<rect x="{-w / 2}" y="-18" width="{w}" height="36" rx="6" fill="#C08A5E"/>{planks}'
            f'<path d="M{-w / 2} -18 L{w / 2} -18 M{-w / 2} 18 L{w / 2} 18" fill="none" stroke-width="5"/></g>')


def ruins(x, y, s=1.0):
    g = ('<rect x="-30" y="-70" width="22" height="70" fill="#A8A29A"/><rect x="10" y="-50" width="22" height="50" fill="#A8A29A"/>'
         '<rect x="-36" y="-80" width="76" height="14" fill="#BFB9AE"/>'
         '<path d="M-26 -50 L-14 -50 M-26 -30 L-14 -30 M14 -30 L26 -30" fill="none" stroke="#857F76" stroke-width="3"/>'
         '<path d="M-36 -80 Q-20 -90 0 -82" fill="none" stroke="#3FA244" stroke-width="5"/>')
    return f'<g transform="translate({x} {y}) scale({s})" stroke-width="{4 / s:.1f}">{g}</g>'


def boat(x, y, s=1.0):
    g = ('<path d="M-30 0 L30 0 L22 14 L-22 14 Z" fill="#B57745"/>'
         '<path d="M0 0 L0 -50" fill="none" stroke-width="4"/>'
         '<path d="M2 -48 L30 -6 L2 -6 Z" fill="#FFFFFF" stroke-width="4"/>'
         '<path d="M-36 18 Q-18 10 0 18 Q18 26 36 18" fill="none" stroke="#FFFFFF" stroke-width="3"/>')
    return f'<g transform="translate({x} {y}) scale({s})">{g}</g>'


def waves(color="#FFFFFF", seed=1, n=14):
    rnd = random.Random(seed)
    out = ""
    for _ in range(n):
        x, y = rnd.uniform(10, 340), rnd.uniform(170, 770)
        out += f'<path d="M{x:.0f} {y:.0f} q8 -6 16 0 q8 6 16 0" fill="none" stroke="{color}" stroke-width="3" opacity="0.8"/>'
    return out


def castle(x, y, s=1.0, c="#4A3A6E"):
    g = (f'<path d="M-50 0 L-50 -60 L-40 -60 L-40 -52 L-30 -52 L-30 -60 L-20 -60 L-20 -40 L20 -40 L20 -60 L30 -60 L30 -52 L40 -52 L40 -60 L50 -60 L50 0 Z" fill="{c}"/>'
         f'<path d="M-12 -40 L-12 -92 L12 -92 L12 -40 Z" fill="{c}"/><path d="M-16 -92 L0 -118 L16 -92 Z" fill="#E8553D"/>'
         '<rect x="-4" y="-80" width="8" height="12" rx="4" fill="#FFE27A" stroke-width="3"/>'
         '<rect x="-38" y="-38" width="8" height="12" rx="4" fill="#FFE27A" stroke-width="3"/><rect x="30" y="-38" width="8" height="12" rx="4" fill="#FFE27A" stroke-width="3"/>'
         '<path d="M-10 0 L-10 -18 Q0 -28 10 -18 L10 0 Z" fill="#2B1B3D"/>')
    return f'<g transform="translate({x} {y}) scale({s})" stroke-width="{5 / s:.1f}">{g}</g>'


# ---------------------------------------------------------------- the five maps
def map_volcano():
    lava = ('<path d="M196 150 Q230 260 300 300 Q360 330 380 420" fill="none" stroke="#2B1B3D" stroke-width="22"/>'
            '<path d="M196 150 Q230 260 300 300 Q360 330 380 420" fill="none" stroke="#FF6B2C" stroke-width="14"/>'
            '<path d="M200 170 Q226 250 280 286" fill="none" stroke="#FFD23F" stroke-width="4"/>')
    body = (ms.cloud(20, 120, 0.8, "#E4DEEE") + ms.cloud(270, 60, 0.6, "#E4DEEE") +
            ms.volcano(180, 300, 380, 250, erupt=True, color="#6E5486") +
            layer(300, "#B9DE8E", 1) + lava + layer(430, "#8ED16E", 2) + layer(570, "#6FC25A", 3) + layer(690, "#4CB85A", 4) +
            ms.fly("petra", 60, 250, 0.3, colors=ms.PETRA_ORANGE) + ms.fly("petra", 310, 190, 0.25, flip=True, colors=ms.PETRA_TEAL) +
            road(LAYOUTS[0], "#F2D49B", "#D9B270", "#FFFFFF") +
            ms.palm(30, 560, 0.75) + ms.palm(345, 760, 0.9, flip=True) + ms.palm(330, 430, 0.6, flip=True) +
            ms.rock(200, 400, 70, 40, "#9C8AA8") + ms.rock(330, 640, 60, 34, "#9C8AA8") + ms.rock(40, 470, 50, 28, "#9C8AA8") +
            ms.fern(190, 700, 0.9) + ms.fern(30, 360, 0.7) + ms.fern(200, 290, 0.6) +
            ms.nest(190, 615, "#5CCB5F") +
            ms.flowers([(60, 680), (150, 560), (300, 600), (220, 470), (40, 400), (320, 370), (90, 300), (170, 760)]))
    return wrap(body, ("#7FC8F0", "#FFE3B0"))


def road_cross(L, y, after=0):
    """Where the road (after level spot `after`) crosses height y: (x, angle in degrees)."""
    pts = road_pts(L)
    start = len(L["entry"]) + after
    for i in range(start, len(pts) - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < len(pts) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        prev = None
        for k in range(201):
            t = k / 200
            q = [(1 - t) ** 3 * a + 3 * (1 - t) ** 2 * t * b + 3 * (1 - t) * t ** 2 * c + t ** 3 * d
                 for a, b, c, d in zip(p1, c1, c2, p2)]
            if prev and (prev[1] - y) * (q[1] - y) <= 0:
                import math
                return q[0], math.degrees(math.atan2(q[1] - prev[1], q[0] - prev[0]))
            prev = q
    raise ValueError("road never crosses that height")


def map_jungle():
    bx, ba = road_cross(LAYOUTS[1], 501)
    global BRIDGE_J
    BRIDGE_J = bridge(round(bx), 501, 84, round(ba))
    river = ('<path d="M-10 480 Q90 450 180 478 Q270 506 370 470 L370 520 Q270 552 180 524 Q90 498 -10 530 Z" fill="#4FC3F7"/>'
             '<path d="M40 490 L70 486 M230 510 L262 514 M300 496 L330 490" fill="none" stroke="#FFFFFF" stroke-width="4"/>')
    body = (layer(160, "#9FD98A", 11, 30) +
            "".join(f'<circle cx="{x}" cy="{y}" r="40" fill="#7CC46A" stroke="none"/>' for x, y in
                    ((40, 170), (100, 150), (170, 165), (240, 145), (310, 160), (360, 150))) +
            layer(300, "#6FBF5C", 12) + ms.waterfall(18, 80, 170, 330) + layer(400, "#5FB04F", 13, 24) +
            river + layer(560, "#4FA347", 14) + layer(700, "#3F9A3C", 15) +
            road(LAYOUTS[1], "#C9B98A", "#A89664", "#FFF3D6") + BRIDGE_J +
            ruins(225, 300, 0.7) + ms.mushroom(175, 730, 1.0) + ms.mushroom(320, 710, 0.8, "#8E5BD9", "#FFD23F") +
            ms.mushroom(30, 595, 0.6, "#FF9F1C") +
            ms.fern(20, 770, 1.4, "#2F8F3A") + ms.fern(345, 590, 1.0, "#2F8F3A") + ms.fern(345, 300, 0.8, "#2F8F3A") +
            ms.trunk(8, 40) + ms.trunk(352, 36) + ms.vine(46, 260, 4) + ms.vine(316, 220, 5) + ms.canopy() +
            ms.fly("petra", 300, 250, 0.28, flip=True) +
            ms.flowers([(330, 660), (180, 680), (170, 290), (30, 720), (210, 560)], ("#FF6B6B", "#FFD23F", "#FF8FA3")))
    return wrap(body, ("#9ED67A", "#E2F7C8"))


def islet(x, y, rx, ry):
    return (f'<ellipse cx="{x}" cy="{y}" rx="{rx + 12}" ry="{ry + 10}" fill="#7FD8FF" stroke="none"/>'
            f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#FFD98A"/>')


def map_beach():
    L = LAYOUTS[2]
    isles = "".join(islet(x, y + 20, 70, 46) for x, y in L["nodes"]) + islet(L["prize"][0], L["prize"][1] + 30, 78, 40)
    shore = ('<path d="M-10 790 L-10 750 Q60 728 130 744 Q200 760 260 738 Q320 718 370 736 L370 790 Z" fill="#7FD8FF" stroke="none"/>'
             '<path d="M-10 790 L-10 762 Q60 742 130 756 Q200 772 260 752 Q320 734 370 750 L370 790 Z" fill="#FFD98A"/>')
    body = (ms.sun(305, 62, 26) + ms.cloud(170, 50, 0.55) +
            '<rect x="-10" y="100" width="380" height="690" fill="#2FA7E0" stroke="none"/>'
            '<path d="M-10 100 Q30 92 70 100 Q110 108 150 100 Q190 92 230 100 Q270 108 310 100 Q350 92 370 98" fill="none" stroke="#FFFFFF" stroke-width="4"/>' +
            waves(seed=3, n=18) + shore + isles +
            ms.plesio(310, 330, 0.4, "#39C1B5", "#2FA7E0") + boat(320, 150, 0.6) +
            ms.fish(170, 520, "#FFB13B", flip=True, s=0.7) + ms.fish(40, 450, "#FF8FA3", s=0.6) +
            ms.rock(340, 590, 34, 24, "#8C8C9C") + ms.rock(20, 660, 30, 22, "#8C8C9C") +
            boardwalk(L) +
            ms.palm(318, 690, 0.5, flip=True) + ms.palm(30, 600, 0.45) + ms.palm(318, 495, 0.42, flip=True) +
            ms.palm(28, 372, 0.42) + ms.palm(165, 158, 0.42, flip=True) +
            ms.sandcastle(186, 704, 0.4) + ms.crab(80, 772, 0.6) + ms.starfish(150, 596, 9) + ms.starfish(312, 250, 9, "#FFB13B") +
            ms.shell(150, 368) + ms.shell(230, 772, 0.9, "#FFF3D6"))
    return wrap(body, ("#6FCDF8", "#FFF0C8"))


def map_ice():
    mountains = ('<path d="M-10 300 L60 130 L110 200 L180 70 L250 210 L300 140 L370 260 L370 320 L-10 320 Z" fill="#D6D0EE"/>'
                 '<path d="M60 130 L80 170 L66 164 L52 178 L44 160 Z M180 70 L206 116 L190 110 L176 126 L162 104 Z '
                 'M300 140 L322 176 L306 170 L292 184 L286 164 Z" fill="#FFFFFF" stroke-width="4"/>')
    lake = ('<ellipse cx="178" cy="482" rx="74" ry="56" fill="#BDEBFF"/>'
            '<ellipse cx="178" cy="482" rx="56" ry="40" fill="none" stroke="#FFFFFF" stroke-width="3" opacity="0.8"/>'
            '<path d="M140 470 L170 462 M180 500 L214 494 M150 448 L164 446" fill="none" stroke="#FFFFFF" stroke-width="4"/>')
    body = (ms.cloud(30, 100, 0.6) + mountains + layer(300, "#EEF4FF", 21, 20) + layer(430, "#F6FAFF", 22, 24) +
            layer(600, "#FFFFFF", 23, 20) + layer(720, "#EEF6FF", 24, 16) + lake +
            road(LAYOUTS[3], "#CFE8FA", "#9CC7EA", "#FFFFFF") +
            ms.pine(330, 650, 0.8) + ms.pine(40, 745, 0.9) + ms.pine(30, 610, 0.65) + ms.pine(330, 380, 0.55) +
            ms.pine(265, 760, 0.55) + ms.igloo(300, 300, 0.55) + ms.snowman(30, 345, 0.45) +
            ms.mammoth(100, 720, 0.4) + ms.snowflakes(36, 7, 770))
    return wrap(body, ("#A6DBFF", "#F2FAFF"))


def map_night():
    body = (ms.stars(70, 61, 360) + ms.moon(70, 90, 26) + ms.shooting_star(330, 70, 80) +
            layer(260, "#2E3A6E", 31, 30) + castle(70, 238, 0.8) + layer(380, "#2A4A5E", 32) +
            layer(520, "#244A3E", 33) + layer(660, "#1A3A30", 34) +
            road(LAYOUTS[4], "#5B4E8E", "#3E3470", "#FFF27A") +
            lantern(100, 650) + lantern(270, 625) + lantern(90, 530) + lantern(285, 470) + lantern(75, 410) +
            lantern(280, 345) + lantern(90, 300) + lantern(255, 230) +
            ms.mushroom(35, 600, 0.8, "#39C1B5", "#C9F2EE", glow="#5CF2E0") + ms.mushroom(330, 545, 0.8, "#A884E8", "#E3D6FF", glow="#C9A8FF") +
            ms.mushroom(320, 745, 1.0, "#39C1B5", "#C9F2EE", glow="#5CF2E0") +
            "".join(ms.firefly(x, y) for x, y in ((30, 330), (330, 300), (300, 700), (60, 700), (40, 480), (335, 420), (120, 170), (230, 760))) +
            ms.pine(30, 470, 0.6, snow=False, color="#2F5A4C") + ms.pine(60, 770, 0.7, snow=False, color="#2F5A4C"))
    return wrap(body, ("#140E36", "#3E3A8C"))


def dig_ground():
    """Under the grass: the dig game's dirt, cut open. A green field already claimed, the yellow trail
    (marching) closing the next one, and treasures buried in the dirt: an egg, gems and fossil bones."""
    dirt = (layer(640, "#A0673F", 51, 8) + layer(720, "#8E5A36", 52, 10))
    pebbles = "".join(f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r * .7:.1f}" fill="#6B4026" stroke="none" opacity=".6"/>'
                      for x, y, r in ((120, 700, 3), (230, 760, 3.5), (340, 740, 3)))
    egg = ('<ellipse cx="300" cy="712" rx="17" ry="22" fill="#FFF4C9"/>'
           '<path d="M287 708 l5 5 l5 -6 l5 6 l5 -5" fill="none" stroke-width="3"/>'
           '<circle cx="306" cy="700" r="3" fill="#FF8FA3" stroke="none"/>')

    def gem(x, y, c):
        return (f'<path d="M{x} {y - 10} L{x + 9} {y} L{x} {y + 10} L{x - 9} {y} Z" fill="{c}" stroke-width="3"/>'
                f'<path class="glint" d="M{x - 3} {y - 4} L{x} {y - 7}" fill="none" stroke="#FFFFFF" stroke-width="2.5"/>')

    def bone(x, y, a):
        return (f'<g transform="rotate({a} {x} {y})"><path d="M{x - 16} {y} H{x + 16}" fill="none" stroke-width="11"/>'
                f'<path d="M{x - 16} {y} H{x + 16}" fill="none" stroke="#FFF4E0" stroke-width="5"/>'
                f'<circle cx="{x - 18}" cy="{y - 4}" r="5" fill="#FFF4E0" stroke-width="3"/><circle cx="{x - 18}" cy="{y + 4}" r="5" fill="#FFF4E0" stroke-width="3"/>'
                f'<circle cx="{x + 18}" cy="{y - 4}" r="5" fill="#FFF4E0" stroke-width="3"/><circle cx="{x + 18}" cy="{y + 4}" r="5" fill="#FFF4E0" stroke-width="3"/></g>')
    return dirt + pebbles + egg + gem(190, 700, "#4FC3F7") + bone(60, 752, -12)


def dig_mesa():
    """A flat dirt hill on the right, where the sky is quiet: a green field already claimed on it, and the
    yellow trail marching around the next one."""
    hill = '<path d="M180 440 L215 318 Q220 300 240 300 L340 300 Q360 300 366 318 L400 440 Z" fill="#A0673F"/>'
    claimed = ('<path d="M232 316 H292 V352 H262 V390 H226 Z" fill="#5CCB5F" stroke-width="4"/>'
               '<path d="M238 326 h14 M244 342 h16 M234 370 h14 M270 324 h14" fill="none" stroke="#3FA244" stroke-width="3"/>')
    trail = ('<path class="trail" d="M292 316 H346 V404 H262 V390" fill="none" stroke="#FFD23F" stroke-width="5" '
             'stroke-dasharray="12 10" stroke-linecap="round"/>'
             '<circle cx="262" cy="390" r="7" fill="#FFD23F" stroke-width="3.5"/>')
    specks = "".join(f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r * .7:.1f}" fill="#6B4026" stroke="none" opacity=".6"/>'
                     for x, y, r in ((310, 340, 3.5), (320, 380, 3), (210, 420, 3), (360, 420, 3.5), (300, 425, 2.5)))
    return hill + specks + claimed + trail


def title_bg():
    """Title screen of the dig game, kept calm: a soft morning sky, one faraway volcano, gentle hills,
    a dirt hill on the right with the claimed field and the marching trail, and dirt at the very bottom."""
    sky = ('<defs><linearGradient id="tsky" x1="0" y1="0" x2="0" y2="1">'
           '<stop offset="0" stop-color="#6FC8F5"/><stop offset="0.35" stop-color="#B8E8FF"/>'
           '<stop offset="0.55" stop-color="#FFF1C6"/></linearGradient></defs>'
           f'<rect width="{W}" height="{H}" fill="url(#tsky)" stroke="none"/>')
    sun = ('<circle cx="300" cy="96" r="46" fill="#FFF6C9" stroke="none" opacity=".6"/>'
           '<circle cx="300" cy="96" r="30" fill="#FFD23F"/>')
    far_volcano = ('<path d="M-20 420 L40 330 Q60 312 80 330 L150 420 Z" fill="#B7A6D6" stroke-width="4"/>'
                   '<path d="M44 326 Q60 316 76 326 L70 340 Q60 334 50 340 Z" fill="#FF9F1C" stroke-width="3"/>'
                   '<circle cx="66" cy="296" r="11" fill="#FFFFFF" stroke="none" opacity=".85"/>'
                   '<circle cx="80" cy="276" r="8" fill="#FFFFFF" stroke="none" opacity=".7"/>')
    body = (sun + ms.cloud(70, 120, 0.6) + ms.cloud(200, 236, 0.45) +
            far_volcano + dig_mesa() +
            layer(440, "#B9E59A", 41, 16) + layer(530, "#8ED16E", 42, 20) + layer(610, "#6FC25A", 43, 14) +
            dig_ground())
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" preserveAspectRatio="xMidYMax slice">'
            '<style>.trail{animation:march 1.1s linear infinite}@keyframes march{to{stroke-dashoffset:-26}}'
            '.glint{animation:glint 1.6s ease-in-out infinite}@keyframes glint{50%{opacity:.25}}</style>'
            f'<defs>{ms.DEFS}</defs>'
            f'<g stroke="{INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">{sky}{body}</g></svg>')


def main():
    for i, fn in enumerate((map_volcano, map_jungle, map_beach, map_ice, map_night), 1):
        with open(os.path.join(OUT, f"map-{i}.svg"), "w", encoding="utf8") as f:
            f.write(fn())
    with open(os.path.join(OUT, "title-bg.svg"), "w", encoding="utf8") as f:
        f.write(title_bg())
    print("wrote 5 maps + title background")


if __name__ == "__main__":
    main()
