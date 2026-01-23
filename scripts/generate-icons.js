/**
 * Icon Generation Script for Lumowski
 *
 * This script generates PNG icons from the SVG source.
 *
 * Prerequisites:
 * - Install sharp: npm install sharp --save-dev
 *
 * Usage:
 * - node scripts/generate-icons.js
 *
 * The script will generate:
 * - public/icons/icon-192x192.png
 * - public/icons/icon-512x512.png
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const projectRoot = join(__dirname, '..');
const iconsDir = join(projectRoot, 'public', 'icons');

// SVG content for the Lumowski "L" logo
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2563eb;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" ry="96" fill="url(#bgGradient)"/>
  <text
    x="256"
    y="360"
    font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    font-size="320"
    font-weight="700"
    fill="white"
    text-anchor="middle"
  >L</text>
</svg>`;

const sizes = [192, 512];

async function generateIcons() {
  try {
    // Dynamically import sharp
    const sharp = (await import('sharp')).default;

    // Ensure icons directory exists
    if (!existsSync(iconsDir)) {
      mkdirSync(iconsDir, { recursive: true });
    }

    for (const size of sizes) {
      const outputPath = join(iconsDir, `icon-${size}x${size}.png`);

      await sharp(Buffer.from(svgContent))
        .resize(size, size)
        .png()
        .toFile(outputPath);

      console.log(`Generated: ${outputPath}`);
    }

    console.log('Icon generation complete!');
  } catch (error) {
    if (error.code === 'ERR_MODULE_NOT_FOUND' || error.message.includes('sharp')) {
      console.error('Error: sharp module not found.');
      console.error('Please install it first: npm install sharp --save-dev');
      console.error('');
      console.error('Alternative: You can manually convert the SVG to PNG using:');
      console.error('- Online tools like https://cloudconvert.com/svg-to-png');
      console.error('- Image editing software like Figma, Sketch, or GIMP');
      console.error('- The SVG source is at: public/icons/icon.svg');
      process.exit(1);
    }
    throw error;
  }
}

generateIcons();
