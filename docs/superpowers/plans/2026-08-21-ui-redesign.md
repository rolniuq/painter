# UI Redesign — Board + Tools Bar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the Auto Doodler UI into a board section (canvas as paper sheet) plus a tldraw-style tools bar adding cursor shape, ink color, pen size, and speed controls.

**Architecture:** Pure DOM/CSS redesign plus three touch points in existing modules: `BrushConfig.resolve()` composes style preset × size factor, `CursorPlayer` gains `color`/`cursorShape` options backed by an exported sprite registry, and `App` holds a `_options` state object wired to the new controls. Pipeline stages and inter-stage contracts are untouched.

**Tech Stack:** Vanilla ES modules, Canvas 2D, inline SVG icons, CSS custom properties, `node:test` + `node:assert`. Zero new dependencies.

## Global Constraints

- **No dependencies, no build step.** Everything runs from static files over HTTP. Browser APIs only.
- **ES modules with explicit `.js` extensions** on all relative imports.
- **Tests:** `npm test` runs `node --test tests/*.test.js` — never change to the bare-directory form.
- **Private members underscore-prefixed** (`this._options`, `_setStatus`).
- **No code comments** unless non-obvious reasoning is essential.
- **Prettier defaults** (2-space, double quotes, `es5` trailing commas); after every edit run `npm run format`, then `npm run lint`, then `npm test`.
- **Conventional Commits**, subject ≤ 72 chars, lowercase after type.
- Spec: `docs/superpowers/specs/2026-08-21-ui-redesign-design.md`.

---

### Task 1: `BrushConfig.resolve(style, size)` — size-aware brush composition

**Files:**

- Modify: `src/BrushConfig.js`
- Test: `tests/brush-config.test.js`

**Interfaces:**

- Consumes: existing `BrushConfig.presets()` (keys `doodle`, `cartoon`, `sketch`; instances expose `width`, `jitter`, `passes`, `cap`).
- Produces: `static BrushConfig.resolve(style, size)` returning a plain object `{ width, jitter, passes, cap }`. Unknown `style` falls back to `cartoon`; unknown `size` falls back to `medium`. Size factors: `thin` 0.6, `medium` 1, `thick` 1.8. Width rounded to 1 decimal. Presets are never mutated. Task 4 calls it as `BrushConfig.resolve(this._options.style, this._options.size)`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/brush-config.test.js`:

```js
test("resolve scales preset width by size factor", () => {
  const thick = BrushConfig.resolve("cartoon", "thick");
  assert.equal(thick.width, 7.2);
  assert.equal(thick.jitter, 0);
  assert.equal(thick.passes, 1);
  assert.equal(thick.cap, "round");

  const thin = BrushConfig.resolve("sketch", "thin");
  assert.equal(thin.width, 0.9);
  assert.equal(thin.passes, 2);

  assert.equal(BrushConfig.resolve("doodle", "medium").width, 2);
});

test("resolve falls back to cartoon for unknown style", () => {
  const brush = BrushConfig.resolve("nope", "medium");
  assert.equal(brush.width, 4);
  assert.equal(brush.jitter, 0);
});

test("resolve falls back to medium for unknown size", () => {
  const brush = BrushConfig.resolve("sketch", "giant");
  assert.equal(brush.width, 1.5);
});

