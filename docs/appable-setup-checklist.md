# APPABLE — PRE-BUILD SETUP CHECKLIST

Set these up before / while running the prompts. Every key below maps to an env var in the prompts.

## Domain
- [ ] Register getappable.com

## Accounts to create
- [ ] DeepInfra (Kimi K2.6 — coding agent). Model: `moonshotai/Kimi-K2.6`. OpenAI-compatible endpoint.
- [ ] Step 3.5 Flash provider (cheap chat/secondary model) — get base URL + key
- [ ] Supabase (auth, Postgres, storage; enable the `pgvector` extension)
- [ ] Stripe (products + webhook signing secret)
- [ ] GPT Image 2 / OpenAI (launch-pack screenshots + icon)
- [ ] Seedance video provider (launch-pack video ads) — wire later, stub for now
- [ ] Codemagic (Windows users use their own free tier; you just need to understand the flow + generate codemagic.yaml)
- [ ] Vercel (deploy the platform)

## Env vars — PLATFORM (Prompt 1)
- [ ] SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
- [ ] STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY
- [ ] CHAT_MODEL_BASE_URL, CHAT_MODEL_KEY, CHAT_MODEL_NAME (Step 3.5 Flash — interview + ASO)
- [ ] IMAGE_MODEL_KEY (GPT Image 2 — screenshots/icon)
- [ ] VIDEO_API_KEY (Seedance — stub ok at first)
- [ ] BUILD_POWER per pack ($19.99 / $49.99 / $99.99), and the $1.99 review top-up amount (config constants)

## Env vars — BUILDER (Prompt 2)
- [ ] BUILD_MODEL_BASE_URL, BUILD_MODEL_KEY, BUILD_MODEL_NAME (Kimi K2.6 via DeepInfra)
- [ ] CHAT_MODEL_* (Step 3.5 Flash for small fixes/summaries)
- [ ] APPABLE_API_URL, APPABLE_API_KEY (talk to the platform: auth, fetch master prompt, report usage, cache read/write)
- [ ] Base-build token budget, full-build token budget, error-fixing iteration cap, build/review split (default 80/20)

## Cross-service API contract (must match across prompts)
- [ ] Platform endpoint: fetch master prompt by project ID
- [ ] Platform endpoint: report usage consumed (decrement build power; build vs review)
- [ ] Platform endpoint: POST completed build to cache (spec + code ref, respect data-sharing opt-in)
- [ ] Platform endpoint: find_similar_builds(spec) → top-N for reference injection
- [ ] Platform endpoint: validate user session / get balance (Builder login)

## Build order
1. Prompt 1 (platform) — get signup → $1 → interview → master prompt stored, running locally, deployed to Vercel
2. Prompt 2 Phase 1 (builder core loop) — reset Void, chat UI, fetch master prompt, Kimi build, error-fix, Mac+Windows paths, one real Swift app end to end
3. Prompt 1 remaining (launch pack, course, caching polish)
4. Prompt 3 (growth: clippers, affiliate, admin)
5. Prompt 2 Phase 2 (accessibility helper + hotkey, then Debug My App)

Always hand Cursor the design-system doc with every prompt.
