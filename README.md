# Homeward

A progression-based 2D platformer about a small cat trying to find its way home through a strange forest.

The three skills are Double Jump, Dash, and Glide Down.
The forest background is bundled in `assets/level-background.png`.
The foreground parallax layer is bundled in `assets/foreground-parallax.png`.

## Run Locally

Open `index.html` in a browser to play, or run a local server:

```sh
npm run dev
```

Then open `http://127.0.0.1:8765`.

## Deploy To Netlify

This is a static canvas game. Netlify can deploy it directly from the repository.

- Build command: `npm run build`
- Publish directory: `.`
- Node version: 18 or newer

## Controls

- Move: `A` / `D` or arrow keys
- Jump: `Space`, `W`, or up arrow
- Interact with waystones: `E`
- Unlock selected skill: `E`, `Enter`, or `Space`
- Pounce: `F`
- Dash after unlocking it: `Q`, `Shift`, `K`, or `L`
- Glide after unlocking it: hold `Space`, `W`, or up arrow while falling
- Respawn: `R`
- Leave the skill tree: `Esc` or `Backspace`

Progress, skill unlocks, high score, and collected points save locally in the browser.

Contextual overlays appear as you play and fade once you act on them or move beyond that moment.
