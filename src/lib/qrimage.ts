import QRCode from 'qrcode';
import jsQR from 'jsqr';

export function qrDataUrl(text: string, size = 360): Promise<string> {
  return QRCode.toDataURL(text, { errorCorrectionLevel: 'M', margin: 2, width: size, color: { dark: '#07080F', light: '#FFFFFF' } });
}

/** Decodes a QR from any drawable source, trying a few scales for robustness. */
export function decodeFromSource(src: CanvasImageSource, w: number, h: number): string | null {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  for (const max of [1000, 700, 450]) {
    const k = Math.min(1, max / Math.max(w, h));
    canvas.width = Math.max(1, Math.round(w * k)); canvas.height = Math.max(1, Math.round(h * k));
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const r = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
    if (r?.data) return r.data;
  }
  return null;
}

export function decodeFromUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(decodeFromSource(img, img.naturalWidth, img.naturalHeight));
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export function decodeFromFile(file: File): Promise<string | null> {
  return new Promise((resolve) => {
    if (!file.type.startsWith('image/') || file.size > 8 * 1024 * 1024) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => decodeFromUrl(String(reader.result)).then(resolve);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}
