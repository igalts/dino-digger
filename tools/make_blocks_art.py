"""Art for the blocks game (דינו בלוקים): five new worlds, each with a map (bmap-N, 360x780),
a level background (bbg-N, 360x640) and a boss (bboss-N), plus the blocks title background (btitle-bg).

Keep NODES / PRIZE in sync with B_MAP_LAYOUTS in game/game.js.
Run:  py -I tools/make_blocks_art.py
"""
import math
import os
import random
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_scenes as ms  # noqa: E402
import make_maps as mm  # noqa: E402

OUT = ms.OUT
INK = ms.INK
W, H = 360, 780

def _line(pts, step=2.0):
    out = [pts[0]]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = max(1, int(math.hypot(x1 - x0, y1 - y0) / step))
        out += [(x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n) for k in range(1, n + 1)]
    return out


def _arc(cx, cy, r, a0, a1, n=60):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * k / n)),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * k / n))) for k in range(n + 1)]


def _round_corners(pts, r=26):
    """A polyline whose sharp corners are rounded off a little."""
    out = [pts[0]]
    for a, b, c in zip(pts, pts[1:], pts[2:]):
        la, lc = math.hypot(a[0] - b[0], a[1] - b[1]), math.hypot(c[0] - b[0], c[1] - b[1])
        p = (b[0] + (a[0] - b[0]) * r / la, b[1] + (a[1] - b[1]) * r / la)
        q = (b[0] + (c[0] - b[0]) * r / lc, b[1] + (c[1] - b[1]) * r / lc)
        out.append(p)
        out += [((1 - t) ** 2 * p[0] + 2 * (1 - t) * t * b[0] + t ** 2 * q[0],
                 (1 - t) ** 2 * p[1] + 2 * (1 - t) * t * b[1] + t ** 2 * q[1]) for t in (k / 12 for k in range(1, 13))]
    out.append(pts[-1])
    return _line(out)


def _shape(path, fracs=(0.1, 0.28, 0.46, 0.64, 0.82)):
    """Level spots at fractions of the road's length; the prize at its end."""
    lens = [0.0]
    for (x0, y0), (x1, y1) in zip(path, path[1:]):
        lens.append(lens[-1] + math.hypot(x1 - x0, y1 - y0))
    nodes = []
    for f in fracs:
        i = min(range(len(lens)), key=lambda k: abs(lens[k] - f * lens[-1]))
        nodes.append((round(path[i][0]), round(path[i][1])))
    end = path[-1]
    return dict(path=path, nodes=nodes, prize=(round(end[0]), round(end[1])))


def _spiral():
    pts = _line([(180, 830), (180, 600)])
    for k in range(1, 241):  # 1.6 turns inward around the middle
        t = k / 240
        a = math.radians(90 - 576 * t)
        r = 165 - 120 * t
        pts.append((180 + r * math.cos(a) * 0.95, 435 + r * math.sin(a)))
    return pts


def _u_turns():
    rows = [605, 465, 325, 185]
    lx, rx = 118, 242
    pts = _line([(rx + 40, 830), (rx + 40, rows[0] + 40)])
    pts += _round_corners([(rx + 40, rows[0] + 40), (rx + 40, rows[0]), (lx, rows[0])], 30)[1:]
    for i in range(len(rows) - 1):
        cy = (rows[i] + rows[i + 1]) / 2
        r = (rows[i] - rows[i + 1]) / 2
        if i % 2 == 0:  # turning on the left side
            pts += _arc(lx, cy, r, 90, 270)[1:]
            pts += _line([(lx, rows[i + 1]), (rx, rows[i + 1])])[1:]
        else:
            pts += _arc(rx, cy, r, 90, -90)[1:]
            pts += _line([(rx, rows[i + 1]), (lx, rows[i + 1])])[1:]
    return pts


def _orbits():
    pts = _line([(180, 830), (180, 710)])
    for i, (y0, y1) in enumerate(((710, 545), (545, 375), (375, 200))):
        cy, r = (y0 + y1) / 2, (y0 - y1) / 2
        pts += _arc(180, cy, r, 90, -90 if i % 2 == 0 else 270)[1:]
    pts += _line([(180, 200), (180, 115)])[1:]
    return pts


# Where along each road the 5 level spots sit. Level 1 is at y≈605 on every map, so the world
# switcher at the bottom of the screen never covers it; the road below it is the way in.
F = [
    (0.223, 0.377, 0.532, 0.686, 0.84),
    (0.178, 0.344, 0.509, 0.675, 0.84),
    (0.213, 0.379, 0.546, 0.713, 0.88),
    (0.222, 0.377, 0.531, 0.686, 0.84),
    (0.274, 0.415, 0.557, 0.698, 0.84),
]
LAYOUTS = [
    # crystal cave: a sharp lightning zigzag up the cave
    _shape(_round_corners([(180, 830), (180, 700), (60, 610), (300, 480), (60, 350), (300, 225), (130, 115)], 22), fracs=F[0]),
    # candy land: a lollipop swirl into the middle
    _shape(_spiral(), fracs=F[1]),
    # under the sea: wide U-turns, back and forth
    _shape(_u_turns(), fracs=F[2]),
    # desert: up the steps of a pyramid
    _shape(_round_corners([(60, 830), (60, 600), (150, 600), (150, 505), (240, 505), (240, 410), (310, 410),
                           (310, 310), (90, 310), (90, 230)], 16), fracs=F[3]),
    # space: orbit arcs around the planets
    _shape(_orbits(), fracs=F[4]),
]



