import sharp from 'sharp';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');

mkdirSync(iconsDir, { recursive: true });

const primaryColor = '#165dff';
const bgColor = '#ffffff';
const text = '雷犀';

async function generateIcon(size) {
  const fontSize = Math.floor(size * 0.35);
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="${bgColor}" rx="${size * 0.15}"/>
      <rect x="${size * 0.1}" y="${size * 0.1}" width="${size * 0.8}" height="${size * 0.8}" fill="${primaryColor}" rx="${size * 0.1}"/>
      <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" font-family="sans-serif" font-size="${fontSize}" font-weight="bold" fill="white">${text}</text>
    </svg>
  `;

  const outputPath = join(iconsDir, `icon-${size}x${size}.png`);
  await sharp(Buffer.from(svg)).png().toFile(outputPath);
  console.log(`Generated: icon-${size}x${size}.png`);
}

async function main() {
  await generateIcon(192);
  await generateIcon(512);
  console.log('PWA icons generated successfully!');
}

main().catch(console.error);
