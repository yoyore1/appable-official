# CURSOR PROMPT 2 — APPABLE BUILDER (forked Void editor)

## Context
This repository is a fork of the Void editor that currently contains unrelated work. FIRST: reset this codebase back to vanilla/default Void (remove all custom features not part of upstream Void). Then build the Appable Builder layer on top as described below. Do not preserve the existing custom code.

## What you are building
The Appable Builder is the build engine for Appable (getappable.com). It receives a "master build prompt" from the Appable web platform (by project ID, via API) and uses an AI coding agent to generate a complete native SwiftUI iOS app. It presents a friendly CHAT-STYLE interface over the editor so non-technical users are never overwhelmed by a normal IDE. Power users can toggle to the full editor view.

## Stack / models (make all of these env vars)
- Coding agent model: Kimi K2.6 via DeepInfra (OpenAI-compatible endpoint). Env: BUILD_MODEL_BASE_URL, BUILD_MODEL_KEY, BUILD_MODEL_NAME (default `moonshotai/Kimi-K2.6`)
- Secondary/cheap model (chat, summaries, small fixes): env CHAT_MODEL_* (will be Step 3.5 Flash)
- Platform API base URL + service key (to fetch master prompts and report completed builds): env APPABLE_API_URL, APPABLE_API_KEY

## Core requirements

### 1. Reset to default Void
Strip the fork back to upstream Void cleanly before adding anything.

### 2. Rebrand + chat-first UI
- Rebrand to "Appable Builder"
- Default view is a friendly chat panel (not the file tree / editor). The chat is the primary interface.
- Hide the file explorer, terminal, and editor by default. Provide a "Show advanced view" toggle for power users.
- Progress UI: when a build runs, show a friendly progress state with plain-language status ("Building your onboarding…", "Setting up your screens…"), not raw logs.

### 3. Auth + connect to platform
- On launch, user logs in with their Appable account (call the platform API to validate + get their user ID and usage balance).
- Fetch the master build prompt from the platform by project ID (documented platform endpoint).

