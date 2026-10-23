// Formats d'import acceptés. Certains (HEIC, MOV, MKV, AVI…) sont convertis par le serveur en JPEG / MP4.
export type MediaKind = 'image' | 'video' | 'audio';

const byExtension: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', jfif: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif',
  heic: 'image/heic', heif: 'image/heif', hif: 'image/heif', bmp: 'image/bmp', tif: 'image/tiff', tiff: 'image/tiff',
  mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', qt: 'video/quicktime', webm: 'video/webm',
  mkv: 'video/x-matroska', avi: 'video/x-msvideo', '3gp': 'video/3gpp', '3gpp': 'video/3gpp',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
};

const aliases: Record<string, string> = {
  'image/jpg': 'image/jpeg', 'image/pjpeg': 'image/jpeg', 'image/heic-sequence': 'image/heic', 'image/heif-sequence': 'image/heif',
  'image/x-ms-bmp': 'image/bmp', 'video/x-m4v': 'video/mp4', 'video/matroska': 'video/x-matroska', 'video/avi': 'video/x-msvideo',
  'video/msvideo': 'video/x-msvideo', 'audio/x-m4a': 'audio/mp4', 'audio/m4a': 'audio/mp4', 'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav', 'audio/mp3': 'audio/mpeg', 'audio/x-flac': 'audio/flac', 'audio/x-aac': 'audio/aac',
};

const allowed: Record<MediaKind, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'image/heic', 'image/heif', 'image/bmp', 'image/tiff'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/x-msvideo', 'video/3gpp'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/aac', 'audio/flac'],
};

/** Valeur de l'attribut accept : types MIME et extensions (certains navigateurs ne connaissent pas .heic ou .mov). */
export const acceptAttribute: Record<MediaKind, string> = {
  image: [...allowed.image, '.heic', '.heif', '.avif', '.bmp', '.tif', '.tiff'].join(','),
  video: [...allowed.video, '.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi', '.3gp'].join(','),
  audio: [...allowed.audio, '.mp3', '.m4a', '.aac', '.wav', '.ogg', '.flac'].join(','),
};

/** Type MIME normalisé du fichier (d'après son type, sinon son extension), ou null s'il n'est pas pris en charge pour ce bloc. */
export function resolveMediaType(file: File, kind: MediaKind): string | null {
  const declared = file.type.toLowerCase().split(';')[0].trim();
  const extension = file.name.includes('.') ? file.name.split('.').pop()!.toLowerCase() : '';
  const candidates = [aliases[declared] ?? declared, byExtension[extension]];
  return candidates.find((type): type is string => !!type && allowed[kind].includes(type)) ?? null;
}

/** Même fichier, avec le type MIME à envoyer au serveur. */
export function withMediaType(file: File, type: string): File {
  return file.type === type ? file : new File([file], file.name, { type, lastModified: file.lastModified });
}
