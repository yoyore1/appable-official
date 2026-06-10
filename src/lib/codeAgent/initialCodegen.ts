import { coerceExpoAppModel } from "@/lib/expoApp/coerceModel";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import type { MasterBuildPrompt } from "@/lib/types";
import { runCodeAgentLoop } from "./agentLoop";
import { loadModelFromWorkspace } from "./workspace";
import { verifyWorkspaceBuild } from "./verifyWorkspace";

/** First real codegen pass after interview — agent completes the workspace app. */
export async function runInitialCodegen(input: {
  projectId: string;
  model: ExpoAppModel;
  mp: MasterBuildPrompt;
}): Promise<{ ok: boolean; model: ExpoAppModel; reply: string }> {
  const features = input.mp.features?.slice(0, 6).join(", ") ?? "";
  const message =
    `Initial build for "${input.mp.appName}".\n` +
    `Audience: ${input.mp.audience}\n` +
    `Features: ${features}\n` +
    `Vibe: ${input.mp.vibe}\n\n` +
    `The workspace has an Expo Router app (app/(tabs)/*) and model/expoAppModel.json.\n` +
    `Make this a complete, shippable MVP: all tabs in the JSON must work in expo-router screens, ` +
    `listing cards show badge/meta when present, flow screens if dual-role.\n` +
    `Do NOT ask questions — implement. Run typecheck before done:true.`;

  const loop = await runCodeAgentLoop({
    projectId: input.projectId,
    model: input.model,
    mp: input.mp,
    message,
    mode: "initial",
  });

  const model = coerceExpoAppModel(
    (await loadModelFromWorkspace(input.projectId)) ?? input.model
  );
  let verify = await verifyWorkspaceBuild(input.projectId);
  let reply = loop.reply.trim();
  let done = loop.done;

  if (!verify.ok && loop.done) {
    const fixLoop = await runCodeAgentLoop({
      projectId: input.projectId,
      model,
      mp: input.mp,
      message:
        `Fix all TypeScript errors from the initial build. Do not stop until typecheck passes.\n\n` +
        `Errors:\n${verify.output.slice(0, 3000)}`,
      mode: "initial",
    });
    verify = await verifyWorkspaceBuild(input.projectId);
    done = fixLoop.done && verify.ok;
    if (fixLoop.reply.trim()) reply = fixLoop.reply.trim();
  }

  return {
    ok: done && verify.ok,
    model,
    reply: reply || "Initial build complete.",
  };
}
