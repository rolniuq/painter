export class EdgeDetector {
  constructor({ low = 0.1, high = 0.3 } = {}) {
    this.low = low;
    this.high = high;
  }

  detect({ gray, width, height }) {
    const size = width * height;
    const blurred = this._gaussianBlur(gray, width, height);

    const mag = new Float32Array(size);
    const dir = new Float32Array(size);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const gx =
          -blurred[i - width - 1] - 2 * blurred[i - 1] - blurred[i + width - 1] +
          blurred[i - width + 1] + 2 * blurred[i + 1] + blurred[i + width + 1];
        const gy =
          -blurred[i - width - 1] - 2 * blurred[i - width] - blurred[i - width + 1] +
          blurred[i + width - 1] + 2 * blurred[i + width] + blurred[i + width + 1];
        mag[i] = Math.hypot(gx, gy);
        dir[i] = Math.atan2(gy, gx);
      }
    }

    const suppressed = this._nonMaxSuppress(mag, dir, width, height);

    let maxMag = 0;
    for (let i = 0; i < size; i++) {
      if (suppressed[i] > maxMag) maxMag = suppressed[i];
    }
    if (maxMag <= 0) {
      return { edgeMask: new Uint8Array(size), directions: dir, width, height };
    }

    const highT = maxMag * this.high;
    const lowT = highT * this.low;
    const edgeMask = this._hysteresis(suppressed, highT, lowT, width, height);
    return { edgeMask, directions: dir, width, height };
  }

  _gaussianBlur(src, width, height) {
    const kernel = [1, 4, 6, 4, 1];
    const ksum = 16;
    const tmp = new Float32Array(src.length);
    const out = new Float32Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) {
          const xi = Math.min(width - 1, Math.max(0, x + k));
          s += kernel[k + 2] * src[y * width + xi];
        }
        tmp[y * width + x] = s / ksum;
      }
    }
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let s = 0;
        for (let k = -2; k <= 2; k++) {
          const yi = Math.min(height - 1, Math.max(0, y + k));
          s += kernel[k + 2] * tmp[yi * width + x];
        }
        out[y * width + x] = s / ksum;
      }
    }
    return out;
  }

  _nonMaxSuppress(mag, dir, width, height) {
    const out = new Float32Array(mag.length);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const deg = Math.abs((dir[i] * 180) / Math.PI);
        let a = 0;
        let b = 0;
        if (deg <= 22.5 || deg >= 157.5) {
          a = mag[i - 1];
          b = mag[i + 1];
        } else if (deg <= 67.5) {
          a = mag[i - width - 1];
          b = mag[i + width + 1];
        } else if (deg <= 112.5) {
          a = mag[i - width];
          b = mag[i + width];
        } else {
          a = mag[i - width + 1];
          b = mag[i + width - 1];
        }
        if (mag[i] >= a && mag[i] >= b) out[i] = mag[i];
      }
    }
    return out;
  }

  _hysteresis(suppressed, highT, lowT, width, height) {
    const edge = new Uint8Array(suppressed.length);
    const stack = [];
    for (let i = 0; i < suppressed.length; i++) {
      if (suppressed[i] >= highT) {
        edge[i] = 1;
        stack.push(i);
      }
    }
    while (stack.length) {
      const i = stack.pop();
      const x = i % width;
      const y = Math.floor(i / width);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const j = ny * width + nx;
          if (!edge[j] && suppressed[j] >= lowT) {
            edge[j] = 1;
            stack.push(j);
          }
        }
      }
    }
    return edge;
  }
}