test("resolve does not mutate presets", () => {
  BrushConfig.resolve("sketch", "thick");
  assert.equal(BrushConfig.presets().sketch.width, 1.5);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `resolve is not a function` (4 new tests fail; existing 24 pass).

- [ ] **Step 3: Write minimal implementation**

In `src/BrushConfig.js`, add inside the `BrushConfig` class after `presets()`:

```js
  static SIZE_FACTORS = { thin: 0.6, medium: 1, thick: 1.8 };

  static resolve(style, size) {
    const presets = BrushConfig.presets();
    const base = presets[style] ?? presets.cartoon;
    const factor =
      BrushConfig.SIZE_FACTORS[size] ?? BrushConfig.SIZE_FACTORS.medium;
    return { ...base, width: Math.round(base.width * factor * 10) / 10 };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 28 tests total.

- [ ] **Step 5: Format, lint, commit**

```bash
npm run format && npm run lint && npm test
git add src/BrushConfig.js tests/brush-config.test.js
git commit -m "feat: add size-aware brush resolution"
```

---

### Task 2: `CursorPlayer` colored ink + selectable cursor sprites

**Files:**

- Modify: `src/CursorPlayer.js`
- Test: `tests/cursor-player.test.js`

**Interfaces:**

- Consumes: nothing new; keeps existing constructor contract (`ctx`, `inkCtx`, `inkCanvas`, `brush`, `width`, `height`, `speed`, `raf`).
- Produces:
  - New constructor options: `color = "#000"` (applied to `inkCtx.strokeStyle`/`fillStyle`) and `cursorShape = "pen"`.
  - Exported `CURSOR_SHAPES`: object mapping ids `"pen" | "pencil" | "marker" | "brush" | "crayon" | "calligraphy"` to `draw(ctx)` functions. Each function draws in local space (tip pointing along +x) using only `beginPath`/`moveTo`/`lineTo`/`closePath`/`fill` so the Node mock context works. Unknown id falls back to `pen`.
  - Task 4 passes `{ color, cursorShape }` alongside existing options.

- [ ] **Step 1: Update the mock context to record style assignments**

In `tests/cursor-player.test.js`, extend `makeMockCtx` so `strokeStyle`/`fillStyle` setters record their values. Change the `calls` initializer to include them:

```js
const calls = {
  moveTo: [],
  lineTo: [],
  beginPath: 0,
  stroke: 0,
  arc: 0,
  closePath: 0,
  fill: 0,
  clearRect: 0,
  drawImage: 0,
  save: 0,
  restore: 0,
  translate: [],
  rotate: [],
  strokeStyle: null,
  fillStyle: null,
};
```

And replace the two setter stubs at the bottom of `makeMockCtx`:

```js
    set lineWidth(v) {},
    set lineCap(v) {},
    set lineJoin(v) {},
    set strokeStyle(v) {
      calls.strokeStyle = v;
    },
    set fillStyle(v) {
      calls.fillStyle = v;
    },
```

Update the import at the top:

```js
import { CursorPlayer, CURSOR_SHAPES } from "../src/CursorPlayer.js";
```

- [ ] **Step 2: Write the failing tests**

Append to `tests/cursor-player.test.js`:

```js
test("exposes six known cursor sprites", () => {
  for (const id of [
    "pen",
    "pencil",
    "marker",
    "brush",
    "crayon",
    "calligraphy",
  ]) {
    assert.equal(typeof CURSOR_SHAPES[id], "function", `${id} missing`);
  }
});

test("uses the requested ink color", () => {
  const ink = makeMockCtx();
  const visible = makeMockCtx();
  new CursorPlayer({
    ctx: visible,
    inkCtx: ink,
    inkCanvas: {},
    brush: BrushConfig.presets().cartoon,
    width: 100,
    height: 100,
    color: "#ff0000",
  });
  assert.equal(ink.calls.strokeStyle, "#ff0000");
  assert.equal(ink.calls.fillStyle, "#ff0000");
});

test("defaults to black ink", () => {
  const ink = makeMockCtx();
  const visible = makeMockCtx();
  new CursorPlayer({
    ctx: visible,
    inkCtx: ink,
    inkCanvas: {},
    brush: BrushConfig.presets().cartoon,
    width: 100,
    height: 100,
  });
  assert.equal(ink.calls.strokeStyle, "#000");
  assert.equal(ink.calls.fillStyle, "#000");
});

test("unknown cursor shape falls back to pen without crashing", () => {
  const ink = makeMockCtx();
  const visible = makeMockCtx();
  const player = new CursorPlayer({
    ctx: visible,
    inkCtx: ink,
    inkCanvas: {},
    brush: BrushConfig.presets().cartoon,
    width: 100,
    height: 100,
    cursorShape: "bogus",
  });
  let doneCount = 0;
  player.play(
    [
      { type: "down", x: 5, y: 5 },
      { type: "move", x: 55, y: 5 },
    ],
    { onDone: () => doneCount++ }
  );
  player.tick(1000);
  assert.equal(doneCount, 1);
  assert.ok(visible.calls.fill >= 1, "fallback sprite should render");
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `CURSOR_SHAPES` is not exported (syntax/import error), color assertions fail.

- [ ] **Step 4: Implement sprite registry, color option, fallback**

In `src/CursorPlayer.js`, add above the class:

```js
export const CURSOR_SHAPES = {
  pen(ctx) {
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
  },
  pencil(ctx) {
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(2, -2.5);
    ctx.lineTo(-6, -2.5);
    ctx.lineTo(-6, 2.5);
    ctx.lineTo(2, 2.5);
    ctx.closePath();
    ctx.fill();
  },
  marker(ctx) {
    ctx.beginPath();
    ctx.moveTo(9, -1);
    ctx.lineTo(3, -3.5);
    ctx.lineTo(-6, -3.5);
    ctx.lineTo(-6, 3.5);
    ctx.lineTo(3, 3.5);
    ctx.lineTo(9, 1);
    ctx.closePath();
    ctx.fill();
  },
  brush(ctx) {
    ctx.beginPath();
    ctx.moveTo(9, 0);
    ctx.lineTo(1, -3);
    ctx.lineTo(-6, -2);
    ctx.lineTo(-6, 2);
    ctx.lineTo(1, 3);
    ctx.closePath();
    ctx.fill();
  },
  crayon(ctx) {
    ctx.beginPath();
    ctx.moveTo(9, -1.5);
    ctx.lineTo(4, -3.5);
    ctx.lineTo(-6, -3.5);
    ctx.lineTo(-6, 3.5);
    ctx.lineTo(4, 3.5);
    ctx.lineTo(9, 1.5);
    ctx.closePath();
    ctx.fill();
  },
  calligraphy(ctx) {
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-2, -5);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.lineTo(-2, 5);
    ctx.closePath();
    ctx.fill();
  },
};
```

Constructor signature gains two defaulted params and applies the color:

```js
  constructor({
    ctx,
    inkCtx,
    inkCanvas,
    brush,
    width,
    height,
    speed = 120,
    raf = null,
    color = "#000",
    cursorShape = "pen",
  }) {
```

Add after `this.raf = raf;`:

```js
this.color = color;
this.cursorShape = cursorShape;
```

Replace the hardcoded ink styling at the end of the constructor:

```js
this.inkCtx.lineWidth = brush.width;
this.inkCtx.lineCap = brush.cap;
this.inkCtx.lineJoin = "round";
this.inkCtx.strokeStyle = this.color;
this.inkCtx.fillStyle = this.color;
```

Replace `_paintFrame`'s cursor-drawing block (everything between `drawImage` and the closing brace) with the registry lookup:

```js
  _paintFrame() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    if (this.inkCanvas) this.ctx.drawImage(this.inkCanvas, 0, 0);
    const draw = CURSOR_SHAPES[this.cursorShape] ?? CURSOR_SHAPES.pen;
    this.ctx.save();
    this.ctx.translate(this.cursor.x, this.cursor.y);
    this.ctx.rotate(this._lastAngle);
    draw(this.ctx);
    this.ctx.restore();
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — 32 tests total (existing 4 cursor-player tests unaffected).

- [ ] **Step 6: Format, lint, commit**

```bash
npm run format && npm run lint && npm test
git add src/CursorPlayer.js tests/cursor-player.test.js
git commit -m "feat: add colored ink and selectable cursor sprites"
```

---

### Task 3: Restructure `index.html` + rewrite `styles.css` into board + tools bar

**Files:**

- Modify: `index.html` (full rewrite)
- Modify: `styles.css` (full rewrite)

**Interfaces:**

- Consumes: nothing (static markup/CSS).
- Produces: every id/class Task 4 queries — `file-input`, `start-btn`, `download-btn`, `status`, `draw-canvas`, `custom-color`, `speed-range`, `speed-value`, and attribute hooks `[data-shape]` (values `pen|pencil|marker|brush|crayon|calligraphy`), `[data-style]` (`doodle|cartoon|sketch`), `[data-color]` (hex), `[data-size]` (`thin|medium|thick`). Selected-state styling keys off `.selected` + `aria-pressed`. Badge hide/show keys off `.badge.hidden`.

- [ ] **Step 1: Rewrite `index.html`**

Replace the entire file with:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Auto Doodler</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg" />
    <link rel="apple-touch-icon" href="favicon.svg" />
    <link rel="stylesheet" href="styles.css" />
  </head>
  <body>
    <div class="workspace">
      <div class="brand">Auto Doodler</div>
      <div id="status" class="badge">Upload an image to begin.</div>
      <canvas id="draw-canvas"></canvas>
    </div>
    <div class="toolbar">
      <div class="tool-group">
        <label class="tool-btn labeled" for="file-input">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M8 10V2M4.5 5.5L8 2l3.5 3.5M2 11v2a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-2"
            />
          </svg>
          <span>Upload</span>
        </label>
        <input id="file-input" type="file" accept="image/*" hidden />
      </div>
      <div class="divider"></div>
      <div class="tool-group" role="group" aria-label="Cursor shape">
        <button
          class="tool-btn icon selected"
          data-shape="pen"
          aria-pressed="true"
          title="Pen"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M12 2.5 13.5 4 6 11.5 3.5 12.5 4.5 10Z" />
          </svg>
        </button>
        <button
          class="tool-btn icon"
          data-shape="pencil"
          aria-pressed="false"
          title="Pencil"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M9.5 3.5 12.5 6.5 6 13H3v-3ZM8 5l3 3" />
          </svg>
        </button>
        <button
          class="tool-btn icon"
          data-shape="marker"
          aria-pressed="false"
          title="Marker"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 2.5 13.5 6 8 11.5H5V8.5ZM4 13h8" />
          </svg>
        </button>
        <button
          class="tool-btn icon"
          data-shape="brush"
          aria-pressed="false"
          title="Brush"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path
              d="M13.5 2.5c-3 .5-6 2.5-7.5 5L4.5 11.5 3 13m1.5-1.5L6 13c2.5-1.5 6-4.5 7.5-10.5Z"
            />
          </svg>
        </button>
        <button
          class="tool-btn icon"
          data-shape="crayon"
          aria-pressed="false"
          title="Crayon"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M11 2.5 13.5 5 5.5 13H3v-2.5ZM9.5 4 12 6.5" />
          </svg>
        </button>
        <button
          class="tool-btn icon"
          data-shape="calligraphy"
          aria-pressed="false"
          title="Calligraphy"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M13.5 2.5 6 10l-2.5 3.5L2 15m4-5 3 3M13.5 2.5 10 6" />
          </svg>
        </button>
      </div>
      <div class="divider"></div>
      <div class="tool-group segmented" role="group" aria-label="Drawing style">
        <button
          class="seg-btn selected"
          data-style="cartoon"
          aria-pressed="true"
        >
          Cartoon
        </button>
        <button class="seg-btn" data-style="doodle" aria-pressed="false">
          Doodle
        </button>
        <button class="seg-btn" data-style="sketch" aria-pressed="false">
          Sketch
        </button>
      </div>
      <div class="divider"></div>
      <div class="tool-group colors" role="group" aria-label="Ink color">
        <button
          class="swatch selected"
          data-color="#000000"
          style="--c: #000000"
          aria-label="Black"
          aria-pressed="true"
        ></button>
        <button
          class="swatch"
          data-color="#ef4444"
          style="--c: #ef4444"
          aria-label="Red"
          aria-pressed="false"
        ></button>
        <button
          class="swatch"
          data-color="#f97316"
          style="--c: #f97316"
          aria-label="Orange"
          aria-pressed="false"
        ></button>
        <button
          class="swatch"
          data-color="#eab308"
          style="--c: #eab308"
          aria-label="Yellow"
          aria-pressed="false"
        ></button>
        <button
          class="swatch"
          data-color="#22c55e"
          style="--c: #22c55e"
          aria-label="Green"
          aria-pressed="false"
        ></button>
        <button
          class="swatch"
          data-color="#3b82f6"
          style="--c: #3b82f6"
          aria-label="Blue"
          aria-pressed="false"
        ></button>
        <button
          class="swatch"
          data-color="#8b5cf6"
          style="--c: #8b5cf6"
          aria-label="Purple"
          aria-pressed="false"
        ></button>
        <button
          class="swatch"
          data-color="#ec4899"
          style="--c: #ec4899"
          aria-label="Pink"
          aria-pressed="false"
        ></button>
        <label class="swatch custom" for="custom-color" title="Custom color">
          <input id="custom-color" type="color" value="#000000" />
        </label>
      </div>
      <div class="divider"></div>
      <div class="tool-group" role="group" aria-label="Pen size">
        <button
          class="tool-btn dot"
          data-size="thin"
          aria-pressed="false"
          title="Thin"
        >
          <span class="dot s1"></span>
        </button>
        <button
          class="tool-btn dot selected"
          data-size="medium"
          aria-pressed="true"
          title="Medium"
        >
          <span class="dot s2"></span>
        </button>
        <button
          class="tool-btn dot"
          data-size="thick"
          aria-pressed="false"
          title="Thick"
        >
          <span class="dot s3"></span>
        </button>
      </div>
      <div class="divider"></div>
      <div class="tool-group speed" title="Draw speed (px/s)">
        <input
          id="speed-range"
          type="range"
          min="40"
          max="300"
          step="10"
          value="120"
        />
        <span id="speed-value">120</span>
      </div>
      <div class="spacer"></div>
      <div class="tool-group actions">
        <button id="start-btn" disabled>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M5 3l8 5-8 5Z" />
          </svg>
          Start Drawing
        </button>
        <button id="download-btn" disabled>
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2 13h12" />
          </svg>
          Download PNG
        </button>
      </div>
    </div>
    <script type="module">
      import { App } from "./src/App.js";
      new App();
    </script>
  </body>
</html>
```

- [ ] **Step 2: Rewrite `styles.css`**

Replace the entire file with:

```css
:root {
  --text: #1a1a1a;
  --muted: #6b7280;
  --surface: #ffffff;
  --workspace: #f2f3f5;
  --border: #e5e7eb;
  --accent: #2563eb;
  --accent-tint: #eff6ff;
  --radius: 8px;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  color: var(--text);
  height: 100dvh;
  display: flex;
  flex-direction: column;
}

.workspace {
  flex: 1;
  min-height: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--workspace);
  padding: 24px;
}

.brand {
  position: absolute;
  top: 16px;
  left: 16px;
  padding: 6px 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  font-size: 0.85rem;
  font-weight: 600;
}

.badge {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  max-width: min(80%, 480px);
  padding: 6px 14px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  font-size: 0.85rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 0.25s ease;
}

.badge.hidden {
  opacity: 0;
  visibility: hidden;
}

#draw-canvas {
  max-width: 100%;
  max-height: 100%;
  background: #fff;
  border-radius: var(--radius);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 10px 16px;
  background: var(--surface);
  border-top: 1px solid var(--border);
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.divider {
  width: 1px;
  height: 24px;
  background: var(--border);
}

.spacer {
  flex: 1;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 32px;
  height: 32px;
  padding: 0 6px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text);
  font-size: 0.85rem;
  cursor: pointer;
}

.tool-btn:hover {
  background: var(--workspace);
}

.tool-btn.selected {
  background: var(--accent-tint);
  color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.tool-btn.labeled svg,
.actions svg {
  width: 16px;
  height: 16px;
}

.tool-btn.icon svg {
  width: 18px;
  height: 18px;
}

svg path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.5;
  stroke-linecap: round;
  stroke-linejoin: round;
}

#start-btn svg path {
  fill: currentColor;
  stroke: none;
}

.segmented {
  padding: 2px;
  background: var(--workspace);
  border-radius: var(--radius);
}

.seg-btn {
  padding: 5px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--muted);
  font-size: 0.85rem;
  cursor: pointer;
}

.seg-btn.selected {
  background: var(--surface);
  color: var(--text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}

.swatch {
  width: 22px;
  height: 22px;
  padding: 0;
  border: 2px solid var(--surface);
  outline: 1px solid var(--border);
  border-radius: 50%;
  background: var(--c);
  cursor: pointer;
}

.swatch:hover {
  transform: scale(1.1);
}

.swatch.selected {
  outline: 2px solid var(--accent);
}

.swatch.custom {
  position: relative;
  overflow: hidden;
  background: conic-gradient(red, yellow, lime, cyan, blue, magenta, red);
}

.swatch.custom input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

.dot {
  display: block;
  border-radius: 50%;
  background: currentColor;
}

.dot.s1 {
  width: 4px;
  height: 4px;
}

.dot.s2 {
  width: 8px;
  height: 8px;
}

.dot.s3 {
  width: 12px;
  height: 12px;
}

.speed input {
  accent-color: var(--accent);
  width: 110px;
}

#speed-value {
  min-width: 3ch;
  font-size: 0.8rem;
  color: var(--muted);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.actions button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.actions button:hover:not(:disabled) {
  border-color: var(--muted);
}

.actions #start-btn {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.actions #start-btn:hover:not(:disabled) {
  background: #1d4ed8;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Verify suite still green and formatting clean**

Run: `npm run format && npm run lint && npm test`
Expected: PASS — 32 tests (Node tests don't touch DOM; Prettier may reformat the HTML/CSS files).

- [ ] **Step 4: Commit**

```bash
git add index.html styles.css
git commit -m "feat: restructure ui into board and tools bar"
```

---

### Task 4: Wire tool options in `App.js` + update contract doc

**Files:**

- Modify: `src/App.js` (full rewrite)
- Modify: `AGENTS.md` (one contract line)

**Interfaces:**

- Consumes: `BrushConfig.resolve(style, size)` (Task 1); `CursorPlayer` options `color`, `cursorShape` (Task 2); all DOM hooks from Task 3.
- Produces: running app where shape/style/color/size/speed selections apply to the next started drawing; status renders through the auto-hiding badge.

- [ ] **Step 1: Rewrite `src/App.js`**

Replace the entire file with:

```js
import { ImageLoader } from "./ImageLoader.js";
import { EdgeDetector } from "./EdgeDetector.js";
import { ContourBuilder } from "./ContourBuilder.js";
import { StrokePlanner } from "./StrokePlanner.js";
import { CursorPlayer } from "./CursorPlayer.js";
import { BrushConfig } from "./BrushConfig.js";

export class App {
  constructor() {
    this.fileInput = document.getElementById("file-input");
    this.startBtn = document.getElementById("start-btn");
    this.downloadBtn = document.getElementById("download-btn");
    this.statusEl = document.getElementById("status");
    this.canvas = document.getElementById("draw-canvas");
    this.customColorInput = document.getElementById("custom-color");
    this.speedRange = document.getElementById("speed-range");
    this.speedValue = document.getElementById("speed-value");
    this.shapeBtns = [...document.querySelectorAll("[data-shape]")];
    this.styleBtns = [...document.querySelectorAll("[data-style]")];
    this.swatches = [...document.querySelectorAll("[data-color]")];
    this.sizeBtns = [...document.querySelectorAll("[data-size]")];

    this.imageLoader = new ImageLoader();
    this.edgeDetector = new EdgeDetector();
    this.contourBuilder = new ContourBuilder();
    this.strokePlanner = new StrokePlanner();
    this.current = null;
    this.ctx = null;
    this._playing = false;
    this._statusTimer = null;
    this._options = {
      style: "cartoon",
      shape: "pen",
      color: "#000000",
      size: "medium",
      speed: 120,
    };

    this.fileInput.addEventListener("change", () => this._onFile());
    this.startBtn.addEventListener("click", () => this._onStart());
    this.downloadBtn.addEventListener("click", () => this._onDownload());

    this._bindChoice(this.shapeBtns, "shape");
    this._bindChoice(this.styleBtns, "style");
    this._bindChoice(this.sizeBtns, "size");
    this.swatches.forEach((btn) =>
      btn.addEventListener("click", () => {
        this._options.color = btn.dataset.color;
        this.customColorInput.value = btn.dataset.color;
        this._setSelected(this.swatches, btn);
      })
    );
    this.customColorInput.addEventListener("input", () => {
      this._options.color = this.customColorInput.value;
      this._setSelected(this.swatches, null);
    });
    this.speedRange.addEventListener("input", () => {
      this._options.speed = Number(this.speedRange.value);
      this.speedValue.textContent = this.speedRange.value;
    });
  }

  _bindChoice(buttons, key) {
    buttons.forEach((btn) =>
      btn.addEventListener("click", () => {
        this._options[key] = btn.dataset[key];
        this._setSelected(buttons, btn);
      })
    );
  }

  _setSelected(buttons, active) {
    buttons.forEach((btn) => {
      btn.classList.toggle("selected", btn === active);
      btn.setAttribute("aria-pressed", btn === active ? "true" : "false");
    });
  }

  _setStatus(text, { sticky = false } = {}) {
    clearTimeout(this._statusTimer);
    this.statusEl.textContent = text;
    this.statusEl.classList.remove("hidden");
    if (!sticky) {
      this._statusTimer = setTimeout(
        () => this.statusEl.classList.add("hidden"),
        4000
      );
    }
  }

  async _onFile() {
    const file = this.fileInput.files[0];
    if (!file) return;
    document.querySelector('label[for="file-input"]').title = file.name;
    if (this._player) {
      this._player.cancel();
      this._player = null;
    }
    this._playing = false;
    this._setStatus("Loading image…", { sticky: true });
    try {
      this.current = await this.imageLoader.load(file);
      this.canvas.width = this.current.width;
      this.canvas.height = this.current.height;
      this.ctx = this.canvas.getContext("2d");
      this.ctx.fillStyle = "#fff";
      this.ctx.fillRect(0, 0, this.current.width, this.current.height);
      this.startBtn.disabled = false;
      this.downloadBtn.disabled = true;
      this._setStatus("Ready. Pick a style and press Start Drawing.");
    } catch (err) {
      this._setStatus(err.message || "Could not load image.", { sticky: true });
    }
  }

  _onStart() {
    if (!this.current || this._playing) return;
    this._playing = true;
    this.startBtn.disabled = true;
    this._setStatus("Drawing…", { sticky: true });
    const { gray, width, height } = this.current;
    setTimeout(() => {
      const { edgeMask } = this.edgeDetector.detect({ gray, width, height });
      const strokes = this.contourBuilder.build({ edgeMask, width, height });
      if (strokes.length === 0) {
        this._playing = false;
        this.startBtn.disabled = false;
        this._setStatus("No edges found. Try another image.", { sticky: true });
        return;
      }
      const commands = this.strokePlanner.plan({ strokes, width, height });
      this._inkCanvas = document.createElement("canvas");
      this._inkCanvas.width = width;
      this._inkCanvas.height = height;
      this._player = new CursorPlayer({
        ctx: this.ctx,
        inkCtx: this._inkCanvas.getContext("2d"),
        inkCanvas: this._inkCanvas,
        brush: BrushConfig.resolve(this._options.style, this._options.size),
        color: this._options.color,
        cursorShape: this._options.shape,
        width,
        height,
        speed: this._options.speed,
        raf: (cb) => requestAnimationFrame(cb),
      });
      this._player.play(commands, {
        onDone: () => {
          this._playing = false;
          this.downloadBtn.disabled = false;
          this._setStatus("Done! Download your drawing.");
        },
      });
    }, 0);
  }

  _onDownload() {
    if (!this.ctx || !this._inkCanvas) return;
    this.ctx.fillStyle = "#fff";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this._inkCanvas, 0, 0);
    this.canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "doodle.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }
}
```

- [ ] **Step 2: Run tests**

Run: `npm test`
Expected: PASS — 32 tests (App has no Node tests; regression guard only).

- [ ] **Step 3: Update the contract line in `AGENTS.md`**

Find this bullet under "Architecture invariants":

```
  - `BrushConfig.presets()` keys (`doodle`, `cartoon`, `sketch`) must match the `<select>` values in `index.html`.
```

Replace with:

```
  - `BrushConfig.presets()` keys (`doodle`, `cartoon`, `sketch`) must match the `[data-style]` button values in `index.html`; `CursorPlayer.CURSOR_SHAPES` keys must match the `[data-shape]` button values.
```

- [ ] **Step 4: Format, lint, test, commit**

```bash
npm run format && npm run lint && npm test
git add src/App.js AGENTS.md
git commit -m "feat: wire tool options into app state and player"
```

---

### Task 5: Manual browser verification against the spec

**Files:**

- None (verification only). Fix-forward any visual defects found by amending the responsible task's files in a new `fix:` commit.

**Interfaces:**

- Consumes: fully wired app from Tasks 1–4.
- Produces: confirmation that every spec requirement behaves correctly in a real browser.

- [ ] **Step 1: Serve and open**

Run: `npm start` then open `http://localhost:8080`.

- [ ] **Step 2: Walk the checklist**

Verify each item and stop at the first failure:

1. Board fills the viewport above the toolbar; canvas appears as a centered white sheet with rounded corners and shadow on the gray workspace.
2. Initial badge reads "Upload an image to begin." and stays visible.
3. Upload a photo: badge shows "Loading image…" then "Ready…" which auto-hides after ~4s; canvas shows the image sized to fit without distortion.
4. Toggle every cursor shape button: exactly one is highlighted at a time.
5. Switch style segments and size dots: selection highlight moves; no console errors.
6. Click swatches, then the rainbow custom swatch and pick e.g. green: custom picker reflects the choice.
7. Drag the speed slider: the numeric readout follows.
8. Press Start Drawing: pen cursor animates using the chosen sprite, ink matches chosen color, thickness visibly differs between thin/thick, speed slider clearly changes pace. Buttons don't allow double-start mid-draw.
9. Upload a different image mid-session after completion: previous drawing resets cleanly.
10. Download PNG: file is white-backed with colored ink, no pen cursor baked in.
11. Narrow the window below ~900px: toolbar wraps into multiple rows without overlap; board still fits.
12. Test an image with no edges (blank white): badge shows "No edges found." and stays.

- [ ] **Step 3: Final gate**

```bash
npm run format:check && npm run lint && npm test
```

Expected: all clean, 32 tests passing. If any fix commits were made, confirm the suite after the last one.
