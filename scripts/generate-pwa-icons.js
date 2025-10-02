#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createCanvas } = require('canvas');

const sizes = [72, 96, 128, 144, 152, 180, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('🎨 Generating PWA icons...\n');

sizes.forEach(size => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#0A84FF');
  gradient.addColorStop(1, '#5E5CE6');

  // Draw rounded rectangle background
  const radius = size * 0.234; // 120/512 ratio
  ctx.fillStyle = gradient;
  roundRect(ctx, 0, 0, size, size, radius);
  ctx.fill();

  // Draw terminal prompt ">"
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = size * 0.047; // 24/512 ratio
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(size * 0.273, size * 0.391);
  ctx.lineTo(size * 0.430, size * 0.5);
  ctx.lineTo(size * 0.273, size * 0.609);
  ctx.stroke();

  // Draw cursor
  ctx.fillStyle = '#FFFFFF';
  ctx.globalAlpha = 0.9;
  roundRect(ctx, size * 0.488, size * 0.477, size * 0.156, size * 0.047, size * 0.008);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Draw port indicator dot (green)
  ctx.fillStyle = '#32D74B';
  ctx.beginPath();
  ctx.arc(size * 0.781, size * 0.703, size * 0.023, 0, 2 * Math.PI);
  ctx.fill();

  // Save PNG
  const buffer = canvas.toBuffer('image/png');
  const filename = path.join(iconsDir, `icon-${size}.png`);
  fs.writeFileSync(filename, buffer);
  console.log(`✓ Created icon-${size}.png`);
});

console.log('\n✨ All PWA icons generated successfully!\n');
console.log('Icons saved to: public/icons/\n');

// Helper function to draw rounded rectangle
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
