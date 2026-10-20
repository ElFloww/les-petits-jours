import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = resolve(root, 'Planche d’autocollants aux expressions variées.png');
const output = resolve(root, 'frontend', 'public', 'stickers');
// A little padding preserves the antialiased edges of the original transparent image.
const crops = [
  ['sourire', 27, 13, 209, 272], ['clin-oeil', 271, 17, 218, 274],
  ['rire', 522, 11, 217, 269], ['surprise', 786, 15, 199, 284],
  ['sceptique', 1037, 12, 206, 275], ['bisou', 1290, 11, 216, 263],
  ['langue', 24, 285, 211, 265], ['bouderie', 278, 283, 201, 255],
  ['grrr', 527, 284, 196, 269], ['reflexion', 761, 291, 244, 283],
  ['lunettes-noires', 1043, 286, 217, 261], ['baiser', 1300, 291, 222, 279],
  ['chapeau', 14, 548, 247, 243], ['joues-gonflees', 302, 546, 191, 244],
  ['chut', 541, 550, 194, 244], ['grimace', 785, 553, 218, 240],
  ['pikachu', 1023, 541, 230, 254], ['larmes', 1294, 564, 211, 232],
  ['lunettes-bleues', 31, 786, 195, 227], ['burger', 288, 781, 264, 243],
  ['malice', 537, 789, 203, 222], ['mousse', 795, 790, 204, 224],
  ['cri', 1057, 793, 197, 231], ['zen', 1298, 795, 211, 219],
];

function keepMainComponent(data, width, height) {
  const visited = new Uint8Array(width * height);
  let largest = [];
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || data[start * 4 + 3] < 128) continue;
    const pixels = [start];
    visited[start] = 1;
    for (let i = 0; i < pixels.length; i++) {
      const p = pixels[i], x = p % width, y = Math.floor(p / width);
      for (const n of [x > 0 ? p - 1 : -1, x < width - 1 ? p + 1 : -1, y > 0 ? p - width : -1, y < height - 1 ? p + width : -1]) {
        if (n >= 0 && !visited[n] && data[n * 4 + 3] >= 128) { visited[n] = 1; pixels.push(n); }
      }
    }
    if (pixels.length > largest.length) largest = pixels;
  }
  const mask = new Uint8Array(width * height);
  for (const p of largest) {
    const x = p % width, y = Math.floor(p / width);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      if (x + dx >= 0 && x + dx < width && y + dy >= 0 && y + dy < height)
        mask[(y + dy) * width + x + dx] = 1;
    }
  }
  for (let p = 0; p < mask.length; p++) if (!mask[p]) data[p * 4 + 3] = 0;
  return data;
}

await mkdir(output, { recursive: true });
const contact = [];
for (const [name, left, top, width, height] of crops) {
  let image = sharp(source).extract({ left, top, width, height });
  // The thinking hand touches the next head in the source: separate their shared edge.
  if (name === 'reflexion' || name === 'grimace') {
    const shape = name === 'reflexion'
      ? `M0 0H244V283H205L181 269L156 262L116 259H0Z`
      : `M0 50L20 22L50 7L80 0L100 3L126 14L153 26L174 40L218 50V240H0Z`;
    image = image.composite([{ input: Buffer.from(`<svg width="${width}" height="${height}"><path d="${shape}" fill="white"/></svg>`), blend: 'dest-in' }]);
  }
  const raw = await image.ensureAlpha().raw().toBuffer();
  const buffer = await sharp(keepMainComponent(raw, width, height), { raw: { width, height, channels: 4 } }).resize({
    width: 300, height: 300, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 },
  }).webp({ quality: 90 }).toBuffer();
  await writeFile(resolve(output, `${name}.webp`), buffer);
  contact.push({ input: await sharp(buffer).resize(150, 150).toBuffer(), left: (contact.length % 6) * 150, top: Math.floor(contact.length / 6) * 150 });
}
await sharp({ create: { width: 900, height: 600, channels: 3, background: '#faf7ef' } })
  .composite(contact).webp({ quality: 90 }).toFile(resolve(output, 'contact-sheet.webp'));
console.log(`Exported ${crops.length} expressions; original unchanged.`);
