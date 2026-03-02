# CogOS - Cognitive Operating System

CogOS is a gamified cognitive profiling app built with Next.js. Users read behavioral vignettes and classify thinking patterns across four dimensions:

- `DR` (Reasoning Depth)
- `SE` (Exploration Width)
- `SR` (Reflection Frequency)
- `CV` (Convergence Style)

After each submission, the app streams coaching feedback (Anthropic when configured, deterministic fallback otherwise), tracks score progression, and computes session-level meta insights.

This repository is for developers working on a single Next.js application that serves both frontend and backend API routes.

## Features

### Gameplay and user-facing flow

- Intro experience with dimension/tier preview and session start CTA.
- Profile-based gameplay (`8` canonical seeded profiles by default).
- Per-profile classification across all four dimensions (`4` options per dimension).
- Optional clue reveal per profile (recorded and applied as XP penalty).
- Live progress indicators and per-profile score breakdown.
- Feedback screen after each submission.
- Session results page with:
  - total score and accuracy
  - XP earned
  - per-profile score list
  - radar chart for dimension accuracy
  - generated meta-cognitive insight

### Streaming feedback system

- `POST /api/game/session/{sessionId}/submit` returns `text/event-stream`.
- Streams feedback chunks in real time.
- Event-based protocol with explicit events: `score`, `feedback_chunk`, `next_profile`, `session_complete`, `done`.
- Anthropic streaming retries with backoff (`1s`, `2s`) before fallback.
- Deterministic fallback feedback when AI is unavailable or stream fails.

### Session lifecycle and state management

- Session create, restore, submit, and complete endpoints.
- Session TTL enforcement (`SESSION_TTL_SECONDS = 7200`).
- Redis cache keys:
  - `profiles:all` (`24h` TTL)
  - `session:{sessionId}` (session TTL)
- Local session persistence in browser storage (`cogos:sessionId`).
- Automatic restore on page load.
- Status transitions across `IDLE`, `RESTORING`, `PLAYING`, `SUBMITTING`, `FEEDBACK`, `COMPLETE`.
- Server-side session states: `ACTIVE`, `COMPLETED`, `EXPIRED`.

### Scoring, progression, and analytics

- Dimension-level correctness scoring (`0-4` per profile).
- Session score aggregation and dimension accuracy percentages.
- Weakest/strongest dimension detection.
- XP computation based on:
  - profile difficulty base
  - per-profile score multiplier
  - speed bonus
  - clue penalty
- User level update formula: `level = floor(totalXp / 100) + 1`.
- User stats aggregation persisted in `UserStats`.

### Authentication and persistence

- NextAuth v5 route handler (`/api/auth/[...nextauth]`).
- Credentials provider (email/password hash verification).
- Optional Google OAuth provider (enabled only when env vars are set).
- JWT session strategy with XP/level attached to session token payload.
- OAuth sign-in upserts users in database.

### Reliability and security controls

- Zod request validation for game routes and auth credentials parsing.
- Unified API error wrapper with consistent response shape.
- Request-scoped IDs via `x-request-id`.
- Rate limiting on all `/api/game/*` routes before business logic.
- Rate-limit identifiers prefer the Auth.js session token (hashed), then fall back to client IP.
- Redis-backed minute-bucket limiter (`ratelimit:{identifier}:{current_minute_timestamp}`) with `INCR + EXPIRE`.
- In-memory fallback limiter is used when Redis is unavailable.
- Sensitive-field redaction in Pino logs.

### Frontend Enhancement (PHASE-5)

- Boot-time loading skeleton (`Booting CogOS...`) now appears on `/`, `/play`, and `/results` while session bootstrap runs.
- Game route UI is wrapped in `GameErrorBoundary` with fallback recovery: "Something went wrong. Your progress may be lost." + "Start New Game".
- Submit flow now shows a disabled button spinner during streaming and a pulsing analysis placeholder before first feedback chunk.
- Keyboard accessibility improvements:
  - dimension options explicitly support Enter/Space selection
  - richer option `aria-label` values include dimension + option + description
  - submit button `aria-label` reflects whether all dimensions are selected
- Reasoning Depth shortcuts are available in gameplay: press `1-4` to set `DR` (`Surface`, `Intermediate`, `Deep`, `Meta`) when no editable field is focused.
- First-visit tooltip explains the `1-4` shortcut and is persisted in local storage.
- Results radar chart rendering is client-only via `next/dynamic` + `ssr: false` to keep Recharts out of SSR/main path.
- Mobile resilience at narrow widths includes overflow-safe profile text, >=44px submit touch target, and scrollable feedback panel for long content.
- Reduced motion support is enabled via `@media (prefers-reduced-motion: reduce)` animation/transition overrides.
- Session persistence key remains `cogos:sessionId`.

