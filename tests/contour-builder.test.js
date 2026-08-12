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
  const builder = new ContourBuilder({ minStrokeLength: 3 });
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