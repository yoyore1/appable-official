# Appable Builder

This folder holds **Part 2** of Appable — the build engine and Void editor integration.

| Path | What it is |
| --- | --- |
| `appable-builder/` | Standalone Node CLI — fetch plan by project ID, generate SwiftUI, ship |
| `void/` | Appable patches for the [Void](https://github.com/voideditor/void) fork (chat UI, engine, IPC) |

## Quick start (Void fork — full Builder app)

1. Clone [Void](https://github.com/voideditor/void) (or your fork) into a sibling folder.
2. Copy `void/scripts/*` and overlay `void/src/**` + `void/product.json` onto the Void tree.
3. Copy `void/.env.example` → Void root `.env.local` and fill in keys.
4. From Void root:

```bash
npm install
npm run watch          # keep running — compiles engine.ts
npm run buildreact     # after UI changes
scripts/code-appable.bat
```

Set `APPABLE_API_URL=http://localhost:3000` and `APPABLE_API_KEY` to match the platform's `APPABLE_SERVICE_KEY`.

## Standalone CLI

```bash
cd builder/appable-builder
npm install
cp .env.example .env.local
npm run build -- --project-id prj_xxx
```

## Platform connection

The web app (repo root) stores master prompts. The Builder fetches them via:

`GET /api/projects/:id/master-prompt` with `Authorization: Bearer <APPABLE_SERVICE_KEY>`