### Internal jobs / schedulers

- No cron jobs, queue workers, or background schedulers are implemented in this repository.

## Tech Stack

### Frontend

- Next.js 14 App Router
- React 18
- TypeScript (strict)
- Tailwind CSS
- Zustand (game state)
- TanStack Query (provider setup)
- Framer Motion
- Recharts
- Radix UI / shadcn-style UI components

### Backend

- Next.js Route Handlers (`src/app/api/*`)
- NextAuth v5
- Prisma ORM
- Zod validation
- Pino logger

### Database and infra

- PostgreSQL (Prisma datasource)
- Upstash Redis (optional caching/rate limit backend)
- Redis helper API in `src/lib/redis.ts`: `setEx`, `get`, `del`, `incr`, `expire`

### AI

- Anthropic SDK (`@anthropic-ai/sdk`)
- Default model constant: `claude-sonnet-4-20250514` (overridable via env)

### Testing and tooling

- Vitest + Testing Library/JSDOM setup
- ESLint + Next lint
- TypeScript strict checks

## Project Structure

```text
.
|-- prisma/
|   |-- schema.prisma                # Data model, enums, datasource
|   |-- seed.ts                      # Canonical profile seed data
|   `-- migrations/                  # Prisma migration history
|-- src/
|   |-- app/
|   |   |-- api/
|   |   |   |-- auth/[...nextauth]/route.ts
|   |   |   `-- game/session/...     # Session create/get/submit/complete APIs
|   |   |-- play/page.tsx            # Gameplay screen
|   |   |-- results/page.tsx         # Session summary screen
|   |   |-- page.tsx                 # Intro and route bootstrap
|   |   |-- layout.tsx               # App shell, metadata, fonts
|   |   `-- globals.css              # Design tokens and utility styles
|   |-- components/
|   |   |-- game/                    # Gameplay UI components
|   |   `-- ui/                      # Reusable UI primitives
|   |-- hooks/
|   |   `-- useGameStream.ts         # SSE client parser + submit flow
|   |-- stores/
|   |   `-- gameStore.ts             # Zustand game/session state machine
|   |-- services/
|   |   |-- SessionService.ts        # Core session, scoring, persistence logic
|   |   `-- FeedbackService.ts       # Anthropic streaming + fallback feedback
|   |-- validations/
|   |   `-- game.schemas.ts          # Zod request schemas
|   |-- utils/
|   |   |-- apiError.ts              # APIError + withErrorHandler wrapper
|   |   |-- rateLimiter.ts           # Redis/local rate limiting logic
|   |   |-- request.ts               # Rate-limit enforcement + IP extraction
|   |   |-- scoring.ts               # Scoring, XP, accuracy helpers
|   |   `-- logger.ts                # Pino logger config with redaction
|   |-- lib/
|   |   |-- constants.ts             # Dimension values, limits, XP bases
|   |   |-- prisma.ts                # Prisma singleton
|   |   |-- redis.ts                 # Optional Redis client + helper wrappers
|   |   `-- anthropic.ts             # Optional Anthropic client
|   |-- types/
|   |   |-- game.ts                  # Shared game/session types
|   |   `-- next-auth.d.ts           # NextAuth type augmentation
|   `-- auth.ts                      # NextAuth config and callbacks
|-- tailwind.config.ts
|-- next.config.ts
|-- vitest.config.ts
`-- package.json
```

## Setup Instructions

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm
- PostgreSQL instance
- Optional:
  - Upstash Redis (for distributed rate limiting/cache)
  - Anthropic API key (for LLM-generated feedback)
  - Google OAuth credentials (for Google sign-in)

### Installation

```bash
git clone <your-repo-url>
cd cognitive-compass
npm install
```

### Environment Variables

Copy and edit env file:

```bash
cp .env.example .env
```

Then ensure all required variables are present:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NODE_ENV` | No | Runtime mode (`development`/`production`), affects logging and Prisma log verbosity. |
| `NEXTAUTH_SECRET` | Yes | NextAuth signing/encryption secret. |
| `NEXTAUTH_URL` | Yes | Canonical app URL for NextAuth callbacks/session URLs. |
| `DATABASE_URL` | Yes | Prisma/Postgres connection string. |
| `DIRECT_URL` | Yes | Prisma direct DB URL for migrations/introspection (declared in `schema.prisma`). |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis REST endpoint. |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis REST token. |
| `ANTHROPIC_API_KEY` | No | Enables Anthropic streaming feedback. |
| `ANTHROPIC_MODEL` | No | Optional model override (defaults to `claude-sonnet-4-20250514`). |
| `GOOGLE_CLIENT_ID` | No | Enables Google provider when paired with secret. |
| `GOOGLE_CLIENT_SECRET` | No | Enables Google provider when paired with ID. |

