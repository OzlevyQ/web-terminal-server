#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Create a simple PNG icon using Canvas (if available) or base64
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');

// Ensure icons directory exists
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

console.log('📱 Creating PWA icons...\n');

// Try to use canvas if available
try {
  const { createCanvas } = require('canvas');

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

    const promptSize = size * 0.234;
    const startX = size * 0.273;
    const startY = size * 0.391;
    const midX = size * 0.430;
    const midY = size * 0.5;
    const endY = size * 0.609;

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.lineTo(midX, midY);
    ctx.lineTo(startX, endY);
    ctx.stroke();

    // Draw cursor
    ctx.fillStyle = '#0A84FF';
    ctx.globalAlpha = 0.9;
    const cursorX = size * 0.488;
    const cursorY = size * 0.477;
    const cursorW = size * 0.156;
    const cursorH = size * 0.047;
    roundRect(ctx, cursorX, cursorY, cursorW, cursorH, size * 0.008);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Save PNG
    const buffer = canvas.toBuffer('image/png');
    const filename = path.join(iconsDir, `icon-${size}.png`);
    fs.writeFileSync(filename, buffer);
    console.log(`✓ Created ${size}x${size} icon`);
  });

  console.log('\n✨ All icons created successfully!\n');

} catch (error) {
  console.log('⚠️  Canvas module not available.');
  console.log('   Install with: npm install canvas');
  console.log('   Or use the SVG icon with inline data URLs\n');

  // Create a fallback using the SVG
  const svgPath = path.join(iconsDir, 'icon.svg');
  if (fs.existsSync(svgPath)) {
    console.log('✓ SVG icon is available at public/icons/icon.svg');
    console.log('  Use online tools to convert to PNG if needed.\n');
  }
}

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
