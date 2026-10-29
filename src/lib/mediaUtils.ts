/**
 * Utility functions for client-side image compression, thumbnail generation, and audio recording.
 * Compresses receipts on upload and generates cached small thumbnails for list rows.
 */

const thumbnailCache = new Map<string, string>();

export async function compressImageToDataUrl(
  file: File,
  maxDimension = 680,
  quality = 0.68
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image'));
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas 2D context unavailable'));

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        const webpUrl = canvas.toDataURL('image/webp', quality);
        const dataUrl = webpUrl.startsWith('data:image/webp')
          ? webpUrl
          : canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image element'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export async function createThumbnailFromDataUrl(
  srcDataUrl: string,
  size = 72,
  quality = 0.6
): Promise<string> {
  if (!srcDataUrl || !srcDataUrl.startsWith('data:image/')) {
    return srcDataUrl;
  }
  const cacheKey = `${srcDataUrl.slice(0, 64)}_${srcDataUrl.length}_${size}`;
  const cached = thumbnailCache.get(cacheKey);
  if (cached) return cached;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(srcDataUrl);
        return;
      }
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'medium';
      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);

      const thumb = canvas.toDataURL('image/webp', quality);
      const finalThumb = thumb.startsWith('data:image/webp')
        ? thumb
        : canvas.toDataURL('image/jpeg', quality);
      thumbnailCache.set(cacheKey, finalThumb);
      resolve(finalThumb);
    };
    img.onerror = () => resolve(srcDataUrl);
    img.src = srcDataUrl;
  });
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to data URL'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function formatAudioDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}
