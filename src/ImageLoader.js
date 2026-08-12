export class ImageLoader {
  constructor({ maxSize = 1200, minSize = 64 } = {}) {
    this.maxSize = maxSize;
    this.minSize = minSize;
  }

  static downscaleDimensions(imgW, imgH, maxSize, minSize) {
    if (!imgW || !imgH) {
      return { width: minSize, height: minSize };
    }
    let scale = Math.min(1, maxSize / Math.max(imgW, imgH));
    if (Math.min(imgW * scale, imgH * scale) < minSize) {
      scale = minSize / Math.min(imgW, imgH);
    }
    scale = Math.min(scale, maxSize / Math.max(imgW, imgH));
    return {
      width: Math.max(1, Math.round(imgW * scale)),
      height: Math.max(1, Math.round(imgH * scale)),
    };
  }

  static isSupportedFile(file) {
    return Boolean(file && typeof file.type === 'string' && file.type.startsWith('image/'));
  }

  static toGrayscale(imageData) {
    const { data, width, height } = imageData;
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    }
    return gray;
  }

  async load(file) {
    if (!ImageLoader.isSupportedFile(file)) {
      throw new Error('Please choose an image file.');
    }
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Could not load image.'));
        img.src = url;
      });
      const { width, height } = ImageLoader.downscaleDimensions(
        img.naturalWidth,
        img.naturalHeight,
        this.maxSize,
        this.minSize,
      );
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const gray = ImageLoader.toGrayscale(ctx.getImageData(0, 0, width, height));
      return { gray, width, height };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}