# ---------------------------------------------------------------- props
def crystal(x, gy, s=1.0, c="#B07CE8", light="#E3D6FF"):
    g = (f'<path d="M-14 0 L-18 -40 L-6 -62 L6 -40 L2 0 Z" fill="{c}"/>'
         f'<path d="M0 0 L4 -54 L18 -86 L30 -54 L24 0 Z" fill="{c}"/>'
         f'<path d="M20 0 L26 -30 L36 -44 L44 -28 L40 0 Z" fill="{c}"/>'
         f'<path d="M8 -50 L17 -78 L20 -52 Z" fill="{light}" stroke="none"/>'
         f'<path d="M-12 -36 L-6 -54 L-4 -38 Z" fill="{light}" stroke="none"/>')
    return f'<g transform="translate({x} {gy}) scale({s})" stroke-width="{4 / s:.1f}">{g}</g>'


def glow(x, y, r, c):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" opacity="0.22" stroke="none"/>'


def stalactites(color, seed, y=0, n=9, maxh=90):
    rnd = random.Random(seed)
    out = ""
    for i in range(n):
        x = i * (W / (n - 1)) + rnd.uniform(-12, 12)
        h = rnd.uniform(maxh * 0.4, maxh)
        w = rnd.uniform(16, 30)
        out += f'<path d="M{x - w:.0f} {y - 10} L{x + w:.0f} {y - 10} L{x:.0f} {y + h:.0f} Z" fill="{color}"/>'
    return out


def lollipop(x, gy, s=1.0, c="#FF6FA8"):
    g = (f'<path d="M0 0 L0 -70" fill="none" stroke="#FFFFFF" stroke-width="9"/>'
         f'<path d="M0 0 L0 -70" fill="none" stroke="{INK}" stroke-width="3" opacity=".25"/>'
         f'<circle cx="0" cy="-92" r="28" fill="{c}"/>'
         f'<path d="M0 -92 m-18 0 a18 18 0 1 1 18 18 a12 12 0 1 1 -12 -12 a6 6 0 1 1 6 6" fill="none" stroke="#FFFFFF" stroke-width="5"/>')
    return f'<g transform="translate({x} {gy}) scale({s})" stroke-width="{5 / s:.1f}">{g}</g>'


def candycane(x, gy, s=1.0, flip=False):
    d = "M0 0 L0 -70 Q0 -96 22 -96 Q44 -96 44 -74"
    g = (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="20"/>'
         f'<path d="{d}" fill="none" stroke="#FFFFFF" stroke-width="12"/>'
         f'<path d="{d}" fill="none" stroke="#FF4F6E" stroke-width="12" stroke-dasharray="9 9"/>')
    sx = -s if flip else s
    return f'<g transform="translate({x} {gy}) scale({sx} {s})">{g}</g>'


def cupcake(x, gy, s=1.0, frost="#FFC2DD", cup="#8FD3FF"):
    g = (f'<path d="M-30 -40 L30 -40 L22 0 L-22 0 Z" fill="{cup}"/>'
         '<path d="M-14 -38 L-11 -2 M0 -38 L0 -2 M14 -38 L11 -2" fill="none" stroke-width="3" opacity=".4"/>'
         f'<path d="M-36 -40 Q-40 -62 -18 -64 Q-14 -86 6 -80 Q26 -88 30 -64 Q46 -60 36 -40 Z" fill="{frost}"/>'
         '<circle cx="2" cy="-86" r="8" fill="#FF4F6E" stroke-width="3"/>'
         '<path d="M-20 -52 L-16 -50 M8 -58 L12 -60 M20 -48 L24 -46 M-6 -66 L-4 -62" fill="none" stroke="#FFD23F" stroke-width="3"/>')
    return f'<g transform="translate({x} {gy}) scale({s})" stroke-width="{4 / s:.1f}">{g}</g>'


def gumdrops(points):
    cols = ("#FF6FA8", "#7EE0C3", "#FFD23F", "#B07CE8", "#FF9F1C")
    return "".join(f'<path d="M{x - 12} {y} Q{x - 12} {y - 22} {x} {y - 22} Q{x + 12} {y - 22} {x + 12} {y} Z" fill="{cols[i % 5]}" stroke-width="3.5"/>'
                   f'<circle cx="{x - 4}" cy="{y - 14}" r="2.5" fill="#FFFFFF" stroke="none"/>' for i, (x, y) in enumerate(points))


def seaweed(x, gy, h=120, c="#3FBF7F", seed=1):
    rnd = random.Random(seed)
    d = f"M{x} {gy}"
    for k in range(1, 6):
        d += f" Q{x + rnd.uniform(-22, 22):.0f} {gy - h * (k - .5) / 5:.0f} {x + rnd.uniform(-6, 6):.0f} {gy - h * k / 5:.0f}"
    return (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="14"/>'
            f'<path d="{d}" fill="none" stroke="{c}" stroke-width="8"/>')


def coral(x, gy, s=1.0, c="#FF7F7F"):
    g = (f'<path d="M0 0 L0 -40 M0 -26 Q-22 -30 -24 -56 M0 -34 Q20 -40 22 -66 M-24 -56 L-30 -70 M22 -66 L30 -78 M-14 -40 L-14 -60" '
         f'fill="none" stroke="{INK}" stroke-width="15"/>'
         f'<path d="M0 0 L0 -40 M0 -26 Q-22 -30 -24 -56 M0 -34 Q20 -40 22 -66 M-24 -56 L-30 -70 M22 -66 L30 -78 M-14 -40 L-14 -60" '
         f'fill="none" stroke="{c}" stroke-width="9"/>')
    return f'<g transform="translate({x} {gy}) scale({s})">{g}</g>'


