# CURSOR PROMPT 1 — APPABLE WEB PLATFORM (getappable.com)

## What you are building
Appable is a web platform where anyone can build a real iOS app for free using AI. Tagline: "Build your first app free." A user signs up, pays a $1 deposit, answers a short chat interview about their app idea, and the platform generates a master build prompt that gets handed off to a build engine (separate service). Users buy AI "usage" to unlock full builds, can buy a launch pack (screenshots, ASO, video ads), and can subscribe to a paid course.

This prompt builds ONLY the web platform. The build engine (forked editor) and the local assistant are separate services that talk to this platform via API.

## Stack
- Next.js (App Router) + TypeScript + Tailwind
- Supabase (auth, Postgres, storage) — use pgvector extension for the cache system
- Stripe for payments
- Deploy target: Vercel

## DESIGN MANDATE — premium, anti-AI-slop (follow the Appable design system doc exactly)
This must NOT look like generic AI-generated UI.
- Mobile-first, normie-friendly. One clear action per screen. Plain language — never say "tokens," say "build power."
- NO generic fonts (no Inter, Roboto, Arial, system defaults). Characterful modern display font for headings + clean refined sans for body.
- NO purple-gradient-on-white cliché, NO cookie-cutter SaaS layout. Use the Appable palette: warm off-white/cream base, coral primary, soft charcoal text, calm green for success.
- Light default. A soft breathing coral gradient mesh as the brand signature (full-strength on landing, dialed way back on dashboard/interior so it stays calm to work in). Faint grain texture for tactility.
- Soft rounded floating cards with diffuse shadows (not flat, not harsh borders). Staggered fade-up reveals on load. Warm human microcopy throughout. Soft-confetti celebration moments on build complete / app submitted / app live.
- Landing borrows the best of the category (one inviting hero chat input, bold headline, project cards with phone-preview thumbnails) but in Appable's warm coral identity — instantly recognizable on TikTok.
- Precision and restraint over decoration. Feel like a premium consumer product, not a dev tool.

## Build these features

### 1. Landing page
- Hero: "Build your first app free" + one-line subhead + big CTA "Start building"
- A 60-second explainer section (placeholder video embed)
- Social proof section (placeholder)
- Simple, bold, high-conversion design

### 2. Auth (Supabase)
- Email + password and Google OAuth
- On first signup, route into the $1 deposit flow before dashboard access

### 3. $1 deposit flow (Stripe)
- Stripe Checkout for a $1 charge
- Copy: "$1 deposit to get started — used as build credit"
- Store deposit + credit balance in Supabase
- Terms note: deposit becomes a non-refundable build credit once a build is used

### 4. Dashboard
- Project cards (each app the user has started)
- A usage/"build power" bar showing remaining balance
- Buttons: New App, Buy Build Power, Launch Pack, Course
- Clean, friendly, mobile-first

### 5. The chat interview (THE CORE)
Conversational, one question at a time, friendly. Uses an LLM via an API route (model configurable via env var; default to a cheap chat model endpoint — make the base URL + key + model name env vars so I can point it at Step 3.5 Flash later).
Five questions, asked one at a time:
1. What's your app idea?
2. Who is it for?
3. What are the 3 main things it does?
4. Pick a vibe: Cinematic / Minimal / Bold / Soft / Luxury (tappable buttons)
5. Any specific colors?
After Q5, show "Perfect. Building your app now…" and generate a structured master build prompt (JSON: appName, description, audience, features[], vibe, colors, screens[]). Store it in Supabase tied to the project. Show a clear handoff state ("Open in Appable Builder") — leave the actual handoff as a documented API endpoint that the build engine will call to fetch the master prompt by project ID.

### 6. Usage / build power packs (Stripe)
- $19.99, $49.99, $99.99 packs (store the balance, make the amount of "build power" per pack a configurable value)
- $1.99 review top-up (separate review balance)
- Purchase flow via Stripe Checkout, update balances on webhook

### 7. Launch pack ($6.99, Stripe)
- Purchase per project
- After purchase, generate (via configurable API routes, env-var keys):
  - ASO copy (title, subtitle, keywords, description) — cheap chat model
  - App Store screenshots + icon — image model (env var configurable, will be GPT Image 2)
  - 3 short video ad scripts/specs — leave a documented stub for a video API (will be Seedance)
- Individual purchase options: ASO $2.99, Screenshots $3.99, Video ads $3.99
- Display generated assets in the project view with download buttons

### 8. Free inclusions per project
- Auto-generate Privacy Policy, Terms of Service, and a hosted Support page (simple generated HTML stored in Supabase storage, each with a public URL)

### 9. Course platform
- Three tiers (Stripe subscriptions): $49.99, $79.99, $149.99/month
- Gated course content area (placeholder lessons)
- Each tier grants a monthly build-power allocation + launch pack inclusion (configurable)
- A simple 1-1 booking placeholder (calendar link field)

### 10. Caching system (Supabase + pgvector)
- Table `cached_builds`: id, category, features[], vibe, colors, code_ref (storage path), embedding (vector), shared (bool), created_at
- On each completed build (triggered via an API endpoint the build engine calls), store metadata + an embedding of the app spec
- Provide an API endpoint `find_similar_builds(spec)` that returns top-N similar cached builds by vector similarity, filtered to shared=true OR same user
- On signup, ask the data-sharing opt-in: "Allow your build patterns to improve Appable for everyone? Your idea stays private, only code structure is shared."

## Deliverables
- Full Next.js project, runnable locally with documented env vars
- Supabase schema (SQL migrations) including pgvector
- Stripe products + webhook handler
- All API routes documented in a README, especially the ones the build engine will call: fetch master prompt by project ID, post completed build to cache, find similar builds
- Clean, mobile-first, friendly UI throughout

Start by scaffolding the project, setting up Supabase schema and auth, then build features in the order listed. Make all model/API keys and "build power" amounts env vars or config constants so they're easy to tune later.
