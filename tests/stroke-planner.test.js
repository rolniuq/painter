import test from "node:test";
import assert from "node:assert/strict";
import { StrokePlanner } from "../src/StrokePlanner.js";

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

test("sorts strokes top-to-bottom by center Y, then center X", () => {
  const planner = new StrokePlanner();
  const strokeA = bounds([
    { x: 4, y: 40 },
    { x: 10, y: 50 },
  ]); // centerY 45
  const strokeB = bounds([
    { x: 4, y: 0 },
    { x: 10, y: 10 },
  ]); // centerY 5
  const commands = planner.plan({
    strokes: [strokeA, strokeB],
    width: 100,
    height: 100,
  });
  assert.equal(commands[0].type, "down");
  assert.equal(commands[0].y, 0); // top stroke first
});

test("starts each stroke with a down command then moves", () => {
  const planner = new StrokePlanner();
  const stroke = bounds([
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 10, y: 0 },
  ]);
  const commands = planner.plan({ strokes: [stroke], width: 100, height: 100 });
  assert.deepEqual(commands, [
    { type: "down", x: 0, y: 0 },
    { type: "move", x: 5, y: 0 },
    { type: "move", x: 10, y: 0 },
  ]);
});

test("splits a long stroke into segments at maxSegmentPoints", () => {
  const planner = new StrokePlanner({ maxSegmentPoints: 50 });
  const points = [];
  for (let x = 0; x <= 100; x++) points.push({ x, y: 0 });
  const stroke = bounds(points);
  const commands = planner.plan({ strokes: [stroke], width: 200, height: 200 });
  const downs = commands.filter((c) => c.type === "down");
  assert.equal(downs.length, 3); // 101 points -> 3 segments (overlapping by 1)
});

test("clamps out-of-range coordinates to canvas bounds", () => {
  const planner = new StrokePlanner();
  const stroke = bounds([
    { x: -5, y: 0 },
    { x: 3000, y: 0 },
  ]);
  const commands = planner.plan({ strokes: [stroke], width: 100, height: 100 });
  assert.equal(commands[0].x, 0);
  assert.equal(commands[1].x, 99);
  assert.equal(commands[1].y, 0);
});