def bubbles(seed, n=16, ymax=760):
    rnd = random.Random(seed)
    out = ""
    for _ in range(n):
        x, y, r = rnd.uniform(10, 350), rnd.uniform(20, ymax), rnd.uniform(4, 11)
        out += (f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="#FFFFFF" fill-opacity=".18" stroke="#FFFFFF" stroke-width="2.5"/>'
                f'<circle cx="{x - r * .35:.1f}" cy="{y - r * .35:.1f}" r="{r * .25:.1f}" fill="#FFFFFF" stroke="none"/>')
    return out


def chest(x, gy, s=1.0):
    g = ('<rect x="-30" y="-34" width="60" height="34" rx="4" fill="#B57745"/>'
         '<path d="M-30 -34 Q-30 -56 0 -56 Q30 -56 30 -34 Z" fill="#C98A52"/>'
         '<rect x="-30" y="-38" width="60" height="8" fill="#FFD23F" stroke-width="3"/>'
         '<rect x="-6" y="-42" width="12" height="16" rx="3" fill="#FFD23F" stroke-width="3"/>'
         '<circle cx="-18" cy="-60" r="6" fill="#FFD23F" stroke-width="3"/><circle cx="14" cy="-62" r="5" fill="#7EE0C3" stroke-width="3"/>')
    return f'<g transform="translate({x} {gy}) scale({s})" stroke-width="{4 / s:.1f}">{g}</g>'


def jelly(x, y, s=1.0, c="#FF9EC0"):
    g = (f'<path d="M-20 0 Q-20 -26 0 -26 Q20 -26 20 0 Z" fill="{c}"/>'
         f'<path d="M-14 0 Q-18 14 -12 26 M-4 0 Q-8 16 -2 30 M6 0 Q2 14 8 26 M14 0 Q12 12 18 22" fill="none" stroke="{c}" stroke-width="4"/>'
         '<circle cx="-7" cy="-12" r="2.5" fill="#2B1B3D" stroke="none"/><circle cx="7" cy="-12" r="2.5" fill="#2B1B3D" stroke="none"/>')
    return f'<g transform="translate({x} {y}) scale({s})" stroke-width="{4 / s:.1f}">{g}</g>'


def pyramid(x, gy, w=160, h=110, c="#F2B45C", shade="#D9923A"):
    return (f'<path d="M{x - w / 2} {gy} L{x} {gy - h} L{x + w / 2} {gy} Z" fill="{c}"/>'
            f'<path d="M{x} {gy - h} L{x + w / 2} {gy} L{x + w * .12:.0f} {gy} Z" fill="{shade}" stroke="none"/>'
            f'<path d="M{x - w * .32:.0f} {gy - h * .36:.0f} L{x + w * .32:.0f} {gy - h * .36:.0f} M{x - w * .16:.0f} {gy - h * .68:.0f} L{x + w * .16:.0f} {gy - h * .68:.0f}" '
            'fill="none" stroke-width="3" opacity=".35"/>'
            f'<path d="M{x - w / 2} {gy} L{x} {gy - h} L{x + w / 2} {gy} Z" fill="none"/>')


def cactus(x, gy, s=1.0, c="#5CCB5F"):
    g = (f'<path d="M-9 0 L-9 -70 Q-9 -82 0 -82 Q9 -82 9 -70 L9 0 Z" fill="{c}"/>'
         f'<path d="M-9 -36 L-22 -36 Q-30 -36 -30 -46 L-30 -60 Q-30 -66 -24 -66 Q-18 -66 -18 -60 L-18 -46 L-9 -46" fill="{c}"/>'
         f'<path d="M9 -48 L20 -48 Q28 -48 28 -58 L28 -66 Q28 -72 22 -72 Q16 -72 16 -66 L16 -58 L9 -58" fill="{c}"/>'
         '<circle cx="0" cy="-86" r="5" fill="#FF6FA8" stroke-width="3"/>')
    return f'<g transform="translate({x} {gy}) scale({s})" stroke-width="{4 / s:.1f}">{g}</g>'


def dune(y, color, seed, amp=30):
    return mm.layer(y, color, seed, amp)


def planet(x, y, r, c, ring=None, spots=None):
    out = ""
    if ring:
        out += f'<ellipse cx="{x}" cy="{y}" rx="{r * 1.7:.0f}" ry="{r * .45:.0f}" fill="none" stroke="{INK}" stroke-width="11" transform="rotate(-18 {x} {y})"/>'
        out += f'<ellipse cx="{x}" cy="{y}" rx="{r * 1.7:.0f}" ry="{r * .45:.0f}" fill="none" stroke="{ring}" stroke-width="5" transform="rotate(-18 {x} {y})"/>'
    out += f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}"/>'
    if spots:
        out += "".join(f'<circle cx="{x + dx * r:.0f}" cy="{y + dy * r:.0f}" r="{rr * r:.0f}" fill="{spots}" stroke="none"/>'
                       for dx, dy, rr in ((-.35, -.2, .22), (.3, .25, .16), (.1, -.5, .1)))
    if ring:  # front half of the ring over the planet
        out += (f'<path d="M{x - r * 1.7:.0f} {y} A{r * 1.7:.0f} {r * .45:.0f} 0 0 0 {x + r * 1.7:.0f} {y}" fill="none" stroke="{INK}" stroke-width="11" transform="rotate(-18 {x} {y})"/>'
                f'<path d="M{x - r * 1.7:.0f} {y} A{r * 1.7:.0f} {r * .45:.0f} 0 0 0 {x + r * 1.7:.0f} {y}" fill="none" stroke="{ring}" stroke-width="5" transform="rotate(-18 {x} {y})"/>')
    return out


