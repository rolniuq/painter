# Auto-Doodler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a client-side web app where a user uploads an image and a pen-shaped cursor autonomously hand-draws a black-on-white line-art version of it, animated on a canvas.

**Architecture:** A one-directional ES6-class pipeline: `ImageLoader` (upload + grayscale + downscale) → `EdgeDetector` (Canny edges) → `ContourBuilder` (edge pixels into ordered strokes) → `StrokePlanner` (sort/split/clamp into pen commands) → `CursorPlayer` (animates a pen cursor, inking a persistent offscreen ink layer). `BrushConfig` holds per-style line parameters; `App` wires DOM to the pipeline. All processing is client-side; there is no server and no build step.

**Tech Stack:** Vanilla JS ES6 modules, Canvas 2D API, `node:test` + `node:assert` for tests, Node 18+ for the test runner only.

## Global Constraints

- Zero runtime dependencies, zero build step; the app is served as static files.
- All code, comments, commit messages, and UI copy in English.
- Each major concern is one ES6 class with a single responsibility.
- Fixed maximum processing size: 1200px; minimum processing size: 64px (from spec).
- Edge detection is custom Canny (Gaussian blur → Sobel → non-maximum suppression → hysteresis), all in-browser JS.
- Stroke ordering: sort strokes by bounding-box center Y then center X (top-to-bottom traversal).
- Long strokes split into segments of at most 600 points (`maxSegmentPoints`).
- Strokes shorter than `minStrokeLength = 10` pixels are discarded as noise.
- Brush styles (doodle/cartoon/sketch) differ only by `BrushConfig` values: `width`, `jitter`, `passes`, `cap`.
- Drawing is one-shot: no playback controls, no progress UI. A Download PNG button enables when done.
- Ink is black (`#000`) on a white canvas.
- Tests use `node --test` and `node:assert`; no test dependencies. Browser behavior verified manually.
- This project is not yet a git repo — Task 1 initializes it.

---

### Task 1: Scaffold the project

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `tests/smoke.test.js`

**Interfaces:**
- Produces: `npm test` runs `node --test tests/` for all later tasks.

- [ ] **Step 1: Initialize the repo**

Run: `git init`
Expected: output `Initialized empty Git repository in ...` or equivalent.

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "auto-doodler",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/",
    "start": "python3 -m http.server 8080"
  }
}
```

- [ ] **Step 3: Write `.gitignore`**

```gitignore
node_modules/
.DS_Store
```

- [ ] **Step 4: Write the smoke test**

`tests/smoke.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';

