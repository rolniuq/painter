import test from "node:test";
import assert from "node:assert/strict";
import { BrushConfig } from "../src/BrushConfig.js";

test("presets exist with expected brush parameters", () => {
  const presets = BrushConfig.presets();
  assert.ok(presets.doodle);
  assert.ok(presets.cartoon);
  assert.ok(presets.sketch);
});

test("cartoon is the thick bold default", () => {
  const { cartoon } = BrushConfig.presets();
  assert.equal(cartoon.width, 4);
  assert.equal(cartoon.jitter, 0);
  assert.equal(cartoon.passes, 1);
  assert.equal(cartoon.cap, "round");
});

test("sketch uses multiple offset passes and a butt cap", () => {
  const { sketch } = BrushConfig.presets();
  assert.equal(sketch.width, 1.5);
  assert.equal(sketch.passes, 2);
  assert.equal(sketch.cap, "butt");
});

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
