/**
 * Creates placeholder PNG icons for development
 *
 * This creates minimal valid PNG files that can be used during development.
 * For production, use generate-icons.js with the sharp library for better quality.
 *
 * Usage: node scripts/create-placeholder-icons.js
 */

import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const iconsDir = join(projectRoot, 'public', 'icons');

// Minimal 1x1 blue PNG as base64 (will be stretched by browser)
// This is a valid PNG file structure
function createMinimalPNG() {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk (image header) - 1x1 pixel, 8-bit RGB
  const ihdrData = Buffer.from([
    0x00, 0x00, 0x00, 0x01, // width: 1
    0x00, 0x00, 0x00, 0x01, // height: 1
    0x08, // bit depth: 8
    0x02, // color type: RGB
    0x00, // compression: deflate
    0x00, // filter: adaptive
    0x00  // interlace: none
  ]);
  const ihdrCrc = crc32(Buffer.concat([Buffer.from('IHDR'), ihdrData]));
  const ihdr = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x0D]), // length: 13
    Buffer.from('IHDR'),
    ihdrData,
    ihdrCrc
  ]);

  // IDAT chunk (image data) - single blue pixel (RGB: 59, 130, 246 = #3b82f6)
  // Compressed with zlib: filter byte (0) + RGB values
  const idatCompressed = Buffer.from([
    0x78, 0x9C, // zlib header
    0x62, 0xBC, 0xF4, 0x60, // compressed data
    0x00, 0x00, 0x00, 0x04, 0x00, 0x01 // checksum
  ]);
  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), idatCompressed]));
  const idat = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, idatCompressed.length]),
    Buffer.from('IDAT'),
    idatCompressed,
    idatCrc
  ]);

  // IEND chunk (image end)
  const iendCrc = crc32(Buffer.from('IEND'));
  const iend = Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x00]), // length: 0
    Buffer.from('IEND'),
    iendCrc
  ]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// CRC32 implementation for PNG chunks
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }

  crc = crc ^ 0xFFFFFFFF;

  return Buffer.from([
    (crc >>> 24) & 0xFF,
    (crc >>> 16) & 0xFF,
    (crc >>> 8) & 0xFF,
    crc & 0xFF
  ]);
}

// Ensure icons directory exists
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

const png = createMinimalPNG();

// Write both icon sizes (browsers will scale the 1x1 pixel)
const sizes = [192, 512];

for (const size of sizes) {
  const outputPath = join(iconsDir, `icon-${size}x${size}.png`);
  writeFileSync(outputPath, png);
  console.log(`Created placeholder: ${outputPath}`);
}

console.log('');
console.log('Placeholder icons created successfully!');
console.log('Note: These are minimal 1x1 pixel PNGs that browsers will scale.');
console.log('For production-quality icons, run: node scripts/generate-icons.js');
console.log('(requires: npm install sharp --save-dev)');
