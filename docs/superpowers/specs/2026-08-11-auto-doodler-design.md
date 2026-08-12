# Auto-Doodler — Design Specification

Date: 2026-08-11

## Overview

A web app where the user uploads an image from disk. The app detects the image's edges entirely client-side, then an autonomous pen-shaped cursor walks a blank white canvas and hand-draws a black-on-white line-art version of the photo. Drawing is one-shot: no playback controls, no progress UI. A Download PNG button becomes available when drawing completes.

## Goals

- Faithful edge trace: final drawing looks like a clean pen-and-ink redraw of the photo.
- Brush styles (doodle, cartoon, sketch) differ only by brush parameters applied to the same stroke data.
- Pure client-side processing — no server, no dependencies, no build step.
- Deterministic and predictable output.

## Non-Goals

- No AI models or neural style transfer.
- No playback controls (play/pause/speed/restart) or per-stroke review.
- No progress bar or stroke counter.
- No color options — always black ink on a white background.
- No editing/drawing tools for the user (this is a passive playback, not an annotation app).

## Architecture

Five ES6 classes, each with a single responsibility, plus one wiring module.

### 1. ImageLoader

- Owns the `<input type="file">` (accepts `image/*`).
- Reads the selected file into an `ImageBitmap`/`Image`.
- Downscales it to fit a fixed maximum canvas (1200px) preserving aspect ratio.
- Exposes `ImageBitmap`, final `{ width, height }`, and raw pixel data via `getImageData`.

### 2. EdgeDetector

- Input: grayscale pixel array + dimensions.
- Runs a custom Canny pipeline:
  1. Gaussian blur.
  2. Sobel gradients (magnitude + direction).
  3. Non-maximum suppression.
  4. Hysteresis thresholding.
- Output: binary edge mask (`Uint8Array`, 1 = edge) and a direction map (radians per edge pixel).

### 3. ContourBuilder

- Walks the edge mask and links adjacent edge pixels into connected contours (8-connected).
- Each contour becomes an ordered polyline of points.
- Filters out noise/short contours below a minimum length.
- Output: `Stroke[]` where each stroke is `{ points: {x,y}[], minX, minY, maxX, maxY }`.

### 4. StrokePlanner

- Sorts strokes by bounding-box center y, then center x (top-to-bottom traversal).
- Splits overly long contours into segments (each ≤ 600 points).
- Clamps every coordinate to canvas bounds.
- Output: ordered `PenCommand[]` — `{ type: 'down', x, y }` and `{ type: 'move', x, y }`.

### 5. CursorPlayer

- The animator + renderer.
- Moves the pen cursor along each stroke using a fixed-step speed (canvas px/frame) normalized by `requestAnimationFrame` delta-time, so animation is framerate-independent.
- Pen down: draws black ink. Pen up: lifts between strokes — the cursor flies to the next stroke start without inking.
- Renders a simple 2D pen/triangle graphic rotated to movement angle, with a small semi-transparent tip trail.
- Emits a `done` event when finished.

### 6. App (wiring)

- Owns the DOM: file input, style switch, canvas, status text, Download button.
- Wires the pipeline together: user selects a file → touches the chosen style's brush config → runs pipeline → enables Download PNG (via canvas `toBlob`/`download`).
- Prevents double-starts: "Start Drawing" disabled while drawing and after completion; reset requires re-uploading.

## Data Flow

One-directional, no cycles:

```
User selects file
   │
   ▼
ImageLoader   →  ImageBitmap + {width, height}  (downscaled to ≤ 1200px, aspect preserved)
   │              getImageData → GrayscaleArray (Uint8, w×h)
   ▼
EdgeDetector  →  EdgeMask (Uint8Array, 1=edge) + directionMap (radians per edge pixel)
   ▼
ContourBuilder→  Stroke[] : [{points:[{x,y}...], minX, minY, maxX, maxY}]
   │              (8-connected linking, short strokes dropped)
   ▼
StrokePlanner →  PenCommand[] : [{type:'down'|'move', x, y}]  (sorted top→bottom)
   │              (long strokes split into ≤ 600-pt segments)
   ▼
CursorPlayer  →  renders on <canvas>
   │
   ▼
done event →  App enables "Download PNG" button
```

All processing runs in a single browser thread. Canny and contour building run synchronously but are wrapped in a `setTimeout`/`requestAnimationFrame` step so the UI thread stays responsive.

## Brush Styles

A switch above the canvas lets the user pick the style before drawing. Styles differ only by brush parameters applied to the same stroke data.

| Style   | Width | Jitter | Passes     | Cap   | Character                           |
| ------- | ----- | ------ | ---------- | ----- | ----------------------------------- |
| Doodle  | 2px   | yes    | 1          | round | Playful hand-sketch wobble          |
| Cartoon | 4px   | no     | 1          | round | Bold smooth outlined look (default) |
| Sketch  | 1.5px | slight | 2 (offset) | butt  | Hashed multi-pass pencil feel       |

- Brush params live in a `BrushConfig` object per style: `{ width, jitter, passes, cap }`. Adding a style = adding one config.
- Jitter applies small perpendicular noise per path segment to the ink path.
- Multiple passes draw slightly offset on the same stroke for the hashed sketch look.
- Ink is black (`rgba(0,0,0,1)`); the page is white.

## Error Handling

- **Non-image file** — ImageLoader validates `image/*` and shows an inline status message.
- **Unreadable/corrupt image** — decode wrapped in try/catch → "Couldn't load image" status.
- **Tiny images** — clamped to a minimum processing size (64px) so Canny output stays sane.
- **No edges detected** — ContourBuilder returning zero strokes → "No edges found", Download stays disabled.
- **Very large images** — downscaled to ≤ 1200px before processing to keep memory/time bounded.
- **Off-canvas coordinates** — every stroke coordinate clamped to canvas bounds in StrokePlanner.
- **Double-start** — Start disabled while drawing and after completion.

All errors funnel to a single status text element under the canvas. No separate error UI system.

## Testing

Pure client-side app with classes → unit tests run in Node's built-in `node:test` runner with `node:assert`. Zero extra dependencies.

- **EdgeDetector** — synthetic images (black square on white, diagonal line, circle) → assert edge mask and direction map positions/counts.
- **ContourBuilder** — two disconnected contours stay separate; long path links into one ordered stroke; sub-minimum-length blobs dropped.
- **StrokePlanner** — strokes sort by center-y then center-x; long strokes split; coordinates clamped; output is a valid alternating down/move `PenCommand` sequence.
- **CursorPlayer** — known command list + simulated frames → ink pixels land where expected and `done` fires exactly once.
- **ImageLoader** — aspect-ratio-preserving downscale math; file-type rejection.

No browser automation; visual behavior verified manually.

## Final Approval

This design was presented in sections (Components, Data Flow, Brush Styles, Error Handling, Testing) and approved by the user on 2026-08-11.
