# Git Commands to Commit Migration Changes

## Summary of Changes
- Migrated from Lovable Supabase project to vjhfehdzjrgkxrpmpxix
- Updated .env with new project credentials
- Regenerated TypeScript types with all MF tables
- All database migrations and Edge Function deployed

## Commands to Run

```bash
# Check current status
git status

# Stage all changes
git add .

# Commit with descriptive message
git commit -m "feat: migrate to unified Supabase project with MF integration

- Migrate from Lovable project (nlnevxvsgholniaeigst) to vjhfehdzjrgkxrpmpxix
- Update .env with new Supabase project credentials
- Regenerate TypeScript types with all 14 tables including MF tables
- Add 5 new MF-related tables: mf_cas_sync, mf_folios, mf_transactions, mf_schemes, mf_holdings_summary
- Deploy mf-cas-sync Edge Function
- Apply all portfolio migrations to new project
- Update RLS policies and security measures"

# Push to remote
git push origin main

# Or if you're on a different branch:
# git push origin <your-branch-name>
```

## Alternative: Interactive Staging

If you want to review changes before committing:

```bash
# Review changes
git diff

# Stage specific files
git add .env
git add src/integrations/supabase/types.ts
git add supabase/migrations/
git add supabase/functions/

# Commit
git commit -m "feat: migrate to unified Supabase project with MF integration"

# Push
git push
```

## Files Changed
- `.env` - Updated Supabase project credentials
- `src/integrations/supabase/types.ts` - Regenerated with all tables
- `supabase/migrations/20260124120000_add_mf_cas_integration.sql` - MF tables migration
- `supabase/functions/mf-cas-sync/index.ts` - MF CAS Edge Function
- `src/components/mutualfund/` - MF UI components
- `src/hooks/useMFCASSync.ts` - MF sync hook
- `src/types/mutualFund.ts` - MF type definitions
- `MF_INTEGRATION_GUIDE.md` - Documentation
