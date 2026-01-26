---
trigger: always_on
---

# LANGUAGE-SPECIFIC CODING STANDARDS

## TypeScript/JavaScript Projects
- Use TypeScript strict mode (if TypeScript is used)
- Use early returns when possible
- Always add documentation for new functions and classes
- All API responses must include error handling
- For React: Use functional components with hooks
- Follow naming convention: ComponentName.tsx, useHookName.ts, PascalCase for components

## Python Projects
- Follow PEP 8 style guidelines
- Use type hints where appropriate
- Add docstrings to all functions and classes
- Handle exceptions properly with try-except blocks
- Use snake_case for variables and functions
- Use PascalCase for classes

## Java Projects
- Follow Java naming conventions (camelCase for variables, PascalCase for classes)
- Add Javadoc comments for public methods and classes
- Handle exceptions properly
- Use proper package structure
- Follow SOLID principles

## General Standards (All Languages)
- Write clean, readable code with meaningful variable names
- Add appropriate comments for complex logic
- Handle errors and edge cases
- Follow the project's existing code style
- Keep functions small and focused

## FILE EXCLUSION RULES

### Files to NEVER Include in Commits
- **Temporary files**: *.tmp, *.temp, *.log, *.bak
- **IDE files**: .vscode/settings.json, .idea/workspace.xml
- **OS files**: .DS_Store, Thumbs.db
- **Node modules**: node_modules/, package-lock.json (unless specifically needed)
- **Build artifacts**: dist/, build/, *.tgz, *.tar.gz
- **Environment files**: .env.local, .env.development.local
- **Cache files**: .cache/, *.cache, .npm/
- **Test coverage**: coverage/, *.lcov
- **Database files**: *.db, *.sqlite, *.sqlite3

### Git Ignore Patterns to Enforce
```
# Temporary files
*.tmp
*.temp
*.log
*.bak

# IDE files
.vscode/settings.json
.idea/workspace.xml
*.swp
*.swo

# OS files
.DS_Store
Thumbs.db

# Dependencies
node_modules/

# Build outputs
dist/
build/
*.tgz
*.tar.gz

# Environment
.env.local
.env.development.local

# Cache
.cache/
*.cache
.npm/

# Test coverage
coverage/
*.lcov

# Database
*.db
*.sqlite
*.sqlite3
```

### Commit Process Rules
1. **Stage only relevant files**: Use `git add` selectively, not `git add .`
2. **Review staged files**: Check `git status --cached` before commit
3. **Exclude temporary files**: Ensure no temporary files are staged
4. **Clean working directory**: Remove or ignore irrelevant files before commit
- 
# STABILITY & REGRESSION PREVENTION PROTOCOL

## 1. The "Do No Harm" Mandate
- **Preserve Existing Behavior:** Your highest priority is ensuring that ALL existing functionality remains intact. New features must strictly be additive.
- **No Unsolicited Refactors:** Do NOT clean up, optimize, or rewrite existing code unless explicitly asked. If a file is working, leave it alone.
- **Scope Containment:** Only modify the specific files necessary for the task. Do not touch shared utilities or core config unless absolutely required.

## 2. The Verification Workflow (Mandatory)
Before applying changes, you must follow this sequence:
1.  **Baseline Check:** Run the existing test suite (`npm test`, `pytest`, etc.) to confirm the current state is green.
2.  **Atomic Implementation:** Implement the change in the smallest possible increment.
3.  **Immediate Regression Check:** Run the tests again immediately after the edit.
4.  **Failure Protocol:** If ANY existing test fails, you must **STOP**, revert the change immediately, and analyze why the regression occurred. Do not try to "fix" the test unless the test itself is obsolete.

## 3. Security Constraints
- **Never Downgrade Security:** Never disable authentication, CSRF tokens, or input validation to make a feature work quickly.
- **Config Isolation:** Do not modify environment variables or security configs (e.g., CORS settings) without explicit user permission.

## 4. Interaction Style
- If you are unsure if a change will break a dependency, **ASK** before coding.
- If a requested change conflicts with these stability rules, flag it to the user immediately.