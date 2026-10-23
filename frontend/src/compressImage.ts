// Allège une photo avant l'envoi : redimensionnée (2560 px max) puis ré-encodée en WebP.
// Seuls JPG, PNG et WebP sont traités ici ; HEIC, BMP, TIFF… sont convertis par le serveur. En cas de doute (GIF animé, navigateur sans WebP, gain nul, erreur…), le fichier d'origine est conservé.
const MAX_SIDE = 2560;
const QUALITY = 0.85;

export async function compressImage(file: File): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) { bitmap.close(); return file; }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', QUALITY));
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' });
  } catch {
    return file;
  }
}
