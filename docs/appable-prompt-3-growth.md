# CURSOR PROMPT 3 — APPABLE GROWTH SYSTEMS (clipper army + admin)

## Context
This extends the Appable web platform (getappable.com, built in Prompt 1, same Next.js + Supabase + Stripe stack). It adds the creator/clipper management system and an admin dashboard. Build this as part of / alongside the existing platform repo.

## What you are building
1. A clipper army management system (recruit creators, track their video submissions and views, calculate tiered payouts).
2. A course-seller affiliate system (recurring commission tracking).
3. An admin dashboard for the founder to see everything.

## Build these features

### 1. Clipper onboarding + tiers
- Public application/signup page for clippers
- Store clipper profile: handle, platform(s), follower count, payout method (PayPal/Wise/USDC), tier (auto-assigned by follower count)
- Tiers by follower count:
  - Tier 0: 0–1K
  - Tier 1: 1K–10K
  - Tier 2: 10K–50K
  - Tier 3: 50K–300K (hybrid: upfront + bonus)
  - Tier 4: 300K–1M (flat upfront)
  - Tier 5: 1M+ (flat upfront)

### 2. Content types + payout matrix
Payout = follower-tier rate × content-type, capped. Make all rates/caps configurable in admin.
Content types and base rates (Tier 0 baseline; higher tiers apply a multiplier — Tier 1 ×1.25, Tier 2 ×1.5):
- Slideshow/Edit: $1/1K views, $150 cap
- Original Short: $2/1K views, $250 cap
- Build Video: $5/1K views, $400 cap (Tier 2 cap $600)
- IRL Stunt: $5/1K views, $400 cap (Tier 2 cap $600)
Tiers 3–5 are upfront flat (configurable per deal), Tier 3 also gets a per-1K bonus.

### 3. Submission + view tracking
- Clippers submit video links (TikTok/YouTube/IG/etc.) + content type
- Store submission: clipper, link, platform, content type, view count, status, payout owed
- Manual view-count entry to start, with a documented stub for later API/scraper integration
- 5K (configurable) minimum view threshold before payout eligibility
- Auto-calculate payout owed per submission from the matrix

### 4. Payouts
- Monthly payout view: total owed per clipper, grouped, with payout method
- Mark-as-paid workflow
- Export to CSV

### 5. Leaderboard
- Public leaderboard (gamify the grinders): top clippers by views/earnings this month

### 6. Course-seller affiliate system
- Affiliate signup, unique referral codes/links
- Track course subscriptions attributed to each affiliate
- 30–40% (configurable) recurring commission calculation while the referred subscription stays active
- Affiliate dashboard showing referrals + commission owed

### 7. Admin dashboard (founder only)
- Auth-gated to admin role
- Overview metrics: signups, deposits, usage-pack revenue, launch-pack revenue, course MRR, active course subs by tier, total clipper spend, net
- Clipper management: approve applications, set tiers, override rates, mark payouts paid
- Affiliate management
- Config panel: edit all rates, caps, build-power-per-pack, token budgets, model env settings surfaced where safe
- Cache stats: number of cached builds, estimated cost savings / cache hit rate

## DESIGN MANDATE
Follow the Appable design system doc — premium, anti-AI-slop, coral palette, characterful display font + clean body, soft rounded floating cards, light default. The admin dashboard can be denser/more functional but must still use the Appable palette and type — never generic SaaS template look. The public-facing clipper application page and leaderboard must match the consumer-grade polish of the main platform.

## Deliverables
- Clipper application + dashboard
- Submission + view tracking + payout matrix calculation
- Monthly payout view + CSV export + mark-as-paid
- Public leaderboard
- Affiliate system with recurring commission tracking
- Admin dashboard with metrics, management, and config panel
- All rates, caps, thresholds, and commission % configurable in admin

Build in this order: clipper data model + tiers, then submission/view tracking + payout matrix, then payouts + leaderboard, then affiliate system, then the admin dashboard tying it all together.
