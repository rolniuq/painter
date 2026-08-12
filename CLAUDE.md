# CLAUDE.md

Guidance for Claude Code (and other Claude-powered agents) in this repository.

This file mirrors [AGENTS.md](./AGENTS.md) — read that for the canonical, complete rules. The essentials:

## Project

Auto Doodler is a **zero-dependency, no-build** client-side web app. Upload an image → a pen cursor redraws it as line art → download a white-backed PNG.

One-directional pipeline, one ES6 class per stage in `src/`:

```
ImageLoader → EdgeDetector → ContourBuilder → StrokePlanner → CursorPlayer
     load        detect          link           plan           play
```

plus `BrushConfig` (style presets) and `App` (browser wiring).

## Hard rules

1. **No dependencies, no build step.** Static files only; browser APIs only. Never add npm packages or a bundler/framework.
2. **ES modules with `.js` extensions** on all relative imports.
3. **`npm test`** must pass before finishing (`node --test tests/*.test.js` — do not switch to the bare-directory form, it breaks on this machine's Node ≥ 22).
4. **Private members are underscore-prefixed** (`_onX`, `this._playing`).
5. **No code comments** unless asked.
6. **Stages are decoupled** — no cross-stage imports; `App` is the only wiring point. Follow the contracts in AGENTS.md.
7. **Export must stay white-backed and cursor-free** — don't `toBlob` the live canvas.

## Commands

```bash
npm test            # required before finishing (24 tests)
npm run lint        # ESLint — must be clean
npm run format      # Prettier write
npm run format:check
npm start           # python3 -m http.server 8080
```

After edits: `npm run format`, `npm run lint`, then `npm test`. Commits run Husky → lint-staged → tests, and commitlint enforces [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, short imperative lowercase subjects ≤ 72 chars).
