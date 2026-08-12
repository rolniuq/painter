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
