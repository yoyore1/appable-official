# APPABLE — DESIGN SYSTEM (hand to Cursor alongside all three prompts)

The mandate: premium, intentional, anti-AI-slop. This should feel like a consumer product people are proud to use on camera — NOT a generic AI/dev tool. Apply across the web platform AND the Builder so there is no visible seam.

## Anti-slop rules (non-negotiable)
- NO generic fonts: no Inter, Roboto, Arial, or OS system fonts.
- NO purple-gradient-on-white cliché. NO evenly-distributed timid palettes. NO cookie-cutter SaaS card-grid template look.
- Dominant color with sharp accents beats a balanced rainbow. Commit fully to the identity below.
- Precision and restraint over decoration. Elegance comes from spacing, type, and a few high-impact moments — not from piling on effects.

## Personality
Encouraging expert friend. Premium but warm. Linear-grade polish with Duolingo-grade encouragement. A nervous first-timer should feel "I can actually do this" at every step.

## Color (light default)
- Base background: warm off-white / cream (slightly creamy, never stark white)
- Primary / action: CORAL (warm coral-salmon). The single dominant brand color.
- Text: soft charcoal (not pure black)
- Success / "done": a calm refined green (used only for completion moments)
- Borders / secondary text: soft warm greys
- Dark mode: offered as a toggle, not the default
- Use CSS variables for all of the above.

## Signature background
A soft, slowly "breathing" CORAL gradient mesh (coral → peach → cream). Full-strength behind the landing hero; dialed WAY back on dashboard and Builder interiors so they stay calm to work in. Add a faint grain/noise overlay for tactility. Cards over the gradient get a subtle frosted/translucent quality.

## Typography
- Display (headings): a characterful modern sans with personality (e.g. Clash Display / Cabinet Grotesk / General Sans family of feel). Bold, confident, brandable.
- Body: a clean refined sans (e.g. Satoshi / a neutral warm grotesk).
- Pair one distinctive display with one refined body. Never converge on the obvious default.

## Layout
- Web platform: minimal top nav (logo left, account right); dashboard home base with project cards in a soft grid; build-power bar always visible; ONE primary coral action highlighted per screen; generous whitespace; mobile-first single-column stacking.
- Builder: chat-first (conversation centered, comfortable reading width); the REAL iOS Simulator (Mac) sits beside the chat as the "preview" — there is no embedded render panel since this is native Swift; big friendly action buttons anchored bottom ("Run," "I need help"); "Advanced view" toggle tucked in a corner (re-themed editor, never raw VS Code); calm quiet background so the running app is the star.

## Components
- Buttons: primary = solid coral, soft-rounded, gentle shadow, subtle press-lift; secondary = cream with soft border + charcoal text; big action buttons = larger pills with a small rounded icon. Warm button copy ("Let's build it," not "Submit").
- Inputs/chat: large rounded hero input with soft inner shadow + inviting placeholder; AI bubbles cream (left), user bubbles coral-tinted (right); tappable soft-pill option buttons that highlight coral when selected (great for the vibe question on mobile).
- Cards: rounded, floating, diffuse shadow; project cards lead with a phone-preview thumbnail (Mac: simulator capture; Windows: device screenshot) + app name + status.
- Build-power bar: friendly rounded bar, coral fill, plain-language label "Build power" with an inline top-up button; gentle glow/pulse when low (nudge, never nag).
- Status cards (during builds): animate in one at a time with a soft icon + friendly text ("Designing your onboarding ✨"), soft check on complete. Never show scary scrolling code to normies.
- Icons: rounded, soft-stroke, friendly, one consistent set.

## Motion
- Gradient mesh breathes (barely perceptible).
- Staggered fade-up reveals on load (one well-orchestrated entrance beats scattered micro-animations).
- Celebration moments: soft confetti + warm message + the app front-and-center on build complete, app submitted, and app-goes-live.

## Voice / microcopy
Talk like a person; celebrate them; never expose machinery (no tokens/API/compile/backend — translate to outcomes). Examples:
- Landing: "Build your first app free." / "You have an idea. We'll turn it into a real app on the App Store. No coding. Seriously."
- Start: "$1 to get started — that's it. It goes toward your first build."
- Interview: "Tell me about your app — what's the idea?" / "Love it. Who's it for?"
- Building: "Designing your onboarding ✨" / "Making it beautiful…"
- Reveal: "Meet your app. 🎉 This is really yours."
- Upsell: "Your app looks amazing. To make it fully work — logins, saving data, payments — let's power it up."
- Low power: "You're running low on build power — top up to keep going."
- Errors (assistant): "Hit a small snag — fixing it now, one sec." / "All sorted! Try running it again."
- Stuck/hotkey: "I can see your screen — here's exactly what to do next."
- Can't-fix fallback: "This one's being stubborn. I've saved everything — want me to try a different approach, or get a human to look?"
- Live: "It's live. You're officially an app founder. 🎉"

## Signature moment
The single thing people remember and screenshot: their real app coming alive (simulator on Mac / their phone on Windows) right after a calm, friendly chat — with a one-tap "Share my build" that records the chat→app reveal into a clean vertical clip ready for TikTok.
