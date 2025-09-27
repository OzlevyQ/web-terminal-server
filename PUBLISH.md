# Publishing Web Terminal Server to NPM

## Pre-publish Checklist

- [ ] Update package.json with your details:
  - `author`: Your name
  - `repository.url`: Your GitHub repository
  - `homepage`: Your project homepage
  - `bugs.url`: Your issues page

- [ ] Test locally with `npx`:
  ```bash
  npm link
  npx web-terminal-server
  ```

- [ ] Test all features:
  - [ ] Terminal creation
  - [ ] Session persistence
  - [ ] Sharing via URL
  - [ ] Monitor dashboard
  - [ ] Mobile controls

- [ ] Update README.md:
  - [ ] Replace placeholder URLs
  - [ ] Add screenshots
  - [ ] Update author info

## Publishing Steps

### 1. Create NPM Account
```bash
npm adduser
# or
npm login
```

### 2. Check Package Name Availability
```bash
npm view web-terminal-server
# If taken, update package.json with a unique name
```

### 3. Publish to NPM
```bash
# Dry run first
npm publish --dry-run

# Publish
npm publish --access public
```

### 4. Test Installation
```bash
# In a new directory
npx web-terminal-server

# Or install globally
npm install -g web-terminal-server
web-terminal-server
```

## Post-publish

### GitHub Repository Setup

1. Create repository on GitHub
2. Push code:
```bash
git init
git add .
git commit -m "Initial release v1.0.0"
git branch -M main
git remote add origin https://github.com/yourusername/web-terminal-server.git
git push -u origin main
```

3. Add GitHub badges to README
4. Create releases/tags
5. Enable GitHub Pages for demo

### Promotion

- [ ] Tweet about the release
- [ ] Post on Reddit (r/node, r/javascript)
- [ ] Submit to Hacker News
- [ ] Write a blog post
- [ ] Create demo video

## Maintenance

### Version Updates
```bash
# Patch release (1.0.0 -> 1.0.1)
npm version patch

# Minor release (1.0.0 -> 1.1.0)
npm version minor

# Major release (1.0.0 -> 2.0.0)
npm version major

# Publish update
npm publish
```

### Security Updates
```bash
npm audit
npm audit fix
```

## Support

Handle issues on GitHub:
- Respond to issues promptly
- Tag issues appropriately
- Welcome contributions
- Maintain a CHANGELOG.md