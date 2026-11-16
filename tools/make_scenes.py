"""Builds the hidden-picture scenes for every level (360x560 SVGs).

Each world has its own background kit; each level places different dinos and props on it.
Dinos come from the character art in ../assets, recoloured so they read as new friends.
Run:  py -I tools/make_scenes.py
"""
import math
import os
import random
import re
import shutil

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "..", "assets")
OUT = os.path.join(HERE, "..", "game", "assets")
INK = "#2B1B3D"

# ---------------------------------------------------------------- dinos from character art
_cache = {}


def _inner(name):
    if name not in _cache:
        with open(os.path.join(ART, name + ".svg"), encoding="utf8") as f:
            t = f.read()
        _cache[name] = re.search(r"<svg[^>]*>(.*)</svg>", t, re.S).group(1)
    return _cache[name]


def _recolor(s, m):
    if not m:
        return s
    pat = re.compile("|".join(re.escape(k) for k in m), re.I)
    return pat.sub(lambda mo: m[mo.group(0).upper()], s)


# name: (width, height, feet-y)
SIZES = {"pip": (200, 200, 186), "stegi": (200, 200, 186), "anki": (200, 200, 182),
         "rafi": (200, 200, 190), "petra": (200, 200, 168), "magma-rex": (240, 220, 212)}


def _dino(name, x, y, s, flip, colors, nohat):
    w = SIZES[name][0]
    body = _inner(name)
    if nohat and name == "pip":
        body = body.split("<!-- explorer hat -->")[0] + "</g>"
    body = _recolor(body, colors)
    if flip:
        tr = f"translate({x + w * s:.1f} {y:.1f}) scale({-s} {s})"
    else:
        tr = f"translate({x:.1f} {y:.1f}) scale({s})"
    return f'<g transform="{tr}">{body}</g>'


def put(name, cx, gy, s, flip=False, colors=None, nohat=False, shadow=True):
    """Stand a dino with its feet on ground line gy, centred on cx."""
    w, h, feet = SIZES[name]
    out = ""
    if shadow:
        out += f'<ellipse cx="{cx}" cy="{gy + 1}" rx="{w * 0.3 * s:.1f}" ry="{6 * s + 2:.1f}" fill="{INK}" opacity="0.18" stroke="none"/>'
    return out + _dino(name, cx - w / 2 * s, gy - feet * s, s, flip, colors, nohat)


def fly(name, cx, cy, s, flip=False, colors=None):
    w, h, _ = SIZES[name]
    return _dino(name, cx - w / 2 * s, cy - h / 2 * s, s, flip, colors, False)


PIP_ORANGE = {"#5CCB5F": "#FF9F1C", "#3FA244": "#E07F00", "#B8EE8A": "#FFE0A8", "#FF9F1C": "#8E5BD9"}
PIP_BLUE = {"#5CCB5F": "#5B8DEF", "#3FA244": "#3E6FD6", "#B8EE8A": "#BFD3FF", "#FF9F1C": "#FFD23F"}
PIP_PINK = {"#5CCB5F": "#FF8FA3", "#3FA244": "#E8557A", "#B8EE8A": "#FFD6DF", "#FF9F1C": "#39C1B5"}
STEGI_GREEN = {"#FFB13B": "#7BD36A", "#E8962A": "#4FA347", "#FFE29A": "#D6F5B8", "#F08A1C": "#4FA347", "#39C1B5": "#FF8FA3"}
STEGI_PURPLE = {"#FFB13B": "#A884E8", "#E8962A": "#7B5BC9", "#FFE29A": "#E3D6FF", "#F08A1C": "#7B5BC9", "#39C1B5": "#FFD23F"}
PETRA_ORANGE = {"#FF8FA3": "#FF9F1C", "#E86F8A": "#E07F00", "#FFD0DA": "#FFE0A8", "#8E5BD9": "#E8553D"}
PETRA_TEAL = {"#FF8FA3": "#39C1B5", "#E86F8A": "#2A9C92", "#FFD0DA": "#C9F2EE", "#8E5BD9": "#FFD23F"}
ANKI_ORANGE = {"#5B8DEF": "#FFB13B", "#3E6FD6": "#E8962A", "#8FB3FF": "#FFE29A"}
ANKI_GREEN = {"#5B8DEF": "#5CCB5F", "#3E6FD6": "#3FA244", "#8FB3FF": "#B8EE8A"}
RAFI_PURPLE = {"#39C1B5": "#A884E8", "#2A9C92": "#7B5BC9"}
RAFI_ORANGE = {"#39C1B5": "#FF9F1C", "#2A9C92": "#E07F00"}

# ---------------------------------------------------------------- scene wrapper
DEFS = """
<g id="cloud"><circle cx="0" cy="0" r="16"/><circle cx="18" cy="-8" r="20"/><circle cx="38" cy="0" r="15"/><rect x="0" y="0" width="38" height="14" rx="7"/></g>
<g id="bush"><circle cx="0" cy="0" r="18"/><circle cx="22" cy="-8" r="22"/><circle cx="46" cy="2" r="17"/><rect x="0" y="0" width="46" height="18"/></g>
"""


def scene(body, sky=("#5EC8F7", "#C9F1FF")):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 560" width="360" height="560">'
            f'<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{sky[0]}"/>'
            f'<stop offset="0.75" stop-color="{sky[1]}"/></linearGradient>{DEFS}</defs>'
            f'<rect width="360" height="560" fill="url(#sky)"/>'
            f'<g stroke="{INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>')


# ---------------------------------------------------------------- props
def sun(x, y, r=32):
    return (f'<circle cx="{x}" cy="{y}" r="{r + 12}" fill="#FFE98A" opacity="0.7" stroke="none"/>'
            f'<circle cx="{x}" cy="{y}" r="{r}" fill="#FFD23F"/>')


def moon(x, y, r=30):
    return (f'<circle cx="{x}" cy="{y}" r="{r + 16}" fill="#FFF3C4" opacity="0.18" stroke="none"/>'
            f'<circle cx="{x}" cy="{y}" r="{r}" fill="#FFF3C4"/>'
            f'<circle cx="{x - 9}" cy="{y - 6}" r="{r * 0.22:.1f}" fill="#EFDFA6" stroke="none"/>'
            f'<circle cx="{x + 10}" cy="{y + 8}" r="{r * 0.15:.1f}" fill="#EFDFA6" stroke="none"/>')


