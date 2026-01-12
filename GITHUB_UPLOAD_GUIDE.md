# Uploading to GitHub Guide

Your repository is already connected to GitHub at: `https://github.com/almtrackers/webappnew`

## Quick Upload (All Changes)

### Step 1: Check what will be uploaded
```bash
git status
```

### Step 2: Add all changes
```bash
git add .
```

Or add specific files:
```bash
git add package.json src/ public/
```

### Step 3: Commit with a message
```bash
git commit -m "Add PWA support and fix Next.js 15 viewport warnings"
```

### Step 4: Push to GitHub
```bash
git push origin main
```

## Step-by-Step Process

### 1. Review Changes
```bash
git status
```
This shows:
- **Modified files**: Files that were changed
- **Untracked files**: New files not yet added to git

### 2. Stage Changes
Add all changes:
```bash
git add .
```

Or add specific files/folders:
```bash
git add package.json
git add src/
git add public/
git add *.md
```

### 3. Commit Changes
```bash
git commit -m "Your commit message here"
```

Good commit messages:
- `"Add PWA support for iOS installation"`
- `"Fix Next.js 15 viewport warnings"`
- `"Add Android AAB build scripts"`
- `"Update service worker with Firebase integration"`

### 4. Push to GitHub
```bash
git push origin main
```

If you get an error about upstream, use:
```bash
git push -u origin main
```

## Important Notes

### ⚠️ Sensitive Files
Your repository contains Firebase API keys in:
- `android/app/google-services.json`
- `public/firebase-messaging-sw.js`
- `public/sw.js`

**These are already in your repository.** If you want to keep them private:
1. Remove them from git history (advanced)
2. Or use environment variables instead
3. Or keep the repo private on GitHub

### Files That Should NOT Be Committed
The `.gitignore` file excludes:
- `node_modules/` - Dependencies (install with `npm install`)
- `out/` - Build output
- `.env*` - Environment variables
- `android/app/build/` - Android build files
- `*.apk`, `*.aab` - Compiled apps

## Common Commands

### See what changed
```bash
git diff
```

### Undo changes (before committing)
```bash
git restore <file>
```

### Update commit message (before pushing)
```bash
git commit --amend -m "New message"
```

### Pull latest changes first
```bash
git pull origin main
```

## Troubleshooting

### "Your branch is ahead of origin/main"
You have local commits not pushed yet. Run:
```bash
git push origin main
```

### "Updates were rejected"
Someone else pushed changes. First pull:
```bash
git pull origin main
# Resolve any conflicts, then:
git push origin main
```

### "Authentication failed"
You need to authenticate. Options:
1. Use GitHub Desktop app
2. Set up SSH keys
3. Use Personal Access Token (PAT)

## Recommended Workflow

1. **Before making changes**: `git pull origin main`
2. **Make your changes**
3. **Review changes**: `git status`
4. **Add changes**: `git add .`
5. **Commit**: `git commit -m "Description"`
6. **Push**: `git push origin main`

## One-Line Upload (All Changes)

```bash
git add . && git commit -m "Add PWA support and build improvements" && git push origin main
```

