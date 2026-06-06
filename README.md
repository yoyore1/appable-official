# Appable — Web Platform (getappable.com)

> Build your first app free.

The Appable platform: signup → $1 deposit → a friendly chat interview →
generates a **master build prompt** that the **Appable Builder** (the forked
Void editor, a separate service) picks up to generate a native iOS app. Also
sells build power, launch packs, and a course.

This is **Part 1 of 3** (Platform). Part 2 is the Builder (Void fork); Part 3 is
Growth (clippers, affiliates, admin).

## Stack

- **Next.js** (App Router) + **TypeScript** + **Tailwind**
- **Supabase** (auth, Postgres, storage; `pgvector` for the build cache)
- **Stripe** (payments)
- Deploy target: **Vercel**

## Mock mode (run with zero accounts)

Every integration is optional. If a service's env vars are missing, the app
falls back to a **mock** for that service:

| Missing keys | Behavior |
| --- | --- |
| Supabase | In-memory data store (`src/lib/db.ts` + `src/lib/mock`) and cookie auth |
| Stripe | A local mock checkout screen that credits the account |
| Chat model | Deterministic interview replies + master-prompt synthesis |
| Image / video model | Soft gradient placeholders + stubbed video specs |

So `npm install && npm run dev` just works. Data resets on restart.

> The **first account you create** becomes the admin (founder) in mock mode.

## Getting started

```bash
npm install
cp .env.example .env.local   # optional — fill in only what you have
npm run dev                  # http://localhost:3000
```

Then: **Start building → sign up → pay the $1 (mock) → New app → chat → reveal.**

## Project structure

```
src/
  app/
    page.tsx                 # 1. Landing
    signup/ login/           # 2. Auth (email/pass + Google)
    deposit/                 # 3. $1 deposit flow
    dashboard/               # 4. Dashboard (projects, build power)
    project/[id]/build/      # 5. Chat interview (the core)
    project/[id]/            #    App reveal + builder handoff + launch pack
    buy/                     # 6. Build power packs + review top-up
    launch/                  # 7. Launch pack entry
    course/                  # 9. Course (3 subscription tiers)
    admin/                   #    Founder overview + cache stats
    legal/[id]/[doc]/        # 8. Free Privacy/Terms/Support (hosted HTML)
    checkout/                #    mock + success screens
    api/                     #    see "API contract" below
  components/                # UI (design-system components)
  lib/                       # config, db, payments, models, types, utils
  server/                    # server actions (auth, checkout, projects)
supabase/migrations/         # 10. SQL incl. pgvector + find_similar_builds()
docs/                        # the original Appable prompt/spec docs
```

## API contract (called by the build engine — service-key auth)

All of these require the `APPABLE_SERVICE_KEY` as `Authorization: Bearer <key>`
(or `x-appable-key: <key>`).

| Method & path | Purpose |
| --- | --- |
| `GET  /api/projects/:id/master-prompt` | Fetch a project's master build prompt |
| `POST /api/auth/validate` | Validate a user (email+password) → id + balances |
| `POST /api/usage` | Report usage consumed (`build` / `review` split) |
| `POST /api/cache` | Store a completed build (respects data-sharing opt-in) |
| `POST /api/cache/similar` | `find_similar_builds(spec)` → top-N reference builds |
| `POST /api/stripe/webhook` | Stripe fulfillment (public, signature-verified) |

Example:

```bash
curl localhost:3000/api/projects/PRJ_ID/master-prompt \
  -H "Authorization: Bearer dev-service-key"
```

## Going live (swap mock → real)

1. **Supabase**: create a project, run `supabase/migrations/0001_init.sql`
   (enables `pgvector`), set `NEXT_PUBLIC_SUPABASE_URL`, `..._ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, then replace the bodies in `src/lib/db.ts` and
   `src/lib/session.ts` with Supabase queries / SSR auth.
2. **Stripe**: set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`. Checkout + webhook are already wired.
   Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
3. **Models**: set `CHAT_MODEL_*` (Step 3.5 Flash), `IMAGE_MODEL_*` (GPT Image 2),
   `VIDEO_API_KEY` (Seedance). Endpoints are OpenAI-compatible.

All prices, build-power amounts, and model names live in `src/lib/config.ts`
(overridable via env) — tune freely.

## Design system

Coral + cream, characterful display (Clash Display) + refined body (Satoshi),
soft floating cards, a breathing coral gradient mesh, grain texture, staggered
fade-up reveals, soft-confetti celebration moments. See `docs/appable-design-system.md`.
```
