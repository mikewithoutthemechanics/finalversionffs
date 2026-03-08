# MCP Servers & CLI Setup

## ✅ Installation Complete

### MCP Servers Installed
| Server | Package | Purpose |
|--------|---------|---------|
| **Supabase MCP** | `supabase-mcp` | Database CRUD, queries, schema |
| **GitHub MCP** | `github-mcp` | Issues, PRs, repos, workflows |
| **Vercel MCP** | `@vercel/mcp-adapter` | Deployments, env vars, logs |

### CLIs Installed
| CLI | Version | Path |
|-----|---------|------|
| **Supabase** | 2.75.0 | `C:\Users\Personal\supabase.exe` |
| **Vercel** | 50.28.0 | `vercel` (global) |
| **GitHub** | 2.85.0 | `gh` (global) |

---

## 🔧 MCP Configuration

### Add to Claude Code (claude_desktop_config.json)

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "supabase-mcp"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_ANON_KEY": "your-anon-key"
      }
    },
    "github": {
      "command": "npx",
      "args": ["-y", "github-mcp"],
      "env": {
        "GITHUB_TOKEN": "your-github-token"
      }
    },
    "vercel": {
      "command": "npx",
      "args": ["-y", "@vercel/mcp-adapter"]
    }
  }
}
```

---

## 🚀 Quick Commands

### Supabase CLI
```bash
# Link to project
supabase link --project-ref your-project-ref

# Run SQL
supabase sql < query.sql

# Generate types
supabase gen types typescript --linked > types.ts

# Start local dev
supabase start

# Stop local dev
supabase stop
```

### Vercel CLI
```bash
# Login
vercel login

# Deploy
vercel

# Deploy to production
vercel --prod

# View logs
vercel logs [app-name]

# Add env var
vercel env add [name]

# List env vars
vercel env ls
```

### GitHub CLI
```bash
# Login
gh auth login

# Create PR
gh pr create --title "Title" --body "Description"

# List PRs
gh pr list

# View PR
gh pr view [number]

# Clone repo
gh repo clone owner/repo

# Create issue
gh issue create --title "Bug" --body "Details"
```

---

## 🔌 Using MCP Servers in Claude

### Supabase MCP Examples
```
"List all tables in my Supabase database"
"Run this SQL: SELECT * FROM users LIMIT 10"
"Create a new table for bookings"
"Show me the schema for the classes table"
```

### GitHub MCP Examples
```
"Create a PR for my changes"
"List open issues in this repo"
"Check if CI is passing"
"Create an issue for the SQL injection vulnerability"
```

### Vercel MCP Examples
```
"Deploy the staging environment"
"Add SUPABASE_URL env var to production"
"Show me recent deployment logs"
"Rollback to previous deployment"
```

---

## 📝 Environment Setup

### Supabase Auth Token
```bash
# Get your token from https://app.supabase.com/account/tokens
supabase login
```

### GitHub Token
```bash
# Create token at https://github.com/settings/tokens
gh auth login
# OR set env var
$env:GITHUB_TOKEN="your-token"
```

### Vercel Token
```bash
vercel login
# OR set env var
$env:VERCEL_TOKEN="your-token"
```

---

## 🔗 Integration with TFMD Project

### Connect to Staging
```bash
cd C:\Users\Personal\Desktop\NEW-CODE

# Link Supabase staging
supabase link --project-ref [your-staging-ref]

# Link Vercel staging
vercel link --project tfmd-staging

# Verify GitHub connection
gh repo view
```

### Common Workflows

#### Deploy Staging + Test
```bash
# Deploy
vercel --prod

# Run SQL injection tests
# (Claude will use sql-injection-testing skill)
```

#### Create Issue from Security Findings
```bash
gh issue create \
  --title "SQL Injection Vulnerability in /api/search" \
  --label "security,critical" \
  --body "Found during staging testing..."
```

#### Database Migration
```bash
# Create migration
supabase migration new add_user_indexes

# Apply to staging
supabase db push

# Verify
supabase sql "SELECT * FROM pg_indexes WHERE tablename='users'"
```

---

## 📚 Help Commands

```bash
supabase --help
vercel --help
gh --help

# Specific help
supabase db --help
vercel env --help
gh pr --help
```

---

## ✅ Verification

Run these to verify everything works:

```bash
# CLIs
supabase --version  # Should show 2.75.0
vercel --version    # Should show 50.28.0
gh --version        # Should show 2.85.0

# MCP servers (via npx)
npx supabase-mcp --help
npx github-mcp --help
npx @vercel/mcp-adapter --help
```

---

## 🎯 Next Steps

1. **Configure tokens** (Supabase, GitHub, Vercel)
2. **Add MCP config** to Claude Code
3. **Test connections** with simple commands
4. **Use in workflows** for automated testing

All tools ready for staging setup and SQL injection testing! 🚀
