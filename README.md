# דינו חופר · Dino Digger

A Hebrew area-claiming game for young kids, made for Android phones (works in any modern browser).
Pip the baby triceratops fences off dirt to uncover a hidden dinosaur picture while Magma Rex and his gang try to stop him.

- 5 worlds × 5 levels, each with its own hidden picture
- Arrow pad controls (touch-to-go and joystick in the pause menu)
- Unlockable dino friends, stars, offline play, installs as an app (PWA)

## Play

The `game/` folder is the whole game — static files, no build step.
Every push to `main` publishes it to GitHub Pages (see `.github/workflows/pages.yml`).

On the phone: open the Pages address in Chrome → menu → **Add to Home screen / Install app**.

## Run locally

```
py serve.py
```

Then open `http://localhost:8080`, or `http://<computer-ip>:8080` from a phone on the same Wi-Fi.

## Project layout

| Path | What |
|---|---|
| `game/` | The game: `index.html`, `game.js`, `style.css`, service worker, manifest, assets |
| `game/assets/s<world>-<level>.svg` | Hidden pictures (generated) |
| `assets/` | Source character art |
| `tools/make_scenes.py` | Builds the 25 hidden pictures from the character art — `py -I tools/make_scenes.py` |
| `moodboard.html` | First look-and-feel board |
| `serve.py` | Local no-cache server for phone testing |