Notes:

- `DIRECT_URL` is required by Prisma schema but is not currently listed in `.env.example`; add it manually.
- If Anthropic variables are missing, feedback falls back to deterministic non-LLM text.
- If Redis variables are missing, rate limiting falls back to in-process memory buckets (not shared across instances).

### Running the project

This is a single Next.js service (frontend + backend API in one process).

```bash
npm run dev
```

Open `http://localhost:3000`.

### Production build and start

```bash
npm run build
npm run start
```

### Database setup and seeding

```bash
npm run db:migrate
npm run db:seed
```

## API Documentation

All API errors use this envelope:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "requestId": "uuid"
  }
}
```

### 1) Create session

- Method: `POST`
- Route: `/api/game/session`
- Body schema:

```json
{
  "userId": "optional-string"
}
```

`userId` is validated but session ownership is derived from `auth()` (current logged-in user) in the route logic.

- Success response (`200`):

```json
{
  "sessionId": "ck...",
  "guestToken": "uuid-or-null",
  "currentProfile": {
    "id": "ck...",
    "slug": "the-investor",
    "name": "The Investor",
    "avatar": "avatar-token",
    "difficulty": "EASY",
    "scenario": "....",
    "context": "....",
    "clues": ["..."],
    "sortOrder": 1
  },
  "totalProfiles": 8,
  "profileIndex": 0,
  "completedScores": []
}
```

### 2) Get session state

- Method: `GET`
- Route: `/api/game/session/{sessionId}`
- Success response (`200`) (`SessionStateResponse`):

```json
{
  "sessionId": "ck...",
  "guestToken": "uuid-or-null",
  "status": "ACTIVE",
  "profileIndex": 2,
  "totalProfiles": 8,
  "totalScore": 6,
  "maxScore": 32,
  "currentProfile": {
    "id": "ck...",
    "slug": "the-product-designer",
    "name": "The Product Designer",
    "avatar": "avatar-token",
    "difficulty": "MEDIUM",
    "scenario": "...",
    "context": "...",
    "clues": ["..."],
    "sortOrder": 4
  },
  "completedScores": [3, 3],
  "expiresAt": "2026-03-02T12:00:00.000Z"
}
```

Common error codes: `SESSION_NOT_FOUND`, `SESSION_EXPIRED`, `RATE_LIMIT_EXCEEDED`.

### 3) Submit answer and stream feedback

- Method: `POST`
- Route: `/api/game/session/{sessionId}/submit`
- Response content type: `text/event-stream`
- Max route duration: `30` seconds (`maxDuration = 30`)

- Body schema:

```json
{
  "profileId": "ck...",
  "selections": {
    "DR": "Surface|Intermediate|Deep|Meta",
    "SE": "Single|DualTrack|MultiTrack|Divergent",
    "SR": "Rare|Selective|Regular|Constant",
    "CV": "Deadline|Clarity|InfoExhaustion|Intuition"
  },
  "clueUsed": true,
  "timeTakenMs": 15342
}
```

#### SSE event contract

Server emits events in this order:

1. `score`
2. `feedback_chunk` (one or many)
3. `next_profile` OR `session_complete`
4. `done`

Event payloads:

- `score`

```json
{
  "total": 3,
  "breakdown": {
    "DR": true,
    "SE": true,
    "SR": false,
    "CV": true
  }
}
```

- `feedback_chunk`

```json
{
  "chunk": "partial feedback text"
}
```

- `next_profile`

```json
{
  "profileIndex": 3,
  "profile": {
    "id": "ck...",
    "slug": "the-conflict-avoider",
    "name": "The Conflict Avoider",
    "avatar": "avatar-token",
    "difficulty": "MEDIUM",
    "scenario": "...",
    "context": "...",
    "clues": ["..."],
    "sortOrder": 5
  }
}
```

- `session_complete`

```json
{
  "profileIndex": 8
}
```

- `done`

```json
{
  "ok": true
}
```

Fallback completion may include:

```json
{
  "ok": true,
  "fallback": true
}
```

Example stream test:

```bash
curl -N -X POST "http://localhost:3000/api/game/session/<sessionId>/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "profileId":"<profileId>",
    "selections":{"DR":"Surface","SE":"Single","SR":"Rare","CV":"Deadline"},
    "clueUsed":false,
    "timeTakenMs":42000
  }'
