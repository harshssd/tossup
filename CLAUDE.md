# TossUp Project - Claude Code Instructions

## Project Structure
- **Monorepo root**: `/Users/apple/Workplace/tossup/`
- **Web app**: `web/` - Next.js 16 cricket auction platform
- See `web/CLAUDE.md` for app-specific conventions

## Workflow Rules

### Before Writing Code
- Always read the file(s) you intend to modify before making changes
- Understand the existing patterns in neighboring files before adding new code
- Check for existing utilities in `src/lib/` before creating new ones

### Git Discipline
- Never commit unless explicitly asked
- Never push unless explicitly asked
- Never force-push or use destructive git commands without explicit confirmation
- Use conventional commit messages: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`

### Code Quality Gates
Before considering any feature or fix complete, verify:
1. **Type check**: `npm run type-check` (must pass with zero errors)
2. **Lint**: `npm run lint` (must pass)
3. **Build**: `npm run build` (must succeed - catches SSR/import issues)
4. **Tests**: `npm test` if test files exist for modified code

Run these from the `web/` directory.

### Security
- Never hardcode secrets, API keys, or credentials
- Never commit `.env` files
- Server-only secrets must use `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix)
- Validate all user input at API boundaries with Zod schemas
- Use parameterized queries only (Supabase client handles this)
- Always check user authorization in API routes via `getAuthenticatedUser(request)`

### Database Changes
- All schema changes must go through Supabase migrations (`web/supabase/migrations/`)
- Migration naming: `YYYYMMDDHHMMSS_description.sql`
- Never modify existing migration files - create new ones
- Consider RLS policies for any new table

#### Two Supabase projects — migrations are split
- `web/supabase/migrations/` is **platform-only** (`tossup` / `byuvtmfarlreoxilrzcx` =
  tossup-cricket): identity, discovery, pavilion, tournaments. This is the active
  CLI target (`config.toml` project_id = `tossup`). New migrations go here.
- `web/supabase/legacy-auction-migrations/` holds the **legacy auction project's**
  migrations (`offnmpuiogbuxbmhgdck`, used by `@/lib/supabase`). Archived, NOT
  CLI-managed — see its README. Never move them back into `supabase/migrations/`
  (they collide by name with platform tables and a `db reset` would corrupt the
  platform schema).
- Tables named `clubs` / `leagues` / `teams` / `tournament_registrations` /
  `fixtures` exist in BOTH projects with different shapes — they are different
  tables in different databases.
