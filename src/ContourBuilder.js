export class ContourBuilder {
  constructor({ minStrokeLength = 10 } = {}) {
    this.minStrokeLength = minStrokeLength;
  }

  build({ edgeMask, width, height }) {
    const visited = new Uint8Array(width * height);
    const strokes = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (!edgeMask[i] || visited[i]) continue;
        const points = this._trace(edgeMask, visited, width, height, x, y);
        if (points.length >= this.minStrokeLength) {
          strokes.push(this._withBounds(points));
        }
      }
    }
    return strokes;
  }

  _trace(edgeMask, visited, width, height, x0, y0) {
    const points = [];
    let x = x0;
    let y = y0;
    const guard = width * height;
    for (let g = 0; g < guard; g++) {
      if (!edgeMask[y * width + x] || visited[y * width + x]) break;
      visited[y * width + x] = 1;
      points.push({ x, y });
      const next = this._next(edgeMask, visited, width, height, x, y);
      if (!next) break;
      x = next.x;
      y = next.y;
    }
    return points;
  }

  _next(edgeMask, visited, width, height, x, y) {
    let best = null;
    for (const [dx, dy] of [
      [-1, -1],
      [0, -1],
      [1, -1],
      [-1, 0],
      [1, 0],
      [-1, 1],
      [0, 1],
      [1, 1],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const i = ny * width + nx;
      if (!edgeMask[i] || visited[i]) continue;
      const count = this._unvisitedNeighbors(
        edgeMask,
        visited,
        width,
        height,
        nx,
        ny
      );
      if (!best || count < best.count) {
        best = { x: nx, y: ny, count };
      }
    }
    return best;
  }

  _unvisitedNeighbors(edgeMask, visited, width, height, x, y) {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const i = ny * width + nx;
        if (edgeMask[i] && !visited[i]) count++;
      }
    }
    return count;
  }

  _withBounds(points) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    return { points, minX, minY, maxX, maxY };
  }
}
