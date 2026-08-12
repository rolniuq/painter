export class StrokePlanner {
  constructor({ maxSegmentPoints = 600 } = {}) {
    this.maxSegmentPoints = maxSegmentPoints;
  }

  plan({ strokes, width, height }) {
    const sorted = strokes.slice().sort((a, b) => {
      const aCy = (a.minY + a.maxY) / 2;
      const bCy = (b.minY + b.maxY) / 2;
      if (aCy !== bCy) return aCy - bCy;
      return (a.minX + a.maxX) / 2 - (b.minX + b.maxX) / 2;
    });
    const commands = [];
    for (const stroke of sorted) {
      this._emitStroke(commands, stroke.points, width, height);
    }
    return commands;
  }

  _emitStroke(commands, points, width, height) {
    const step = this.maxSegmentPoints - 1;
    for (let start = 0; start < points.length; start += step) {
      const segment = points.slice(start, start + this.maxSegmentPoints);
      for (let i = 0; i < segment.length; i++) {
        const x = this._clamp(Math.round(segment[i].x), width);
        const y = this._clamp(Math.round(segment[i].y), height);
        commands.push({ type: i === 0 ? "down" : "move", x, y });
      }
    }
  }

  _clamp(v, maxExclusive) {
    return Math.max(0, Math.min(maxExclusive - 1, v));
  }
}