def stars(n, seed, ymax=300):
    rnd = random.Random(seed)
    out = ""
    for _ in range(n):
        x, y, r = rnd.uniform(8, 352), rnd.uniform(8, ymax), rnd.uniform(1.2, 2.6)
        out += f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.1f}" fill="#FFF6C9" stroke="none"/>'
    for _ in range(n // 6):
        x, y, s = rnd.uniform(20, 340), rnd.uniform(20, ymax), rnd.uniform(5, 8)
        out += (f'<path d="M{x:.0f} {y - s:.0f} L{x + s * .3:.1f} {y - s * .3:.1f} L{x + s:.0f} {y:.0f} L{x + s * .3:.1f} {y + s * .3:.1f} '
                f'L{x:.0f} {y + s:.0f} L{x - s * .3:.1f} {y + s * .3:.1f} L{x - s:.0f} {y:.0f} L{x - s * .3:.1f} {y - s * .3:.1f} Z" fill="#FFF6C9" stroke="none"/>')
    return out


def cloud(x, y, s=1.0, color="#FFFFFF"):
    return (f'<g transform="translate({x} {y}) scale({s})"><use href="#cloud" fill="{INK}" stroke-width="10"/>'
            f'<use href="#cloud" fill="{color}" stroke="none"/></g>')


def bush(x, y, s=1.0, color="#3FA244"):
    return (f'<g transform="translate({x} {y}) scale({s})"><use href="#bush" fill="{INK}" stroke-width="10"/>'
            f'<use href="#bush" fill="{color}" stroke="none"/></g>')


def ground(y, color, curve=32):
    return f'<path d="M-10 {y} Q180 {y - curve} 370 {y} L370 570 L-10 570 Z" fill="{color}"/>'


def hills(y, color, seed=1):
    rnd = random.Random(seed)
    a, b, c = (rnd.uniform(-40, 30) for _ in range(3))
    return (f'<path d="M-10 {y} Q90 {y - 60 + a:.0f} 180 {y - 18 + b:.0f} Q270 {y - 68 + c:.0f} 370 {y - 30} L370 {y + 120} L-10 {y + 120} Z" '
            f'fill="{color}"/>')


def volcano(x, base, w=200, h=150, erupt=False, color="#7A5A8E"):
    top = base - h
    out = ""
    if erupt:
        out += (f'<path d="M{x - 20} {top} L{x - 34} {top - 34} L{x - 8} {top - 18} L{x} {top - 50} L{x + 8} {top - 18} '
                f'L{x + 34} {top - 34} L{x + 20} {top} Z" fill="#FFD23F" stroke-width="4"/>')
        for dx, dy, r in ((-40, -56, 8), (34, -70, 7), (4, -86, 10), (-14, -110, 6)):
            out += f'<circle cx="{x + dx}" cy="{top + dy}" r="{r}" fill="#FF6B2C" stroke-width="4"/>'
    else:
        for dx, dy, r in ((0, -26, 14), (10, -50, 12), (-2, -72, 10)):
            out += f'<circle cx="{x + dx}" cy="{top + dy}" r="{r}" fill="#E4DEEE" stroke-width="4"/>'
    out += f'<path d="M{x - w / 2} {base} L{x - 24} {top} L{x + 24} {top} L{x + w / 2} {base} Z" fill="{color}"/>'
    out += (f'<path d="M{x - 24} {top} L{x + 24} {top} L{x + 18} {top + 20} Q{x + 11} {top + 30} {x + 5} {top + 16} '
            f'Q{x - 2} {top + 36} {x - 9} {top + 14} Q{x - 15} {top + 24} {x - 20} {top + 12} Z" fill="#FF6B2C" stroke-width="4"/>')
    out += f'<path d="M{x + 4} {top + 28} Q{x + 10} {top + 58} {x + 2} {top + 88}" fill="none" stroke="#FF6B2C" stroke-width="6"/>'
    return out


def palm(x, base, s=1.0, flip=False):
    sx = -s if flip else s
    g = ('<path d="M290 400 L294 250 L310 250 L314 400 Z" fill="#B57745"/>'
         '<path d="M294 300 L310 300 M293 340 L311 340 M292 370 L312 370" fill="none" stroke="#8A5634" stroke-width="3"/>'
         '<path d="M302 248 Q270 222 238 238 Q266 236 302 256 Z" fill="#3FA244" stroke-width="4"/>'
         '<path d="M302 248 Q300 214 270 200 Q290 222 298 252 Z" fill="#3FA244" stroke-width="4"/>'
         '<path d="M302 248 Q330 210 356 220 Q330 226 306 254 Z" fill="#3FA244" stroke-width="4"/>'
         '<path d="M302 248 Q340 248 360 274 Q332 262 304 256 Z" fill="#3FA244" stroke-width="4"/>'
         '<path d="M302 248 Q270 260 256 290 Q276 268 304 256 Z" fill="#3FA244" stroke-width="4"/>'
         '<circle cx="298" cy="258" r="6" fill="#8A5634" stroke-width="3"/><circle cx="310" cy="254" r="6" fill="#8A5634" stroke-width="3"/>')
    return f'<g transform="translate({x - 302 * sx:.1f} {base - 400 * s:.1f}) scale({sx} {s})">{g}</g>'


def pine(x, base, s=1.0, snow=True, color="#3FA244"):
    g = (f'<rect x="-7" y="-22" width="14" height="24" fill="#8A5634" stroke-width="4"/>'
         f'<path d="M0 -60 L50 -12 L-50 -12 Z" fill="{color}"/>'
         f'<path d="M0 -92 L42 -44 L-42 -44 Z" fill="{color}"/>'
         f'<path d="M0 -122 L32 -76 L-32 -76 Z" fill="{color}"/>')
    if snow:
        g += ('<path d="M0 -122 L14 -101 Q8 -95 2 -100 Q-4 -94 -10 -99 L-14 -101 Z" fill="#FFFFFF" stroke-width="3"/>'
              '<path d="M-42 -44 Q-20 -36 0 -44 Q20 -36 42 -44 L36 -50 L-36 -50 Z" fill="#FFFFFF" stroke-width="3"/>'
              '<path d="M-50 -12 Q-24 -4 0 -12 Q24 -4 50 -12 L44 -18 L-44 -18 Z" fill="#FFFFFF" stroke-width="3"/>')
    return f'<g transform="translate({x} {base}) scale({s})" stroke-width="{5 / s:.1f}">{g}</g>'


def fern(x, y, s=1.0, color="#3FA244"):
    leaves = "".join(f'<path d="M0 0 Q-13 -32 0 -64 Q13 -32 0 0 Z" transform="rotate({a})" fill="{color}"/>' for a in (-64, -32, 0, 32, 64))
    return f'<g transform="translate({x} {y}) scale({s})" stroke-width="{4 / s:.1f}">{leaves}</g>'


def flower(x, y, c="#FF8FA3", r=6):
    return (f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" stroke-width="2.5"/>'
            f'<circle cx="{x}" cy="{y}" r="{r * 0.42:.1f}" fill="#FFD23F" stroke="none"/>')


def flowers(points, colors=("#FF8FA3", "#FFFFFF", "#FFD23F")):
    return "".join(flower(x, y, colors[i % len(colors)]) for i, (x, y) in enumerate(points))


def rock(x, y, w, h, c="#9C8AA8"):
    return f'<path d="M{x - w / 2} {y} Q{x - w / 2} {y - h} {x} {y - h} Q{x + w / 2} {y - h} {x + w / 2} {y} Z" fill="{c}"/>'


def nest(x, y, egg_spots="#7C8CFF"):
    g = ('<ellipse cx="292" cy="500" rx="10" ry="13" fill="#FFF3D6" stroke-width="4"/>'
         '<ellipse cx="320" cy="500" rx="10" ry="13" fill="#FFF3D6" stroke-width="4"/>'
         '<ellipse cx="306" cy="496" rx="10" ry="13" fill="#FFF3D6" stroke-width="4"/>'
         f'<circle cx="303" cy="492" r="3" fill="{egg_spots}" stroke="none"/><circle cx="317" cy="498" r="3" fill="{egg_spots}" stroke="none"/>'
         f'<circle cx="290" cy="498" r="3" fill="{egg_spots}" stroke="none"/>'
         '<path d="M270 506 Q306 528 342 506 L338 520 Q306 536 274 520 Z" fill="#B57745" stroke-width="4"/>'
         '<path d="M280 514 L298 520 M312 520 L330 513" fill="none" stroke="#8A5634" stroke-width="3"/>')
    return f'<g transform="translate({x - 306} {y - 512})">{g}</g>'


def brachio(tx, ty, s=1.0, body="#7C8CFF", dark="#5E6EE0", spot="#A9B4FF", sleep=False, flip=False):
    eye = ('<path d="M258 246 Q264 251 270 246" fill="none" stroke-width="3"/>' if sleep else
           '<circle cx="264" cy="245" r="5" fill="#FFFFFF" stroke-width="3"/><circle cx="265.5" cy="245.5" r="2.5" fill="#2B1B3D" stroke="none"/>')
    g = (f'<path d="M178 342 Q196 292 246 252 L264 270 Q222 300 206 356 Z" fill="{body}"/>'
         f'<rect x="102" y="370" width="24" height="58" rx="10" fill="{dark}"/><rect x="168" y="370" width="24" height="58" rx="10" fill="{dark}"/>'
         f'<rect x="84" y="376" width="26" height="62" rx="10" fill="{body}"/><rect x="148" y="376" width="26" height="62" rx="10" fill="{body}"/>'
         f'<path d="M76 352 Q36 344 14 382 Q44 372 80 378 Z" fill="{body}"/>'
         f'<ellipse cx="140" cy="362" rx="68" ry="40" fill="{body}"/>'
         f'<circle cx="118" cy="345" r="8" fill="{spot}"/><circle cx="146" cy="337" r="6" fill="{spot}"/><circle cx="168" cy="352" r="7" fill="{spot}"/>'
         f'<circle cx="214" cy="306" r="4" fill="{spot}"/><circle cx="232" cy="284" r="4" fill="{spot}"/>'
         f'<ellipse cx="262" cy="252" rx="25" ry="15" transform="rotate(-20 262 252)" fill="{body}"/>'
         f'{eye}<path d="M270 260 Q278 260 284 252" fill="none" stroke-width="3"/>'
         f'<ellipse cx="274" cy="256" rx="4" ry="2.5" fill="#FF8FA3" stroke="none"/>')
    sx = -s if flip else s
    return f'<g transform="translate({tx} {ty}) scale({sx} {s})" stroke-width="{5 / s:.1f}">{g}</g>'


def plesio(cx, wy, s=1.0, color="#39C1B5", sea="#2FA7E0", sleep=False):
    eye = ('<path d="M66 -96 Q71 -92 76 -96" fill="none" stroke-width="3"/>' if sleep else
           '<circle cx="71" cy="-96" r="4.5" fill="#FFFFFF" stroke-width="3"/><circle cx="72.5" cy="-95.5" r="2.2" fill="#2B1B3D" stroke="none"/>')
    g = (f'<ellipse cx="-36" cy="4" rx="42" ry="20" fill="{color}"/>'
         f'<path d="M-80 6 Q-100 -6 -108 6" fill="none" stroke="{INK}" stroke-width="10"/>'
         f'<path d="M-80 6 Q-100 -6 -108 6" fill="none" stroke="{color}" stroke-width="5"/>'
         f'<path d="M4 4 Q14 -60 50 -90 L64 -80 Q34 -50 30 8 Z" fill="{color}"/>'
         f'<ellipse cx="66" cy="-90" rx="22" ry="13" fill="{color}"/>'
         f'{eye}<path d="M76 -84 Q83 -84 88 -90" fill="none" stroke-width="3"/>'
         f'<ellipse cx="74" cy="-85" rx="4" ry="2.5" fill="#FF8FA3" stroke="none"/>'
         f'<circle cx="-46" cy="-6" r="5" fill="#FFFFFF" opacity="0.5" stroke="none"/><circle cx="-26" cy="-10" r="4" fill="#FFFFFF" opacity="0.5" stroke="none"/>'
         f'<rect x="-120" y="8" width="230" height="30" fill="{sea}" stroke="none"/>'
         f'<path d="M-110 10 Q-90 2 -70 10 Q-50 18 -30 10 Q-10 2 10 10 Q30 18 50 10 Q70 2 90 10" fill="none" stroke="#FFFFFF" stroke-width="4"/>')
    return f'<g transform="translate({cx} {wy}) scale({s})" stroke-width="{5 / s:.1f}">{g}</g>'


def mammoth(cx, gy, s=1.0, color="#A0673F", dark="#7A4A2A", flip=False):
    g = (f'<ellipse cx="0" cy="1" rx="62" ry="7" fill="{INK}" opacity="0.18" stroke="none"/>'
         f'<rect x="-46" y="-40" width="24" height="40" rx="9" fill="{dark}"/><rect x="18" y="-40" width="24" height="40" rx="9" fill="{dark}"/>'
         f'<rect x="-30" y="-36" width="26" height="38" rx="9" fill="{color}"/><rect x="30" y="-36" width="26" height="38" rx="9" fill="{color}"/>'
         f'<ellipse cx="0" cy="-70" rx="62" ry="46" fill="{color}"/>'
         f'<path d="M-40 -96 Q-30 -88 -20 -98 M-10 -108 Q0 -98 10 -110 M-46 -64 Q-36 -56 -26 -66" fill="none" stroke="{dark}" stroke-width="4"/>'
         f'<path d="M-62 -76 Q-74 -70 -72 -54" fill="none" stroke-width="5"/>'
         f'<circle cx="54" cy="-86" r="32" fill="{color}"/>'
         f'<path d="M40 -116 Q48 -128 56 -118 Q62 -130 68 -116" fill="none" stroke-width="4"/>'
         f'<ellipse cx="38" cy="-82" rx="15" ry="22" fill="{dark}"/>'
         f'<path d="M76 -72 Q94 -40 86 -16 Q82 -6 74 -12 Q80 -38 64 -60 Z" fill="{color}"/>'
         f'<path d="M66 -64 Q90 -48 100 -66 Q86 -56 70 -56 Z" fill="#FFF3D6" stroke-width="4"/>'
         f'<circle cx="62" cy="-94" r="5" fill="#FFFFFF" stroke-width="3"/><circle cx="63.5" cy="-93.5" r="2.5" fill="{INK}" stroke="none"/>'
         f'<ellipse cx="70" cy="-80" rx="5" ry="3" fill="#FF8FA3" stroke="none"/>')
    sx = -s if flip else s
    return f'<g transform="translate({cx} {gy}) scale({sx} {s})" stroke-width="{5 / s:.1f}">{g}</g>'


def sandcastle(x, gy, s=1.0):
    g = ('<rect x="-40" y="-40" width="80" height="40" fill="#F2C46B"/>'
         '<path d="M-46 -40 L-46 -78 L-38 -78 L-38 -70 L-30 -70 L-30 -78 L-22 -78 L-22 -40 Z" fill="#F2C46B"/>'
         '<path d="M22 -40 L22 -78 L30 -78 L30 -70 L38 -70 L38 -78 L46 -78 L46 -40 Z" fill="#F2C46B"/>'
         '<path d="M-14 -40 L-14 -96 L-6 -96 L-6 -88 L6 -88 L6 -96 L14 -96 L14 -40 Z" fill="#F7D48A"/>'
         '<path d="M0 -96 L0 -124" fill="none" stroke-width="4"/><path d="M0 -124 L20 -117 L0 -110 Z" fill="#E8553D" stroke-width="3"/>'
         '<path d="M-8 0 L-8 -16 Q0 -24 8 -16 L8 0 Z" fill="#B57745" stroke-width="4"/>'
         '<circle cx="-30" cy="-56" r="3" fill="#B57745" stroke="none"/><circle cx="30" cy="-56" r="3" fill="#B57745" stroke="none"/>')
    return f'<g transform="translate({x} {gy}) scale({s})" stroke-width="{5 / s:.1f}">{g}</g>'


def starfish(x, y, r=12, c="#FF8FA3"):
    pts = []
    for i in range(10):
        a = -math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append(f"{x + math.cos(a) * rr:.1f} {y + math.sin(a) * rr:.1f}")
    return f'<path d="M{" L".join(pts)} Z" fill="{c}" stroke-width="3"/>'


def shell(x, y, s=1.0, c="#FFD6DF"):
    return (f'<g transform="translate({x} {y}) scale({s})" stroke-width="{3 / s:.1f}"><path d="M0 0 L-14 -14 Q0 -26 14 -14 Z" fill="{c}"/>'
            f'<path d="M0 0 L-6 -20 M0 0 L0 -22 M0 0 L6 -20" fill="none"/></g>')


def crab(x, y, s=1.0):
    g = ('<path d="M-22 4 L-34 12 M-20 10 L-30 20 M22 4 L34 12 M20 10 L30 20" fill="none" stroke-width="4"/>'
         '<circle cx="-28" cy="-14" r="8" fill="#E8553D" stroke-width="4"/><circle cx="28" cy="-14" r="8" fill="#E8553D" stroke-width="4"/>'
         '<ellipse cx="0" cy="0" rx="24" ry="15" fill="#E8553D"/>'
         '<path d="M-8 -14 L-8 -24 M8 -14 L8 -24" fill="none" stroke-width="4"/>'
         '<circle cx="-8" cy="-26" r="4" fill="#FFFFFF" stroke-width="3"/><circle cx="8" cy="-26" r="4" fill="#FFFFFF" stroke-width="3"/>'
         '<path d="M-6 4 Q0 9 6 4" fill="none" stroke-width="3"/>')
    return f'<g transform="translate({x} {y}) scale({s})">{g}</g>'


def fish(x, y, c="#FFB13B", flip=False, s=1.0):
    sx = -s if flip else s
    g = (f'<path d="M-18 0 L-30 -10 L-30 10 Z" fill="{c}" stroke-width="3"/><ellipse cx="0" cy="0" rx="18" ry="11" fill="{c}" stroke-width="3"/>'
         f'<circle cx="8" cy="-3" r="2.5" fill="{INK}" stroke="none"/>')
    return f'<g transform="translate({x} {y}) scale({sx} {s})">{g}</g>'


def mushroom(x, gy, s=1.0, cap="#E8553D", dots="#FFFFFF", glow=None):
    g = ""
    if glow:
        g += f'<circle cx="0" cy="-34" r="44" fill="{glow}" opacity="0.28" stroke="none"/>'
    g += (f'<path d="M-10 0 L-8 -30 L8 -30 L10 0 Z" fill="#FFF3D6"/>'
          f'<path d="M-36 -26 Q-36 -66 0 -66 Q36 -66 36 -26 Z" fill="{cap}"/>'
          f'<circle cx="-16" cy="-44" r="6" fill="{dots}" stroke="none"/><circle cx="10" cy="-52" r="5" fill="{dots}" stroke="none"/>'
          f'<circle cx="20" cy="-34" r="4" fill="{dots}" stroke="none"/>')
    return f'<g transform="translate({x} {gy}) scale({s})" stroke-width="{4 / s:.1f}">{g}</g>'


def firefly(x, y):
    return (f'<circle cx="{x}" cy="{y}" r="7" fill="#FFF27A" opacity="0.35" stroke="none"/>'
            f'<circle cx="{x}" cy="{y}" r="2.6" fill="#FFF27A" stroke="none"/>')


def waterfall(x0, x1, ytop, ybot):
    out = f'<rect x="{x0}" y="{ytop}" width="{x1 - x0}" height="{ybot - ytop}" fill="#7FD8FF"/>'
    for i, xx in enumerate(range(x0 + 12, x1 - 6, 16)):
        out += f'<path d="M{xx} {ytop + 10 + (i % 2) * 20} L{xx} {ybot - 20 - (i % 3) * 14}" fill="none" stroke="#FFFFFF" stroke-width="4"/>'
    cx = (x0 + x1) / 2
    out += f'<ellipse cx="{cx}" cy="{ybot}" rx="{(x1 - x0) * 0.9:.0f}" ry="18" fill="#4FC3F7"/>'
    out += f'<circle cx="{x0 + 6}" cy="{ybot - 6}" r="9" fill="#FFFFFF" stroke-width="3"/><circle cx="{x1 - 8}" cy="{ybot - 8}" r="10" fill="#FFFFFF" stroke-width="3"/>'
    return out


def vine(x, length, seed=1):
    rnd = random.Random(seed)
    out = f'<path d="M{x} -5 Q{x + 14} {length / 3:.0f} {x - 6} {length * 2 / 3:.0f} Q{x - 14} {length * 0.85:.0f} {x + 2} {length}" fill="none" stroke="#2F7A34" stroke-width="5"/>'
    for i in range(1, 5):
        y = length * i / 5
        side = 1 if i % 2 else -1
        out += f'<path d="M{x} {y:.0f} Q{x + 18 * side} {y - 12:.0f} {x + 22 * side} {y + 4:.0f} Q{x + 10 * side} {y + 6:.0f} {x} {y:.0f} Z" fill="#5CCB5F" stroke-width="3"/>'
    return out


def canopy(color="#2F8F3A", light="#3FA244"):
    out = ""
    for (x, y, r, c) in ((0, 10, 46, color), (60, -6, 44, light), (120, 14, 40, color), (180, -10, 46, light),
                         (240, 12, 42, color), (300, -4, 46, light), (360, 14, 44, color)):
        out += f'<circle cx="{x}" cy="{y}" r="{r}" fill="{INK}" stroke-width="10"/>'
    for (x, y, r, c) in ((0, 10, 46, color), (60, -6, 44, light), (120, 14, 40, color), (180, -10, 46, light),
                         (240, 12, 42, color), (300, -4, 46, light), (360, 14, 44, color)):
        out += f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" stroke="none"/>'
    return out


def trunk(x, w=44):
    return (f'<path d="M{x - w / 2} 570 L{x - w / 2 + 6} -10 L{x + w / 2 - 6} -10 L{x + w / 2} 570 Z" fill="#8A5634"/>'
            f'<path d="M{x - 6} 120 Q{x} 160 {x - 4} 200 M{x + 6} 300 Q{x + 10} 340 {x + 4} 380" fill="none" stroke="#6E4428" stroke-width="4"/>')


def log(x, y, w=150):
    return (f'<rect x="{x - w / 2}" y="{y - 26}" width="{w}" height="30" rx="14" fill="#B57745"/>'
            f'<ellipse cx="{x + w / 2 - 4}" cy="{y - 11}" rx="10" ry="15" fill="#E0B07A"/>'
            f'<ellipse cx="{x + w / 2 - 4}" cy="{y - 11}" rx="4" ry="7" fill="none" stroke-width="3"/>')


def igloo(x, gy, s=1.0):
    g = ('<path d="M-60 0 Q-60 -64 0 -64 Q60 -64 60 0 Z" fill="#FFFFFF"/>'
         '<path d="M-56 -22 L56 -22 M-44 -44 L44 -44 M-20 -64 L-24 -44 M20 -64 L24 -44 M-40 -44 L-36 -22 M0 -44 L0 -22 M40 -44 L36 -22 M-20 -22 L-20 0 M20 -22 L20 0" '
         'fill="none" stroke="#BFD9EC" stroke-width="3"/>'
         '<path d="M-60 0 Q-60 -64 0 -64 Q60 -64 60 0 Z" fill="none"/>'
         '<path d="M-16 0 L-16 -18 Q0 -34 16 -18 L16 0 Z" fill="#3A2A4E"/>')
    return f'<g transform="translate({x} {gy}) scale({s})" stroke-width="{5 / s:.1f}">{g}</g>'


def campfire(x, gy, s=1.0):
    g = ('<circle cx="0" cy="-26" r="40" fill="#FFB13B" opacity="0.25" stroke="none"/>'
         '<path d="M-26 0 L24 -12 M-24 -12 L26 0" fill="none" stroke="#8A5634" stroke-width="9"/>'
         '<path d="M-14 -8 Q-20 -30 -4 -52 Q-2 -36 6 -42 Q18 -26 14 -8 Z" fill="#FF6B2C" stroke-width="4"/>'
         '<path d="M-6 -8 Q-8 -24 2 -34 Q8 -22 6 -8 Z" fill="#FFD23F" stroke-width="3"/>')
    return f'<g transform="translate({x} {gy}) scale({s})">{g}</g>'


def aurora():
    return ('<path d="M-20 90 Q60 40 140 90 Q220 140 380 70" fill="none" stroke="#5CF2A0" stroke-width="26" opacity="0.45"/>'
            '<path d="M-20 140 Q90 90 180 130 Q270 170 380 120" fill="none" stroke="#A884E8" stroke-width="20" opacity="0.4"/>'
            '<path d="M-20 60 Q100 20 200 60 Q280 90 380 40" fill="none" stroke="#7FD8FF" stroke-width="14" opacity="0.35"/>')


def snowman(x, gy, s=1.0):
    g = ('<circle cx="0" cy="-26" r="28" fill="#FFFFFF"/><circle cx="0" cy="-74" r="22" fill="#FFFFFF"/><circle cx="0" cy="-112" r="17" fill="#FFFFFF"/>'
         '<circle cx="-6" cy="-116" r="2.5" fill="#2B1B3D" stroke="none"/><circle cx="6" cy="-116" r="2.5" fill="#2B1B3D" stroke="none"/>'
         '<path d="M0 -110 L18 -106 L0 -104 Z" fill="#FF9F1C" stroke-width="3"/>'
         '<path d="M-17 -98 Q0 -90 17 -98 L19 -92 Q0 -84 -19 -92 Z" fill="#E8553D" stroke-width="3"/>'
         '<path d="M-6 -130 L0 -144 L6 -130 M-14 -124 L-20 -136 L-8 -128 M14 -124 L20 -136 L8 -128" fill="#7BD36A" stroke-width="3"/>'
         '<circle cx="0" cy="-78" r="2.5" fill="#2B1B3D" stroke="none"/><circle cx="0" cy="-66" r="2.5" fill="#2B1B3D" stroke="none"/>'
         '<path d="M-20 -78 L-44 -94 M20 -78 L44 -94" fill="none" stroke="#8A5634" stroke-width="4"/>')
    return f'<g transform="translate({x} {gy}) scale({s})">{g}</g>'


def snowflakes(n, seed, ymax=520):
    rnd = random.Random(seed)
    return "".join(f'<circle cx="{rnd.uniform(5, 355):.0f}" cy="{rnd.uniform(5, ymax):.0f}" r="{rnd.uniform(2, 4):.1f}" fill="#FFFFFF" stroke="none" opacity="0.9"/>'
                   for _ in range(n))


def shooting_star(x, y, length=90):
    return (f'<path d="M{x} {y} L{x - length} {y - length * 0.45:.0f}" fill="none" stroke="#FFF6C9" stroke-width="4" opacity="0.6"/>'
            f'<path d="M{x} {y} L{x - length * 0.5:.0f} {y - length * 0.22:.0f}" fill="none" stroke="#FFFFFF" stroke-width="5"/>'
            f'<circle cx="{x}" cy="{y}" r="6" fill="#FFF6C9"/>')


def firework(x, y, c, r=34):
    out = ""
    for i in range(12):
        a = i * math.pi / 6
        out += (f'<path d="M{x + math.cos(a) * 10:.1f} {y + math.sin(a) * 10:.1f} L{x + math.cos(a) * r:.1f} {y + math.sin(a) * r:.1f}" '
                f'fill="none" stroke="{c}" stroke-width="4"/>')
        out += f'<circle cx="{x + math.cos(a) * (r + 7):.1f}" cy="{y + math.sin(a) * (r + 7):.1f}" r="3" fill="{c}" stroke="none"/>'
    return out


def party_hat(x, y, s=1.0, c="#FF8FA3"):
    return (f'<g transform="translate({x} {y}) scale({s})"><path d="M-18 0 L0 -44 L18 0 Z" fill="{c}" stroke-width="4"/>'
            f'<path d="M-10 -18 L10 -14 M-14 -8 L14 -4" fill="none" stroke="#FFFFFF" stroke-width="3"/>'
            f'<circle cx="0" cy="-46" r="6" fill="#FFD23F" stroke-width="3"/></g>')


def zzz(x, y, color="#FFFFFF"):
    return (f'<text x="{x}" y="{y}" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="700" font-size="22" '
            f'fill="{color}" stroke="{INK}" stroke-width="5" paint-order="stroke">Z</text>'
            f'<text x="{x + 16}" y="{y - 18}" font-family="Arial, sans-serif" font-weight="700" font-size="16" fill="{color}" stroke="{INK}" stroke-width="4" paint-order="stroke">z</text>')


def river():
    return ('<path d="M370 420 Q260 424 236 452 Q212 488 130 498 Q60 506 -10 540 L-10 570 L30 570 Q90 530 150 524 Q246 514 268 476 Q286 448 370 446 Z" fill="#4FC3F7"/>'
            '<path d="M300 434 L326 434 M196 500 L220 494 M60 526 L84 518" fill="none" stroke="#FFFFFF" stroke-width="4"/>')


# ---------------------------------------------------------------- world backgrounds
def bg_volcano(vx=95, erupt=False, vw=200, vh=150):
    return (sun(292, 78) + cloud(36, 112) + cloud(176, 52, 0.75) + volcano(vx, 330, vw, vh, erupt) +
            hills(330, "#8EDB6E", seed=vx) + ground(384, "#4CB85A"))


def bg_jungle():
    return (hills(300, "#8FD37C", seed=7) + trunk(18) + trunk(342, 40) +
            vine(60, 200, 1) + vine(300, 160, 2) + canopy() + ground(420, "#3FA244", 24))


def bg_beach(sky_sun=(286, 84)):
    return (sun(*sky_sun) + cloud(30, 120, 0.8) + cloud(200, 70, 0.6) +
            '<path d="M-10 250 L370 250 L370 370 L-10 370 Z" fill="#2FA7E0"/>' +
            '<path d="M-10 262 Q20 254 50 262 Q80 270 110 262 Q140 254 170 262 Q200 270 230 262 Q260 254 290 262 Q320 270 350 262 Q365 258 370 260" fill="none" stroke="#FFFFFF" stroke-width="4"/>' +
            '<path d="M-10 368 Q60 340 140 356 Q240 376 370 344 L370 570 L-10 570 Z" fill="#FFD98A"/>' +
            '<path d="M-10 368 Q60 340 140 356 Q240 376 370 344" fill="none" stroke="#FFFFFF" stroke-width="7"/>' +
            "".join(f'<circle cx="{x}" cy="{y}" r="2" fill="#E8B860" stroke="none"/>' for x, y in
                    ((40, 420), (90, 470), (150, 430), (210, 500), (270, 440), (320, 520), (60, 530), (180, 545), (300, 470))))


def bg_ice():
    return (cloud(30, 100, 0.7) +
            '<path d="M-10 320 L70 170 L110 230 L170 130 L250 260 L300 200 L370 300 L370 360 L-10 360 Z" fill="#E6E0F5"/>' +
            '<path d="M70 170 L88 204 L76 200 L64 214 L56 196 Z M170 130 L196 172 L180 166 L168 182 L156 162 Z M300 200 L320 228 L306 224 L292 236 Z" fill="#FFFFFF" stroke-width="4"/>' +
            ground(370, "#F4FBFF", 26) +
            '<path d="M30 430 Q90 420 120 436 M220 470 Q270 460 320 476 M60 520 Q120 510 160 524" fill="none" stroke="#BFD9EC" stroke-width="5"/>' +
            snowflakes(26, 3, 360))


def bg_night(ground_c="#244A3E", hill_c="#2E5A4C"):
    return stars(46, 11, 320) + moon(282, 86) + hills(330, hill_c, seed=5) + ground(390, ground_c)


# ---------------------------------------------------------------- levels
SCENES = {}

# World 1 — Volcano Valley (level 1 is the hand-drawn original)
SCENES["s1-2"] = scene(
    bg_volcano(vx=280) + flowers([(40, 410), (200, 400), (330, 420), (120, 540), (260, 548)]) +
    bush(10, 440, 0.9) + nest(70, 470, "#5CCB5F") +
    put("pip", 175, 480, 1.05, colors=PIP_ORANGE, nohat=True) +
    put("pip", 290, 515, 0.48, nohat=True) + put("pip", 88, 535, 0.45, flip=True, colors=PIP_BLUE, nohat=True))

SCENES["s1-3"] = scene(
    sun(60, 70) + cloud(220, 120, 0.9) + volcano(190, 380, 260, 210, erupt=True) +
    hills(380, "#8EDB6E", seed=3) + ground(450, "#4CB85A", 20) +
    rock(60, 470, 120, 70, "#9C8AA8") + nest(60, 418, "#FF9F1C") +
    fly("petra", 80, 200, 0.55, colors=PETRA_ORANGE) + fly("petra", 280, 230, 0.5, flip=True, colors=PETRA_TEAL) +
    fly("petra", 300, 80, 0.4, flip=True) + flowers([(170, 500), (250, 520), (320, 490)]))

SCENES["s1-4"] = scene(
    bg_volcano(vx=70) + fern(30, 470, 1.0) + fern(330, 440, 0.8) + rock(300, 548, 70, 36) +
    put("stegi", 210, 470, 0.95, flip=True, colors=STEGI_GREEN) + put("stegi", 85, 520, 0.6, colors=STEGI_PURPLE) +
    put("stegi", 300, 530, 0.45, flip=True) + flowers([(150, 410), (40, 540), (240, 540)]))

SCENES["s1-5"] = scene(
    cloud(250, 70, 0.7, "#D8D2E3") + volcano(180, 360, 320, 230, erupt=True) +
    hills(360, "#7BC46A", seed=9) + ground(420, "#4CB85A", 18) +
    '<path d="M180 160 Q170 260 120 330 Q90 380 40 400" fill="none" stroke="#2B1B3D" stroke-width="16"/>'
    '<path d="M180 160 Q170 260 120 330 Q90 380 40 400" fill="none" stroke="#FF6B2C" stroke-width="9"/>' +
    rock(170, 480, 200, 60, "#7A5A8E") + put("magma-rex", 170, 446, 1.0) +
    put("pip", 305, 530, 0.5, flip=True) + flowers([(40, 520), (90, 548), (330, 450)]))

# World 2 — Jungle
SCENES["s2-1"] = scene(
    bg_jungle() + rock(180, 368, 180, 40, "#7F9A86") + waterfall(140, 220, 110, 370) +
    brachio(-30, 96, 0.72, body="#FF9F1C", dark="#E07F00", spot="#FFD23F") +
    fern(320, 470, 0.9, "#2F8F3A") + flowers([(250, 450), (300, 530), (60, 540)], ("#FF8FA3", "#FFD23F")),
    sky=("#B6E88E", "#EAFFD6"))

SCENES["s2-2"] = scene(
    bg_jungle() +
    '<path d="M18 200 Q80 186 150 204" fill="none" stroke="#8A5634" stroke-width="14"/>'
    '<path d="M342 150 Q280 136 220 156" fill="none" stroke="#8A5634" stroke-width="12"/>' +
    fly("petra", 90, 160, 0.5, colors=PETRA_TEAL) + fly("petra", 268, 112, 0.45, flip=True) +
    "".join(flower(x, y, "#FF6B6B", 10) for x, y in ((150, 205), (225, 158), (300, 260))) +
    "".join(f'<ellipse cx="{x}" cy="{y}" rx="7" ry="10" fill="#FFD23F" stroke-width="3"/>' for x, y in ((120, 222), (132, 226), (250, 174))) +
    put("pip", 180, 500, 0.6) + fern(60, 500, 1.0, "#2F8F3A") + fern(300, 520, 0.9, "#2F8F3A"),
    sky=("#B6E88E", "#EAFFD6"))

SCENES["s2-3"] = scene(
    bg_jungle() + put("rafi", 230, 470, 0.8, flip=True, colors=RAFI_PURPLE) +
    fern(240, 500, 1.4, "#2F8F3A") + put("rafi", 90, 520, 0.6) + fern(40, 548, 1.0, "#3FA244") +
    fern(320, 556, 0.9, "#3FA244") + flowers([(160, 430), (300, 440), (130, 540)], ("#FF8FA3", "#FFD23F")),
    sky=("#B6E88E", "#EAFFD6"))

SCENES["s2-4"] = scene(
    bg_jungle() + mushroom(80, 470, 1.6) + mushroom(290, 450, 1.2, "#8E5BD9", "#FFD23F") + mushroom(200, 540, 0.8, "#FF9F1C") +
    put("anki", 190, 470, 0.85, colors=ANKI_GREEN) + put("pip", 300, 535, 0.45, flip=True) +
    fern(30, 548, 0.8, "#2F8F3A"),
    sky=("#B6E88E", "#EAFFD6"))

SCENES["s2-5"] = scene(
    bg_jungle() + log(180, 470, 220) +
    put("stegi", 95, 446, 0.55) + put("pip", 180, 446, 0.5) + put("rafi", 262, 446, 0.52, flip=True) +
    "".join(f'<circle cx="{x}" cy="{y}" r="9" fill="#E8553D" stroke-width="3"/>' for x, y in
            ((110, 520), (130, 530), (150, 516), (230, 528), (250, 518))) +
    '<path d="M60 300 Q50 286 62 280 Q70 290 66 300 Q80 292 86 302 Q74 310 66 302" fill="#FF8FA3" stroke-width="3"/>' +
    fly("petra", 300, 260, 0.4, flip=True, colors=PETRA_ORANGE),
    sky=("#B6E88E", "#EAFFD6"))

# World 3 — Beach
BEACH_SKY = ("#6FCDF8", "#FFF0C8")
SCENES["s3-1"] = scene(
    bg_beach() + plesio(230, 330, 1.0) + sandcastle(90, 470, 1.0) + starfish(220, 500, 14) +
    shell(300, 450) + shell(40, 540, 0.9, "#FFF3D6") + palm(340, 470, 0.8, flip=True), sky=BEACH_SKY)

SCENES["s3-2"] = scene(
    bg_beach() + sandcastle(100, 500, 1.3) + put("stegi", 250, 500, 0.75, flip=True, colors=STEGI_GREEN) +
    '<path d="M180 540 L176 512 L204 512 L200 540 Z" fill="#E8553D" stroke-width="4"/><path d="M178 512 Q190 496 202 512" fill="none" stroke-width="3"/>' +
    starfish(320, 410, 12, "#FFB13B") + shell(40, 410), sky=BEACH_SKY)

SCENES["s3-3"] = scene(
    bg_beach() + fly("petra", 120, 170, 0.55, colors=PETRA_ORANGE) + fly("petra", 260, 210, 0.45, flip=True) +
    fish(90, 300, "#FFB13B") + fish(200, 320, "#FF8FA3", flip=True) + fish(300, 290, "#FFD23F") +
    palm(330, 520, 1.0, flip=True) + crab(120, 480) + shell(220, 520), sky=BEACH_SKY)

SCENES["s3-4"] = scene(
    bg_beach() +
    '<path d="M60 470 L300 470 L310 530 L50 530 Z" fill="#FFFFFF"/>'
    '<path d="M90 470 L84 530 M140 470 L138 530 M190 470 L192 530 M240 470 L246 530" fill="none" stroke="#4FC3F7" stroke-width="10"/>' +
    put("anki", 180, 500, 0.85, colors=ANKI_ORANGE, shadow=False) + crab(310, 420, 0.8) + starfish(40, 420, 12) +
    shell(330, 550) + palm(20, 450, 0.8), sky=BEACH_SKY)

SCENES["s3-5"] = scene(
    '<circle cx="180" cy="250" r="70" fill="#FFD23F"/>' +
    '<path d="M-10 250 L370 250 L370 370 L-10 370 Z" fill="#6C5BB0"/>' +
    '<path d="M120 270 L240 270 M140 292 L220 292 M156 314 L204 314" fill="none" stroke="#FFD23F" stroke-width="6"/>' +
    '<path d="M-10 368 Q60 340 140 356 Q240 376 370 344 L370 570 L-10 570 Z" fill="#F2B880"/>' +
    palm(30, 470, 1.0) + palm(340, 450, 0.9, flip=True) +
    put("pip", 120, 510, 0.5) + put("anki", 200, 520, 0.5) + put("rafi", 270, 510, 0.5, flip=True) +
    fly("petra", 250, 150, 0.35, flip=True, colors=PETRA_ORANGE),
    sky=("#FF8F6B", "#FFD9A0"))

# World 4 — Ice Land
ICE_SKY = ("#A6DBFF", "#F2FAFF")
SCENES["s4-1"] = scene(
    bg_ice() + pine(40, 400, 0.8) + pine(320, 390, 0.7) +
    mammoth(170, 470, 1.15) + mammoth(300, 520, 0.6, "#C08A5E", "#9A6640", flip=False) + snowflakes(10, 9, 540),
    sky=ICE_SKY)

SCENES["s4-2"] = scene(
    bg_ice() + '<path d="M-10 380 Q120 380 250 500 L250 570 L-10 570 Z" fill="#FFFFFF"/>' +
    '<g transform="rotate(24 140 440)"><rect x="70" y="440" width="140" height="14" rx="7" fill="#E8553D"/>'
    '<path d="M70 454 Q60 454 62 440" fill="none" stroke-width="5"/></g>' +
    '<g transform="rotate(24 140 440)">' + put("anki", 140, 442, 0.75, colors=ANKI_GREEN, shadow=False) + '</g>' +
    pine(300, 460, 0.9) + pine(330, 540, 0.6), sky=ICE_SKY)

SCENES["s4-3"] = scene(
    bg_ice() + '<ellipse cx="180" cy="470" rx="170" ry="60" fill="#BDEBFF"/>' +
    '<path d="M70 450 L110 440 M220 500 L270 488 M140 500 L160 496" fill="none" stroke="#FFFFFF" stroke-width="5"/>' +
    '<path d="M60 480 Q120 500 170 470 Q220 440 290 470" fill="none" stroke="#7FB8E0" stroke-width="3" stroke-dasharray="8 8"/>' +
    put("pip", 120, 480, 0.55, colors=PIP_PINK, nohat=True) + put("rafi", 250, 476, 0.6, flip=True) + pine(330, 400, 0.6),
    sky=ICE_SKY)

SCENES["s4-4"] = scene(
    stars(20, 4, 200) + aurora() +
    '<path d="M-10 320 L70 200 L110 250 L170 160 L250 280 L300 220 L370 300 L370 360 L-10 360 Z" fill="#9A8CC8"/>' +
    ground(370, "#E6F2FF", 26) + snowman(110, 480, 1.0) + put("stegi", 250, 490, 0.7, flip=True, colors=STEGI_PURPLE) +
    pine(330, 420, 0.6) + snowflakes(14, 5, 540),
    sky=("#1E2A5C", "#4C6BA8"))

SCENES["s4-5"] = scene(
    bg_ice() + igloo(260, 420, 1.0) + campfire(170, 500, 1.0) +
    put("pip", 80, 500, 0.5) + put("anki", 250, 530, 0.5, flip=True) + fly("petra", 150, 320, 0.38) +
    pine(40, 410, 0.7), sky=("#8FB8F0", "#F2E6FF"))

# World 5 — Night
NIGHT_SKY = ("#140E36", "#3E3A8C")
SCENES["s5-1"] = scene(
    bg_night() + volcano(90, 330, 200, 140, color="#4A3A6E") +
    brachio(30, 110, 0.85, body="#7C8CFF", dark="#5E6EE0", spot="#A9B4FF", sleep=True) + zzz(270, 270) +
    "".join(firefly(x, y) for x, y in ((60, 420), (300, 380), (330, 460))), sky=NIGHT_SKY)

SCENES["s5-2"] = scene(
    stars(30, 21, 200) + moon(80, 70, 22) + trunk(330, 40) + vine(40, 180, 3) +
    hills(330, "#1F4A3A", seed=2) + ground(410, "#1A3A30", 22) +
    mushroom(90, 470, 1.4, "#39C1B5", "#C9F2EE", glow="#5CF2E0") + mushroom(270, 500, 1.0, "#A884E8", "#E3D6FF", glow="#C9A8FF") +
    put("rafi", 180, 520, 0.65, colors=RAFI_ORANGE) +
    "".join(firefly(x, y) for x, y in ((40, 300), (120, 260), (200, 330), (290, 280), (250, 400), (60, 520), (330, 420))),
    sky=NIGHT_SKY)

SCENES["s5-3"] = scene(
    stars(40, 31, 240) + moon(250, 90) +
    '<path d="M-10 250 L370 250 L370 370 L-10 370 Z" fill="#23306E"/>' +
    '<path d="M220 270 L280 270 M230 292 L270 292 M240 314 L260 314" fill="none" stroke="#FFF3C4" stroke-width="5"/>' +
    plesio(140, 330, 0.9, "#39C1B5", "#23306E", sleep=True) +
    '<path d="M-10 368 Q60 340 140 356 Q240 376 370 344 L370 570 L-10 570 Z" fill="#B8A07A"/>' +
    starfish(80, 470, 14, "#FFB13B") + starfish(300, 520, 12, "#FF8FA3") + shell(200, 500, 1.0, "#FFF3D6") +
    put("anki", 240, 460, 0.55, flip=True), sky=NIGHT_SKY)

SCENES["s5-4"] = scene(
    stars(50, 41, 300) + shooting_star(300, 90) + shooting_star(170, 170, 70) +
    '<path d="M-10 330 L60 240 L100 280 L160 210 L230 300 L290 250 L370 320 L370 380 L-10 380 Z" fill="#5A5498"/>' +
    ground(390, "#D8E4F8", 22) + pine(30, 420, 0.7, color="#2F7A54") + pine(330, 430, 0.8, color="#2F7A54") +
    put("anki", 130, 500, 0.65, shadow=False) + put("stegi", 250, 510, 0.6, flip=True, shadow=False),
    sky=NIGHT_SKY)

_rex_s = 0.8
SCENES["s5-5"] = scene(
    stars(30, 51, 240) + firework(80, 100, "#FFD23F") + firework(270, 80, "#FF8FA3", 40) + firework(180, 180, "#5CF2A0", 28) +
    hills(340, "#2E5A4C", seed=8) + ground(400, "#244A3E") +
    '<path d="M10 260 Q100 300 180 270 Q260 300 350 260" fill="none" stroke-width="3"/>' +
    "".join(f'<path d="M{x} {y} L{x + 10} {y + 18} L{x + 20} {y} Z" fill="{("#FFD23F", "#FF8FA3", "#4FC3F7")[i % 3]}" stroke-width="3"/>'
            for i, (x, y) in enumerate(((30, 268), (80, 284), (130, 284), (190, 272), (240, 286), (290, 280), (330, 266)))) +
    put("magma-rex", 180, 470, _rex_s) + party_hat(180 - 120 * _rex_s + 66 * _rex_s, 470 - 212 * _rex_s + 34 * _rex_s, 0.8) +
    put("pip", 60, 520, 0.45) + put("stegi", 300, 520, 0.45, flip=True) + put("anki", 120, 548, 0.4) +
    put("rafi", 250, 548, 0.42, flip=True) + fly("petra", 300, 340, 0.35, flip=True),
    sky=NIGHT_SKY)


def main():
    os.makedirs(OUT, exist_ok=True)
    shutil.copyfile(os.path.join(ART, "scene-volcano-valley.svg"), os.path.join(OUT, "s1-1.svg"))
    # give the copied original explicit size like the others
    p = os.path.join(OUT, "s1-1.svg")
    with open(p, encoding="utf8") as f:
        t = f.read()
    t = t.replace('viewBox="0 0 360 560">', 'viewBox="0 0 360 560" width="360" height="560">', 1)
    with open(p, "w", encoding="utf8") as f:
        f.write(t)
    for name, svg in SCENES.items():
        with open(os.path.join(OUT, name + ".svg"), "w", encoding="utf8") as f:
            f.write(svg)
    print(f"wrote {len(SCENES) + 1} scenes")


if __name__ == "__main__":
    main()