def rocket(x, y, s=1.0, a=20):
    g = ('<path d="M0 -50 Q18 -30 16 10 L-16 10 Q-18 -30 0 -50 Z" fill="#FFFFFF"/>'
         '<circle cx="0" cy="-16" r="8" fill="#4FC3F7" stroke-width="4"/>'
         '<path d="M-16 0 L-28 18 L-14 14 Z M16 0 L28 18 L14 14 Z" fill="#FF6B7A"/>'
         '<path d="M-10 12 Q0 40 10 12 Z" fill="#FFD23F"/><path d="M-5 12 Q0 26 5 12 Z" fill="#FF9F1C" stroke="none"/>')
    return f'<g transform="translate({x} {y}) rotate({a}) scale({s})" stroke-width="{4 / s:.1f}">{g}</g>'


def ufo(x, y, s=1.0):
    g = ('<ellipse cx="0" cy="-8" rx="16" ry="14" fill="#BDEBFF"/>'
         '<ellipse cx="0" cy="0" rx="38" ry="12" fill="#B07CE8"/>'
         '<circle cx="-20" cy="0" r="3.5" fill="#FFD23F" stroke="none"/><circle cx="0" cy="3" r="3.5" fill="#FFD23F" stroke="none"/><circle cx="20" cy="0" r="3.5" fill="#FFD23F" stroke="none"/>')
    return f'<g transform="translate({x} {y}) scale({s})" stroke-width="{4 / s:.1f}">{g}</g>'


def craters(points, c="#8E84B8"):
    return "".join(f'<ellipse cx="{x}" cy="{y}" rx="{r}" ry="{r * .45:.1f}" fill="{c}" stroke-width="3.5"/>' for x, y, r in points)


def road_paved(L, color, edge, dash):
    return mm.road(L, color, edge, dash)


# ---------------------------------------------------------------- roads: one of a kind per world
def road_samples(L, step):
    """Points evenly spaced along the road, each as (x, y, angle in degrees)."""
    dense = L["path"]
    out, run = [], step / 2
    for (x0, y0), (x1, y1) in zip(dense, dense[1:]):
        seg = math.hypot(x1 - x0, y1 - y0)
        run += seg
        if run >= step:
            run -= step
            out.append((x1, y1, math.degrees(math.atan2(y1 - y0, x1 - x0))))
    return out


def road_line(L, *strokes):
    d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in L["path"])
    return "".join(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linejoin="round"{extra}/>'
                   for c, w, extra in strokes)


def road_crystal(L):
    # a glowing path of gem tiles
    cols = [("#7EE0FF", "#E6FBFF"), ("#E08CFF", "#FBE3FF"), ("#7EE0C3", "#E3FFF5"), ("#FFD23F", "#FFF6C9")]
    out = road_line(L, ("#C9A8FF", 60, ' opacity=".22" stroke-linecap="round"'), (INK, 36, ""), ("#3A2E7A", 30, ""))
    for i, (x, y, a) in enumerate(road_samples(L, 21)):
        c, lt = cols[i % 4]
        out += (f'<g transform="translate({x:.1f} {y:.1f}) rotate({a:.0f})">'
                f'<path d="M-9 0 L-5 -11 L5 -11 L9 0 L5 11 L-5 11 Z" fill="{c}" stroke-width="2.5"/>'
                f'<path d="M-5 -7 L0 -9 L-2 -2 Z" fill="{lt}" stroke="none"/></g>')
    return out + mm.pads(L)


def road_candy(L):
    # a candy-cane road: red and white stripes, with sprinkles
    out = road_line(L, (INK, 38, ""), ("#FFFFFF", 30, ""), ("#FF4F6E", 30, ' stroke-dasharray="10 10" stroke-linecap="butt"'))
    spr = ["#FFD23F", "#7EE0C3", "#8FD3FF", "#B07CE8"]
    for i, (x, y, a) in enumerate(road_samples(L, 46)):
        side = 26 if i % 2 else -26
        r = math.radians(a + 90)
        sx, sy = x + math.cos(r) * side, y + math.sin(r) * side
        out += (f'<rect x="{sx - 6:.1f}" y="{sy - 2.5:.1f}" width="12" height="5" rx="2.5" fill="{spr[i % 4]}" '
                f'stroke-width="2" transform="rotate({(i * 47) % 180} {sx:.1f} {sy:.1f})"/>')
    return out + mm.pads(L)


def road_sea(L):
    # stepping stones across the sea floor, with a trail of bubbles between them
    out = road_line(L, ("#BFF0FF", 30, ' opacity=".28" stroke-linecap="round"'))
    stones = ["#F2D49B", "#E8C384", "#F7E2B5"]
    for i, (x, y, a) in enumerate(road_samples(L, 30)):
        out += (f'<g transform="translate({x:.1f} {y:.1f}) rotate({a:.0f})">'
                f'<ellipse cx="0" cy="2" rx="15" ry="12" fill="{INK}" opacity=".25" stroke="none"/>'
                f'<ellipse cx="0" cy="0" rx="14" ry="11.5" fill="{stones[i % 3]}" stroke-width="3"/>'
                f'<ellipse cx="-4" cy="-4" rx="4" ry="2.5" fill="#FFFFFF" opacity=".55" stroke="none"/></g>')
    for i, (x, y, a) in enumerate(road_samples(L, 30)[:-1]):
        r = math.radians(a)
        bx, by = x + math.cos(r) * 15, y + math.sin(r) * 15
        out += f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{2.5 + (i % 2)}" fill="#E6FBFF" stroke="#2A7FC0" stroke-width="1.5"/>'
    return out + mm.pads(L)


