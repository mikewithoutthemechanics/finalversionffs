# Contributing to TFMD Booking App

## 🚨 Branch Protection Rules

This repository enforces branch protection rules to maintain code quality.

### Protected Branches
- `v2` - Production branch
- `main` - Alternative production branch

### ❌ DO NOT push directly to protected branches

## ✅ Required Workflow

### 1. Create a Feature Branch
```bash
git checkout v2
git pull origin v2
git checkout -b feature/your-feature-name
```

### 2. Make Changes
```bash
# Edit files
git add .
git commit -m "feat: add new feature description"
```

### 3. Push Feature Branch
```bash
git push origin feature/your-feature-name
```

### 4. Create Pull Request
- Go to GitHub
- Click "Compare & pull request"
- Fill in PR description
- Request review
- Wait for CI checks to pass

### 5. Merge
- After approval, merge via GitHub UI
- Delete feature branch after merge

## 🔒 Local Hook Installation

To prevent accidental direct pushes:

```bash
git config core.hooksPath .githooks
```

## 🌿 Branch Naming Conventions

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feature/` | New features | `feature/payment-integration` |
| `fix/` | Bug fixes | `fix/login-redirect` |
| `hotfix/` | Urgent production fixes | `hotfix/critical-bug` |
| `docs/` | Documentation updates | `docs/api-readme` |
| `refactor/` | Code refactoring | `refactor/db-queries` |

## 📝 Commit Message Format

We follow conventional commits:

```
feat: add new booking calendar
fix: resolve payment webhook issue
docs: update API documentation
refactor: optimize database queries
test: add unit tests for auth
chore: update dependencies
```

## ⚠️ Bypass (Emergency Only)

If you absolutely must bypass protection:

```bash
git push --no-verify  # Skips local hooks
```

**Note:** GitHub Actions will still block direct pushes to v2/main unless they are merge commits.
