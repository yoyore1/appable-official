# APPABLE — AI INTEGRATION SYSTEM (for apps built on Appable)

See the full spec in the user's integration doc. Summary for developers:

## Two provider accounts (Appable's keys — users set up nothing in demo)

1. **DeepInfra** (~80–90% of calls) — Qwen, Kimi, Qwen3-VL, FLUX, Whisper, TTS, embeddings
2. **OpenRouter** (premium escalation only) — Claude / GPT / Gemini for complex tasks

Env: `DEEPINFRA_API_KEY` + `OPENROUTER_API_KEY` in `.env.local`.

## Router (`src/lib/models/router.ts`)

1. Classify capability → task (vision, cheap_text, image_gen, …)
2. Classify complexity → simple | mid | complex
3. Route:
   - simple/mid → DeepInfra
   - complex + OpenRouter configured → OpenRouter

## Normie-facing rules

- Never show model names in UI
- Demo/build = Appable keys (capped)
- Publish = user's own key or Appable AI credits (future)