def road_desert(L):
    # an old road of sandstone blocks, laid in two rows like a pyramid wall
    out = road_line(L, (INK, 38, ""), ("#B8864A", 31, ""))
    for i, (x, y, a) in enumerate(road_samples(L, 7)):
        if i % 2:
            off, fill = 6.5, "#F2CF8A"
        else:
            off, fill = -6.5, "#EAC07A"
        out += (f'<g transform="translate({x:.1f} {y:.1f}) rotate({a:.0f})">'
                f'<rect x="-6.5" y="{off - 6:.1f}" width="13" height="12" rx="2" fill="{fill}" stroke="#9C6B34" stroke-width="2"/></g>')
    return out + mm.pads(L)


def road_space(L):
    # a neon light-beam road with a dotted centre line and twinkles beside it
    out = road_line(L, ("#7EE0FF", 54, ' opacity=".16" stroke-linecap="round"'), (INK, 38, ""),
                    ("#7EE0FF", 31, ""), ("#1A1450", 24, ""),
                    ("#FFF27A", 4, ' stroke-dasharray="8 12" stroke-linecap="round"'))
    for i, (x, y, a) in enumerate(road_samples(L, 52)):
        side = 30 if i % 2 else -30
        r = math.radians(a + 90)
        sx, sy = x + math.cos(r) * side, y + math.sin(r) * side
        out += (f'<path d="M{sx:.1f} {sy - 6:.1f} L{sx + 1.6:.1f} {sy - 1.6:.1f} L{sx + 6:.1f} {sy:.1f} L{sx + 1.6:.1f} {sy + 1.6:.1f} '
                f'L{sx:.1f} {sy + 6:.1f} L{sx - 1.6:.1f} {sy + 1.6:.1f} L{sx - 6:.1f} {sy:.1f} L{sx - 1.6:.1f} {sy - 1.6:.1f} Z" '
                f'fill="#FFF6C9" stroke="none"/>')
    return out + mm.pads(L)


# ---------------------------------------------------------------- maps
def wrap(body, sky):
    return mm.wrap(body, sky)


def map_crystal():
    L = LAYOUTS[0]
    body = (stalactites("#4A3A7E", 1, 0, 9, 110) +
            mm.layer(260, "#5B4A9E", 101, 26) + mm.layer(420, "#4E4092", 102, 30) + mm.layer(580, "#433788", 103, 24) +
            mm.layer(700, "#3A2E7A", 104, 18) +
            glow(60, 380, 60, "#7EE0FF") + glow(300, 560, 70, "#E08CFF") + glow(300, 250, 50, "#7EE0C3") +
            crystal(40, 420, 1.0, "#7EE0FF", "#E6FBFF") + crystal(300, 600, 1.1, "#E08CFF", "#FBE3FF") +
            crystal(320, 300, 0.8, "#7EE0C3", "#E3FFF5") + crystal(30, 760, 1.2, "#B07CE8") + crystal(310, 770, 0.9, "#7EE0FF", "#E6FBFF") +
            crystal(290, 150, 0.6, "#FFD23F", "#FFF6C9") +
            road_crystal(L) +
            crystal(110, 500, 0.5, "#FF8FC8", "#FFE3F0") + crystal(270, 700, 0.55, "#7EE0C3", "#E3FFF5") +
            ms.mushroom(330, 420, 0.7, "#39C1B5", "#C9F2EE", glow="#5CF2E0") + ms.mushroom(30, 280, 0.6, "#A884E8", "#E3D6FF", glow="#C9A8FF") +
            "".join(ms.firefly(x, y) for x, y in ((140, 300), (330, 680), (50, 520), (240, 760), (300, 160))))
    return wrap(body, ("#2A1F5C", "#4A3A8E"))


def map_candy():
    L = LAYOUTS[1]
    river = ('<path d="M-10 410 Q90 380 180 404 Q270 430 370 396 L370 440 Q270 474 180 448 Q90 424 -10 454 Z" fill="#8B5A3C"/>'
             '<path d="M40 420 q10 -6 20 0 M230 438 q10 -6 20 0" fill="none" stroke="#C98A52" stroke-width="4"/>')
    body = (ms.cloud(40, 110, 0.7, "#FFF0F7") + ms.cloud(250, 70, 0.6, "#FFF0F7") +
            mm.layer(220, "#FFD6EC", 201, 30) + mm.layer(330, "#FFC2DD", 202, 26) + river +
            mm.layer(470, "#FFB0D2", 203, 30) + mm.layer(610, "#FF9EC7", 204, 26) + mm.layer(710, "#FF8FBF", 205, 18) +
            road_candy(L) +
            lollipop(300, 720, 0.8) + lollipop(300, 262, 0.6, "#7EE0C3") + lollipop(60, 262, 0.55, "#FFD23F") +
            candycane(335, 775, 0.8) + candycane(40, 720, 0.7, flip=True) +
            cupcake(180, 215, 0.6, "#FFFFFF", "#FF9EC0") + cupcake(105, 785, 0.7, "#FFF0A8", "#B07CE8") +
            gumdrops([(130, 690), (250, 690), (335, 600), (115, 235), (245, 235), (25, 600)]))
    return wrap(body, ("#FF9EC7", "#FFE3F0"))