```

### 4) Complete session

- Method: `POST`
- Route: `/api/game/session/{sessionId}/complete`
- Body schema: `{}`
- Success response (`200`) (`SessionSummary`):

```json
{
  "totalScore": 21,
  "maxScore": 32,
  "accuracy": 65.625,
  "profileResults": [
    {
      "profileId": "ck...",
      "profileName": "The Investor",
      "selections": {"DR":"Surface","SE":"Single","SR":"Rare","CV":"Intuition"},
      "correctAnswers": {"DR":"Surface","SE":"Single","SR":"Rare","CV":"Intuition"},
      "score": {"DR":true,"SE":true,"SR":true,"CV":true,"total":4,"maxScore":4},
      "feedback": "...",
      "clueUsed": false,
      "timeTakenMs": 21345
    }
  ],
  "dimensionAccuracy": {"DR":75,"SE":62.5,"SR":50,"CV":75},
  "weakestDimension": "SR",
  "strongestDimension": "DR",
  "metaInsight": "Reflection frequency is the main growth edge...",
  "xpEarned": 96
}
```

For authenticated sessions, completion also updates:

- `User.xp`
- `User.level`
- `UserStats` aggregate counters and rolling dimension accuracies

### 5) Auth route handlers

- Methods: `GET`, `POST`
- Route: `/api/auth/[...nextauth]`
- Behavior:
  - Proxies NextAuth handlers from `src/auth.ts`.
  - Credentials provider checks email/password against `User.passwordHash`.
  - Google provider is registered only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured.

## Usage

### Guest flow

1. Open `/`.
2. Click "Begin Profiling".
3. App creates session (`POST /api/game/session`) and routes to `/play`.
4. For each profile:
   - read scenario
   - optionally reveal clues
   - select `DR`, `SE`, `SR`, `CV`
   - submit and watch streamed feedback
5. At final profile, complete session and view `/results`.

### Resume flow

1. Session ID is persisted in `localStorage` (`cogos:sessionId`).
2. On reload, app attempts `GET /api/game/session/{sessionId}`.
3. If active, gameplay resumes from current index.
4. If completed, app fetches summary and shows results.
5. If expired/not found, state resets to intro.

### Authenticated flow

1. Authenticated session create attaches `userId`.
2. On completion, XP/level and `UserStats` aggregates are updated.
3. OAuth sign-in upserts user record by email.

## Scripts and Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start Next.js dev server (frontend + API). |
| `npm run build` | Production build. |
| `npm run start` | Start production server from build output. |
| `npm run lint` | Run `next lint`. |
| `npm run type-check` | Run TypeScript check (`tsc --noEmit`). |
| `npm run test` | Run Vitest test suite once. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run db:migrate` | Run Prisma development migrations. |
| `npm run db:seed` | Seed canonical profile data. |

## Database Schema Summary

Key Prisma models:

- `User`: identity, auth provider, XP, level.
- `UserStats`: aggregate stats and rolling dimension accuracies per user.
- `Profile`: canonical vignette definitions and correct answers.
- `GameSession`: session lifecycle, profile order, score totals, expiry.
- `Attempt`: per-profile submissions, correctness flags, feedback text, clue/time metadata.

Enums include `Difficulty`, `SessionStatus`, and all four dimension value sets.

## Deployment Guide

### Build and runtime

```bash
npm ci
npm run build
npm run start
```

### Environment setup (production)

Required minimum:

- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `DATABASE_URL`
- `DIRECT_URL`

Recommended for full functionality:

- `ANTHROPIC_API_KEY` (LLM streaming feedback)
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (shared rate limits/cache)
- Google OAuth keys (if Google sign-in is desired)

### Hosting notes

- Vercel-compatible Next.js app.
- Use managed Postgres (Supabase, Railway, Neon, etc.) for Prisma datasource.
- Use Upstash Redis for distributed rate limiting across replicas.

### Smoke test checklist

After deployment:

1. Open `/` and confirm intro page renders.
2. Start a session and verify `/play` route loads profile data.
3. Submit an answer and verify SSE events arrive (score + feedback + done).
4. Complete full run and verify `/results` renders summary.
5. Call `POST /api/game/session` and verify JSON response.

## Known Issues and Limitations

- Test coverage is minimal (`src/test/example.test.ts` only).
- No Dockerfile / docker-compose manifests are present.
- No CI workflow directory (`.github/workflows`) is present.
- Credentials auth currently has no registration/signup API or UI in this repo.
- Legacy/unused artifacts exist and can cause confusion:
  - `src/lib/feedback.ts`
  - `src/data/profiles.ts`
  - `src/components/NavLink.tsx`
  - `next.config.mjs` exists alongside `next.config.ts`
- Prisma migration history appears partial for fresh bootstrap flows; review migration strategy before initializing a brand-new production database.

## Verified local checks

The following commands were run successfully against this repository:

- `npm run type-check`
- `npm run lint`
- `npm run test`
- `npm run build`
