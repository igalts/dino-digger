"""Builds the five world-map backgrounds (360x780 SVGs) with a winding road through the level spots.

The level buttons are placed by the game at NODES (same coordinates), and the world's prize dino at PRIZE.
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

# Level spots, bottom to top. Keep in sync with MAP_NODES in game/game.js.
NODES = [(95, 625), (262, 530), (100, 420), (262, 305), (150, 195)]
PRIZE = (262, 120)
ROAD = [(40, 820), (62, 720)] + NODES + [PRIZE]


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


def road(color, edge, dash):
    d = catmull(ROAD)
    out = (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="38"/>'
           f'<path d="{d}" fill="none" stroke="{edge}" stroke-width="31"/>'
           f'<path d="{d}" fill="none" stroke="{color}" stroke-width="23"/>'
           f'<path d="{d}" fill="none" stroke="{dash}" stroke-width="4" stroke-dasharray="1 15"/>')
    # stone pads under each level spot and the prize
    for x, y in NODES + [PRIZE]:
        out += f'<ellipse cx="{x}" cy="{y + 30}" rx="40" ry="11" fill="{INK}" opacity="0.25" stroke="none"/>'
    return out


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


def bridge(x, y, w=70):
    planks = "".join(f'<path d="M{x - w / 2 + i * 10 + 5} {y - 16} L{x - w / 2 + i * 10 + 5} {y + 16}" fill="none" stroke="#8A5634" stroke-width="3"/>'
                     for i in range(int(w / 10)))
    return (f'<rect x="{x - w / 2}" y="{y - 18}" width="{w}" height="36" rx="6" fill="#C08A5E"/>{planks}'
            f'<path d="M{x - w / 2} {y - 18} L{x + w / 2} {y - 18} M{x - w / 2} {y + 18} L{x + w / 2} {y + 18}" fill="none" stroke-width="5"/>')


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
            road("#F2D49B", "#D9B270", "#FFFFFF") +
            ms.palm(30, 560, 0.75) + ms.palm(345, 760, 0.9, flip=True) + ms.palm(330, 430, 0.6, flip=True) +
            ms.rock(200, 400, 70, 40, "#9C8AA8") + ms.rock(330, 640, 60, 34, "#9C8AA8") + ms.rock(40, 470, 50, 28, "#9C8AA8") +
            ms.fern(190, 700, 0.9) + ms.fern(30, 360, 0.7) + ms.fern(200, 290, 0.6) +
            ms.nest(190, 615, "#5CCB5F") +
            ms.flowers([(60, 680), (150, 560), (300, 600), (220, 470), (40, 400), (320, 370), (90, 300), (170, 760)]))
    return wrap(body, ("#7FC8F0", "#FFE3B0"))


def map_jungle():
    river = ('<path d="M-10 480 Q90 450 180 478 Q270 506 370 470 L370 520 Q270 552 180 524 Q90 498 -10 530 Z" fill="#4FC3F7"/>'
             '<path d="M40 490 L70 486 M230 510 L262 514 M300 496 L330 490" fill="none" stroke="#FFFFFF" stroke-width="4"/>')
    body = (layer(160, "#9FD98A", 11, 30) +
            "".join(f'<circle cx="{x}" cy="{y}" r="40" fill="#7CC46A" stroke="none"/>' for x, y in
                    ((40, 170), (100, 150), (170, 165), (240, 145), (310, 160), (360, 150))) +
            layer(300, "#6FBF5C", 12) + ms.waterfall(18, 80, 170, 330) + layer(400, "#5FB04F", 13, 24) +
            river + layer(560, "#4FA347", 14) + layer(700, "#3F9A3C", 15) +
            road("#C9B98A", "#A89664", "#FFF3D6") + bridge(181, 501, 76) +
            ruins(330, 410, 0.7) + ms.mushroom(200, 640, 1.0) + ms.mushroom(320, 700, 0.8, "#8E5BD9", "#FFD23F") +
            ms.mushroom(40, 380, 0.7, "#FF9F1C") +
            ms.fern(20, 760, 1.4, "#2F8F3A") + ms.fern(345, 600, 1.0, "#2F8F3A") + ms.fern(200, 380, 0.8, "#2F8F3A") +
            ms.trunk(8, 40) + ms.trunk(352, 36) + ms.vine(46, 260, 4) + ms.vine(316, 220, 5) + ms.canopy() +
            ms.fly("petra", 300, 250, 0.28, flip=True) +
            ms.flowers([(70, 560), (300, 650), (180, 740), (210, 330), (60, 700)], ("#FF6B6B", "#FFD23F", "#FF8FA3")))
    return wrap(body, ("#9ED67A", "#E2F7C8"))


def map_beach():
    island = ('<path d="M20 780 Q-10 640 40 560 Q10 470 50 380 Q30 280 110 220 Q180 140 280 110 Q350 120 340 220 '
              'Q360 320 320 400 Q350 500 320 600 Q350 700 330 790 Z" fill="#7FD8FF" stroke="none"/>'
              '<path d="M44 780 Q14 640 64 566 Q36 474 72 388 Q56 290 128 236 Q190 160 280 134 Q332 142 322 224 '
              'Q340 320 302 400 Q330 500 300 600 Q326 700 308 790 Z" fill="#FFD98A"/>')
    body = (ms.sun(70, 70, 28) + ms.cloud(220, 60, 0.6) +
            '<rect x="-10" y="150" width="380" height="640" fill="#2FA7E0" stroke="none"/>'
            '<path d="M-10 150 Q30 142 70 150 Q110 158 150 150 Q190 142 230 150 Q270 158 310 150 Q350 142 370 148" fill="none" stroke="#FFFFFF" stroke-width="4"/>' +
            waves(seed=3) + island + road("#E8C27A", "#C99550", "#FFF3D6") +
            "".join(f'<circle cx="{x}" cy="{y}" r="2" fill="#E8B860" stroke="none"/>' for x, y in
                    ((180, 600), (210, 700), (130, 500), (200, 380), (190, 260), (240, 210), (280, 660), (160, 300))) +
            ms.palm(60, 500, 0.7) + ms.palm(300, 470, 0.7, flip=True) + ms.palm(90, 300, 0.6) + ms.palm(310, 700, 0.7, flip=True) +
            ms.sandcastle(180, 280, 0.6) + ms.crab(200, 690, 0.7) + ms.starfish(150, 580, 11) + ms.starfish(290, 380, 10, "#FFB13B") +
            ms.shell(170, 450) + ms.shell(240, 760, 0.9, "#FFF3D6") +
            ms.plesio(0, 300, 0.45, "#39C1B5", "#2FA7E0") + boat(345, 330, 0.7) +
            ms.fish(20, 720, "#FFB13B", flip=True, s=0.8) + ms.rock(350, 560, 40, 30, "#8C8C9C") + ms.rock(15, 230, 36, 26, "#8C8C9C"))
    return wrap(body, ("#6FCDF8", "#FFF0C8"))


def map_ice():
    mountains = ('<path d="M-10 300 L60 130 L110 200 L180 70 L250 210 L300 140 L370 260 L370 320 L-10 320 Z" fill="#D6D0EE"/>'
                 '<path d="M60 130 L80 170 L66 164 L52 178 L44 160 Z M180 70 L206 116 L190 110 L176 126 L162 104 Z '
                 'M300 140 L322 176 L306 170 L292 184 L286 164 Z" fill="#FFFFFF" stroke-width="4"/>')
    lake = ('<ellipse cx="90" cy="520" rx="90" ry="40" fill="#BDEBFF"/>'
            '<path d="M40 510 L70 504 M100 534 L140 528" fill="none" stroke="#FFFFFF" stroke-width="4"/>')
    body = (ms.cloud(30, 100, 0.6) + mountains + layer(300, "#EEF4FF", 21, 20) + layer(430, "#F6FAFF", 22, 24) + lake +
            layer(600, "#FFFFFF", 23, 20) + layer(720, "#EEF6FF", 24, 16) +
            road("#CFE8FA", "#9CC7EA", "#FFFFFF") +
            ms.pine(30, 380, 0.6) + ms.pine(330, 440, 0.7) + ms.pine(320, 650, 0.8) + ms.pine(40, 740, 0.9) +
            ms.pine(200, 380, 0.5) + ms.pine(190, 720, 0.6) + ms.igloo(80, 230, 0.6) + ms.snowman(340, 260, 0.5) +
            ms.mammoth(200, 640, 0.45) + ms.snowflakes(36, 7, 770))
    return wrap(body, ("#A6DBFF", "#F2FAFF"))


def map_night():
    body = (ms.stars(70, 61, 360) + ms.moon(70, 90, 26) + ms.shooting_star(330, 70, 80) +
            layer(260, "#2E3A6E", 31, 30) + castle(262, 238, 0.9) + layer(380, "#2A4A5E", 32) +
            layer(520, "#244A3E", 33) + layer(660, "#1A3A30", 34) +
            road("#5B4E8E", "#3E3470", "#FFF27A") +
            lantern(170, 640) + lantern(190, 470) + lantern(170, 360) + lantern(320, 220) + lantern(60, 250) +
            ms.mushroom(40, 520, 0.9, "#39C1B5", "#C9F2EE", glow="#5CF2E0") + ms.mushroom(330, 420, 0.8, "#A884E8", "#E3D6FF", glow="#C9A8FF") +
            ms.mushroom(320, 740, 1.0, "#39C1B5", "#C9F2EE", glow="#5CF2E0") +
            "".join(ms.firefly(x, y) for x, y in ((30, 330), (120, 300), (330, 330), (220, 580), (60, 700), (300, 610), (200, 260), (340, 520))) +
            ms.pine(40, 460, 0.6, snow=False, color="#2F5A4C") + ms.pine(210, 760, 0.7, snow=False, color="#2F5A4C"))
    return wrap(body, ("#140E36", "#3E3A8C"))


def main():
    for i, fn in enumerate((map_volcano, map_jungle, map_beach, map_ice, map_night), 1):
        with open(os.path.join(OUT, f"map-{i}.svg"), "w", encoding="utf8") as f:
            f.write(fn())
    print("wrote 5 maps")


if __name__ == "__main__":
    main()
