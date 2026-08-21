# AGENTS.md

Guidance for AI agents (opencode, Claude Code, Copilot, etc.) working in this repository.

## Project overview

Auto Doodler is a **zero-dependency, no-build** client-side web app: upload an image, and a pen cursor redraws it as line art on a canvas. The finished drawing downloads as a white-backed PNG.

The whole product is a one-directional image-to-strokes pipeline, one ES6 class per stage, living in `src/`:

```
ImageLoader → EdgeDetector → ContourBuilder → StrokePlanner → CursorPlayer
     load        detect          link           plan           play
```

plus `BrushConfig` (style presets) and `App` (the browser wiring in `index.html`).

## Critical constraints — read before editing

1. **No dependencies.** Do not add npm packages (beyond the dev tooling already present) and do not introduce a build step, bundler, or framework. Everything must run from static files served over HTTP. Browser APIs (Canvas 2D, `requestAnimationFrame`, FileReader, Blob) only.
2. **ES modules, explicit extensions.** Every module is `export class` / `import ... from "./X.js"`. Always include the `.js` extension on relative imports.
3. **Node 25 for tests.** `npm test` runs `node --test tests/*.test.js` — the Node version installed (≥ 22) rejects the bare-directory `node --test tests/` form. Do not "fix" the script to use the directory form; it will break CI on this machine.
4. **Private members are underscore-prefixed.** Follow `_onX`, `this._playing`, `this._player` conventions already in `src/App.js`.
5. **Don't add code comments.** Keep the code self-explanatory; comments are only for non-obvious reasoning, and only when asked.

## Commands

```bash
npm test            # must pass before finishing any change (currently 24 tests)
npm run lint        # ESLint — must be clean
npm run format      # Prettier write
npm run format:check
npm start           # python3 -m http.server 8080
```

After any edit, run `npm run format` and `npm run lint`, then `npm test`. A `git commit` triggers Husky → lint-staged (Prettier + ESLint `--fix`) → full test suite, and commitlint validates the message.

## Architecture invariants

- **Stages are pure-ish and decoupled.** Each class in `src/` has one job and no imports from its siblings. Data flows one way; `App` is the only place that wires them. Don't create cross-stage imports to "share logic" — extend the data passed between stages instead.
- **Contracts between stages** (see the spec in `docs/superpowers/specs/2026-08-11-auto-doodler-design.md`):
  - `EdgeDetector.detect({ gray, width, height })` → `{ edgeMask }`
  - `ContourBuilder.build({ edgeMask, width, height })` → `strokes`
  - `StrokePlanner.plan({ strokes, width, height })` → `commands`
  - `CursorPlayer.play(commands, { onDone })`
  - `BrushConfig.presets()` keys (`doodle`, `cartoon`, `sketch`) must match the `[data-style]` button values in `index.html`; `CursorPlayer.CURSOR_SHAPES` keys must match the `[data-shape]` button values.
- **Thresholds are fractions of max gradient magnitude** — `EdgeDetector` uses `highT`/`lowT` as fractions, not absolute pixel values. If you change hysteresis semantics, update the tests that pin the old-vs-new behavior.
- **Export must produce a clean white-backed PNG without the pen cursor.** The visible canvas may show the pen while animating, but `_onDownload` repaints white and composites the ink layer. Preserve that; don't `toBlob` the live canvas.

## Conventions

- **Formatting:** Prettier defaults (2-space indent, double quotes, trailing commas `es5`). Enforced by EditorConfig + Prettier.
- **Style:** Doodle / cartoon / sketch presets in `BrushConfig.js`. Adding a style means adding a preset there **and** an `<option>` in `index.html`.
- **Tests:** one `tests/*.test.js` per module, using `node:test` + `node:assert` (no test framework). Cover edge cases (empty input, extreme aspect ratios, cancellation) — tests should pin real behavior, not just "no crash".

## Git conventions

[Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint (`commitlint.config.js`):

```
feat: new capability
fix:  correcting behavior
docs: documentation or spec
test: tests only
chore: tooling, config, maintenance
```

Keep subjects short (≤ 72 chars), imperative mood, lowercase after the type. Always follow the project's existing git history style.

## When you finish work

- Run `npm test`, `npm run lint`, `npm run format:check` and confirm all pass.
- Only commit what's asked. Let the user decide about pushing/deploying. GitHub Pages serves this repo from `main` at the repo root (no build step).
