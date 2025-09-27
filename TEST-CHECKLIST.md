# Pre-Publish Test Checklist

## ✅ Fixed Issues (v1.0.3)
- [x] Ngrok hanging issue resolved
- [x] Added 10-second timeout for ngrok connection
- [x] Improved error handling and fallback mechanisms
- [x] Better module detection across environments
- [x] Cleanup ngrok on shutdown

## 📋 Manual Tests Required

### Basic Functionality
```bash
# Test 1: Basic startup
npx web-terminal-server

# Test 2: Custom port
npx web-terminal-server --port 3001

# Test 3: Help command
npx web-terminal-server --help
```

### Ngrok Integration
```bash
# Test 4: With ngrok (no auth)
npx web-terminal-server --ngrok

# Test 5: With ngrok auth token
echo "NGROK_AUTH_TOKEN=your_token" > .env
npx web-terminal-server --ngrok
```

### Terminal Features
- [ ] Create new terminal session
- [ ] Type commands and verify response
- [ ] Test cd / (with full security)
- [ ] Share terminal via Share button
- [ ] Open Monitor dashboard
- [ ] Close and reconnect to session
- [ ] Verify history is preserved

### Mobile Testing
- [ ] Open on mobile browser
- [ ] Test touch controls
- [ ] Verify keyboard input
- [ ] Test arrow keys

## 🚀 Publish Steps

1. **Run all tests above**

2. **Final version check:**
```bash
npm version
# Should show 1.0.3
```

3. **Verify GitHub is up to date:**
```bash
git status
# Should be clean
```

4. **Publish to NPM:**
```bash
npm login
npm publish --access public
```

5. **Verify published package:**
```bash
# Wait 1 minute then test
npx web-terminal-server@latest --help
```

## 📊 Expected Results

- Server starts without errors ✅
- Browser opens automatically ✅
- Terminal is interactive ✅
- Sessions persist ✅
- Sharing works ✅
- Ngrok doesn't hang ✅
- Monitor shows all sessions ✅

## 🎯 Final Checks

- [ ] No console errors in browser
- [ ] No server crashes
- [ ] Ngrok timeout works (10 seconds max)
- [ ] All buttons functional
- [ ] Mobile responsive
- [ ] Sessions save/restore properly