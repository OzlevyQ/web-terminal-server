# PWA Installation Guide

## Generate Icons (Required for iOS)

The app is ready as a PWA, but iOS requires PNG icons. Follow these steps:

### Quick Method (2 minutes):

1. **Open the icon generator:**
   ```
   Visit: https://www.pwabuilder.com/imageGenerator
   ```

2. **Upload the source icon:**
   - Upload: `public/icons/icon.svg`

3. **Download generated files:**
   - Download the ZIP file
   - Extract all PNG files

4. **Copy to project:**
   ```bash
   # Copy all icon-*.png files to:
   public/icons/
   ```

5. **Restart server:**
   ```bash
   npm start
   ```

Now the PWA will work perfectly on iOS with proper icons!

## Alternative: Use the built-in generator

1. Start server: `npm start`
2. Open: http://localhost:5000/icons/generate-base64-icons.html
3. Download all PNG files
4. Save to `public/icons/`

## Verify Installation

After adding icons:
- Check manifest: http://localhost:5000/manifest.json
- iOS: Safari → Share → "Add to Home Screen"
- Android: Chrome → Menu → "Install App"
