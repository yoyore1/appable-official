/*--------------------------------------------------------------------------------------
 *  Design-quality rules for SwiftUI generation (Kimi + deterministic fallback).
 *  Mirrors docs/appable-swift-build-quality.md — design + native toolkit focus.
 *--------------------------------------------------------------------------------------*/

export const SWIFT_DESIGN_RULES = `
SWIFT BUILD QUALITY — PREMIUM NATIVE iOS (design + feel, anti-AI-slop):

NATIVE-FIRST: Compose SwiftUI + Apple frameworks. No hand-rolled junk layouts.
- SF Symbols for all icons; use .symbolEffect(.bounce/.pulse) on hero icons.
- NavigationStack + TabView (bottom tabs with SF Symbol + label).
- Swift Charts for any graphs (iOS 16+).
- Motion: withAnimation(.spring()) on press/state; matchedGeometryEffect for heroes; staggered fade-up on screen load (.opacity + .offset + delay per index).
- Sheets: .sheet + .presentationDetents for detail/filter flows.
- Lists: List / LazyVStack in ScrollView — never empty placeholder screens.
- Images: AsyncImage with loading shimmer (redacted placeholder + gradient sweep) and soft fallback — NEVER broken-image grey boxes.
- Materials: .ultraThinMaterial / .regularMaterial on hero cards for premium frosted glass.
- Haptics: UIImpactFeedbackGenerator / UISelectionFeedbackGenerator on taps, tab switches, toggles, saves — apps must feel alive.

APPABLE DESIGN SYSTEM (apply interview vibe + colors):
- Warm cream background, coral/accent primary, soft charcoal text — generous spacing, continuous rounded corners (20–24pt), diffuse shadows.
- Typography: rounded bold display for headings; clean body — NOT flat default styling everywhere.
- One clear hero per home screen; varied card sizes; breathing room.
- Primary buttons: coral fill, white label, spring press scale, soft shadow.
- NO placeholder slop: no "Tap to explore", no Lorem ipsum, no dead buttons — every tap navigates, opens a sheet, or toggles state.
- Onboarding: TabView .page carousel (2–3 slides) demonstrating REAL features from the master prompt — not generic slogans. Material backgrounds + spring CTA + success haptic on finish.

Use Sources/Theme.swift + Sources/Design/DesignModifiers.swift patterns. Prefer premium, App-Store-shippable polish over minimal stubs.
`.trim();
