"""Builds the five world bosses (boss-1..boss-5.svg): the big rex, recoloured per world, with a crown.

Run:  py -I tools/make_bosses.py
"""
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
ART = os.path.join(HERE, "..", "assets")
OUT = os.path.join(HERE, "..", "game", "assets")
INK = "#2B1B3D"

# body, dark leg, belly, spikes/jaw
BASE = ("#E8553D", "#B83B2E", "#FFB15C", "#6B2A5E")
WORLDS = {
    1: (BASE, "#FFD23F", "#E8553D"),                                   # volcano: the original red rex
    2: (("#4CAF50", "#2E7D32", "#C5E86C", "#7B4A12"), "#FFD23F", "#FF8FA3"),  # jungle
    3: (("#2FA7E0", "#1B6FA8", "#9FE3FF", "#FF6F91"), "#FFD23F", "#5CCB5F"),  # beach
    4: (("#9FD8F5", "#5FA3CC", "#FFFFFF", "#3E6FD6"), "#E6F7FF", "#5B8DEF"),  # ice
    5: (("#8E5BD9", "#5E3A9E", "#C9A8FF", "#2E1A5C"), "#FFD23F", "#4FC3F7"),  # night
}


def crown(gold, gem):
    return (
        f'<g stroke="{INK}" stroke-width="5" stroke-linejoin="round">'
        f'<path d="M30 30 L26 -6 L44 10 L58 -18 L72 8 L90 -10 L90 28 Q60 20 30 30 Z" fill="{gold}"/>'
        f'<circle cx="58" cy="17" r="6" fill="{gem}" stroke-width="3"/>'
        f'<circle cx="26" cy="-8" r="4" fill="{gold}" stroke-width="3"/>'
        f'<circle cx="58" cy="-20" r="4" fill="{gold}" stroke-width="3"/>'
        f'<circle cx="90" cy="-12" r="4" fill="{gold}" stroke-width="3"/>'
        "</g>"
    )


def main():
    with open(os.path.join(ART, "magma-rex.svg"), encoding="utf8") as f:
        inner = re.search(r"<svg[^>]*>(.*)</svg>", f.read(), re.S).group(1)
    for w, (cols, gold, gem) in WORLDS.items():
        m = dict(zip(BASE, cols))
        body = re.sub("|".join(BASE), lambda mo: m[mo.group(0)], inner)
        svg = (
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -30 240 250" width="240" height="250">'
            f"{body}{crown(gold, gem)}</svg>\n"
        )
        with open(os.path.join(OUT, f"boss-{w}.svg"), "w", encoding="utf8") as f:
            f.write(svg)
        # Same rex without the crown: the chaser in that world's regular levels.
        plain = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 220" width="240" height="220">{body}</svg>\n'
        with open(os.path.join(OUT, f"rex-{w}.svg"), "w", encoding="utf8") as f:
            f.write(plain)
    print("wrote boss-1..5 and rex-1..5")


if __name__ == "__main__":
    main()
