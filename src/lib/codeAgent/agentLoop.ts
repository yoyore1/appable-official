import { integrations, codeAgentConfig } from "@/lib/config";
import { codeAgentChatComplete } from "@/lib/planChat";
import { formatPreviewBuildStateBlock } from "@/lib/expoApp/previewBuildState";
import type { PreviewBuildState } from "@/lib/expoApp/previewBuildState";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import type { MasterBuildPrompt } from "@/lib/types";
import { runCodeAgentTool } from "./tools";
import type { CodeAgentStep, CodeAgentToolCall } from "./types";

type AgentTurn = {
  done?: boolean;
  ask?: string | null;
  reply?: string;
  tools?: CodeAgentToolCall[];
};

type AgentMode = "edit" | "initial";

function parseAgentTurn(text: string): AgentTurn | null {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as AgentTurn;
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as AgentTurn;
      } catch {
        return null;
      }
    }
  }
  return null;
}

const SYSTEM = `You are Appable Build — a real mobile app coding agent (like Replit/Rork). You edit files in a per-project Expo workspace.

SOURCE OF TRUTH:
- model/expoAppModel.json — tabs, home sections/items (badge, meta), tabScreens, flow, theme
- app/(tabs)/*.tsx — expo-router screens (index = Home, other tabs = tab id files)
- app/welcome.tsx, app/role.tsx, app/setup.tsx, app/sign-in.tsx — launch flow
- src/components/ListCard.tsx — listing card UI

TAP-TO-EDIT (must preserve):
- Every text uses <EText id="..." style=...> and every editable container uses <EView id="..."> / SafeAreaView with dataSet={{ appableKind, appableId }} from src/lib/editable.tsx.
- When you add or change screens, ALWAYS render text with <EText id="<stable.path>"> and containers/backgrounds with <EView> or a dataSet appable tag — never raw <Text>/<View> for visible content. This keeps the builder's tap-to-edit working.
- Per-element color/background overrides live in model.elementStyles (keyed by appable id). Don't strip them.

RULES:
- Founder requests are literal. "Remove cart" = delete cart from model.tabs + tabScreens, regenerate app/(tabs) if needed.
- "Add status chips" = set home.sections[n].items[m].badge to Open/Matched/Done in JSON.
- "Area labels" = set .meta on listing items (e.g. "Brooklyn · near you").
- Structural changes: edit JSON first, then App.tsx only if renderer must change.
- Execute — do NOT ask which screen unless the request is truly empty.
- After edits: run_cmd "npm run typecheck" or "npx tsc --noEmit" before done:true.

Output STRICT JSON each turn:
{"tools":[{"tool":"read_file","path":"..."}],"done":false}
OR
{"tools":[{"tool":"write_file","path":"...","content":"..."}],"done":true,"reply":"what changed in plain English"}

Tools: read_file, write_file, list_dir, grep, run_cmd (typecheck only).`;

export async function runCodeAgentLoop(input: {
  projectId: string;
  model: ExpoAppModel;
  mp: MasterBuildPrompt;
  message: string;
  previewState?: PreviewBuildState;
  mode?: AgentMode;
  threadBlock?: string;
  retrievedBlock?: string;
}): Promise<{
  steps: CodeAgentStep[];
  done: boolean;
  needsMore: boolean;
  reply: string;
  asked?: string;
}> {
  const canRunAgent =
    integrations.expoBuildModel ||
    (input.mode === "initial" && integrations.planModel);
  if (!canRunAgent) {
    return {
      steps: [],
      done: false,
      needsMore: false,
      reply: "Build model not configured — add FIREWORKS_API_KEY or BUILD_MODEL_KEY.",
      asked: "Build model not configured.",
    };
  }

  const previewBlock = formatPreviewBuildStateBlock(input.previewState, input.model);
  const threadBlock = input.threadBlock?.trim() ?? "";
  const retrievedBlock = input.retrievedBlock?.trim() ?? "";
  const history: { role: "user" | "assistant"; content: string }[] = [
    {
      role: "user",
      content:
        `${previewBlock}\n\n` +
        (threadBlock ? `${threadBlock}\n\n` : "") +
        (retrievedBlock ? `${retrievedBlock}\n\n` : "") +
        `App: ${input.mp.appName}\n` +
        `Workspace: project ${input.projectId}\n` +
        `Files: app/(tabs)/*, model/expoAppModel.json, eas.json (EAS publish)\n\n` +
        `Request:\n${input.message.trim()}\n\n` +
        `Continue the Build thread above. Execute this request on the workspace — do not ask which screen unless the request is empty.`,
    },
  ];

  const steps: CodeAgentStep[] = [];
  const maxSteps =
    input.mode === "initial"
      ? codeAgentConfig.maxInitialAgentSteps
      : codeAgentConfig.maxAgentSteps;

  for (let i = 0; i < maxSteps; i++) {
    const { text } = await codeAgentChatComplete(
      [{ role: "system", content: SYSTEM }, ...history],
      {
        temperature: 0.2,
        maxTokens: 4096,
        timeoutMs: 120_000,
        allowPlanFallback: input.mode === "initial",
      }
    );

    const turn = parseAgentTurn(text);
    if (!turn) {
      history.push({ role: "assistant", content: text.slice(0, 800) });
      history.push({
        role: "user",
        content: "Reply with valid JSON only — tools array and done flag.",
      });
      continue;
    }

    if (turn.ask?.trim() && input.mode !== "initial") {
      return {
        steps,
        done: false,
        needsMore: false,
        reply: turn.ask.trim(),
        asked: turn.ask.trim(),
      };
    }

    const toolCalls = turn.tools ?? [];
    if (!toolCalls.length && turn.done) {
      return {
        steps,
        done: true,
        needsMore: false,
        reply: turn.reply?.trim() || "Done.",
      };
    }

    const results: string[] = [];
    for (const call of toolCalls) {
      const result = await runCodeAgentTool(input.projectId, call);
      steps.push({
        tool: call.tool,
        ok: result.ok,
        summary: result.output.slice(0, 200),
      });
      results.push(
        `[${call.tool}${call.path ? ` ${call.path}` : ""}] ${result.ok ? "ok" : "err"}: ${result.output.slice(0, 1500)}`
      );
    }

    history.push({ role: "assistant", content: text.slice(0, 4000) });
    history.push({
      role: "user",
      content:
        `Tool results:\n${results.join("\n\n")}\n\n` +
        (turn.done
          ? "If typecheck passed, respond done:true with reply. Else fix and continue."
          : "Continue — implement the request fully, then typecheck before done."),
    });

    if (turn.done && toolCalls.length) {
      return {
        steps,
        done: true,
        needsMore: false,
        reply: turn.reply?.trim() || "Done.",
      };
    }
  }

  const partial = steps.filter((s) => s.ok).length;
  return {
    steps,
    done: false,
    needsMore: partial > 0,
    reply: "",
  };
}
