# GSD - Get Shit Done

_Last updated: March 6, 2026 at 8:56 AM (SAST)_

This project uses the GSD framework for spec-driven development.

> **Note:** GSD commands referenced below may not be available in current setup.

## Quick Start

```bash
# Initialize new feature
/gsd:new-project

# Discuss a phase
/gsd:discuss-phase 1

# Plan a phase
/gsd:plan-phase 1

# Execute a phase
/gsd:execute-phase 1

# Verify work
/gsd:verify-work 1

# Quick task (no full planning)
/gsd:quick
```

## Files Created by GSD

- `.planning/PROJECT.md` - Project vision
- `.planning/REQUIREMENTS.md` - v1/v2 requirements
- `.planning/ROADMAP.md` - Phases and progress
- `.planning/STATE.md` - Decisions, blockers, memory
- `{phase}-CONTEXT.md` - Implementation preferences
- `{phase}-{N}-PLAN.md` - Atomic task plans

See `.planning/` directory for full documentation.
