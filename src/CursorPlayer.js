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
    this.inkCtx.lineJoin = "round";
    this.inkCtx.strokeStyle = "#000";
    this.inkCtx.fillStyle = "#000";
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
        this._move(
          this.cursor.x + (dx / dist) * r,
          this.cursor.y + (dy / dist) * r
        );
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
    if (cmd.type === "down") {
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
      const jA =
        Math.sin(this._inkDistance * 0.12) * this.brush.jitter + passOffset;
      const jB =
        Math.sin((this._inkDistance + dist) * 0.12) * this.brush.jitter +
        passOffset;
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
