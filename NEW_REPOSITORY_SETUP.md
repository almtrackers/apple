# Setting Up a New GitHub Repository

## Step 1: Create New Repository on GitHub

1. Go to [GitHub](https://github.com) and sign in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Fill in:
   - **Repository name**: e.g., `al-muhafiz-trackers` or `al-muhafiz-pwa`
   - **Description**: (optional) "Vehicle Tracking System with PWA support"
   - **Visibility**: Choose **Public** or **Private**
   - **DO NOT** initialize with README, .gitignore, or license (you already have these)
4. Click **"Create repository"**

## Step 2: Copy the Repository URL

After creating, GitHub will show you the repository URL. It will look like:
- HTTPS: `https://github.com/YOUR_USERNAME/REPO_NAME.git`
- SSH: `git@github.com:YOUR_USERNAME/REPO_NAME.git`

**Copy the HTTPS URL** (easier for first-time setup)

## Step 3: Update Git Remote

### Option A: Change Existing Remote (Recommended)
```bash
git remote set-url origin https://github.com/YOUR_USERNAME/REPO_NAME.git
```

### Option B: Add New Remote (Keep Old One)
```bash
git remote add new-origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git remote -v  # Verify it was added
```

### Option C: Remove Old and Add New
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
```

## Step 4: Verify Remote
```bash
git remote -v
```

You should see your new repository URL.

## Step 5: Push to New Repository

### First Push (Set Upstream)
```bash
git push -u origin main
```

If your default branch is `master` instead of `main`:
```bash
git push -u origin master
```

### Subsequent Pushes
```bash
git push origin main
```

## Complete Example

```bash
# 1. Create repo on GitHub first, then:

# 2. Update remote URL (replace with your actual URL)
git remote set-url origin https://github.com/YOUR_USERNAME/al-muhafiz-trackers.git

# 3. Verify
git remote -v

# 4. Add all changes
git add .

# 5. Commit
git commit -m "Initial commit: PWA-enabled vehicle tracking system"

# 6. Push to new repository
git push -u origin main
```

## Troubleshooting

### "Repository not found"
- Check the URL is correct
- Make sure the repository exists on GitHub
- Verify you have access (if private repo, you need to be added)

### "Authentication failed"
You need to authenticate. Options:

**Option 1: GitHub Desktop**
- Use GitHub Desktop app (easiest)

**Option 2: Personal Access Token (PAT)**
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Use token as password when pushing

**Option 3: SSH Keys**
1. Generate SSH key: `ssh-keygen -t ed25519 -C "your_email@example.com"`
2. Add to GitHub: Settings → SSH and GPG keys
3. Use SSH URL: `git@github.com:USERNAME/REPO.git`

### "Branch 'main' does not exist"
If your local branch is `master`:
```bash
git branch -M main  # Rename local branch to main
git push -u origin main
```

### "Updates were rejected"
If the new repo has files (README, etc.):
```bash
git pull origin main --allow-unrelated-histories
# Resolve conflicts if any
git push origin main
```

## What Gets Uploaded

All your files will be uploaded, including:
- ✅ Source code (`src/`)
- ✅ PWA files (`public/sw.js`, `manifest.webmanifest`)
- ✅ Android project (`android/`)
- ✅ Configuration files (`package.json`, `next.config.ts`)
- ✅ Documentation (`*.md` files)

**Excluded** (by `.gitignore`):
- ❌ `node_modules/`
- ❌ Build outputs (`out/`, `build/`)
- ❌ `.env` files
- ❌ Android build artifacts

## Security Reminder

⚠️ **Important**: Your code contains Firebase API keys. If making the repo public:
- Consider using environment variables
- Or keep the repository **private**
- Review `GITHUB_UPLOAD_GUIDE.md` for more security tips