### 4. The build loop (core)
- Take the master build prompt and use the Kimi K2.6 agent to generate a complete native SwiftUI Xcode project (proper .xcodeproj structure, folders, Info.plist, etc.).
- Base (free) build: UI only — onboarding, home, 2-3 feature screens, navigation, mock data, plus generated Privacy/Terms/Support references. Cap base build usage (configurable token budget).
- Full build (paid usage): real backend wired with Supabase (auth, database, storage), RevenueCat paywall, push notifications, error-fixing rounds. Configurable usage budget.
- Track usage consumed and report it back to the platform API (decrement the user's build power). Split tracking into "build" usage and "review" usage (80/20 default, configurable).

### 5. Error-fixing loop
- After generating, attempt to build. Read compiler/build errors, feed them to the agent, apply fixes, rebuild. Cap iterations (configurable, default ~5-6 rounds). On Mac this uses local Xcode (see #6). On Windows this defers to Codemagic (see #7).

### 6. Mac path (local Xcode)
- Provide big friendly buttons in the chat UI: "Open in Xcode" and "Run".
- "Run" triggers an xcodebuild/simulator launch via local terminal commands (handled by the agent, invisible to the user).
- Pipe Xcode build logs to the agent automatically so it can detect and fix failures without the user reading errors.

### 7. Windows path (Codemagic)
- Detect OS. If Windows, the user cannot run Xcode locally.
- Provide a guided "Import to Codemagic" flow: walk the user step-by-step (in chat) through connecting a Codemagic account (their own free tier), pushing the generated project, building in the cloud, and installing via internal TestFlight on their iPhone.
- The agent should generate the codemagic.yaml and any config needed.

### 8. Local AI assistant — screen awareness + hotkey (Mac first)
- Bundle a small native macOS helper (Swift) that uses the Accessibility API (AXUIElement) to read on-screen UI/text of the frontmost app. Request accessibility permission once on first launch.
- The helper streams context to the Builder over a local WebSocket (localhost).
- Global HOTKEY: when pressed, capture the current frontmost-app context (e.g. Xcode error, Railway/Supabase/App Store Connect/RevenueCat setup screen) and combine it with the user's full project context, then have the agent give specific, contextual help in the chat.
- The assistant should also act automatically on build failures (read the error, fix, rebuild) without needing the hotkey.
- Keep the helper idle/passive until a trigger (hotkey or build-failure event) to keep cost/CPU near zero.

### 9. Report completed build to platform (for caching)
- On a successful build, POST the app spec + generated code reference to the platform's cache endpoint so it can be embedded and stored for future reuse (respecting the user's data-sharing opt-in, which the platform tracks).
- Before generating, call the platform's `find_similar_builds` endpoint with the spec; if good matches return, inject their code structure into the agent's context as reference templates so it adapts rather than generating from scratch.

## Phasing (build in this order, all in scope for launch)
- PHASE 1 (core loop): reset to default Void → rebrand + chat-first UI → platform auth + master prompt fetch → Kimi build loop → log-based error fixing → Mac Xcode path + Windows Codemagic path → report usage + cache read/write. Get a normie able to build one real Swift app end to end that runs in the simulator (Mac) / TestFlight (Windows).
- PHASE 2 (advanced, after core loop runs): the macOS accessibility helper + global hotkey contextual assist, and "Debug My App" mode (below). These are higher-risk engineering; build and test them only once the Phase 1 loop is proven working. Still part of launch scope.

## Debug My App mode (Phase 2, Mac-first)
- Fuse three signals so the agent can self-test the app it built: (1) screenshot the running iOS Simulator and pass it to a vision model, (2) read the simulator's accessibility tree via AXUIElement, (3) read Xcode/console logs.
- The agent can also CONTROL the simulator (tap, scroll, navigate) via accessibility APIs to walk through the app like a user, find broken flows/blank screens/dead buttons, fix the code, rebuild, and re-test.
- Surface this as a friendly "Debug my app" button. Windows users (no local simulator) fall back to log-based fixing + TestFlight on their real device.

## DESIGN MANDATE — premium, anti-AI-slop (applies to the whole Builder UI)
This must NOT look like generic AI-generated UI. Follow the Appable design system doc exactly. Specifically:
- NO generic fonts (no Inter, Roboto, Arial, system defaults). Use a characterful modern display font for headings + a clean refined sans for body, per the design doc.
- NO purple-gradient-on-white cliché, NO cookie-cutter SaaS layout. Use the Appable coral palette: warm off-white/cream base, coral primary, soft charcoal text, calm green for success.
- Light default. Chat-first. Calm interiors so the real simulator/app is the star.
- Soft rounded floating cards with diffuse shadows, faint grain texture, a subtle breathing coral gradient signature, staggered fade-up reveals. Warm human microcopy (never expose tokens/API/compile — translate to outcomes). Celebration moments (soft confetti) on build complete / app live.
- Even the "advanced view" (full editor) must be re-themed to Appable's coral system so it never looks like raw VS Code.
- Match implementation effort to a refined, intentional aesthetic. Precision and restraint over decoration. It should feel like a premium consumer product someone is proud to be seen using on TikTok.

## Deliverables
- Clean Void fork reset to upstream, with the Appable Builder layer on top
- Phase 1 core loop fully working before Phase 2
- Debug My App mode (Phase 2)
- Chat-first UI with advanced toggle
- Working agent build loop with Kimi K2.6 (env configurable)
- Error-fixing loop with iteration cap
- Mac local Xcode path + Windows Codemagic guided path
- macOS accessibility helper + WebSocket bridge + global hotkey contextual assist
- Platform API integration (auth, fetch master prompt, report usage, cache read/write)
- All models, keys, budgets, and iteration caps as env vars / config

Start by resetting to default Void. Then complete all of PHASE 1 (chat-first UI → platform API + master prompt fetch → Kimi build loop → error-fixing → Mac/Windows paths → usage + cache) and get one real Swift app building end to end. Only then build PHASE 2 (accessibility helper + hotkey, then Debug My App mode). Apply the Appable design system / anti-slop mandate throughout. All models, keys, budgets, and iteration caps as env vars / config.
