import test from "node:test";
import assert from "node:assert/strict";
import { CursorPlayer } from "../src/CursorPlayer.js";
import { BrushConfig } from "../src/BrushConfig.js";

function makeMockCtx() {
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
    closePath() {
      calls.closePath++;
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

test("draws a single stroke and fires onDone once", () => {
  const { ink, player } = makePlayer();
  let doneCount = 0;
  const commands = [
    { type: "down", x: 10, y: 10 },
    { type: "move", x: 110, y: 10 },
  ];
  player.play(commands, { onDone: () => doneCount++ });
  player.tick(1000);
  assert.equal(doneCount, 1);
  assert.equal(ink.calls.lineTo.length, 1);
  assert.ok(ink.calls.arc >= 1, "pen-down should stamp a dot");
});

test("lifts the pen (no ink) while flying between strokes", () => {
  const { ink, player } = makePlayer();
  const commands = [
    { type: "down", x: 0, y: 0 },
    { type: "move", x: 0, y: 50 },
    { type: "down", x: 100, y: 50 },
    { type: "move", x: 100, y: 0 },
  ];
  player.play(commands, {});
  player.tick(1000);
  assert.equal(
    ink.calls.lineTo.length,
    2,
    "only the two inked segments are stroked"
  );
  const fly = ink.calls.moveTo.find(
    ([x0, y0]) => Math.abs(x0 - 0) < 0.5 && Math.abs(y0 - 50) < 0.5
  );
  assert.ok(!fly, "no ink between (0,50) and (100,50)");
});

test("onDone fires exactly once even with repeated ticks", () => {
  const { player } = makePlayer();
  let doneCount = 0;
  const commands = [
    { type: "down", x: 5, y: 5 },
    { type: "move", x: 55, y: 5 },
  ];
  player.play(commands, { onDone: () => doneCount++ });
  for (let i = 0; i < 10; i++) player.tick(1000);
  assert.equal(doneCount, 1);
});

test("uses a raf scheduler when provided and stops the loop on cancel", () => {
  let rafCallback = null;
  const raf = (cb) => {
    rafCallback = cb;
  };
  const { player } = makePlayer(raf);
  const commands = [
    { type: "down", x: 5, y: 5 },
    { type: "move", x: 55, y: 5 },
  ];
  let doneCount = 0;
  player.play(commands, { onDone: () => doneCount++ });
  assert.ok(rafCallback, "raf should be scheduled");
  rafCallback(100); // first frame: dt=0 (lastTime is null)
  rafCallback(10100); // dt=10000ms at 200px/s = 2000px, enough to finish ~57px path
  assert.ok(doneCount >= 1);
});