def map_sea():
    L = LAYOUTS[2]
    rays = "".join(f'<path d="M{x} -10 L{x + 40} -10 L{x + 120} 600 L{x + 60} 600 Z" fill="#FFFFFF" opacity=".07" stroke="none"/>' for x in (20, 140, 260))
    sand = '<path d="M-10 790 L-10 720 Q90 690 180 712 Q270 734 370 700 L370 790 Z" fill="#F2D49B"/>'
    body = (rays + bubbles(301, 24) +
            ms.fish(300, 95, "#FFD23F", flip=True, s=0.8) + ms.fish(80, 90, "#FF8FA3", s=0.7) + ms.fish(180, 420, "#7EE0C3", flip=True, s=0.6) +
            jelly(325, 240, 0.8) + jelly(35, 410, 0.7, "#C9A8FF") +
            sand +
            seaweed(20, 740, 220, seed=1) + seaweed(340, 720, 260, seed=2) + seaweed(160, 760, 120, "#5CCB5F", seed=3) +
            coral(300, 740, 1.0) + coral(60, 740, 0.8, "#FFB13B") + chest(200, 760, 0.8) +
            road_sea(L) +
            ms.starfish(120, 770, 10) + ms.shell(260, 772, 0.8) + ms.plesio(300, 560, 0.35, "#39C1B5", "#2A7FC0"))
    return wrap(body, ("#4FC3F7", "#164A9E"))


def map_desert():
    L = LAYOUTS[3]
    body = (ms.sun(300, 70, 30) +
            pyramid(90, 300, 200, 140) + pyramid(230, 300, 140, 100, "#F7C76E", "#DDA14A") + pyramid(320, 300, 90, 64) +
            dune(300, "#F7D38A", 401, 24) + dune(440, "#F2C36E", 402, 30) + dune(580, "#ECB45C", 403, 26) + dune(700, "#E5A64E", 404, 18) +
            road_desert(L) +
            cactus(340, 640, 0.8) + cactus(30, 380, 0.7) + cactus(310, 760, 1.0) + cactus(25, 620, 0.6) + cactus(190, 490, 0.5) +
            ms.rock(330, 700, 50, 30, "#C9A07A") + ms.rock(200, 770, 44, 26, "#C9A07A") +
            '<path d="M180 690 Q200 670 220 690" fill="none" stroke-width="4"/>' +
            ms.fly("petra", 120, 160, 0.26, colors=ms.PETRA_ORANGE))
    return wrap(body, ("#FFB86B", "#FFE9B8"))


def map_space():
    L = LAYOUTS[4]
    moon_ground = ('<path d="M-10 790 L-10 730 Q90 700 180 720 Q270 740 370 708 L370 790 Z" fill="#B8AEDB"/>' +
                   craters([(60, 760, 22), (200, 752, 16), (300, 770, 20)]))
    body = (ms.stars(80, 501, 760) +
            planet(70, 170, 34, "#FF9F1C", ring="#FFD23F", spots="#E07F00") + planet(310, 340, 26, "#7EE0C3", spots="#39C1B5") +
            planet(40, 520, 22, "#FF8FC8", spots="#E8557A") + planet(330, 640, 18, "#5B8DEF", ring="#BDEBFF") +
            ms.shooting_star(300, 60, 70) + rocket(330, 220, 0.7, 25) + ufo(80, 300, 0.7) +
            moon_ground +
            road_space(L))
    return wrap(body, ("#0E0A2E", "#3A2E7A"))


# ---------------------------------------------------------------- level backgrounds (behind the board, 360x640)
BW, BH = 360, 640


def bg(body, sky):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {BW} {BH}" width="{BW}" height="{BH}">'
            f'<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{sky[0]}"/>'
            f'<stop offset="1" stop-color="{sky[1]}"/></linearGradient>{ms.DEFS}</defs>'
            f'<rect width="{BW}" height="{BH}" fill="url(#sky)"/>'
            f'<g stroke="{INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


def low_layer(y, color, seed, amp=26):
    rnd = random.Random(seed)
    a, b, c, e = (rnd.uniform(-amp, amp) for _ in range(4))
    return (f'<path d="M-10 {y + a:.0f} Q80 {y - amp + b:.0f} 170 {y + c / 2:.0f} Q270 {y + amp + e:.0f} 370 {y - a / 2:.0f} '
            f'L370 {BH + 10} L-10 {BH + 10} Z" fill="{color}"/>')


def bg_crystal():
    return bg(stalactites("#4A3A7E", 11, 0, 8, 120) + glow(80, 300, 80, "#7EE0FF") + glow(290, 420, 90, "#E08CFF") +
              low_layer(470, "#4E4092", 111) + low_layer(560, "#3A2E7A", 112, 18) +
              crystal(40, 520, 1.3, "#7EE0FF", "#E6FBFF") + crystal(290, 560, 1.5, "#E08CFF", "#FBE3FF") +
              crystal(180, 610, 0.9, "#7EE0C3", "#E3FFF5") + crystal(320, 250, 0.7, "#FFD23F", "#FFF6C9") +
              "".join(ms.firefly(x, y) for x, y in ((120, 200), (250, 160), (60, 420), (300, 330))), ("#2A1F5C", "#4A3A8E"))


def bg_candy():
    return bg(ms.cloud(40, 90, 0.8, "#FFF0F7") + ms.cloud(240, 150, 0.7, "#FFF0F7") +
              low_layer(400, "#FFC2DD", 211) + low_layer(500, "#FFB0D2", 212) + low_layer(580, "#FF9EC7", 213, 18) +
              lollipop(60, 470, 1.0) + lollipop(300, 520, 1.1, "#7EE0C3") + candycane(190, 560, 0.9) +
              cupcake(110, 630, 1.0) + cupcake(280, 640, 0.9, "#FFFFFF", "#B07CE8") +
              gumdrops([(30, 610), (220, 620), (340, 600), (170, 500)]), ("#FF9EC7", "#FFE3F0"))


