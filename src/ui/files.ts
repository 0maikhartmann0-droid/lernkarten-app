// Dateien lesen und speichern im Browser: Bilder verkleinern, Downloads und Teilen.

/** Kleine Bilder bleiben unverändert, größere werden verkleinert, damit der Gerätespeicher reicht. */
const MAX_BYTES = 300_000;
const MAX_SIDE = 1600;

export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(file.name);
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Datei nicht lesbar'));
    reader.readAsDataURL(blob);
  });
}

export async function imageToDataUri(file: File): Promise<string> {
  if (file.size <= MAX_BYTES || file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return readAsDataUrl(file);
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // PNG kann Transparenz enthalten (Skizzen) – dafür WebP, sonst JPEG.
  return file.type === 'image/png'
    ? canvas.toDataURL('image/webp', 0.85)
    : canvas.toDataURL('image/jpeg', 0.85);
}

export function downloadFile(name: string, content: string, type = 'application/json'): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Teilen-Menü des Geräts (z. B. an OneDrive oder per E-Mail) – nur, wo der Browser Dateien teilen kann. */
export function canShareFiles(): boolean {
  try {
    const probe = new File(['{}'], 'probe.json', { type: 'application/json' });
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [probe] });
  } catch {
    return false;
  }
}

export async function shareFile(
  name: string,
  content: string,
  type = 'application/json',
): Promise<boolean> {
  const file = new File([content], name, { type });
  try {
    await navigator.share({ files: [file], title: name });
    return true;
  } catch {
    // Abgebrochen oder nicht erlaubt
    return false;
  }
}
