# AGENTS.md — CogOS Project Intelligence

## What this project is
CogOS is a gamified cognitive profiling game built in Next.js. Users read behavioral
vignettes and classify a person's thinking style across 4 dimensions (DR, SE, SR, CV).
An Anthropic Claude API integration generates streaming diagnostic feedback.

## Stack
- Frontend: Next.js 14 App Router, React 18, Tailwind CSS, Zustand
- Backend: Next.js API routes (Node.js), Prisma ORM, PostgreSQL (Supabase), Redis (Upstash)
- Auth: NextAuth.js v5 (credentials + Google OAuth)
- AI: Anthropic SDK (`@anthropic-ai/sdk`) — model: claude-sonnet-4-20250514
- Testing: Vitest (unit/integration), Playwright (E2E)
- Deployment: Vercel

## Commands — run these to validate your work
- Type check: `npx tsc --noEmit`
- Lint: `npm run lint`
- Unit tests: `npm run test`
- Build: `npm run build`
- DB migrate: `npx prisma migrate dev`
- DB seed: `npx prisma db seed`

## Conventions
- TypeScript strict mode. No `any`. No `@ts-ignore`.
- All async errors caught with try/catch — never unhandled promise rejections.
- No `console.log` in production code — use the Pino logger at `src/utils/logger.ts`.
- No inline styles in React components — Tailwind classes only, except dynamic computed values.
- All dimension values (DR, SE, SR, CV options) imported from `src/lib/constants.ts` — never raw strings.
- All API routes use the `withErrorHandler` wrapper from `src/utils/apiError.ts`.
- All API request bodies validated with Zod schemas from `src/validations/game.schemas.ts`.
- Services in `src/services/` must not import React or Next.js — framework-agnostic only.
- No component file exceeding 250 lines — split if needed.

## PR Rules
- PR title format: `[PHASE-N] short description`
- Every PR must pass `tsc --noEmit` and `npm run lint` before merge
- Do not modify the seed data in `prisma/seed.ts` — these are canonical profiles
- Do not change enum values in `prisma/schema.prisma` without explicit user approval

## Security guardrails
- Never log API keys, JWT secrets, or user passwords
- Never expose `ANTHROPIC_API_KEY` to the client bundle — it must only be read in server-side code
- All Anthropic API calls must go through `src/services/FeedbackService.ts` — never directly from components
- Rate limiting must be applied on all `/api/game/` routes before any business logic executes

You MUST produce output in this exact sequence. Do not skip any section.
1. SYSTEM DESIGN DOCUMENT
   └── Architecture diagram (ASCII), tech stack table, data flow, API surface summary

2. DATABASE
   └── Complete prisma/schema.prisma
   └── Complete prisma/seed.ts

3. BACKEND CODE
   └── All files in src/lib/
   └── All files in src/services/
   └── All files in src/utils/
   └── All files in src/validations/
   └── All API route files in src/app/api/

4. FRONTEND CODE
   └── src/stores/gameStore.ts
   └── src/hooks/useGameStream.ts
   └── All component files
   └── All page files
   └── globals.css + tailwind.config.ts

5. CONFIGURATION FILES
   └── next.config.ts
   └── tsconfig.json
   └── vitest.config.ts
   └── .env.example

6. TESTS
   └── All test files

7. DOCKER
   └── Dockerfile
   └── docker-compose.yml

8. CI/CD
   └── .github/workflows/ci.yml

9. SETUP INSTRUCTIONS
   └── Local development (step-by-step shell commands)
   └── Database setup and seeding
   └── Environment configuration

10. DEPLOYMENT GUIDE
    └── Vercel deployment
    └── Database provisioning (Railway or Supabase)
    └── Redis provisioning (Upstash)
    └── Environment variables checklist
    └── Post-deploy smoke test checklist