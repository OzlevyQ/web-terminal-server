# App Icons

## Quick Setup for PWA Icons

### Option 1: Use Online Generator (Easiest)

1. Go to: https://www.pwabuilder.com/imageGenerator
2. Upload `icon.svg` from this folder
3. Download the generated PNG files
4. Save all PNG files to this `public/icons/` folder

### Option 2: Generate in Browser

1. Start the server: `npm start`
2. Open: http://localhost:5000/icons/generate-base64-icons.html
3. Click each download link to save the PNG files
4. Move all downloaded files to this folder

### Option 3: Use ImageMagick (If installed)

```bash
cd public/icons

# Install ImageMagick
brew install imagemagick  # macOS
# or: sudo apt-get install imagemagick  # Linux

# Generate all sizes
for size in 72 96 128 144 152 180 192 384 512; do
  convert -background none -resize ${size}x${size} icon.svg icon-${size}.png
done
```

### Required Sizes

- icon-72.png (72x72)
- icon-96.png (96x96)
- icon-128.png (128x128)
- icon-144.png (144x144)
- icon-152.png (152x152)
- icon-180.png (180x180) - **Important for iOS**
- icon-192.png (192x192) - **Required for PWA**
- icon-384.png (384x384)
- icon-512.png (512x512) - **Required for PWA**

### Icon Design

The icon features:
- Gradient background (blue #0A84FF to purple #5E5CE6)
- Terminal prompt symbol ">"
- Cursor block
- Port indicator dot (green)

All icons should maintain the same design across all sizes.