test('test runner works', () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 5: Run tests to verify the runner works**

Run: `npm test`
Expected: output showing `# tests 1`, `# pass 1`, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add package.json .gitignore tests/smoke.test.js
git commit -m "chore: scaffold project with node:test harness"
```

---

### Task 2: BrushConfig

**Files:**
- Create: `src/BrushConfig.js`
- Test: `tests/brush-config.test.js`

**Interfaces:**
- Produces: `BrushConfig` class with constructor `{ width, jitter, passes, cap }` and static method `BrushConfig.presets()` returning `{ doodle, cartoon, sketch }`. Doodle = `{width:2, jitter:1.2, passes:1, cap:'round'}`, Cartoon = `{width:4, jitter:0, passes:1, cap:'round'}`, Sketch = `{width:1.5, jitter:0.4, passes:2, cap:'butt'}`. Consumed by `CursorPlayer` (Task 7) and `App` (Task 8).

- [ ] **Step 1: Write the failing test**

`tests/brush-config.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { BrushConfig } from '../src/BrushConfig.js';

test('presets exist with expected brush parameters', () => {
  const presets = BrushConfig.presets();
  assert.ok(presets.doodle);
  assert.ok(presets.cartoon);
  assert.ok(presets.sketch);
});

test('cartoon is the thick bold default', () => {
  const { cartoon } = BrushConfig.presets();
  assert.equal(cartoon.width, 4);
  assert.equal(cartoon.jitter, 0);
  assert.equal(cartoon.passes, 1);
  assert.equal(cartoon.cap, 'round');
});

test('sketch uses multiple offset passes and a butt cap', () => {
  const { sketch } = BrushConfig.presets();
  assert.equal(sketch.width, 1.5);
  assert.equal(sketch.passes, 2);
  assert.equal(sketch.cap, 'butt');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../src/BrushConfig.js`.

- [ ] **Step 3: Write the implementation**

`src/BrushConfig.js`:

```js
export class BrushConfig {
  constructor({ width = 2, jitter = 0, passes = 1, cap = 'round' } = {}) {
    this.width = width;
    this.jitter = jitter;
    this.passes = passes;
    this.cap = cap;
  }

  static presets() {
    return {
      doodle: new BrushConfig({ width: 2, jitter: 1.2, passes: 1, cap: 'round' }),
      cartoon: new BrushConfig({ width: 4, jitter: 0, passes: 1, cap: 'round' }),
      sketch: new BrushConfig({ width: 1.5, jitter: 0.4, passes: 2, cap: 'butt' }),
    };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all 3 BrushConfig tests plus the smoke test green.

- [ ] **Step 5: Commit**

```bash
git add src/BrushConfig.js tests/brush-config.test.js
git commit -m "feat: add brush config presets for doodle, cartoon, sketch"
```

---

### Task 3: ImageLoader (pure helpers)

**Files:**
- Create: `src/ImageLoader.js`
- Test: `tests/image-loader.test.js`

**Interfaces:**
- Produces: static `ImageLoader.downscaleDimensions(imgW, imgH, maxSize, minSize)` → `{width, height}`; static `ImageLoader.isSupportedFile(file)` → boolean; static `ImageLoader.toGrayscale(imageData)` → `Uint8Array` of luma values; instance method `async load(file)` → `{ gray, width, height }` (browser-only, not unit-tested). Consumed by `App` (Task 8).

- [ ] **Step 1: Write the failing test**

`tests/image-loader.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ImageLoader } from '../src/ImageLoader.js';

const MAX = 1200;
const MIN = 64;

test('downscales a large image to fit max size, preserving aspect', () => {
  const { width, height } = ImageLoader.downscaleDimensions(2000, 1000, MAX, MIN);
  assert.equal(width, 1200);
  assert.equal(height, 600);
});

test('keeps an image already smaller than max unchanged', () => {
  const { width, height } = ImageLoader.downscaleDimensions(600, 400, MAX, MIN);
  assert.equal(width, 600);
  assert.equal(height, 400);
});

test('upscales a tiny image to at least the minimum size', () => {
  const { width, height } = ImageLoader.downscaleDimensions(30, 20, MAX, MIN);
  assert.equal(height, 64);
  assert.equal(width, 96);
});

test('rejects non-image files and missing files', () => {
  assert.equal(ImageLoader.isSupportedFile({ type: 'image/png' }), true);
  assert.equal(ImageLoader.isSupportedFile({ type: 'text/plain' }), false);
  assert.equal(ImageLoader.isSupportedFile(null), false);
});

test('converts rgba pixels to luma grayscale', () => {
  const data = new Uint8ClampedArray([
    0, 0, 0, 255,   // black -> 0
    255, 255, 255, 255, // white -> 255
  ]);
  const gray = ImageLoader.toGrayscale({ data, width: 2, height: 1 });
  assert.equal(gray.length, 2);
  assert.equal(gray[0], 0);
  assert.equal(gray[1], 255);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../src/ImageLoader.js`.

- [ ] **Step 3: Write the implementation**

`src/ImageLoader.js`:

```js
export class ImageLoader {
  constructor({ maxSize = 1200, minSize = 64 } = {}) {
    this.maxSize = maxSize;
    this.minSize = minSize;
  }

  static downscaleDimensions(imgW, imgH, maxSize, minSize) {
    if (!imgW || !imgH) {
      return { width: minSize, height: minSize };
    }
    let scale = Math.min(1, maxSize / Math.max(imgW, imgH));
    if (Math.min(imgW * scale, imgH * scale) < minSize) {
      scale = minSize / Math.min(imgW, imgH);
    }
    return {
      width: Math.max(1, Math.round(imgW * scale)),
      height: Math.max(1, Math.round(imgH * scale)),
    };
  }

  static isSupportedFile(file) {
    return Boolean(file && typeof file.type === 'string' && file.type.startsWith('image/'));
  }

  static toGrayscale(imageData) {
    const { data, width, height } = imageData;
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    return gray;
  }

  async load(file) {
    if (!ImageLoader.isSupportedFile(file)) {
      throw new Error('Please choose an image file.');
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Could not load image.'));
        img.src = url;
      });
      const { width, height } = ImageLoader.downscaleDimensions(
        img.naturalWidth,
        img.naturalHeight,
        this.maxSize,
        this.minSize,
      );
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const gray = ImageLoader.toGrayscale(ctx.getImageData(0, 0, width, height));
      return { gray, width, height };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all ImageLoader tests green.

- [ ] **Step 5: Commit**

```bash
git add src/ImageLoader.js tests/image-loader.test.js
git commit -m "feat: add image loader with downscale, validation, and grayscale conversion"
```

---

### Task 4: EdgeDetector (Canny)

**Files:**
- Create: `src/EdgeDetector.js`
- Test: `tests/edge-detector.test.js`

**Interfaces:**
- Produces: `EdgeDetector` constructor `{ low = 0.1, high = 0.3 }` (fractions of max gradient magnitude); method `detect({ gray, width, height })` → `{ edgeMask: Uint8Array (1=edge), directions: Float32Array (radians), width, height }`. Consumed by `App` (Task 8) and tested here with synthetic images.

- [ ] **Step 1: Write the failing test**

`tests/edge-detector.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { EdgeDetector } from '../src/EdgeDetector.js';

const detector = new EdgeDetector();

function blankGray(width, height, fill = 255) {
  return new Uint8Array(width * height).fill(fill);
}

test('detects the boundary of a black square on a white background', () => {
  const width = 40;
  const height = 40;
  const gray = blankGray(width, height);
  for (let y = 15; y < 25; y++) {
    for (let x = 15; x < 25; x++) {
      gray[y * width + x] = 0;
    }
  }
  const { edgeMask, directions } = detector.detect({ gray, width, height });
  let count = 0;
  for (let i = 0; i < edgeMask.length; i++) count += edgeMask[i];
  assert.ok(count > 20, `expected edges around the square, got ${count}`);
  assert.ok(count < 400, `expected a thin boundary, got ${count}`);
  assert.equal(directions.length, width * height);
});

test('detects a diagonal black line', () => {
  const width = 30;
  const height = 30;
  const gray = blankGray(width, height);
  for (let i = 2; i < 18; i++) gray[i * width + i] = 0;
  const { edgeMask } = detector.detect({ gray, width, height });
  let count = 0;
  for (let i = 0; i < edgeMask.length; i++) count += edgeMask[i];
  assert.ok(count > 0, 'expected edges along the diagonal');
});

test('detects a circular outline', () => {
  const width = 40;
  const height = 40;
  const cx = 19.5;
  const cy = 19.5;
  const r = 8;
  const gray = blankGray(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (Math.abs(d - r) <= 0.5) gray[y * width + x] = 0;
    }
  }
  const { edgeMask } = detector.detect({ gray, width, height });
  let count = 0;
  for (let i = 0; i < edgeMask.length; i++) count += edgeMask[i];
  assert.ok(count > 0, 'expected edges along the circle');
});

test('returns an empty mask for a blank image', () => {
  const width = 20;
  const height = 20;
  const { edgeMask } = detector.detect({ gray: blankGray(width, height), width, height });
  let count = 0;
  for (let i = 0; i < edgeMask.length; i++) count += edgeMask[i];
  assert.equal(count, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../src/EdgeDetector.js`.

- [ ] **Step 3: Write the implementation**

`src/EdgeDetector.js`:

```js
export class EdgeDetector {
  constructor({ low = 0.1, high = 0.3 } = {}) {
    this.low = low;
    this.high = high;
  }

  detect({ gray, width, height }) {
    const size = width * height;
    const blurred = this._gaussianBlur(gray, width, height);

    const mag = new Float32Array(size);
    const dir = new Float32Array(size);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const gx =
          -blurred[i - width - 1] - 2 * blurred[i - 1] - blurred[i + width - 1] +
          blurred[i - width + 1] + 2 * blurred[i + 1] + blurred[i + width + 1];
        const gy =
          -blurred[i - width - 1] - 2 * blurred[i - width] - blurred[i - width + 1] +
          blurred[i + width - 1] + 2 * blurred[i + width] + blurred[i + width + 1];
        mag[i] = Math.hypot(gx, gy);
        dir[i] = Math.atan2(gy, gx);
      }
    }

    const suppressed = this._nonMaxSuppress(mag, dir, width, height);

    let maxMag = 0;
    for (let i = 0; i < size; i++) {
      if (suppressed[i] > maxMag) maxMag = suppressed[i];
    }
    if (maxMag <= 0) {
      return { edgeMask: new Uint8Array(size), directions: dir, width, height };
    }

    const highT = maxMag * this.high;
    const lowT = highT * this.low;
    const edgeMask = this._hysteresis(suppressed, highT, lowT, width, height);
    return { edgeMask, directions: dir, width, height };
  }

  _gaussianBlur(src, width, height) {
    const kernel = [1, 4, 6, 4, 1];
    const ksum = 16;
    const tmp = new Float32Array(src.length);
    const out = new Float32Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) {
          const xi = Math.min(width - 1, Math.max(0, x + k));
          s += kernel[k + 2] * src[y * width + xi];
        }
        tmp[y * width + x] = s / ksum;
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) {
          const yi = Math.min(height - 1, Math.max(0, y + k));
          s += kernel[k + 2] * tmp[yi * width + x];
        }
        out[y * width + x] = s / ksum;
      }
    }
    return out;
  }

  _nonMaxSuppress(mag, dir, width, height) {
    const out = new Float32Array(mag.length);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const deg = Math.abs((dir[i] * 180) / Math.PI);
        let a = 0;
        let b = 0;
        if (deg <= 22.5 || deg >= 157.5) {
          a = mag[i - 1];
          b = mag[i + 1];
        } else if (deg <= 67.5) {
          a = mag[i - width - 1];
          b = mag[i + width + 1];
        } else if (deg <= 112.5) {
          a = mag[i - width];
          b = mag[i + width];
        } else {
          a = mag[i - width + 1];
          b = mag[i + width - 1];
        }
        if (mag[i] >= a && mag[i] >= b) out[i] = mag[i];
      }
    }
    return out;
  }

  _hysteresis(suppressed, highT, lowT, width, height) {
    const edge = new Uint8Array(suppressed.length);
    const stack = [];
    for (let i = 0; i < suppressed.length; i++) {
      if (suppressed[i] >= highT) {
        edge[i] = 1;
        stack.push(i);
      }
    }
    while (stack.length) {
      const i = stack.pop();
      const x = i % width;
      const y = Math.floor(i / width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (!edge[j] && suppressed[j] >= lowT) {
            edge[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    return edge;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all EdgeDetector tests green (edge counts within asserted ranges).

- [ ] **Step 5: Commit**

```bash
git add src/EdgeDetector.js tests/edge-detector.test.js
git commit -m "feat: add Canny edge detector with blur, sobel, nms, hysteresis"
```

---

### Task 5: ContourBuilder

**Files:**
- Create: `src/ContourBuilder.js`
- Test: `tests/contour-builder.test.js`

**Interfaces:**
- Produces: `ContourBuilder` constructor `{ minStrokeLength = 10 }`; method `build({ edgeMask, width, height })` → `Stroke[]`, each `{ points: [{x,y}], minX, minY, maxX, maxY }`. Consumed by `App` (Task 8).

- [ ] **Step 1: Write the failing test**

`tests/contour-builder.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ContourBuilder } from '../src/ContourBuilder.js';

const builder = new ContourBuilder({ minStrokeLength: 5 });

function maskFrom(pointSets, width, height) {
  const edgeMask = new Uint8Array(width * height);
  for (const pts of pointSets) {
    for (const [x, y] of pts) {
      if (x >= 0 && y >= 0 && x < width && y < height) edgeMask[y * width + x] = 1;
    }
  }
  return edgeMask;
}

test('turns two disconnected lines into two separate strokes', () => {
  const width = 20;
  const height = 20;
  const edgeMask = maskFrom(
    [[[3, 2], [4, 2], [5, 2]], [[12, 10], [13, 10], [14, 10]]],
    width,
    height,
  );
  const strokes = builder.build({ edgeMask, width, height });
  assert.equal(strokes.length, 2);
  assert.equal(strokes[0].points.length, 3);
  assert.equal(strokes[1].points.length, 3);
  assert.ok(strokes[0].minY < strokes[1].minY);
});

test('traces one connected diagonal path into a single ordered stroke', () => {
  const width = 20;
  const height = 20;
  const points = [];
  for (let i = 2; i < 15; i++) points.push([i, i]);
  const edgeMask = maskFrom([points], width, height);
  const strokes = builder.build({ edgeMask, width, height });
  assert.equal(strokes.length, 1);
  assert.equal(strokes[0].points.length, 13);
  const first = strokes[0].points[0];
  const last = strokes[0].points[strokes[0].points.length - 1];
  assert.ok(Math.abs(first.x - 2) <= 1 && Math.abs(first.y - 2) <= 1);
  assert.ok(Math.abs(last.x - 14) <= 1 && Math.abs(last.y - 14) <= 1);
});

test('drops a small blob below minStrokeLength', () => {
  const width = 10;
  const height = 10;
  const edgeMask = maskFrom(
    [[[2, 2], [3, 2], [3, 3]]],
    width,
    height,
  );
  const strokes = builder.build({ edgeMask, width, height });
  assert.equal(strokes.length, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../src/ContourBuilder.js`.

- [ ] **Step 3: Write the implementation**

`src/ContourBuilder.js`:

```js
export class ContourBuilder {
  constructor({ minStrokeLength = 10 } = {}) {
    this.minStrokeLength = minStrokeLength;
  }

  build({ edgeMask, width, height }) {
    const visited = new Uint8Array(width * height);
    const strokes = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!edgeMask[i] || visited[i]) continue;
        const points = this._trace(edgeMask, visited, width, height, x, y);
        if (points.length >= this.minStrokeLength) {
          strokes.push(this._withBounds(points));
        }
      }
    }
    return strokes;
  }

  _trace(edgeMask, visited, width, height, x0, y0) {
    const points = [];
    let x = x0;
    let y = y0;
    const guard = width * height;
    for (let g = 0; g < guard; g++) {
      if (!edgeMask[y * width + x] || visited[y * width + x]) break;
      visited[y * width + x] = 1;
      points.push({ x, y });
      const next = this._next(edgeMask, visited, width, height, x, y);
      if (!next) break;
      x = next.x;
      y = next.y;
    }
    return points;
  }

  _next(edgeMask, visited, width, height, x, y) {
    let best = null;
    for (const [dx, dy] of [
      [-1, -1], [0, -1], [1, -1],
      [-1, 0], [1, 0],
      [-1, 1], [0, 1], [1, 1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const i = ny * width + nx;
      if (!edgeMask[i] || visited[i]) continue;
      const count = this._unvisitedNeighbors(edgeMask, visited, width, height, nx, ny);
      if (!best || count < best.count) {
        best = { x: nx, y: ny, count };
      }
    }
    return best;
  }

  _unvisitedNeighbors(edgeMask, visited, width, height, x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const i = ny * width + nx;
        if (edgeMask[i] && !visited[i]) count++;
      }
    }
    return count;
  }

  _withBounds(points) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { points, minX, minY, maxX, maxY };
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all ContourBuilder tests green.

- [ ] **Step 5: Commit**

```bash
git add src/ContourBuilder.js tests/contour-builder.test.js
git commit -m "feat: link edge pixels into ordered contour strokes"
```

---

### Task 6: StrokePlanner

**Files:**
- Create: `src/StrokePlanner.js`
- Test: `tests/stroke-planner.test.js`

**Interfaces:**
- Produces: `StrokePlanner` constructor `{ maxSegmentPoints = 600 }`; method `plan({ strokes, width, height })` → `PenCommand[]`, each `{ type: 'down'|'move', x, y }` with integer coordinates. Sort is top-to-bottom by bounding-box center. Consumed by `CursorPlayer` (Task 7).

- [ ] **Step 1: Write the failing test**

`tests/stroke-planner.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { StrokePlanner } from '../src/StrokePlanner.js';

function bounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  return { points, minX, minY, maxX, maxY };
}

test('sorts strokes top-to-bottom by center Y, then center X', () => {
  const planner = new StrokePlanner();
  const strokeA = bounds([{ x: 4, y: 40 }, { x: 10, y: 50 }]); // centerY 45
  const strokeB = bounds([{ x: 4, y: 0 }, { x: 10, y: 10 }]); // centerY 5
  const commands = planner.plan({ strokes: [strokeA, strokeB], width: 100, height: 100 });
  assert.equal(commands[0].type, 'down');
  assert.equal(commands[0].y, 0); // top stroke first
});

test('starts each stroke with a down command then moves', () => {
  const planner = new StrokePlanner();
  const stroke = bounds([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }]);
  const commands = planner.plan({ strokes: [stroke], width: 100, height: 100 });
  assert.deepEqual(commands, [
    { type: 'down', x: 0, y: 0 },
    { type: 'move', x: 5, y: 0 },
    { type: 'move', x: 10, y: 0 },
  ]);
});

test('splits a long stroke into segments at maxSegmentPoints', () => {
  const planner = new StrokePlanner({ maxSegmentPoints: 50 });
  const points = [];
  for (let x = 0; x <= 100; x++) points.push({ x, y: 0 });
  const stroke = bounds(points);
  const commands = planner.plan({ strokes: [stroke], width: 200, height: 200 });
  const downs = commands.filter((c) => c.type === 'down');
  assert.equal(downs.length, 3); // 101 points -> 3 segments (overlapping by 1)
});

test('clamps out-of-range coordinates to canvas bounds', () => {
  const planner = new StrokePlanner();
  const stroke = bounds([{ x: -5, y: 0 }, { x: 3000, y: 0 }]);
  const commands = planner.plan({ strokes: [stroke], width: 100, height: 100 });
  assert.equal(commands[0].x, 0);
  assert.equal(commands[1].x, 99);
  assert.equal(commands[1].y, 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../src/StrokePlanner.js`.

- [ ] **Step 3: Write the implementation**

`src/StrokePlanner.js`:

```js
export class StrokePlanner {
  constructor({ maxSegmentPoints = 600 } = {}) {
    this.maxSegmentPoints = maxSegmentPoints;
  }

  plan({ strokes, width, height }) {
    const sorted = strokes.slice().sort((a, b) => {
      const aCy = (a.minY + a.maxY) / 2;
      const bCy = (b.minY + b.maxY) / 2;
      if (aCy !== bCy) return aCy - bCy;
      return (a.minX + a.maxX) / 2 - (b.minX + b.maxX) / 2;
    });
    const commands = [];
    for (const stroke of sorted) {
      this._emitStroke(commands, stroke.points, width, height);
    }
    return commands;
  }

  _emitStroke(commands, points, width, height) {
    const step = this.maxSegmentPoints - 1;
    for (let start = 0; start < points.length; start += step) {
      const segment = points.slice(start, start + this.maxSegmentPoints);
      for (let i = 0; i < segment.length; i++) {
        const x = this._clamp(Math.round(segment[i].x), width);
        const y = this._clamp(Math.round(segment[i].y), height);
        commands.push({ type: i === 0 ? 'down' : 'move', x, y });
      }
    }
  }

  _clamp(v, maxExclusive) {
    return Math.max(0, Math.min(maxExclusive - 1, v));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all StrokePlanner tests green.

- [ ] **Step 5: Commit**

```bash
git add src/StrokePlanner.js tests/stroke-planner.test.js
git commit -m "feat: plan ordered pen commands with top-to-bottom sorting"
```

---

### Task 7: CursorPlayer

**Files:**
- Create: `src/CursorPlayer.js`
- Test: `tests/cursor-player.test.js`

**Interfaces:**
- Consumes: `PenCommand[]` from `StrokePlanner` (`{type:'down'|'move', x, y}` clamped ints) and a `BrushConfig`.
- Produces: `CursorPlayer` constructor `{ ctx, inkCtx, inkCanvas, brush, width, height, speed = 120, raf = null }`; method `play(commands, { onDone } = {})`; method `tick(dtMs)` for manual simulation; fires `onDone()` exactly once after the final command is consumed. `ctx` and `inkCtx` are Canvas 2D contexts; `ink` accumulates the permanent drawing (redrawn each frame onto `ctx` on top of the pen). Consumed by `App` (Task 8).

- [ ] **Step 1: Write the failing test**

`tests/cursor-player.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { CursorPlayer } from '../src/CursorPlayer.js';
import { BrushConfig } from '../src/BrushConfig.js';

function makeMockCtx() {
  const calls = {
    moveTo: [],
    lineTo: [],
    beginPath: 0,
    stroke: 0,
    arc: 0,
    fill: 0,
    clearRect: 0,
    drawImage: 0,
    save: 0,
    restore: 0,
    translate: [],
    rotate: [],
  };
  return {
    calls,
    beginPath() {
      calls.beginPath++;
    },
    moveTo(x, y) {
      calls.moveTo.push([x, y]);
    },
    lineTo(x, y) {
      calls.lineTo.push([x, y]);
    },
    stroke() {
      calls.stroke++;
    },
    arc() {
      calls.arc++;
    },
    fill() {
      calls.fill++;
    },
    clearRect() {
      calls.clearRect++;
    },
    drawImage() {
      calls.drawImage++;
    },
    save() {
      calls.save++;
    },
    restore() {
      calls.restore++;
    },
    translate(x, y) {
      calls.translate.push([x, y]);
    },
    rotate(a) {
      calls.rotate.push(a);
    },
    set lineWidth(v) {},
    set lineCap(v) {},
    set lineJoin(v) {},
    set strokeStyle(v) {},
    set fillStyle(v) {},
  };
}

function makePlayer(raf = null) {
  const ink = makeMockCtx();
  const visible = makeMockCtx();
  return {
    ink,
    visible,
    player: new CursorPlayer({
      ctx: visible,
      inkCtx: ink,
      inkCanvas: {},
      brush: BrushConfig.presets().cartoon,
      width: 200,
      height: 200,
      speed: 200,
      raf,
    }),
  };
}

test('draws a single stroke and fires onDone once', () => {
  const { ink, player } = makePlayer();
  let doneCount = 0;
  const commands = [
    { type: 'down', x: 10, y: 10 },
    { type: 'move', x: 110, y: 10 },
  ];
  player.play(commands, { onDone: () => doneCount++ });
  player.tick(1000);
  assert.equal(doneCount, 1);
  assert.equal(ink.calls.lineTo.length, 1);
  assert.ok(ink.calls.arc >= 1, 'pen-down should stamp a dot');
});

test('lifts the pen (no ink) while flying between strokes', () => {
  const { ink, player } = makePlayer();
  const commands = [
    { type: 'down', x: 0, y: 0 },
    { type: 'move', x: 0, y: 50 },
    { type: 'down', x: 100, y: 50 },
    { type: 'move', x: 100, y: 0 },
  ];
  player.play(commands, {});
  player.tick(1000);
  assert.equal(ink.calls.lineTo.length, 2, 'only the two inked segments are stroked');
  const fly = ink.calls.lineTo.find(
    ([x0, y0]) => Math.abs(x0 - 0) < 0.5 && Math.abs(y0 - 50) < 0.5,
  );
  assert.ok(!fly, 'no ink between (0,50) and (100,50)');
});

test('onDone fires exactly once even with repeated ticks', () => {
  const { player } = makePlayer();
  let doneCount = 0;
  const commands = [
    { type: 'down', x: 5, y: 5 },
    { type: 'move', x: 55, y: 5 },
  ];
  player.play(commands, { onDone: () => doneCount++ });
  for (let i = 0; i < 10; i++) player.tick(1000);
  assert.equal(doneCount, 1);
});

test('uses a raf scheduler when provided and stops the loop on cancel', () => {
  let rafCallback = null;
  const raf = (cb) => {
    rafCallback = cb;
  };
  const { player } = makePlayer(raf);
  const commands = [
    { type: 'down', x: 5, y: 5 },
    { type: 'move', x: 55, y: 5 },
  ];
  let doneCount = 0;
  player.play(commands, { onDone: () => doneCount++ });
  assert.ok(rafCallback, 'raf should be scheduled');
  rafCallback(100); // first frame: dt=0 (lastTime is null)
  rafCallback(10100); // dt=10000ms at 200px/s = 2000px, enough to finish ~57px path
  assert.ok(doneCount >= 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `ERR_MODULE_NOT_FOUND` for `../src/CursorPlayer.js`.

- [ ] **Step 3: Write the implementation**

`src/CursorPlayer.js`:

```js
export class CursorPlayer {
  constructor({
    ctx,
    inkCtx,
    inkCanvas,
    brush,
    width,
    height,
    speed = 120,
    raf = null,
  }) {
    this.ctx = ctx;
    this.inkCtx = inkCtx;
    this.inkCanvas = inkCanvas;
    this.brush = brush;
    this.width = width;
    this.height = height;
    this.speed = speed;
    this.raf = raf;

    this.commands = [];
    this.onDone = null;
    this.cursor = { x: 0, y: 0 };
    this.target = null;
    this.ink = false;
    this.index = 0;
    this.done = false;
    this._inkDistance = 0;
    this._lastAngle = 0;
    this._lastTime = null;
    this._finished = false;
    this._rafId = null;

    this.inkCtx.lineWidth = brush.width;
    this.inkCtx.lineCap = brush.cap;
    this.inkCtx.lineJoin = 'round';
    this.inkCtx.strokeStyle = '#000';
    this.inkCtx.fillStyle = '#000';
  }

  play(commands, { onDone } = {}) {
    this.commands = commands;
    this.onDone = onDone || null;
    this.cursor = { x: 0, y: 0 };
    this.target = null;
    this.ink = false;
    this.index = 0;
    this.done = false;
    this._inkDistance = 0;
    this._lastAngle = 0;
    this._lastTime = null;
    this._finished = false;
    this._prepNext();
    if (this.raf) {
      this._rafId = this.raf((t) => this._frame(t));
    }
    this.tick(0);
  }

  cancel() {
    this._finished = true;
  }

  _frame(now) {
    if (this._finished) return;
    const dt = this._lastTime === null ? 0 : now - this._lastTime;
    this._lastTime = now;
    this.tick(dt);
    if (this._finished) return;
    this._rafId = this.raf((t) => this._frame(t));
  }

  tick(dtMs) {
    if (this.done && this._finished) return;
    let remaining = (this.speed * dtMs) / 1000;
    let guard = 0;
    while (remaining > 0 && !this.done && guard++ < 100000) {
      if (!this.target) {
        this._prepNext();
        continue;
      }
      const dx = this.target.x - this.cursor.x;
      const dy = this.target.y - this.cursor.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= remaining) {
        this._move(this.target.x, this.target.y);
        remaining -= dist;
        this.index++;
        if (this.index >= this.commands.length) this.done = true;
        this.target = null;
        if (this._downAtCurrent) {
          this._downAtCurrent = false;
          this.ink = true;
          this._dot(this.cursor.x, this.cursor.y);
        }
        this._prepNext();
      } else {
        const r = remaining;
        this._move(this.cursor.x + (dx / dist) * r, this.cursor.y + (dy / dist) * r);
        remaining = 0;
      }
    }
    this._paintFrame();
    if (this.done && !this._finished) {
      this._finished = true;
      if (this.onDone) this.onDone();
    }
  }

  _prepNext() {
    if (this.index >= this.commands.length) {
      this.done = true;
      this.target = null;
      return;
    }
    const cmd = this.commands[this.index];
    this._downAtCurrent = false;
    if (cmd.type === 'down') {
      if (this.cursor.x === cmd.x && this.cursor.y === cmd.y) {
        this.ink = true;
        this._dot(cmd.x, cmd.y);
        this.index++;
        this._prepNext();
      } else {
        this.ink = false;
        this.target = { x: cmd.x, y: cmd.y };
        this._downAtCurrent = true;
      }
    } else {
      this.ink = true;
      this.target = { x: cmd.x, y: cmd.y };
    }
  }

  _move(x, y) {
    const dx = x - this.cursor.x;
    const dy = y - this.cursor.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (this.ink) this._inkLine(this.cursor.x, this.cursor.y, x, y, dist);
    if (dx !== 0 || dy !== 0) this._lastAngle = Math.atan2(dy, dx);
    this.cursor = { x, y };
  }

  _inkLine(x0, y0, x1, y1, dist) {
    const nx = -(y1 - y0) / dist;
    const ny = (x1 - x0) / dist;
    const base = (this.brush.passes - 1) / 2;
    for (let p = 0; p < this.brush.passes; p++) {
      const passOffset = (p - base) * 0.6;
      const jA = Math.sin(this._inkDistance * 0.12) * this.brush.jitter + passOffset;
      const jB = Math.sin((this._inkDistance + dist) * 0.12) * this.brush.jitter + passOffset;
      this.inkCtx.beginPath();
      this.inkCtx.moveTo(x0 + nx * jA, y0 + ny * jA);
      this.inkCtx.lineTo(x1 + nx * jB, y1 + ny * jB);
      this.inkCtx.stroke();
    }
    this._inkDistance += dist;
  }

  _dot(x, y) {
    this.inkCtx.beginPath();
    this.inkCtx.arc(x, y, this.brush.width / 2, 0, Math.PI * 2);
    this.inkCtx.fill();
  }

  _paintFrame() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    if (this.inkCanvas) this.ctx.drawImage(this.inkCanvas, 0, 0);
    this.ctx.save();
    this.ctx.translate(this.cursor.x, this.cursor.y);
    this.ctx.rotate(this._lastAngle);
    this.ctx.beginPath();
    this.ctx.moveTo(6, 0);
    this.ctx.lineTo(-4, -4);
    this.ctx.lineTo(-4, 4);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all CursorPlayer tests green.

- [ ] **Step 5: Commit**

```bash
git add src/CursorPlayer.js tests/cursor-player.test.js
git commit -m "feat: animate a pen cursor drawing commands onto an ink layer"
```

---

### Task 8: App wiring, UI, and manual verification

**Files:**
- Create: `index.html`
- Create: `styles.css`
- Create: `src/App.js`

**Interfaces:**
- Consumes: `ImageLoader`, `EdgeDetector` (`detect({gray,width,height})` → `{edgeMask,...}`), `ContourBuilder` (`build({edgeMask,width,height})` → strokes), `StrokePlanner` (`plan({strokes,width,height})` → commands), `CursorPlayer` (`play(commands, {onDone})`), `BrushConfig.presets()`.

- [ ] **Step 1: Write `index.html`**

`index.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Auto Doodler</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main>
    <h1>Auto Doodler</h1>
    <div class="controls">
      <input id="file-input" type="file" accept="image/*" />
      <label for="style-select">Style</label>
      <select id="style-select">
        <option value="cartoon">Cartoon</option>
        <option value="doodle">Doodle</option>
        <option value="sketch">Sketch</option>
      </select>
      <button id="start-btn" disabled>Start Drawing</button>
      <button id="download-btn" disabled>Download PNG</button>
    </div>
    <div id="status">Upload an image to begin.</div>
    <canvas id="draw-canvas"></canvas>
  </main>
  <script type="module">
    import { App } from './src/App.js';
    new App();
  </script>
</body>
</html>
```

- [ ] **Step 2: Write `styles.css`**

`styles.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, sans-serif;
  background: #f4f4f4;
  color: #222;
}

main {
  max-width: 960px;
  margin: 0 auto;
  padding: 1.5rem;
}

h1 {
  font-size: 1.4rem;
  margin: 0 0 1rem;
}

.controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
  margin-bottom: 0.75rem;
}

#status {
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  color: #555;
  min-height: 1.2em;
}

#draw-canvas {
  max-width: 100%;
  height: auto;
  background: #fff;
  border: 1px solid #ddd;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 3: Write `src/App.js`**

`src/App.js`:

```js
import { ImageLoader } from './ImageLoader.js';
import { EdgeDetector } from './EdgeDetector.js';
import { ContourBuilder } from './ContourBuilder.js';
import { StrokePlanner } from './StrokePlanner.js';
import { CursorPlayer } from './CursorPlayer.js';
import { BrushConfig } from './BrushConfig.js';

export class App {
  constructor() {
    this.fileInput = document.getElementById('file-input');
    this.styleSelect = document.getElementById('style-select');
    this.startBtn = document.getElementById('start-btn');
    this.downloadBtn = document.getElementById('download-btn');
    this.statusEl = document.getElementById('status');
    this.canvas = document.getElementById('draw-canvas');

    this.imageLoader = new ImageLoader();
    this.edgeDetector = new EdgeDetector();
    this.contourBuilder = new ContourBuilder();
    this.strokePlanner = new StrokePlanner();
    this.current = null;
    this.ctx = null;
    this._playing = false;

    this.fileInput.addEventListener('change', () => this._onFile());
    this.startBtn.addEventListener('click', () => this._onStart());
    this.downloadBtn.addEventListener('click', () => this._onDownload());
  }

  async _onFile() {
    const file = this.fileInput.files[0];
    if (!file) return;
    this.statusEl.textContent = 'Loading image…';
    try {
      this.current = await this.imageLoader.load(file);
      this.canvas.width = this.current.width;
      this.canvas.height = this.current.height;
      this.ctx = this.canvas.getContext('2d');
      this.ctx.fillStyle = '#fff';
      this.ctx.fillRect(0, 0, this.current.width, this.current.height);
      this.startBtn.disabled = false;
      this.downloadBtn.disabled = true;
      this.statusEl.textContent = 'Ready. Pick a style and press Start Drawing.';
    } catch (err) {
      this.statusEl.textContent = err.message || 'Could not load image.';
    }
  }

  _onStart() {
    if (!this.current || this._playing) return;
    this._playing = true;
    this.startBtn.disabled = true;
    this.statusEl.textContent = 'Drawing…';
    const { gray, width, height } = this.current;
    setTimeout(() => {
      const { edgeMask } = this.edgeDetector.detect({ gray, width, height });
      const strokes = this.contourBuilder.build({ edgeMask, width, height });
      if (strokes.length === 0) {
        this._playing = false;
        this.startBtn.disabled = false;
        this.statusEl.textContent = 'No edges found. Try another image.';
        return;
      }
      const commands = this.strokePlanner.plan({ strokes, width, height });
      const inkCanvas = document.createElement('canvas');
      inkCanvas.width = width;
      inkCanvas.height = height;
      this._player = new CursorPlayer({
        ctx: this.ctx,
        inkCtx: inkCanvas.getContext('2d'),
        inkCanvas,
        brush: BrushConfig.presets()[this.styleSelect.value] ?? BrushConfig.presets().cartoon,
        width,
        height,
        speed: 120,
        raf: (cb) => requestAnimationFrame(cb),
      });
      this._player.play(commands, {
        onDone: () => {
          this._playing = false;
          this.downloadBtn.disabled = false;
          this.statusEl.textContent = 'Done! Download your drawing.';
        },
      });
    }, 0);
  }

  _onDownload() {
    this.canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'doodle.png';
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }
}
```

- [ ] **Step 4: Run the unit tests (regression check)**

Run: `npm test`
Expected: PASS — all tests across all tasks still green.

- [ ] **Step 5: Manually verify in the browser**

Run: `npm start` then open `http://localhost:8080` in a browser.

Verify:
1. Page renders "Auto Doodler", an upload input, style select (Cartoon/Doodle/Sketch), disabled Start and Download buttons.
2. Upload a JPEG/PNG photo. Status shows "Ready…" and Start becomes enabled.
3. Click Start. The pen cursor flies to the first stroke, draws line-art top-to-bottom, lifts between strokes. No progress UI appears.
4. A blank image upload shows "No edges found. Try another image." and Start re-enables.
5. After drawing completes, Download PNG is enabled and produces a black-on-white PNG.
6. Each of the three styles draws (cartoon = bold smooth, doodle = wobbly, sketch = thin hashed). Stop the dev server when finished.

- [ ] **Step 6: Commit**

```bash
git add index.html styles.css src/App.js
git commit -m "feat: wire the drawing pipeline into the browser UI"
```

---

## Self-Review Notes

- **Spec coverage:** ImageLoader (T3), EdgeDetector (T4), ContourBuilder (T5), StrokePlanner (T6), BrushConfig (T2), CursorPlayer (T7), App/DOM/Download (T8). Style switch, no-progress one-shot drawing, top-to-bottom order, error text, and download all have explicit tasks. Testing approach matches the spec (`node:test`).
- **Placeholder scan:** no TBD/TODO; every step has exact code and expected output.
- **Type consistency:** `StrokePlanner.plan({strokes,width,height})` → `{type,x,y}[]` used identically by `CursorPlayer.play`; `BrushConfig.presets()[style]` keys match the `<select>` option values (`cartoon`, `doodle`, `sketch`); `ImageLoader.load()` returns `{gray,width,height}` consumed by `EdgeDetector.detect`.