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
