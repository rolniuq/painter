import { ImageLoader } from "./ImageLoader.js";
import { EdgeDetector } from "./EdgeDetector.js";
import { ContourBuilder } from "./ContourBuilder.js";
import { StrokePlanner } from "./StrokePlanner.js";
import { CursorPlayer } from "./CursorPlayer.js";
import { BrushConfig } from "./BrushConfig.js";

export class App {
  constructor() {
    this.fileInput = document.getElementById("file-input");
    this.styleSelect = document.getElementById("style-select");
    this.startBtn = document.getElementById("start-btn");
    this.downloadBtn = document.getElementById("download-btn");
    this.statusEl = document.getElementById("status");
    this.canvas = document.getElementById("draw-canvas");

    this.imageLoader = new ImageLoader();
    this.edgeDetector = new EdgeDetector();
    this.contourBuilder = new ContourBuilder();
    this.strokePlanner = new StrokePlanner();
    this.current = null;
    this.ctx = null;
    this._playing = false;

    this.fileInput.addEventListener("change", () => this._onFile());
    this.startBtn.addEventListener("click", () => this._onStart());
    this.downloadBtn.addEventListener("click", () => this._onDownload());
  }

  async _onFile() {
    const file = this.fileInput.files[0];
    if (!file) return;
    if (this._player) {
      this._player.cancel();
      this._player = null;
    }
    this._playing = false;
    this.statusEl.textContent = "Loading image…";
    try {
      this.current = await this.imageLoader.load(file);
      this.canvas.width = this.current.width;
      this.canvas.height = this.current.height;
      this.ctx = this.canvas.getContext("2d");
      this.ctx.fillStyle = "#fff";
      this.ctx.fillRect(0, 0, this.current.width, this.current.height);
      this.startBtn.disabled = false;
      this.downloadBtn.disabled = true;
      this.statusEl.textContent =
        "Ready. Pick a style and press Start Drawing.";
    } catch (err) {
      this.statusEl.textContent = err.message || "Could not load image.";
    }
  }

  _onStart() {
    if (!this.current || this._playing) return;
    this._playing = true;
    this.startBtn.disabled = true;
    this.statusEl.textContent = "Drawing…";
    const { gray, width, height } = this.current;
    setTimeout(() => {
      const { edgeMask } = this.edgeDetector.detect({ gray, width, height });
      const strokes = this.contourBuilder.build({ edgeMask, width, height });
      if (strokes.length === 0) {
        this._playing = false;
        this.startBtn.disabled = false;
        this.statusEl.textContent = "No edges found. Try another image.";
        return;
      }
      const commands = this.strokePlanner.plan({ strokes, width, height });
      this._inkCanvas = document.createElement("canvas");
      this._inkCanvas.width = width;
      this._inkCanvas.height = height;
      this._player = new CursorPlayer({
        ctx: this.ctx,
        inkCtx: this._inkCanvas.getContext("2d"),
        inkCanvas: this._inkCanvas,
        brush:
          BrushConfig.presets()[this.styleSelect.value] ??
          BrushConfig.presets().cartoon,
        width,
        height,
        speed: 120,
        raf: (cb) => requestAnimationFrame(cb),
      });
      this._player.play(commands, {
        onDone: () => {
          this._playing = false;
          this.downloadBtn.disabled = false;
          this.statusEl.textContent = "Done! Download your drawing.";
        },
      });
    }, 0);
  }

  _onDownload() {
    if (!this.ctx || !this._inkCanvas) return;
    this.ctx.fillStyle = "#fff";
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.drawImage(this._inkCanvas, 0, 0);
    this.canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "doodle.png";
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }
}
