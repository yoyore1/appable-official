# APPABLE — SWIFT BUILD QUALITY SPEC (premium native iOS, anti-AI-slop)

The Swift-native equivalent of the React Native build-quality spec. Same PRINCIPLES (anti-slop, no placeholders, multi-pass self-critique, real functional flow, "looks like a real shipped app" bar, onboarding psychology/archetypes) — but built with the native Apple toolkit instead of RN/Expo libraries. Governs the Swift-native build path (desktop/Mac, the premium "Highly Recommended" path). Apply the Appable coral design system throughout.

## CORE RULE: NATIVE-FIRST, ASSEMBLE FROM QUALITY PARTS
SwiftUI is powerful natively — lean on Apple's own frameworks before any third-party library. Do NOT free-style raw layouts. Compose proven SwiftUI components + the design system. Constrain to the toolkit below.

## NATIVE TOOLKIT — what to use for what (no install needed; use these FIRST)
- **SwiftUI** — all UI (replaces Tamagui). Use proper components, not hand-rolled views.
- **SF Symbols** — all icons (replaces lucide). Consistent, huge set; use **Symbol Effects** (bounce, pulse, variable-color) for "alive" icons.
- **NavigationStack / TabView** — navigation (replaces Expo Router). Bottom tab bar for primary sections; stacks for drill-downs.
- **Swift Charts** (iOS 16+) — ALL charts/graphs. Native, auto-animating, theme-aware. No third-party chart lib.
- **Animations (replaces reanimated/moti):**
  - `withAnimation(.spring())` — spring/physics motion (cards scale on press, things settle naturally) — the core "premium feel"
  - **matchedGeometryEffect** — smooth hero transitions between screens
  - **PhaseAnimator** (iOS 17+) — cyclic/sequenced animations (pulsing CTAs, looping effects)
  - **KeyframeAnimator** (iOS 17+) — granular After-Effects-style control for micro-interactions
  - **.transition** + staggered `.animation` delays — fade-up/staggered entrances on screen load
- **.sheet / .presentationDetents** — bottom sheets / detail views / filters (replaces gorhom)
- **List / LazyVStack / LazyHGrid / ScrollView** — performant lists/grids (replaces flash-list)
- **AsyncImage** — image loading + caching (replaces expo-image). Always provide a placeholder/loading state — never a broken image.
- **Material / .ultraThinMaterial / .regularMaterial** — native frosted-glass blur (replaces expo-blur) — premium iOS look, built in
- **GlassEffectContainer / Liquid Glass** — newest native premium glass effects for hero moments
- **Core Haptics / UIFeedbackGenerator (.impact/.selection/.notification)** — haptics on EVERY interaction (replaces expo-haptics). The #1 "alive/premium" lever — use everywhere (taps, tab switches, toggles, saves).
- **Device features:** AVFoundation/Camera (camera), PhotosUI/PHPicker (photo library), Core Location (GPS), UserNotifications (push), AVFoundation (audio). WIRE THESE FUNCTIONALLY when the app needs them — camera actually opens and captures, never a placeholder button.

## THIRD-PARTY — only where native falls short
- **Lottie-iOS** — animated illustrations for onboarding (the premium onboarding lever; same role as in RN). Free animations from lottiefiles.com.
- **Pow** — pre-packaged premium micro-interaction/transition effects (e.g. a "like" exploding into particles) that would take days to hand-build. Big premium-delight lever.
- **Rive** — interactive/designer-driven animations when you need more than Lottie (optional, advanced).
- **NavigationTransitions** — custom animated navigation transitions (optional).
- **Shimmer** — skeleton/shimmer loading states (or build with native redaction `.redacted(reason:)` + animation). Never a blank screen or bare spinner.

## CONTENT RULES (kill the fake look)
- NO placeholder text ("Tap to explore," "Lorem ipsum," empty cards). Every screen has REAL, plausible content for the app's purpose.
- Every interactive element actually does something (navigates, opens a sheet, toggles state) — no dead buttons.
- Real imagery via AsyncImage with proper loading/fallback — never a broken-image icon or grey box.
- The app must feel USABLE and finished on first open.

## DESIGN RULES (Appable design system, native)
- Apply the interview's vibe + colors as the app theme, over a clean SwiftUI base.
- Premium, intentional: generous spacing, soft rounded cards (`.clipShape(RoundedRectangle(cornerRadius:))`), proper type hierarchy (use custom display font for headings + clean body — not default SF for everything if a characterful font fits the brand), diffuse shadows, NOT flat default styling.
- One clear hero/focal element per screen, varied card sizes, breathing room.
- Proper bottom TabView with SF Symbol icons + labels.
- Staggered fade-up entrances so screens feel alive, not static.

## ONBOARDING (same archetypes + psychology as RN, built native)
- Archetypes: show-the-magic-first / value-prop carousel / personalization-first / hybrid (master prompt indicates which).
- Build the carousel with TabView (.page style) + Lottie animated illustrations + matchedGeometry/spring transitions + Material backgrounds.
- HARD RULE: each onboarding screen DEMONSTRATES the real feature, never a generic slogan.
- Psychology beats: quick win/aha fast, investment effect, personalization payoff, seeded social proof/aliveness, progress + completion (celebrate with a Pow/Symbol-effect moment), upgrade-as-level-up.

## PROCESS: MULTI-PASS, NOT SINGLE-SHOT
1. Generate the full app from the master prompt using the native toolkit above.
2. Self-critique: any placeholder content? dead buttons? hollow screens? broken images? generic onboarding slogans? flat/default styling? Does the core functional flow actually work?
3. Refine: fix every issue — real content, wired interactions, real device features, premium styling, specific onboarding.
4. Repeat until it passes: "Would a normie believe this is a real, premium, finished App Store app they'd be proud to post?"

## THE BAR
Native iOS should look MORE premium than the RN path (it's the "Highly Recommended" tier). Use Material blur, spring physics, SF Symbol effects, haptics everywhere, and Pow/Lottie delight moments to make it feel unmistakably high-end. Looking fake or generic = failed build.
