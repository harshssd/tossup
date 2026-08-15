# TossUp Web - App Conventions

## Tech Stack
- Next.js 16 (App Router) | React 19 | TypeScript (strict mode)
- TailwindCSS 4 (inline theme in globals.css, no tailwind.config) | shadcn/ui
- Supabase (auth + DB + realtime) | Zod 4 | react-hook-form 7
- Framer Motion 12 | Inter + Instrument Serif fonts | Dark theme default

## Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # ESLint check
npm run type-check   # TypeScript check (tsc --noEmit)
npm test             # Run Jest tests
npm run test:watch   # Tests in watch mode
npm run test:coverage # Tests with coverage report
```

## File Organization

### Naming Conventions
| What | Convention | Example |
|------|-----------|---------|
| Components | PascalCase file + export | `AuctionCard.tsx` |
| Hooks | camelCase with `use` prefix | `useCaptainSession.ts` |
| Lib/utils | camelCase | `bid-utils.ts`, `route-gates.ts` |
| API routes | `route.ts` in folder path | `app/api/auction/[id]/route.ts` |
| Types | PascalCase interfaces | `AuctionStatus`, `PlayingRole` |
| CSS classes | Tailwind utilities only | No custom CSS classes |

### Where Things Go
- `src/app/` - Pages and API routes (App Router)
- `src/components/ui/` - shadcn/ui primitives (do not manually edit)
- `src/components/{feature}/` - Feature-specific components
- `src/hooks/` - Custom React hooks with business logic
- `src/lib/` - Server utilities, auth, DB helpers, shared logic
- `src/lib/validations/` - Zod schemas for form/API validation
- `src/lib/supabase/` - Supabase client setup (server.ts, admin.ts)
- `src/types/` - Shared TypeScript type definitions
- `src/__tests__/` - Jest tests mirroring src/ structure

## Coding Standards

### TypeScript
- Strict mode is ON - no `any` types, no `@ts-ignore`
- Use `interface` for object shapes, `type` for unions/intersections
- Export types from the file that owns them, import with `type` keyword
- Use `@/*` path alias for all imports (maps to `src/*`)

### React Components
- Use function components with arrow syntax
- Props interface defined above component: `interface Props { ... }`
- Hooks at the top of the component, then derived state, then handlers, then JSX
- Use `'use client'` directive only when component needs client features (hooks, events, browser APIs)
- Default to server components - only add `'use client'` when necessary

### API Routes
```typescript
// Standard pattern for API routes
import { getAuthenticatedUser } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    // ... business logic
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

### Supabase Usage
- **Server components/API routes**: Use `createClient()` from `@/lib/supabase/server` (respects RLS)
- **Admin operations** (bypass RLS): Use `createAdminClient()` from `@/lib/supabase/admin` - only in trusted server contexts
- **Client components**: Use `createBrowserClient()` from `@supabase/ssr`
- Always handle Supabase errors: `const { data, error } = await supabase.from(...)`

### Auth & Authorization
- Middleware injects `x-user-id` and `x-user-email` headers for API routes
- Use `getAuthenticatedUser(request)` in API routes to get current user
- Role hierarchy: OWNER > MODERATOR > CAPTAIN > VIEWER
- Check permissions via `getUserAuctionPermissions()` or `verifyTeamAdminAccess()`
- Public routes: `/`, `/auth/*`, `/live/*`, `/api/health`

### Styling
- Tailwind utility classes only - no inline styles, no CSS modules
- Use `cn()` from `@/lib/utils` to merge conditional classes
- Dark theme is default (`html.dark`) - always ensure dark mode looks correct
- Background: `bg-[#0a0e17]` for main surfaces in dark mode
- Use shadcn/ui components as building blocks, compose them for complex UI
- Framer Motion for animations - use `motion` components

### Form Handling
- Use `react-hook-form` with `zodResolver` for all forms
- Define Zod schemas in `src/lib/validations/`
- Validate on both client (form) and server (API route)

### Error Handling
- API routes: try/catch with appropriate HTTP status codes
- Client: `sonner` toast notifications for user-facing errors; keep messages specific and actionable
- Log server errors with `@/lib/logger.ts`

### Testing
- Test files go in `src/__tests__/` mirroring the source structure
- Use `@testing-library/react` for component tests
- Mock Supabase, Next.js router, and external deps (see `jest.setup.js`)
- Aim for 70%+ coverage on new code
- Test business logic in hooks and lib functions, not just UI rendering

## Common Patterns

### Adding a New Feature
1. Define types in `src/types/` or co-located with the feature
2. Create Zod validation schema if forms/API input involved
3. Build API route(s) in `src/app/api/`
4. Create hook in `src/hooks/` for client-side data fetching/state
5. Build component(s) in `src/components/{feature}/`
6. Wire up the page in `src/app/{route}/page.tsx`
7. Add tests for critical business logic

### Adding a New API Endpoint
1. Create route file: `src/app/api/{resource}/route.ts`
2. Authenticate with `getAuthenticatedUser(request)`
3. Validate input with Zod schema
4. Query Supabase with proper error handling
5. Return typed JSON responses with correct status codes

### Adding a shadcn/ui Component
```bash
npx shadcn@latest add {component-name}
```
Do NOT manually create or edit files in `src/components/ui/`.