def bg_sea():
    rays = "".join(f'<path d="M{x} -10 L{x + 40} -10 L{x + 130} 640 L{x + 70} 640 Z" fill="#FFFFFF" opacity=".08" stroke="none"/>' for x in (10, 150, 270))
    return bg(rays + bubbles(311, 20, 600) + ms.fish(280, 140, "#FFD23F", flip=True, s=0.9) + ms.fish(60, 260, "#FF8FA3", s=0.8) +
              jelly(300, 330, 1.0) +
              '<path d="M-10 650 L-10 570 Q90 540 180 562 Q270 584 370 550 L370 650 Z" fill="#F2D49B"/>' +
              seaweed(25, 620, 260, seed=11) + seaweed(335, 600, 300, seed=12) + seaweed(130, 630, 150, "#5CCB5F", seed=13) +
              coral(240, 610, 1.1) + coral(80, 620, 0.9, "#FFB13B") + chest(180, 640, 0.9) + ms.starfish(300, 625, 11),
              ("#4FC3F7", "#164A9E"))


def bg_desert():
    return bg(ms.sun(290, 80, 34) + pyramid(100, 400, 230, 160) + pyramid(260, 400, 160, 110, "#F7C76E", "#DDA14A") +
              low_layer(400, "#F7D38A", 411) + low_layer(490, "#F2C36E", 412) + low_layer(580, "#ECB45C", 413, 18) +
              cactus(40, 560, 1.0) + cactus(320, 610, 1.2) + cactus(180, 630, 0.7) + ms.rock(260, 530, 50, 30, "#C9A07A"),
              ("#FFB86B", "#FFE9B8"))


def bg_space():
    return bg(ms.stars(70, 511, 600) + planet(80, 140, 40, "#FF9F1C", ring="#FFD23F", spots="#E07F00") +
              planet(300, 300, 28, "#7EE0C3", spots="#39C1B5") + ms.shooting_star(260, 70, 80) + ufo(220, 200, 0.8) +
              rocket(60, 380, 0.8, -20) +
              '<path d="M-10 650 L-10 560 Q90 530 180 552 Q270 574 370 540 L370 650 Z" fill="#B8AEDB"/>' +
              craters([(70, 600, 26), (220, 590, 18), (310, 620, 22)]), ("#0E0A2E", "#3A2E7A"))


def btitle_bg():
    """The blocks game's start screen: a crystal-and-candy landscape with stacked blocks and planets."""
    blocks = ""
    cols = ("#4FC3F7", "#FFD23F", "#B07CE8", "#FF9F1C", "#5B8DEF", "#5CCB5F", "#FF6B7A")
    rnd = random.Random(7)
    for i, (x, y) in enumerate(((10, 740), (42, 740), (74, 740), (10, 708), (42, 708), (10, 676),
                                (286, 740), (318, 740), (318, 708), (286, 708), (318, 676), (254, 740))):
        c = cols[rnd.randrange(7)]
        blocks += (f'<rect x="{x}" y="{y}" width="30" height="30" rx="7" fill="{c}" stroke-width="3.5"/>'
                   f'<rect x="{x + 6}" y="{y + 5}" width="16" height="5" rx="2.5" fill="#FFFFFF" opacity=".45" stroke="none"/>')
    body = (ms.stars(40, 701, 260) + planet(300, 90, 30, "#FF9F1C", ring="#FFD23F", spots="#E07F00") + planet(50, 170, 18, "#7EE0C3") +
            ms.shooting_star(140, 60, 70) +
            mm.layer(430, "#B8AEDB", 702, 30) + crystal(60, 470, 1.2, "#7EE0FF", "#E6FBFF") + crystal(300, 480, 1.0, "#E08CFF", "#FBE3FF") +
            mm.layer(560, "#FFC2DD", 703, 26) + lollipop(330, 620, 0.9) + candycane(30, 640, 0.8) +
            mm.layer(660, "#FF9EC7", 704, 20) + cupcake(200, 760, 0.8) + blocks)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" preserveAspectRatio="xMidYMax slice">'
            '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E1A5C"/>'
            f'<stop offset="0.45" stop-color="#6B5BD0"/><stop offset="0.8" stop-color="#FFC2DD"/></linearGradient>{ms.DEFS}</defs>'
            f'<rect width="{W}" height="{H}" fill="url(#sky)"/>'
            f'<g stroke="{INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


