"""Art for מפלצת הראשים (game/dragon): five monster worlds.

  hbg-N     the ground seen from above, 360x640, repeats top to bottom as it scrolls
  hworld-N  the world's banner (side view), 360x200, for the world list and the world screen
  htitle-bg the title background (360x780), and icons/icon.svg

Worlds: 1 lava caves, 2 haunted swamp, 3 dragon graveyard, 4 crystal abyss, 5 storm citadel.
Run:  py -I tools/make_monster_art.py
"""
import math
import os
import random

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "game", "dragon", "assets")
ICONS = os.path.join(HERE, "..", "game", "dragon", "icons")
INK = "#0A0614"
BW, BH = 360, 640


# ---------------------------------------------------------------- helpers
def svg(w, h, body, defs="", aspect=""):
    pa = f' preserveAspectRatio="{aspect}"' if aspect else ""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}"{pa}>'
            f'<defs>{defs}</defs>{body}</svg>')


def grad(gid, stops, vertical=True):
    x2, y2 = ("0", "1") if vertical else ("1", "0")
    s = "".join(f'<stop offset="{o}" stop-color="{c}"/>' for o, c in stops)
    return f'<linearGradient id="{gid}" x1="0" y1="0" x2="{x2}" y2="{y2}">{s}</linearGradient>'


def glow(gid, color):
    return (f'<radialGradient id="{gid}"><stop offset="0" stop-color="{color}" stop-opacity=".75"/>'
            f'<stop offset="1" stop-color="{color}" stop-opacity="0"/></radialGradient>')


def poly(pts, fill, stroke=INK, sw=2, extra=""):
    d = "M" + " L".join(f"{x:.1f} {y:.1f}" for x, y in pts) + " Z"
    return f'<path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}" stroke-linejoin="round"{extra}/>'


def blob(cx, cy, r, n, rnd, jag=0.25):
    return [(cx + math.cos(i / n * math.tau) * r * (1 + rnd.uniform(-jag, jag)),
             cy + math.sin(i / n * math.tau) * r * (1 + rnd.uniform(-jag, jag))) for i in range(n)]


def scatter(seed, n, r_range, margin=0, avoid=None):
    rnd = random.Random(seed)
    pts, tries = [], 0
    while len(pts) < n and tries < 5000:
        tries += 1
        x, y, r = rnd.uniform(-10 + margin, 370 - margin), rnd.uniform(0, BH), rnd.uniform(*r_range)
        if avoid and avoid(x, y, r):
            continue
        if any(math.hypot(x - a, (y - b + BH / 2) % BH - BH / 2) < r + c + 6 for a, b, c in pts):
            continue
        pts.append((x, y, r))
    return pts


def wrapped(items):
    """Things on the ground; one that crosses the top or bottom edge also shows on the other side."""
    out = ""
    for y, r, draw in items:
        out += draw(0)
        if y + r > BH:
            out += draw(-BH)
        if y - r < 0:
            out += draw(BH)
    return out


