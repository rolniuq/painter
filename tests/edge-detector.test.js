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
