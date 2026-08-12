export class BrushConfig {
  constructor({ width = 2, jitter = 0, passes = 1, cap = 'round' } = {}) {
    this.width = width;
    this.jitter = jitter;
    this.passes = passes;
    this.cap = cap;
  }

  static presets() {
    return {
      doodle: new BrushConfig({ width: 2, jitter: 1.2, passes: 1, cap: 'round' }),
      cartoon: new BrushConfig({ width: 4, jitter: 0, passes: 1, cap: 'round' }),
      sketch: new BrushConfig({ width: 1.5, jitter: 0.4, passes: 2, cap: 'butt' }),
    };
  }
}