def river(xs, layers):
    """A band that leaves the bottom where it came in at the top, so the picture repeats."""
    d = "M" + " L".join(f"{xs(y):.1f} {y}" for y in range(-20, BH + 21, 8))
    return "".join(f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round"{e}/>' for c, w, e in layers)


def rv(amp1, amp2, mid=180, ph=1.0):
    return lambda y: mid + amp1 * math.sin(2 * math.pi * y / BH) + amp2 * math.sin(4 * math.pi * y / BH + ph)


# ---------------------------------------------------------------- 1. lava caves
def bg_lava():
    xs = rv(95, 30)
    items = []
    rnd = random.Random(11)
    for x, y, r in scatter(101, 18, (12, 30), avoid=lambda x, y, r: abs(x - xs(y)) < r + 34):
        pts = blob(x, y, r, 7, random.Random(int(x * 7 + y)), 0.3)
        def d(o, pts=pts, x=x, y=y, r=r):
            sh = [(px, py + o) for px, py in pts]
            hi = [(x + (px - x) * .55 - r * .15, y + o + (py - y) * .55 - r * .2) for px, py in pts]
            return poly(sh, "#2E2228") + poly(hi, "#43323A", stroke="none")
        items.append((y, r, d))
    for x, y, r in scatter(102, 7, (8, 13), avoid=lambda x, y, r: abs(x - xs(y)) < r + 40):
        def d(o, x=x, y=y, r=r):
            return (f'<circle cx="{x:.0f}" cy="{y + o:.0f}" r="{r * 2.2:.0f}" fill="url(#lg)"/>'
                    + poly([(x, y + o - r * 1.4), (x + r * .6, y + o), (x, y + o + r * .5), (x - r * .6, y + o)], "#FF4A3D", sw=1.5)
                    + poly([(x + r * .9, y + o - r * .6), (x + r * 1.3, y + o + r * .2), (x + r * .7, y + o + r * .3)], "#FF8A3D", sw=1.5))
        items.append((y, r * 2.2, d))
    cracks = "".join(f'<path d="M{x:.0f} {y:.0f} l{rnd.uniform(-14, 14):.0f} 9 l{rnd.uniform(-10, 10):.0f} 11 l{rnd.uniform(-12, 12):.0f} 8" '
                     f'fill="none" stroke="#FF6A2A" stroke-width="1.6" opacity=".7"/>'
                     for x, y, _ in scatter(103, 16, (4, 4)) if 20 < y < BH - 40)
    lava = river(xs, [("url(#lg)", 90, ' opacity=".55"'), ("#140A0C", 38, ""), ("#E8401C", 30, ""), ("#FF8A2A", 16, ""), ("#FFE07A", 5, "")])
    return svg(BW, BH, f'<rect width="{BW}" height="{BH}" fill="#1E1418"/>' + cracks + lava + wrapped(items), glow("lg", "#FF5A1A"))


# ---------------------------------------------------------------- 2. haunted swamp
def bg_swamp():
    items = []
    for x, y, r in scatter(201, 7, (30, 52), margin=10):
        pts = blob(x, y, r, 10, random.Random(int(x + y * 3)), 0.22)
        def d(o, pts=pts):
            sh = [(px, py + o) for px, py in pts]
            return poly(sh, "#0E2422", stroke="#3AF0A0", sw=1.4, extra=' stroke-opacity=".45"') + poly(sh, "none", stroke="#0A1614", sw=0)
        items.append((y, r * 1.25, d))
    for x, y, r in scatter(202, 9, (14, 22)):
        rnd = random.Random(int(x * y))
        def d(o, x=x, y=y, r=r, rnd=rnd):
            out = ""
            for k in range(5):
                a = k / 5 * math.tau + rnd.uniform(-.3, .3)
                ex, ey = x + math.cos(a) * r * 1.6, y + o + math.sin(a) * r * 1.6
                out += f'<path d="M{x:.0f} {y + o:.0f} Q{x + math.cos(a + .4) * r:.0f} {y + o + math.sin(a + .4) * r:.0f} {ex:.0f} {ey:.0f}" fill="none" stroke="#0A0806" stroke-width="5" stroke-linecap="round"/>'
                out += f'<path d="M{x:.0f} {y + o:.0f} Q{x + math.cos(a + .4) * r:.0f} {y + o + math.sin(a + .4) * r:.0f} {ex:.0f} {ey:.0f}" fill="none" stroke="#3A2E26" stroke-width="2.5" stroke-linecap="round"/>'
            return out + f'<circle cx="{x:.0f}" cy="{y + o:.0f}" r="{r * .35:.0f}" fill="#2A2018" stroke="#0A0806" stroke-width="2"/>'
        items.append((y, r * 1.7, d))
    for (x, y, r), c in zip(scatter(203, 14, (4, 7)), ["#4AF0FF", "#C77DFF", "#7CFF8A"] * 5):
        def d(o, x=x, y=y, r=r, c=c):
            return (f'<circle cx="{x:.0f}" cy="{y + o:.0f}" r="{r * 3:.0f}" fill="{c}" opacity=".14"/>'
                    f'<circle cx="{x:.0f}" cy="{y + o:.0f}" r="{r:.0f}" fill="{c}" stroke="#0A0614" stroke-width="1.5"/>'
                    f'<circle cx="{x - r * .3:.1f}" cy="{y + o - r * .3:.1f}" r="{r * .3:.1f}" fill="#FFFFFF" opacity=".7"/>')
        items.append((y, r * 3, d))
    rnd = random.Random(204)
    moss = "".join(f'<ellipse cx="{rnd.uniform(0, 360):.0f}" cy="{rnd.uniform(0, BH):.0f}" rx="{rnd.uniform(20, 50):.0f}" ry="{rnd.uniform(10, 22):.0f}" '
                   f'fill="#2C3E26" opacity=".6"/>' for _ in range(22))
    return svg(BW, BH, f'<rect width="{BW}" height="{BH}" fill="#1A2620"/>' + moss + wrapped(items))


# ---------------------------------------------------------------- 3. dragon graveyard
def ribcage(x, y, s, o, rot):
    out = f'<g transform="translate({x:.0f} {y + o:.0f}) rotate({rot:.0f}) scale({s:.2f})">'
    out += '<path d="M0 -70 L0 70" stroke="#0A0806" stroke-width="12" stroke-linecap="round"/><path d="M0 -70 L0 70" stroke="#D9CFB8" stroke-width="7" stroke-linecap="round"/>'
    for k in range(-3, 4):
        yy = k * 18
        for sd in (-1, 1):
            p = f"M0 {yy} Q{sd * 40} {yy - 6} {sd * 46} {yy + 22}"
            out += f'<path d="{p}" fill="none" stroke="#0A0806" stroke-width="8" stroke-linecap="round"/><path d="{p}" fill="none" stroke="#CFC3A6" stroke-width="4" stroke-linecap="round"/>'
    return out + "</g>"


def skull(x, y, s, o, rot):
    return (f'<g transform="translate({x:.0f} {y + o:.0f}) rotate({rot:.0f}) scale({s:.2f})" stroke="#0A0806" stroke-width="2.5" stroke-linejoin="round">'
            '<path d="M-16 -18 Q0 -30 16 -18 L20 6 L10 30 L-10 30 L-20 6 Z" fill="#D9CFB8"/>'
            '<path d="M-12 -14 L-26 -34 L-6 -20 Z M12 -14 L26 -34 L6 -20 Z" fill="#BFB294"/>'
            '<ellipse cx="-7" cy="-2" rx="5" ry="6" fill="#1A1210"/><ellipse cx="7" cy="-2" rx="5" ry="6" fill="#1A1210"/>'
            '<path d="M-6 22 L-4 28 M0 22 L0 29 M6 22 L4 28" fill="none" stroke-width="2"/></g>')


def bg_bones():
    items = []
    rnd = random.Random(301)
    for x, y, r in scatter(302, 3, (70, 80), margin=40):
        rot, s = rnd.uniform(-35, 35), rnd.uniform(.7, .9)
        items.append((y, r, lambda o, x=x, y=y, s=s, rot=rot: ribcage(x, y, s, o, rot)))
    for x, y, r in scatter(303, 5, (22, 28), avoid=lambda x, y, r: False):
        rot, s = rnd.uniform(-40, 40), rnd.uniform(.8, 1.1)
        items.append((y, 32, lambda o, x=x, y=y, s=s, rot=rot: skull(x, y, s, o, rot)))
    bones = ""
    for _ in range(26):
        x, y, a = rnd.uniform(0, 360), rnd.uniform(10, BH - 10), rnd.uniform(0, 180)
        bones += (f'<g transform="translate({x:.0f} {y:.0f}) rotate({a:.0f})"><path d="M-9 0 L9 0" stroke="#0A0806" stroke-width="6" stroke-linecap="round"/>'
                  f'<path d="M-9 0 L9 0" stroke="#BFB294" stroke-width="3" stroke-linecap="round"/></g>')
    dunes = "".join(f'<ellipse cx="{rnd.uniform(0, 360):.0f}" cy="{rnd.uniform(0, BH):.0f}" rx="{rnd.uniform(40, 90):.0f}" ry="{rnd.uniform(14, 30):.0f}" '
                    f'fill="#3A2E28" opacity=".7"/>' for _ in range(16))
    cracks = "".join(f'<path d="M{rnd.uniform(0, 360):.0f} {rnd.uniform(20, BH - 40):.0f} l12 10 l-6 12 l14 9" fill="none" stroke="#C0381E" stroke-width="1.6" opacity=".6"/>' for _ in range(10))
    return svg(BW, BH, f'<rect width="{BW}" height="{BH}" fill="#2E2420"/>' + dunes + cracks + bones + wrapped(items))


# ---------------------------------------------------------------- 4. crystal abyss
def bg_crystal():
    rnd = random.Random(401)
    specks = "".join(f'<circle cx="{rnd.uniform(0, 360):.0f}" cy="{rnd.uniform(2, BH - 2):.0f}" r="{rnd.uniform(.6, 1.8):.1f}" fill="#B8A8FF" opacity="{rnd.uniform(.3, .9):.2f}"/>' for _ in range(90))
    items = []
    for x, y, r in scatter(402, 7, (28, 46), margin=20):
        rr = random.Random(int(x * 13 + y))
        pts = blob(x, y, r, 9, rr, 0.25)
        cols = rr.choice([("#4AF0FF", "#C8FBFF"), ("#FF4FD8", "#FFC8F4"), ("#9B7BFF", "#E0D4FF")])
        def d(o, pts=pts, x=x, y=y, r=r, cols=cols, rr=random.Random(int(x + y))):
            out = f'<circle cx="{x:.0f}" cy="{y + o:.0f}" r="{r * 1.5:.0f}" fill="url(#cg)" opacity=".5"/>'
            out += poly([(px, py + o) for px, py in pts], "#241A44", sw=2.5)
            out += poly([(x + (px - x) * .7, y + o + (py - y) * .7 - 3) for px, py in pts], "#33275C", stroke="none")
            for k in range(4):
                cx, cy = x + rr.uniform(-r * .45, r * .45), y + o + rr.uniform(-r * .45, r * .45)
                h = rr.uniform(8, 16)
                out += poly([(cx - 4, cy + 3), (cx, cy - h), (cx + 4, cy + 3)], cols[0], sw=1.5)
                out += poly([(cx, cy - h), (cx + 1.5, cy + 2), (cx + 4, cy + 3)], cols[1], stroke="none")
            return out
        items.append((y, r * 1.5, d))
    return svg(BW, BH, f'<rect width="{BW}" height="{BH}" fill="#0C0A1C"/>' + specks + wrapped(items), glow("cg", "#7B5CFF"))


# ---------------------------------------------------------------- 5. storm citadel
def bg_storm():
    rnd = random.Random(501)
    clouds = "".join(f'<ellipse cx="{rnd.uniform(-20, 380):.0f}" cy="{rnd.uniform(0, BH):.0f}" rx="{rnd.uniform(50, 110):.0f}" ry="{rnd.uniform(24, 46):.0f}" '
                     f'fill="{rnd.choice(["#2A3248", "#232A3E", "#323B54"])}" opacity=".85"/>' for _ in range(30))
    items = []
    for x, y, r in scatter(502, 5, (30, 42), margin=30):
        def d(o, x=x, y=y, r=r):
            pts = [(x + math.cos(i / 6 * math.tau + .5) * r, y + o + math.sin(i / 6 * math.tau + .5) * r * .8) for i in range(6)]
            inner = [(x + (px - x) * .62, y + o + (py - y - o) * .62) for px, py in pts]
            out = poly(pts, "#3A3A4A", sw=2.5) + poly(inner, "#4A4A5E", stroke="#1A1A24", sw=1.5)
            out += f'<circle cx="{x:.0f}" cy="{y + o:.0f}" r="{r * .22:.0f}" fill="none" stroke="#5AC8FF" stroke-width="2" opacity=".8"/>'
            for i in range(6):
                a = i / 6 * math.tau
                out += f'<path d="M{x + math.cos(a) * r * .3:.0f} {y + o + math.sin(a) * r * .25:.0f} L{x + math.cos(a) * r * .5:.0f} {y + o + math.sin(a) * r * .42:.0f}" stroke="#5AC8FF" stroke-width="1.5" opacity=".6"/>'
            return out
        items.append((y, r, d))
    bolts = ""
    for _ in range(5):
        x, y = rnd.uniform(20, 340), rnd.uniform(30, BH - 120)
        pts = [(x, y)]
        for k in range(5):
            pts.append((pts[-1][0] + rnd.uniform(-16, 16), pts[-1][1] + rnd.uniform(14, 22)))
        d = "M" + " L".join(f"{a:.0f} {b:.0f}" for a, b in pts)
        bolts += f'<path d="{d}" fill="none" stroke="#FFE45C" stroke-width="5" opacity=".18"/><path d="{d}" fill="none" stroke="#FFF6B0" stroke-width="1.5" opacity=".7"/>'
    return svg(BW, BH, f'<rect width="{BW}" height="{BH}" fill="#161B2A"/>' + clouds + bolts + wrapped(items))


# ---------------------------------------------------------------- world banners (side view, 360x200)
VW_, VH_ = 360, 200


def banner(defs, body):
    return svg(VW_, VH_, body + '<rect width="360" height="200" fill="url(#bvig)"/>',
               defs + '<radialGradient id="bvig" cx=".5" cy=".45" r=".8"><stop offset=".55" stop-color="#000" stop-opacity="0"/>'
               '<stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>', "xMidYMid slice")


def ban_lava():
    rnd = random.Random(1)
    stal = "".join(poly([(x - w, 0), (x, h), (x + w, 0)], "#1E1418", sw=2) for x, w, h in
                   ((20, 18, 50), (70, 12, 34), (120, 22, 62), (190, 14, 40), (250, 20, 56), (310, 16, 44), (350, 12, 30)))
    falls = "".join(f'<rect x="{x}" y="20" width="{w}" height="150" fill="url(#lf)"/>' for x, w in ((90, 10), (276, 14)))
    ground = poly([(0, 200), (0, 150), (60, 140), (110, 158), (170, 136), (230, 150), (300, 132), (360, 146), (360, 200)], "#140C10", sw=2)
    lava = '<path d="M0 176 Q90 166 180 178 T360 172 L360 200 L0 200 Z" fill="#FF5A1A"/><path d="M0 182 Q90 174 180 184 T360 180" fill="none" stroke="#FFD27A" stroke-width="3"/>'
    rocks = "".join(poly(blob(x, 160, r, 6, rnd, .3), "#2E2228", sw=2) for x, r in ((40, 16), (210, 20), (330, 14)))
    embers = "".join(f'<circle cx="{rnd.uniform(0, 360):.0f}" cy="{rnd.uniform(40, 170):.0f}" r="{rnd.uniform(1, 2.4):.1f}" fill="#FFB020"/>' for _ in range(30))
    defs = grad("sky1", [(0, "#2A0A10"), (.7, "#7A1E14"), (1, "#C2481E")]) + grad("lf", [(0, "#FFD27A"), (1, "#FF5A1A")])
    return banner(defs, '<rect width="360" height="200" fill="url(#sky1)"/>' + falls + stal + ground + rocks + lava + embers)


def ban_swamp():
    rnd = random.Random(2)
    trees = ""
    for x, h, s in ((40, 120, 1), (300, 140, -1), (180, 90, 1), (110, 70, -1)):
        trees += (f'<g transform="translate({x} 170) scale({s} 1)" stroke="#05080A" stroke-width="2" fill="#0C1412">'
                  f'<path d="M-6 0 L-4 -{h} L-2 -{h * .7:.0f} L14 -{h * .9:.0f} L0 -{h * .55:.0f} L4 -{h * .2:.0f} L6 0 Z"/>'
                  f'<path d="M-4 -{h * .8:.0f} L-22 -{h * .95:.0f} L-6 -{h * .7:.0f} Z"/></g>')
    fog = "".join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="12" fill="#7CFFB0" opacity=".1"/>' for x, y, rx in ((80, 150, 120), (260, 160, 140), (180, 130, 100)))
    shrooms = "".join(f'<circle cx="{x}" cy="{y}" r="14" fill="{c}" opacity=".2"/><path d="M{x - 6} {y} Q{x} {y - 10} {x + 6} {y} Z" fill="{c}" stroke="#05080A" stroke-width="1.5"/>'
                      f'<rect x="{x - 1.5}" y="{y}" width="3" height="7" fill="#C8D8C0"/>' for x, y, c in ((60, 172, "#4AF0FF"), (150, 178, "#C77DFF"), (240, 175, "#7CFF8A"), (330, 180, "#4AF0FF")))
    ground = '<path d="M0 200 L0 170 Q90 160 180 172 T360 168 L360 200 Z" fill="#0E1A16"/>'
    water = '<path d="M60 186 Q140 180 220 188 T340 186" fill="none" stroke="#3AF0A0" stroke-width="1.5" opacity=".4"/>'
    moon = '<circle cx="270" cy="50" r="40" fill="#C8FFE0" opacity=".12"/><circle cx="270" cy="50" r="24" fill="#E0FFF0" opacity=".85"/>'
    eyes = "".join(f'<ellipse cx="{x}" cy="{y}" rx="2.2" ry="1.4" fill="#FFE45C"/><ellipse cx="{x + 7}" cy="{y}" rx="2.2" ry="1.4" fill="#FFE45C"/>' for x, y in ((30, 140), (205, 120)))
    return banner(grad("sky2", [(0, "#060E12"), (1, "#1E3A30")]), '<rect width="360" height="200" fill="url(#sky2)"/>' + moon + fog + trees + ground + water + shrooms + eyes)


def ban_bones():
    ribs = ""
    for k in range(6):
        x = 120 + k * 26
        p = f"M{x} 172 Q{x - 10} {90 - k * 4} {x + 30} {64 + k * 3}"
        ribs += f'<path d="{p}" fill="none" stroke="#0A0806" stroke-width="11" stroke-linecap="round"/><path d="{p}" fill="none" stroke="#D9CFB8" stroke-width="6" stroke-linecap="round"/>'
    spine = '<path d="M100 170 Q200 60 300 110" fill="none" stroke="#0A0806" stroke-width="13" stroke-linecap="round"/><path d="M100 170 Q200 60 300 110" fill="none" stroke="#E6DCC4" stroke-width="7" stroke-linecap="round" stroke-dasharray="10 4"/>'
    sk = ('<g transform="translate(60 150) rotate(-12)" stroke="#0A0806" stroke-width="2.5" stroke-linejoin="round">'
          '<path d="M-40 0 Q-36 -30 0 -32 Q40 -30 50 -6 L70 4 L46 14 L-30 16 Z" fill="#D9CFB8"/>'
          '<path d="M-20 -26 L-40 -58 L-6 -30 Z" fill="#BFB294"/><ellipse cx="6" cy="-12" rx="9" ry="7" fill="#1A1210"/>'
          '<circle cx="6" cy="-12" r="2.5" fill="#FF4A2A"/><path d="M30 12 L34 20 M40 10 L44 18 M50 8 L53 15" fill="none"/></g>')
    ground = '<path d="M0 200 L0 168 Q120 156 200 170 T360 162 L360 200 Z" fill="#2A1E18"/>'
    sun = '<circle cx="290" cy="56" r="52" fill="#FF5A2A" opacity=".18"/><circle cx="290" cy="56" r="30" fill="#FF8A4A" opacity=".85"/>'
    return banner(grad("sky3", [(0, "#1A0C0C"), (.6, "#5A1E14"), (1, "#8A3A1E")]), '<rect width="360" height="200" fill="url(#sky3)"/>' + sun + spine + ribs + ground + sk)


def ban_crystal():
    rnd = random.Random(4)
    specks = "".join(f'<circle cx="{rnd.uniform(0, 360):.0f}" cy="{rnd.uniform(0, 200):.0f}" r="{rnd.uniform(.5, 1.6):.1f}" fill="#C8B8FF"/>' for _ in range(60))
    isl = ""
    for x, y, w, cols in ((90, 120, 70, ("#4AF0FF", "#C8FBFF")), (260, 90, 90, ("#FF4FD8", "#FFC8F4")), (190, 160, 50, ("#9B7BFF", "#E0D4FF"))):
        isl += f'<ellipse cx="{x}" cy="{y - 10}" rx="{w * 1.1:.0f}" ry="{w * .6:.0f}" fill="{cols[0]}" opacity=".1"/>'
        isl += poly([(x - w / 2, y), (x + w / 2, y), (x + w * .2, y + w * .7), (x - w * .1, y + w * .9), (x - w * .3, y + w * .5)], "#241A44", sw=2.5)
        for k in range(4):
            cx, h = x - w * .35 + k * w * .23, rnd.uniform(14, 34)
            isl += poly([(cx - 6, y), (cx, y - h), (cx + 6, y)], cols[0], sw=1.8) + poly([(cx, y - h), (cx + 2, y), (cx + 6, y)], cols[1], stroke="none")
    return banner(grad("sky4", [(0, "#06040E"), (1, "#1E1440")]), '<rect width="360" height="200" fill="url(#sky4)"/>' + specks + isl)


def ban_storm():
    rnd = random.Random(5)
    clouds = "".join(f'<ellipse cx="{rnd.uniform(-20, 380):.0f}" cy="{rnd.uniform(0, 70):.0f}" rx="{rnd.uniform(50, 90):.0f}" ry="{rnd.uniform(16, 28):.0f}" fill="#2A3248"/>' for _ in range(12))
    rock = poly([(110, 150), (250, 150), (220, 182), (180, 196), (140, 180)], "#22222E", sw=2.5)
    tower = (poly([(150, 150), (150, 80), (160, 60), (170, 80), (170, 150)], "#2E2E3C", sw=2) + poly([(190, 150), (190, 70), (202, 40), (214, 70), (214, 150)], "#2E2E3C", sw=2) +
             poly([(140, 150), (140, 110), (230, 110), (230, 150)], "#383848", sw=2) +
             '<rect x="198" y="80" width="8" height="12" fill="#5AC8FF"/><rect x="156" y="96" width="7" height="10" fill="#5AC8FF"/><rect x="180" y="124" width="10" height="26" fill="#0A0A10"/>')
    bolt = '<path d="M300 0 L286 50 L300 54 L278 120" fill="none" stroke="#FFE45C" stroke-width="7" opacity=".25"/><path d="M300 0 L286 50 L300 54 L278 120" fill="none" stroke="#FFF6B0" stroke-width="2.2"/>'
    rain = "".join(f'<path d="M{x:.0f} {y:.0f} l-4 10" stroke="#8AA0C8" stroke-width="1" opacity=".5"/>' for x, y in ((rnd.uniform(0, 360), rnd.uniform(0, 200)) for _ in range(50)))
    small = poly([(30, 170), (80, 170), (60, 190)], "#22222E", sw=2) + poly([(290, 160), (340, 160), (318, 184)], "#22222E", sw=2)
    return banner(grad("sky5", [(0, "#080A14"), (1, "#2A3450")]), '<rect width="360" height="200" fill="url(#sky5)"/>' + clouds + bolt + rain + rock + tower + small)


# ---------------------------------------------------------------- title background and icon
def title_bg():
    rnd = random.Random(9)
    specks = "".join(f'<circle cx="{rnd.uniform(0, 360):.0f}" cy="{rnd.uniform(0, 420):.0f}" r="{rnd.uniform(.5, 1.6):.1f}" fill="#E8DCFF" opacity="{rnd.uniform(.3, .9):.2f}"/>' for _ in range(70))
    peaks = (poly([(-10, 780), (-10, 560), (40, 520), (70, 470), (110, 540), (150, 500), (190, 560), (230, 480), (262, 430), (300, 520), (370, 470), (370, 780)], "#140E22", sw=2) +
             poly([(-10, 780), (-10, 640), (60, 600), (120, 650), (200, 610), (280, 660), (370, 620), (370, 780)], "#0C0816", sw=2))
    citadel = (poly([(240, 480), (240, 400), (252, 370), (264, 400), (264, 480)], "#1A1428", sw=2) + poly([(272, 480), (272, 420), (282, 396), (292, 420), (292, 480)], "#1A1428", sw=2) +
               '<rect x="248" y="410" width="7" height="9" fill="#FF8A3D"/><rect x="279" y="432" width="6" height="8" fill="#FF8A3D"/>')
    bolt = '<path d="M90 0 L70 90 L92 96 L60 220" fill="none" stroke="#B8A8FF" stroke-width="10" opacity=".18"/><path d="M90 0 L70 90 L92 96 L60 220" fill="none" stroke="#E8E0FF" stroke-width="2.5" opacity=".85"/>'
    glow_ = '<ellipse cx="180" cy="760" rx="260" ry="140" fill="#FF5A1A" opacity=".18"/>'
    defs = grad("tsky", [(0, "#05040C"), (.55, "#1E1240"), (.85, "#4A1A2A"), (1, "#7A2A1A")])
    return svg(360, 780, '<rect width="360" height="780" fill="url(#tsky)"/>' + specks + bolt + glow_ + peaks + citadel, defs, "xMidYMax slice")


def icon():
    heads = ""
    for (x, y, nc) in ((150, 190, "#E8452C"), (256, 140, "#7FD4FF"), (362, 190, "#5BC23A")):
        heads += (f'<path d="M256 360 Q{(256 + x) / 2:.0f} 280 {x} {y}" fill="none" stroke="{INK}" stroke-width="40"/>'
                  f'<path d="M256 360 Q{(256 + x) / 2:.0f} 280 {x} {y}" fill="none" stroke="#3B2F5C" stroke-width="24"/>')
    faces = ""
    for (x, y, c, g) in ((150, 190, "#E8452C", "#FFB020"), (256, 140, "#7FD4FF", "#E6FBFF"), (362, 190, "#5BC23A", "#B6FF6A")):
        faces += (f'<path d="M{x} {y - 62} Q{x + 34} {y - 30} {x + 34} {y + 6} Q{x + 30} {y + 36} {x} {y + 40} Q{x - 30} {y + 36} {x - 34} {y + 6} Q{x - 34} {y - 30} {x} {y - 62} Z" fill="{c}"/>'
                  f'<ellipse cx="{x - 15}" cy="{y - 4}" rx="9" ry="5" fill="{g}" transform="rotate(-25 {x - 15} {y - 4})" stroke="none"/>'
                  f'<ellipse cx="{x + 15}" cy="{y - 4}" rx="9" ry="5" fill="{g}" transform="rotate(25 {x + 15} {y - 4})" stroke="none"/>')
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">'
            '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1E1240"/><stop offset="1" stop-color="#4A1A2A"/></linearGradient></defs>'
            '<rect width="512" height="512" rx="110" fill="url(#bg)"/><circle cx="256" cy="420" r="150" fill="#FF5A1A" opacity=".25"/>'
            f'<g stroke="{INK}" stroke-width="10" stroke-linejoin="round" stroke-linecap="round">{heads}'
            '<path d="M170 470 Q160 360 256 340 Q352 360 342 470 Z" fill="#3B2F5C"/>'
            '<circle cx="256" cy="410" r="22" fill="#B79BFF" stroke="none" opacity=".9"/>'
            f'{faces}</g>'
            '<rect x="10" y="10" width="492" height="492" rx="104" fill="none" stroke="#F2B84B" stroke-width="8" opacity=".7"/></svg>')


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(ICONS, exist_ok=True)
    for name in os.listdir(OUT):
        if name.startswith("hmap-"):
            os.remove(os.path.join(OUT, name))
    for i, fn in enumerate((bg_lava, bg_swamp, bg_bones, bg_crystal, bg_storm), 1):
        with open(os.path.join(OUT, f"hbg-{i}.svg"), "w", encoding="utf8") as f:
            f.write(fn())
    for i, fn in enumerate((ban_lava, ban_swamp, ban_bones, ban_crystal, ban_storm), 1):
        with open(os.path.join(OUT, f"hworld-{i}.svg"), "w", encoding="utf8") as f:
            f.write(fn())
    with open(os.path.join(OUT, "htitle-bg.svg"), "w", encoding="utf8") as f:
        f.write(title_bg())
    with open(os.path.join(ICONS, "icon.svg"), "w", encoding="utf8") as f:
        f.write(icon())
    print("wrote hbg-1..5, hworld-1..5, htitle-bg, icon.svg")


if __name__ == "__main__":
    main()
