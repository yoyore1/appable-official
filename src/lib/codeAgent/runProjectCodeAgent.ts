import { coerceExpoAppModel } from "@/lib/expoApp/coerceModel";
import { commitAppState, ensureRepoForApp } from "@/lib/github";
import { integrations } from "@/lib/config";
import { runCodeAgentLoop } from "./agentLoop";
import type { RunProjectCodeAgentInput, RunProjectCodeAgentResult } from "./types";
import type { CodeAgentStep } from "./types";
import {
  ensureProjectWorkspace,
  listWorkspaceFiles,
  loadModelFromWorkspace,
  readWorkspaceFile,
} from "./workspace";
import { verifyWorkspaceBuild } from "./verifyWorkspace";
import { prepareCodeAgentPrompt } from "./buildCodeAgentContext";
import { buildAppliedChatReply } from "@/lib/expoApp/buildReply";
import { syncWorkspaceAfterModelChange } from "./syncAfterBuild";

const MAX_FIX_PASSES = 3;

function fixPassMessage(
  original: string,
  verify: { ok: boolean; output: string },
  needsMore: boolean
): string {
  if (!verify.ok) {
    return (
      `Fix all TypeScript errors from the previous edit. Do not stop until typecheck passes.\n\n` +
      `Errors:\n${verify.output.slice(0, 3000)}\n\n` +
      `Original request:\n${original}`
    );
  }
  if (needsMore) {
    return (
      `Finish the original request completely — implement every part, then run typecheck before done:true.\n\n` +
      `Original request:\n${original}`
    );
  }
  return original;
}

function userFacingBuildReply(): string {
  return buildAppliedChatReply();
}

function pushToGithubInBackground(
  repoUrl: string,
  projectId: string,
  message: string
): void {
  void (async () => {
    try {
      const files = await listWorkspaceFiles(projectId);
      const payload: { path: string; contents: string }[] = [];
      for (const rel of files) {
        payload.push({
          path: rel,
          contents: await readWorkspaceFile(projectId, rel),
        });
      }
      if (payload.length) {
        await commitAppState(repoUrl, payload, `Build: ${message.trim().slice(0, 72)}`);
      }
    } catch {
      /* best effort */
    }
  })();
}

export async function runProjectCodeAgent(
  input: RunProjectCodeAgentInput
): Promise<RunProjectCodeAgentResult> {
  if (!integrations.codeAgent) return null;

  const repoUrl =
    input.githubRepoUrl ??
    (input.userId
      ? await ensureRepoForApp({
          userId: input.userId,
          name: input.appName ?? input.mp.appName,
          githubRepoUrl: input.githubRepoUrl ?? null,
        })
      : null);

  await ensureProjectWorkspace({
    projectId: input.projectId,
    model: input.model,
    appName: input.mp.appName,
    userId: input.userId ?? input.projectId,
    masterPrompt: input.mp,
    scaffoldApp: true,
  });

  const { enrichedMessage, threadBlock, retrievedBlock } = prepareCodeAgentPrompt({
    message: input.message,
    model: input.model,
    mp: input.mp,
    buildHistory: input.buildHistory ?? [],
    interview: input.interview,
    brainstormHistory: input.brainstormHistory,
    brainstormContext: input.brainstormContext,
  });

  const allSteps: CodeAgentStep[] = [];
  let loopMessage = enrichedMessage;
  let lastAgentReply = "";
  let loopDone = false;
  let verify = { ok: false, output: "" };
  let currentModel = input.model;

  for (let pass = 0; pass < MAX_FIX_PASSES; pass++) {
    const loop = await runCodeAgentLoop({
      projectId: input.projectId,
      model: currentModel,
      mp: input.mp,
      message: loopMessage,
      previewState: input.previewState,
      threadBlock: pass === 0 ? threadBlock : "",
      retrievedBlock: pass === 0 ? retrievedBlock : "",
    });

    allSteps.push(...loop.steps);

    if (loop.asked) {
      return { kind: "clarify", reply: loop.asked };
    }

    if (loop.reply.trim()) {
      lastAgentReply = loop.reply.trim();
    }

    const passModel = coerceExpoAppModel(
      (await loadModelFromWorkspace(input.projectId)) ?? currentModel
    );
    if (JSON.stringify(passModel) !== JSON.stringify(currentModel)) {
      await syncWorkspaceAfterModelChange(
        input.projectId,
        currentModel,
        passModel,
        input.mp
      );
      currentModel = passModel;
    }

    verify = await verifyWorkspaceBuild(input.projectId);
    loopDone = loop.done;
    const okSteps = loop.steps.filter((s) => s.ok).length;

    if (loop.done && verify.ok) {
      break;
    }

    if (pass < MAX_FIX_PASSES - 1 && (loop.needsMore || !verify.ok || okSteps > 0)) {
      loopMessage = fixPassMessage(enrichedMessage, verify, loop.needsMore);
      continue;
    }

    break;
  }

  const nextModel = currentModel;
  const okSteps = allSteps.filter((s) => s.ok).length;
  const modelChanged = JSON.stringify(nextModel) !== JSON.stringify(input.model);
  const madeChanges = modelChanged || okSteps > 0;

  if (!loopDone && !madeChanges) {
    return {
      kind: "clarify",
      reply:
        "I couldn't apply that — try naming the screen (welcome, home, setup) or tap the exact line in the preview.",
    };
  }

  if (!madeChanges) {
    return {
      kind: "clarify",
      reply:
        "I couldn't apply that — try naming the screen (welcome, home, setup) or tap the exact line in the preview.",
    };
  }

  if (repoUrl && integrations.github) {
    pushToGithubInBackground(repoUrl, input.projectId, input.message);
  }

  const { refreshWorkspacePreview } = await import("./workspaceRuntime");
  await refreshWorkspacePreview(input.projectId);

  if (!verify.ok) {
    const snagReply = "Still working on it — try again in a moment.";
    return {
      kind: "applied",
      model: nextModel,
      reply: snagReply,
      committed: false,
      steps: allSteps,
    };
  }

  const reply = userFacingBuildReply();

  return {
    kind: "applied",
    model: nextModel,
    reply,
    committed: Boolean(repoUrl && integrations.github),
    steps: allSteps,
  };
}
