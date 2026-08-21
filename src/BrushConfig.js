export class BrushConfig {
  constructor({ width = 2, jitter = 0, passes = 1, cap = "round" } = {}) {
    this.width = width;
    this.jitter = jitter;
    this.passes = passes;
    this.cap = cap;
  }

  static presets() {
    return {
      doodle: new BrushConfig({
        width: 2,
        jitter: 1.2,
        passes: 1,
        cap: "round",
      }),
      cartoon: new BrushConfig({
        width: 4,
        jitter: 0,
        passes: 1,
        cap: "round",
      }),
      sketch: new BrushConfig({
        width: 1.5,
        jitter: 0.4,
        passes: 2,
        cap: "butt",
      }),
    };
  }

  static SIZE_FACTORS = { thin: 0.6, medium: 1, thick: 1.8 };

  static resolve(style, size) {
    const presets = BrushConfig.presets();
    const base = presets[style] ?? presets.cartoon;
    const factor =
      BrushConfig.SIZE_FACTORS[size] ?? BrushConfig.SIZE_FACTORS.medium;
    return { ...base, width: Math.round(base.width * factor * 10) / 10 };
  }
}
