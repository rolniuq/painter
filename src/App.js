import { ImageLoader } from "./ImageLoader.js";
import { EdgeDetector } from "./EdgeDetector.js";
import { ContourBuilder } from "./ContourBuilder.js";
import { StrokePlanner } from "./StrokePlanner.js";
import { CursorPlayer } from "./CursorPlayer.js";
import { BrushConfig } from "./BrushConfig.js";

export class App {
  constructor() {
    this.fileInput = document.getElementById("file-input");
    this.startBtn = document.getElementById("start-btn");
    this.downloadBtn = document.getElementById("download-btn");
    this.statusEl = document.getElementById("status");
    this.canvas = document.getElementById("draw-canvas");
    this.customColorInput = document.getElementById("custom-color");
    this.speedRange = document.getElementById("speed-range");
    this.speedValue = document.getElementById("speed-value");
    this.shapeBtns = [...document.querySelectorAll("[data-shape]")];
    this.styleBtns = [...document.querySelectorAll("[data-style]")];
    this.swatches = [...document.querySelectorAll("[data-color]")];
    this.sizeBtns = [...document.querySelectorAll("[data-size]")];

    this.imageLoader = new ImageLoader();
    this.edgeDetector = new EdgeDetector();
    this.contourBuilder = new ContourBuilder();
    this.strokePlanner = new StrokePlanner();
    this.current = null;
    this.ctx = null;
    this._playing = false;
    this._statusTimer = null;
    this._options = {
      style: "cartoon",
      shape: "pen",
      color: "#000000",
      size: "medium",
      speed: 120,
    };

    this.fileInput.addEventListener("change", () => this._onFile());
    this.startBtn.addEventListener("click", () => this._onStart());
    this.downloadBtn.addEventListener("click", () => this._onDownload());

    this._bindChoice(this.shapeBtns, "shape");
    this._bindChoice(this.styleBtns, "style");
    this._bindChoice(this.sizeBtns, "size");
    this.swatches.forEach((btn) =>
      btn.addEventListener("click", () => {
        this._options.color = btn.dataset.color;
        this.customColorInput.value = btn.dataset.color;
        this._setSelected(this.swatches, btn);
      })
    );
    this.customColorInput.addEventListener("input", () => {
      this._options.color = this.customColorInput.value;
      this._setSelected(this.swatches, null);
    });
    this.speedRange.addEventListener("input", () => {
      this._options.speed = Number(this.speedRange.value);
      this.speedValue.textContent = this.speedRange.value;
    });
  }

  _bindChoice(buttons, key) {
    buttons.forEach((btn) =>
      btn.addEventListener("click", () => {
        this._options[key] = btn.dataset[key];
        this._setSelected(buttons, btn);
      })
    );
  }

  _setSelected(buttons, active) {
    buttons.forEach((btn) => {
      btn.classList.toggle("selected", btn === active);
      btn.setAttribute("aria-pressed", btn === active ? "true" : "false");
    });
  }

  _setStatus(text, { sticky = false } = {}) {
    clearTimeout(this._statusTimer);
    this.statusEl.textContent = text;
    this.statusEl.classList.remove("hidden");
    if (!sticky) {
      this._statusTimer = setTimeout(
        () => this.statusEl.classList.add("hidden"),
        4000
      );
    }
  }

  async _onFile() {
    const file = this.fileInput.files[0];
    if (!file) return;
    document.querySelector('label[for="file-input"]').title = file.name;
    if (this._player) {
      this._player.cancel();
      this._player = null;
    }
    this._playing = false;
    this._setStatus("Loading image…", { sticky: true });
    try {
      this.current = await this.imageLoader.load(file);
      this.canvas.width = this.current.width;
      this.canvas.height = this.current.height;
      this.ctx = this.canvas.getContext("2d");
      this.ctx.fillStyle = "#fff";
      this.ctx.fillRect(0, 0, this.current.width, this.current.height);
      this.startBtn.disabled = false;
      this.downloadBtn.disabled = true;
      this._setStatus("Ready. Pick a style and press Start Drawing.");
    } catch (err) {
      this._setStatus(err.message || "Could not load image.", { sticky: true });
    }
  }

  _onStart() {
    if (!this.current || this._playing) return;
    this._playing = true;
    this.startBtn.disabled = true;
    this._setStatus("Drawing…", { sticky: true });
    const { gray, width, height } = this.current;
    setTimeout(() => {
      const { edgeMask } = this.edgeDetector.detect({ gray, width, height });
      const strokes = this.contourBuilder.build({ edgeMask, width, height });
      if (strokes.length === 0) {
        this._playing = false;
        this.startBtn.disabled = false;
        this._setStatus("No edges found. Try another image.", { sticky: true });
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
        brush: BrushConfig.resolve(this._options.style, this._options.size),
        color: this._options.color,
        cursorShape: this._options.shape,
        width,
        height,
        speed: this._options.speed,
        raf: (cb) => requestAnimationFrame(cb),
      });
      this._player.play(commands, {
        onDone: () => {
          this._playing = false;
          this.downloadBtn.disabled = false;
          this._setStatus("Done! Download your drawing.");
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