def hub_bg():
    """The game picker (דינו-גיים): a sunset fair. Party flags on top, sun rays, and two hills that meet in the
    middle - the jungle of the dig game on the left, the crystals of the blocks game on the right."""
    rnd = random.Random(11)
    rays = "".join(
        f'<path d="M180 470 L{180 + 900 * math.cos(math.radians(a - 4)):.0f} {470 + 900 * math.sin(math.radians(a - 4)):.0f} '
        f'L{180 + 900 * math.cos(math.radians(a + 4)):.0f} {470 + 900 * math.sin(math.radians(a + 4)):.0f} Z" fill="#FFFFFF" opacity=".1" stroke="none"/>'
        for a in range(-180, 1, 20))
    flag_cols = ("#FF6B7A", "#FFD23F", "#4FC3F7", "#5CCB5F", "#B07CE8", "#FF9F1C")

    def bunting(y0, sag, n, seed):
        out = f'<path d="M-10 {y0} Q180 {y0 + sag} 370 {y0}" fill="none" stroke-width="3"/>'
        for i in range(n):
            t = (i + 0.5) / n
            x = -10 + 380 * t
            y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * (y0 + sag) + t ** 2 * y0
            out += f'<path d="M{x - 11:.0f} {y:.0f} L{x + 11:.0f} {y:.0f} L{x:.0f} {y + 24:.0f} Z" fill="{flag_cols[(i + seed) % 6]}" stroke-width="3"/>'
        return out

    confetti = "".join(
        f'<rect x="{rnd.uniform(0, 350):.0f}" y="{rnd.uniform(140, 420):.0f}" width="9" height="5" rx="2" fill="{flag_cols[i % 6]}" '
        f'stroke="none" transform="rotate({rnd.randrange(180)} {rnd.uniform(0, 350):.0f} {rnd.uniform(140, 420):.0f})"/>' for i in range(28))
    sun = ('<circle cx="180" cy="520" r="120" fill="#FFE38A" stroke="none" opacity=".55"/>'
           '<circle cx="180" cy="520" r="92" fill="#FFD23F"/>')
    left_hill = '<path d="M-10 560 Q90 500 200 600 L200 790 L-10 790 Z" fill="#5CCB5F"/>'
    right_hill = '<path d="M160 610 Q270 490 370 545 L370 790 L160 790 Z" fill="#8E7FD0"/>'
    front = '<path d="M-10 690 Q180 650 370 690 L370 790 L-10 790 Z" fill="#FFB86B"/>'
    blocks = ""
    for (x, y, c, a) in ((290, 610, "#4FC3F7", 8), (318, 640, "#FFD23F", -6), (262, 646, "#FF6B7A", 4)):
        blocks += (f'<g transform="rotate({a} {x + 14} {y + 14})"><rect x="{x}" y="{y}" width="28" height="28" rx="7" fill="{c}" stroke-width="3.5"/>'
                   f'<rect x="{x + 5}" y="{y + 5}" width="14" height="5" rx="2.5" fill="#FFFFFF" opacity=".45" stroke="none"/></g>')
    body = (rays + sun + bunting(40, 50, 11, 0) + bunting(96, 40, 9, 3) + confetti +
            ms.cloud(60, 230, 0.7, "#FFF0F7") + ms.cloud(290, 300, 0.55, "#FFF0F7") +
            left_hill + right_hill +
            ms.mushroom(40, 600, 0.8, "#FF6B7A", "#FFE3E8") + ms.mushroom(120, 590, 0.55, "#FFD23F", "#FFF6C9") +
            crystal(250, 600, 0.75, "#7EE0FF", "#E6FBFF") + crystal(330, 580, 0.6, "#E08CFF", "#FBE3FF") +
            front + blocks +
            '<ellipse cx="80" cy="730" rx="20" ry="25" fill="#FFF4C9"/><path d="M66 724 l6 5 l6 -6 l6 6 l6 -5" fill="none" stroke-width="3"/>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" preserveAspectRatio="xMidYMax slice">'
            '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3B1E6E"/>'
            f'<stop offset="0.45" stop-color="#E8558F"/><stop offset="0.75" stop-color="#FFB86B"/></linearGradient>{ms.DEFS}</defs>'
            f'<rect width="{W}" height="{H}" fill="url(#sky)"/>'
            f'<g stroke="{INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


# ---------------------------------------------------------------- bosses: the big rex in each new world's colours
BASE = ("#E8553D", "#B83B2E", "#FFB15C", "#6B2A5E")
BOSSES = {
    1: (("#8E5BD9", "#5E3A9E", "#7EE0FF", "#2E1A5C"), "#7EE0FF", "#E08CFF"),   # crystal
    2: (("#FF6FA8", "#D94F86", "#FFE3F0", "#7B2A55"), "#FFFFFF", "#7EE0C3"),   # candy
    3: (("#2AA39A", "#1B7A73", "#9FF0E6", "#FF9F1C"), "#FFD23F", "#FF6B7A"),   # sea
    4: (("#E0A040", "#B87A28", "#FFE0A0", "#7A4A12"), "#FFD23F", "#4FC3F7"),   # desert
    5: (("#5B6BB8", "#3A4890", "#C9D3FF", "#FFD23F"), "#E6E6F0", "#FF6B7A"),   # space
}


def bosses():
    with open(os.path.join(ms.ART, "magma-rex.svg"), encoding="utf8") as f:
        inner = re.search(r"<svg[^>]*>(.*)</svg>", f.read(), re.S).group(1)
    import make_bosses as mb
    for w, (cols, gold, gem) in BOSSES.items():
        m = dict(zip(BASE, cols))
        body = re.sub("|".join(BASE), lambda mo: m[mo.group(0)], inner)
        svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -30 240 250" width="240" height="250">'
               f"{body}{mb.crown(gold, gem)}</svg>\n")
        with open(os.path.join(OUT, f"bboss-{w}.svg"), "w", encoding="utf8") as f:
            f.write(svg)


def main():
    for i, fn in enumerate((map_crystal, map_candy, map_sea, map_desert, map_space), 1):
        with open(os.path.join(OUT, f"bmap-{i}.svg"), "w", encoding="utf8") as f:
            f.write(fn())
    for i, fn in enumerate((bg_crystal, bg_candy, bg_sea, bg_desert, bg_space), 1):
        with open(os.path.join(OUT, f"bbg-{i}.svg"), "w", encoding="utf8") as f:
            f.write(fn())
    with open(os.path.join(OUT, "btitle-bg.svg"), "w", encoding="utf8") as f:
        f.write(btitle_bg())
    with open(os.path.join(OUT, "hub-bg.svg"), "w", encoding="utf8") as f:
        f.write(hub_bg())
    bosses()
    print("wrote bmap-1..5, bbg-1..5, btitle-bg, hub-bg, bboss-1..5")


if __name__ == "__main__":
    main()
