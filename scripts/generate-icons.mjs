/** public/icon.svg から各サイズのPNGアイコンを生成する */
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url));

const targets = [
  { file: 'public/icon-512.png', size: 512 },
  { file: 'public/icon-192.png', size: 192 },
  { file: 'public/apple-touch-icon.png', size: 180 },
  { file: 'public/favicon-32.png', size: 32 },
];

for (const { file, size } of targets) {
  await sharp(svg, { density: 300 }).resize(size, size).png().toFile(file);
  console.log(`generated ${file} (${size}x${size})`);
}
