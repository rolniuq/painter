# Auto Doodler

Upload an image and watch it redraw itself as line art, by hand, in real time. A pen cursor traces the image's edges stroke by stroke, then you can download the finished drawing as a PNG.

Zero dependencies. No build step. Pure browser JavaScript (ES modules) on Canvas 2D, tested with `node:test`.

## Try it

- **Live:** <https://rolniuq.github.io/painter/>
- **Local:** `npm start`, then open <http://localhost:8080>

## How it works

The pipeline is a one-directional chain of stages, each one owning a single step:

1. **Load** — `ImageLoader` reads the file, downsizes it (max edge 1200px, min edge 64px) and converts it to grayscale.
2. **Detect** — `EdgeDetector` runs a Canny edge detector: Gaussian blur, Sobel gradients, non-maximum suppression, then hysteresis thresholding.
3. **Link** — `ContourBuilder` traces the edge mask into ordered, contiguous strokes.
4. **Plan** — `StrokePlanner` sorts strokes top-to-bottom, splits over-long strokes, and emits pen commands (move, line, pen-up, pen-down).
5. **Play** — `CursorPlayer` animates a pen-shaped cursor executing those commands onto the canvas.
6. **Export** — Download composites the ink layer over a clean white background as a PNG.

The style presets (doodle / cartoon / sketch) control brush width, jitter, and passes.

## Development

```bash
npm test            # run the test suite (node --test)
npm run lint        # ESLint
npm run format      # Prettier (write)
npm run format:check
npm start           # local server on :8080
```

## Project layout

```
src/          ES6 class per pipeline stage (no framework, no bundler)
tests/        node:test suites, one per module
index.html    single-page UI
docs/         design spec and implementation plan
```

## Git conventions

[Conventional Commits](https://www.conventionalcommits.org/) are enforced by commitlint on every commit; Prettier and ESLint run via lint-staged in the pre-commit hook, followed by the full test suite.

| Type     | When to use                                     |
| -------- | ----------------------------------------------- |
| `feat:`  | new capability (a pipeline stage, a UI feature) |
| `fix:`   | correcting behavior                             |
| `docs:`  | documentation or spec changes                   |
| `test:`  | adding/changing tests only                      |
| `chore:` | tooling, config, maintenance                    |

For agents working in this repo, see [AGENTS.md](./AGENTS.md) and [CLAUDE.md](./CLAUDE.md).

## Design

The full design rationale and the original implementation plan live in [`docs/superpowers`](./docs/superpowers).
