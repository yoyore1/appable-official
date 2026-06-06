# Appable Builder — engine

Part 2 of Appable. Turns a **master build prompt** (from the Part 1 platform) into
a complete native **SwiftUI** iOS app using the **Kimi K2.6** coding agent, runs an
**error-fixing loop**, and ships it — **Xcode/simulator on Mac**, **Codemagic →
TestFlight on Windows** — then reports usage and writes to the platform build cache.

This is the **engine** (the brains). It runs standalone and is designed to be
wired into the **Void fork's chat-first UI** (see "Wiring into Void" below).

## Run it now (mock mode, no keys)

```bash
cd appable-builder
npm install
npm run build:app -- --project sample --mode base --verbose
```

This builds the bundled sample app and writes a real XcodeGen SwiftUI project to
`./builds/<AppName>/`. On Windows it also emits a `codemagic.yaml` and prints the
guided TestFlight flow; on Mac it prints the Xcode/run commands.

### Flags
| Flag | Default | Meaning |
| --- | --- | --- |
| `--project <id>` | `sample` | Platform project ID (or `sample` for the baked-in demo) |
| `--mode base\|full` | `base` | Base = UI only (free); Full = backend + paywall + push |
| `--email` / `--password` | mock | Appable account for platform auth |
| `--verbose` | off | Show the raw technical detail (advanced view) |

## Connect to the real platform

Set `APPABLE_API_URL=http://localhost:3000` (Part 1 running) and
`APPABLE_API_KEY=dev-service-key` in `.env.local`. Then a real project ID will:
fetch its master prompt, pull similar builds from the cache for reference
injection, report usage (decrementing build power), and post the completed build
back to the cache.

Add `BUILD_MODEL_*` (Kimi via DeepInfra) to use the real coding agent instead of
the deterministic generator. All budgets/caps are env-configurable (see
`.env.example`).

## What it generates

An XcodeGen project (`project.yml` + `Sources/` + `Resources/`), themed to the
app's vibe/colors, with an `@main` app, onboarding gate, a tab bar, a SwiftUI
view per screen, and mock data. `--mode full` adds Supabase auth/db, a RevenueCat
paywall, and push notifications. We use XcodeGen instead of a hand-written
`.pbxproj` so output is clean and reproducible on Mac and Codemagic.

## Architecture

```
src/
  config.ts      env + mock detection + budgets/caps
  platform.ts    Appable platform client (auth, prompt, usage, cache)
  model.ts       Kimi K2.6 agent (+ deterministic fallback) + token accounting
  swiftgen.ts    SwiftUI/XcodeGen project generator
  compile.ts     error checks (Mac xcodebuild / off-Mac static check)
  codemagic.ts   codemagic.yaml + guided Windows flow
  os.ts          OS detection → ship path
  buildAgent.ts  the orchestrated core loop
  cli.ts         runnable entry point
```

## Wiring into Void (next step)

The Void fork's chat panel calls `buildApp()` and renders the `Progress` events
as friendly status cards, with an "Advanced view" toggle that reveals the
`detail()` lines and the generated files in the editor. Big action buttons map to
"Open in Xcode" / "Run" (Mac) or "Import to Codemagic" (Windows).
```
