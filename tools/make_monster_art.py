"""Art for מפלצת הראשים (game/dragon): five world maps (hmap-N, 360x780), five ground pictures seen from
above that repeat as they scroll (hbg-N, 360x640), the title background (htitle-bg) and the app icon.

Keep the map NODES / PRIZE in sync with MAP.layouts in game/dragon/hydra.js.
Run:  py -I tools/make_monster_art.py
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import make_scenes as ms  # noqa: E402
import make_maps as mm  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "game", "dragon", "assets")
ICONS = os.path.join(HERE, "..", "game", "dragon", "icons")
INK = ms.INK
W, H = 360, 780

LAYOUTS = [
    dict(nodes=[(90, 605), (250, 520), (110, 420), (255, 318), (140, 215)], prize=(255, 120)),
    dict(nodes=[(270, 605), (110, 535), (235, 440), (95, 340), (235, 230)], prize=(110, 120)),
    dict(nodes=[(180, 605), (295, 500), (190, 400), (70, 300), (190, 205)], prize=(290, 118)),
    dict(nodes=[(80, 605), (210, 545), (300, 430), (160, 360), (70, 235)], prize=(235, 130)),
    dict(nodes=[(180, 605), (80, 500), (260, 420), (110, 320), (250, 215)], prize=(150, 115)),
]
for L in LAYOUTS:
    x0 = L["nodes"][0][0]
    L["entry"] = [(x0, 830), (x0, 720)]


# ---------------------------------------------------------------- helpers
def flight_path(L):
    """The flight route: a dark track with a glowing gold dashed line on it."""
    d = mm.catmull(mm.road_pts(L))
    return (f'<path d="{d}" fill="none" stroke="#FFB020" stroke-width="40" opacity=".12"/>'
            f'<path d="{d}" fill="none" stroke="#05070F" stroke-width="22" opacity=".85"/>'
            f'<path d="{d}" fill="none" stroke="#F2B84B" stroke-width="3.5" stroke-dasharray="10 9"/>'
            + "".join(f'<ellipse cx="{x}" cy="{y + 30}" rx="38" ry="10" fill="#000" opacity=".35" stroke="none"/>' for x, y in L["nodes"] + [L["prize"]]))


def dragon(x, y, s=1.0, body="#E8553D", wing="#FF9F1C", flip=False):
    """A little dragon flying across the sky (side view)."""
    sx = -s if flip else s
    g = (f'<path d="M-30 6 Q-48 2 -56 -10 Q-44 -2 -30 0" fill="{body}" stroke-width="4"/>'
         f'<path d="M-6 -6 Q-10 -40 -30 -48 Q-16 -30 -26 -20 Q-14 -18 -10 -4 Z" fill="{wing}" stroke-width="4"/>'
         f'<ellipse cx="-8" cy="4" rx="24" ry="12" fill="{body}" stroke-width="4"/>'
         f'<path d="M10 -2 Q22 -16 34 -12 Q44 -8 42 0 Q38 8 24 6 Z" fill="{body}" stroke-width="4"/>'
         f'<path d="M26 -12 L22 -22 L32 -14 Z" fill="#FFE0A8" stroke-width="3"/>'
         f'<circle cx="32" cy="-5" r="2.6" fill="{INK}" stroke="none"/>'
         f'<path d="M4 -6 Q2 -34 16 -42 Q12 -26 20 -16 Z" fill="{wing}" stroke-width="4"/>')
    return f'<g transform="translate({x} {y}) scale({sx} {s})">{g}</g>'


def map_svg(body, L, sky):
    """The scenery, darkened into dusk (lighter toward the bottom), with the route drawn on top."""
    shade = ('<defs><linearGradient id="dusk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05040C" stop-opacity=".72"/>'
             '<stop offset="1" stop-color="#05040C" stop-opacity=".45"/></linearGradient>'
             '<radialGradient id="vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/>'
             '<stop offset="1" stop-color="#000" stop-opacity=".6"/></radialGradient></defs>'
             f'<rect width="{W}" height="{H}" fill="url(#dusk)" stroke="none"/><rect width="{W}" height="{H}" fill="url(#vig)" stroke="none"/>')
    return mm.wrap(body + shade + flight_path(L), sky)


# ---------------------------------------------------------------- the five maps
def map_fire():
    L = LAYOUTS[0]
    body = (ms.cloud(30, 90, 0.7, "#FFE3D0") + ms.cloud(250, 180, 0.6, "#FFE3D0") +
            dragon(80, 160, 0.7) + dragon(300, 300, 0.55, flip=True) +
            ms.volcano(250, 420, 300, 190, erupt=True, color="#6E3E5E") + ms.volcano(70, 470, 200, 120, color="#7A4E6E") +
            mm.layer(470, "#8E5468", 11, 26) + mm.layer(590, "#7A4458", 12, 28) + mm.layer(700, "#64364A", 13, 18) +
            '<path d="M200 470 Q170 560 220 640 Q260 720 210 800" fill="none" stroke-width="24"/>'
            '<path d="M200 470 Q170 560 220 640 Q260 720 210 800" fill="none" stroke="#FF6B2C" stroke-width="15"/>'
            '<path d="M196 490 Q174 560 214 630" fill="none" stroke="#FFD23F" stroke-width="4"/>' +
            ms.rock(320, 640, 60, 34, "#9C7A8E") + ms.rock(40, 730, 50, 28, "#9C7A8E") + ms.rock(300, 760, 44, 24, "#9C7A8E"))
    return map_svg(body, L, ("#3A0E1A", "#C2482A"))


def map_forest():
    L = LAYOUTS[1]
    trees = "".join(ms.pine(x, y, s, snow=False, color=c) for x, y, s, c in
                    ((30, 500, 0.9, "#2F8F3A"), (330, 470, 0.8, "#3FA244"), (180, 520, 0.6, "#2F8F3A"),
                     (20, 760, 1.1, "#3FA244"), (340, 770, 1.0, "#2F8F3A"), (170, 790, 0.8, "#3FA244")))
    body = (ms.sun(60, 70, 26) + ms.cloud(240, 80, 0.6) + ms.cloud(40, 250, 0.5) +
            dragon(290, 190, 0.6, "#3FA244", "#7ED957", flip=True) + dragon(70, 380, 0.45, "#3FA244", "#C5E86C") +
            mm.layer(360, "#8ED16E", 21, 30) + mm.layer(470, "#6FC25A", 22, 26) + mm.layer(600, "#4CB85A", 23, 26) +
            mm.layer(700, "#3FA244", 24, 18) + trees +
            ms.mushroom(330, 620, 0.7) + ms.mushroom(30, 640, 0.6, "#FFD23F", "#FFFFFF") +
            ms.flowers([(60, 700), (300, 700), (200, 650), (140, 760)]))
    return map_svg(body, L, ("#0E2A3A", "#5A8A5A"))


def map_sea():
    L = LAYOUTS[2]
    sea = '<path d="M-10 330 Q90 310 180 326 Q270 342 370 318 L370 790 L-10 790 Z" fill="#2E8FD6"/>'
    isle = "".join(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#F2D49B"/>' f'<ellipse cx="{x}" cy="{y - ry * .4:.0f}" rx="{rx * .6:.0f}" ry="{ry * .5:.0f}" fill="#5CCB5F"/>'
                   for x, y, rx, ry in ((40, 470, 46, 16), (320, 640, 50, 18), (60, 740, 44, 15)))
    body = (ms.sun(300, 70, 28) + ms.cloud(30, 120, 0.7) + ms.cloud(200, 230, 0.55) +
            dragon(90, 220, 0.6, "#2A8FD0", "#4FC3F7") + sea + mm.waves("#BFF0FF", 31, 18) + isle +
            ms.palm(40, 460, 0.55) + ms.palm(325, 630, 0.6, flip=True) +
            mm.boat(300, 410, 0.7) + ms.plesio(280, 760, 0.35, "#39C1B5", "#2E8FD6") )
    return map_svg(body, L, ("#0A1A3A", "#3A7AB0"))


def map_ice():
    L = LAYOUTS[3]
    mtn = ""
    for x, base, w, h, c in ((70, 420, 240, 230, "#C9DDF0"), (260, 430, 280, 280, "#B5CDE6"), (180, 470, 220, 170, "#D6E6F5")):
        mtn += (f'<path d="M{x - w / 2} {base} L{x} {base - h} L{x + w / 2} {base} Z" fill="{c}"/>'
                f'<path d="M{x - w * .16:.0f} {base - h * .68:.0f} L{x} {base - h} L{x + w * .16:.0f} {base - h * .68:.0f} '
                f'L{x + w * .06:.0f} {base - h * .6:.0f} L{x} {base - h * .7:.0f} L{x - w * .06:.0f} {base - h * .6:.0f} Z" fill="#FFFFFF"/>')
    pines = "".join(ms.pine(x, y, s) for x, y, s in ((30, 560, 0.8), (330, 590, 0.9), (20, 760, 1.0), (340, 770, 1.1), (190, 780, 0.7)))
    body = (ms.snowflakes(26, 41, 760) + dragon(270, 140, 0.6, "#9FDCF5", "#E6F7FF", flip=True) + mtn +
            mm.layer(470, "#EAF4FF", 42, 24) + mm.layer(600, "#DDEBF8", 43, 26) + mm.layer(700, "#CFE2F4", 44, 18) + pines + ms.snowman(320, 480, 0.6))
    return map_svg(body, L, ("#14203A", "#8AA8C8"))


def map_space():
    import make_blocks_art as mba
    L = LAYOUTS[4]
    body = (ms.stars(90, 51, 770) +
            mba.planet(300, 300, 34, "#FF9F1C", ring="#FFD23F", spots="#E07F00") + mba.planet(50, 200, 22, "#7EE0C3", spots="#39C1B5") +
            mba.planet(320, 640, 24, "#FF8FC8", spots="#E8557A") + mba.planet(40, 420, 18, "#5B8DEF", ring="#BDEBFF") +
            ms.shooting_star(120, 60, 80) + dragon(80, 680, 0.6, "#5B3E9E", "#B07CE8") + dragon(300, 470, 0.45, "#5B3E9E", "#B07CE8", flip=True) )
    return map_svg(body, L, ("#0E0A2E", "#3A2E7A"))


# ---------------------------------------------------------------- ground from above (repeats top to bottom)
BW, BH = 360, 640


def tile_svg(base, body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {BW} {BH}" width="{BW}" height="{BH}">'
            f'<rect width="{BW}" height="{BH}" fill="{base}"/>'
            f'<g stroke="{INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


def wrapped(items):
    """Things scattered on the ground; one that crosses the top or bottom edge also shows on the other side."""
    out = ""
    for y, r, draw in items:
        out += draw(0)
        if y + r > BH:
            out += draw(-BH)
        if y - r < 0:
            out += draw(BH)
    return out


def river(xs, color, width, edge=INK, inner=None):
    """A river that leaves the bottom where it came in at the top, so the picture repeats."""
    pts = [(xs(y), y) for y in range(-20, BH + 21, 8)]
    d = "M" + " L".join(f"{x:.1f} {y}" for x, y in pts)
    out = (f'<path d="{d}" fill="none" stroke="{edge}" stroke-width="{width + 8}"/>'
           f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}"/>')
    if inner:
        out += f'<path d="{d}" fill="none" stroke="{inner}" stroke-width="{max(3, width // 5)}" opacity=".85"/>'
    return out


def scatter(seed, n, r_range, margin=0, avoid=None):
    rnd = random.Random(seed)
    pts = []
    tries = 0
    while len(pts) < n and tries < 4000:
        tries += 1
        x, y, r = rnd.uniform(-10 + margin, 370 - margin), rnd.uniform(0, BH), rnd.uniform(*r_range)
        if avoid and avoid(x, y, r):
            continue
        if any(math.hypot(x - a, (y - b + BH / 2) % BH - BH / 2) < r + c + 6 for a, b, c in pts):
            continue
        pts.append((x, y, r))
    return pts


def rv(amp1, amp2, mid=180):
    return lambda y: mid + amp1 * math.sin(2 * math.pi * y / BH) + amp2 * math.sin(4 * math.pi * y / BH + 1)


def bg_fire():
    xs = rv(90, 30)
    items = []
    for x, y, r in scatter(101, 16, (10, 26), avoid=lambda x, y, r: abs(x - xs(y)) < r + 30):
        def d(o, x=x, y=y, r=r):
            return (f'<ellipse cx="{x:.0f}" cy="{y + o:.0f}" rx="{r:.0f}" ry="{r * .8:.0f}" fill="#7A4E62"/>'
                    f'<ellipse cx="{x - r * .3:.0f}" cy="{y + o - r * .25:.0f}" rx="{r * .4:.0f}" ry="{r * .25:.0f}" fill="#9C6E84" stroke="none"/>')
        items.append((y, r, d))
    for x, y, r in scatter(102, 5, (14, 20), avoid=lambda x, y, r: abs(x - xs(y)) < r + 40):
        def d(o, x=x, y=y, r=r):
            return (f'<circle cx="{x:.0f}" cy="{y + o:.0f}" r="{r + 6:.0f}" fill="#4A2638"/>'
                    f'<circle cx="{x:.0f}" cy="{y + o:.0f}" r="{r:.0f}" fill="#FF6B2C"/>'
                    f'<circle cx="{x - 3:.0f}" cy="{y + o - 3:.0f}" r="{r * .4:.0f}" fill="#FFD23F" stroke="none"/>')
        items.append((y, r + 6, d))
    cracks = "".join(f'<path d="M{x:.0f} {y:.0f} l12 8 l-4 12 l10 6" fill="none" stroke="#3A1E2C" stroke-width="3"/>'
                     for x, y, _ in scatter(103, 10, (6, 6)) if 20 < y < BH - 30)
    return tile_svg("#5A3346", cracks + river(xs, "#FF6B2C", 30, inner="#FFD23F") + wrapped(items))


def bg_forest():
    xs = rv(70, 40)
    items = []
    for x, y, r in scatter(201, 26, (16, 30), avoid=lambda x, y, r: abs(x - xs(y)) < r + 26):
        c, lt = random.Random(int(x * y)).choice([("#2F7F38", "#3FA244"), ("#3FA244", "#5CCB5F"), ("#2B6E30", "#3FA244")])

        def d(o, x=x, y=y, r=r, c=c, lt=lt):
            return (f'<circle cx="{x + 4:.0f}" cy="{y + o + 6:.0f}" r="{r:.0f}" fill="#1F4A2A" stroke="none" opacity=".5"/>'
                    f'<circle cx="{x:.0f}" cy="{y + o:.0f}" r="{r:.0f}" fill="{c}"/>'
                    f'<circle cx="{x - r * .3:.0f}" cy="{y + o - r * .3:.0f}" r="{r * .45:.0f}" fill="{lt}" stroke="none"/>')
        items.append((y, r + 8, d))
    flowers = "".join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="3" fill="{c}" stroke="none"/>'
                      for (x, y, _), c in zip(scatter(202, 40, (2, 2)), ["#FFD23F", "#FF8FA3", "#FFFFFF"] * 20) if 4 < y < BH - 4)
    return tile_svg("#6FC25A", flowers + river(xs, "#4FC3F7", 34, inner="#BFF0FF") + wrapped(items))


def bg_sea():
    items = []
    for x, y, r in scatter(301, 6, (26, 44), margin=20):
        def d(o, x=x, y=y, r=r):
            return (f'<ellipse cx="{x:.0f}" cy="{y + o:.0f}" rx="{r + 10:.0f}" ry="{r * .8 + 8:.0f}" fill="#7FD3F5" stroke="none" opacity=".6"/>'
                    f'<ellipse cx="{x:.0f}" cy="{y + o:.0f}" rx="{r:.0f}" ry="{r * .8:.0f}" fill="#F2D49B"/>'
                    f'<ellipse cx="{x + 2:.0f}" cy="{y + o - 2:.0f}" rx="{r * .55:.0f}" ry="{r * .45:.0f}" fill="#5CCB5F"/>'
                    f'<circle cx="{x - r * .1:.0f}" cy="{y + o - r * .1:.0f}" r="{r * .22:.0f}" fill="#3FA244"/>')
        items.append((y, r + 12, d))
    waves = ""
    rnd = random.Random(302)
    for _ in range(46):
        x, y = rnd.uniform(0, 340), rnd.uniform(10, BH - 10)
        waves += f'<path d="M{x:.0f} {y:.0f} q7 -5 14 0 q7 5 14 0" fill="none" stroke="#BFF0FF" stroke-width="3" opacity=".8"/>'
    return tile_svg("#2E8FD6", waves + wrapped(items))


def bg_ice():
    xs = rv(60, 30, 200)
    items = []
    for x, y, r in scatter(401, 20, (12, 20), avoid=lambda x, y, r: abs(x - xs(y)) < r + 30):
        def d(o, x=x, y=y, r=r):
            pts = []
            for i in range(16):
                a = i * math.pi / 8
                rr = r if i % 2 == 0 else r * .55
                pts.append(f"{x + math.cos(a) * rr:.1f} {y + o + math.sin(a) * rr:.1f}")
            return (f'<path d="M{" L".join(pts)} Z" fill="#2F7F5A"/>'
                    f'<circle cx="{x:.0f}" cy="{y + o:.0f}" r="{r * .35:.0f}" fill="#FFFFFF" stroke="none" opacity=".85"/>')
        items.append((y, r, d))
    for x, y, r in scatter(402, 4, (20, 28), avoid=lambda x, y, r: abs(x - xs(y)) < r + 40):
        def d(o, x=x, y=y, r=r):
            return f'<ellipse cx="{x:.0f}" cy="{y + o:.0f}" rx="{r * 1.3:.0f}" ry="{r:.0f}" fill="#BDEBFF"/>'
        items.append((y, r, d))
    return tile_svg("#EAF4FF", river(xs, "#9CC8E0", 10, edge="#6FA8D6") + wrapped(items))


def bg_space():
    rnd = random.Random(501)
    stars = "".join(f'<circle cx="{rnd.uniform(0, 360):.0f}" cy="{rnd.uniform(2, BH - 2):.0f}" r="{rnd.uniform(.8, 2.2):.1f}" fill="#FFF6C9" stroke="none"/>'
                    for _ in range(110))
    neb = "".join(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{c}" stroke="none" opacity=".12"/>'
                  for (x, y, r), c in zip(((80, 160, 120), (290, 420, 140), (160, 560, 90)), ("#B07CE8", "#4FC3F7", "#FF8FC8")))
    items = []
    for (x, y, r), c in zip(scatter(502, 3, (12, 22), margin=30), ("#FF9F1C", "#7EE0C3", "#FF8FC8")):
        def d(o, x=x, y=y, r=r, c=c):
            return (f'<circle cx="{x:.0f}" cy="{y + o:.0f}" r="{r:.0f}" fill="{c}"/>'
                    f'<circle cx="{x - r * .3:.0f}" cy="{y + o - r * .3:.0f}" r="{r * .3:.0f}" fill="#FFFFFF" stroke="none" opacity=".45"/>')
        items.append((y, r, d))
    return tile_svg("#140E36", neb + stars + wrapped(items))


# ---------------------------------------------------------------- title background and icon
def title_bg():
    body = (ms.stars(60, 77, 380) +
            dragon(70, 220, 0.7) + dragon(300, 330, 0.6, "#3FA244", "#7ED957", flip=True) + dragon(110, 400, 0.45, "#2A8FD0", "#4FC3F7") +
            ms.volcano(280, 640, 260, 170, erupt=True, color="#6E5486") +
            mm.layer(600, "#2A1E40", 61, 30) + mm.layer(680, "#1C1430", 62, 24) + mm.layer(740, "#120C20", 63, 18))
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" preserveAspectRatio="xMidYMax slice">'
            '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070A1A"/>'
            f'<stop offset="0.55" stop-color="#2A1A4A"/><stop offset="0.85" stop-color="#8A2A1A"/></linearGradient>{ms.DEFS}</defs>'
            f'<rect width="{W}" height="{H}" fill="url(#sky)"/>'
            f'<g stroke="{INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


def icon():
    heads = ""
    for (x, y, c, nc) in ((150, 190, "#FF9F1C", "#D9730D"), (256, 140, "#5BC8F5", "#2A8FD0"), (362, 190, "#7ED957", "#3FA244")):
        heads += (f'<path d="M256 360 Q{(256 + x) / 2:.0f} 280 {x} {y}" fill="none" stroke="{INK}" stroke-width="44"/>'
                  f'<path d="M256 360 Q{(256 + x) / 2:.0f} 280 {x} {y}" fill="none" stroke="{nc}" stroke-width="26"/>')
    faces = ""
    for (x, y, c) in ((150, 190, "#FF9F1C"), (256, 140, "#5BC8F5"), (362, 190, "#7ED957")):
        faces += (f'<circle cx="{x}" cy="{y}" r="50" fill="{c}"/>'
                  f'<ellipse cx="{x}" cy="{y - 26}" rx="34" ry="22" fill="#FFF4C9"/>'
                  f'<circle cx="{x - 20}" cy="{y + 10}" r="14" fill="#FFFFFF" stroke-width="7"/><circle cx="{x + 20}" cy="{y + 10}" r="14" fill="#FFFFFF" stroke-width="7"/>'
                  f'<circle cx="{x - 20}" cy="{y + 6}" r="7" fill="{INK}" stroke="none"/><circle cx="{x + 20}" cy="{y + 6}" r="7" fill="{INK}" stroke="none"/>')
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">'
            '<rect width="512" height="512" rx="110" fill="#FF9F1C"/><circle cx="256" cy="280" r="210" fill="#FFD23F"/>'
            f'<g stroke="{INK}" stroke-width="12" stroke-linejoin="round" stroke-linecap="round">'
            '<path d="M200 380 Q90 300 50 350 Q100 370 110 420 Q150 400 200 430 Z" fill="#39C1B5"/>'
            '<path d="M312 380 Q422 300 462 350 Q412 370 402 420 Q362 400 312 430 Z" fill="#39C1B5"/>'
            f'{heads}<ellipse cx="256" cy="400" rx="78" ry="86" fill="#8E5BD9"/><ellipse cx="256" cy="420" rx="44" ry="56" fill="#E3D6FF" stroke="none"/>'
            f'{faces}</g></svg>')


def main():
    os.makedirs(OUT, exist_ok=True)
    os.makedirs(ICONS, exist_ok=True)
    for i, fn in enumerate((map_fire, map_forest, map_sea, map_ice, map_space), 1):
        with open(os.path.join(OUT, f"hmap-{i}.svg"), "w", encoding="utf8") as f:
            f.write(fn())
    for i, fn in enumerate((bg_fire, bg_forest, bg_sea, bg_ice, bg_space), 1):
        with open(os.path.join(OUT, f"hbg-{i}.svg"), "w", encoding="utf8") as f:
            f.write(fn())
    with open(os.path.join(OUT, "htitle-bg.svg"), "w", encoding="utf8") as f:
        f.write(title_bg())
    with open(os.path.join(ICONS, "icon.svg"), "w", encoding="utf8") as f:
        f.write(icon())
    print("wrote hmap-1..5, hbg-1..5, htitle-bg, icon.svg")


if __name__ == "__main__":
    main()
