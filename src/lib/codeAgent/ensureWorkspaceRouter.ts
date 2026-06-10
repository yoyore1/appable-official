import path from "node:path";
import { generateExpoRouterApp } from "@/lib/codegen/expoRouterCodegen";
import { coerceExpoAppModel } from "@/lib/expoApp/coerceModel";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import type { MasterBuildPrompt } from "@/lib/types";
import { flowRoutesMissing } from "./workspaceRouterCheck";
import { loadModelFromWorkspace, workspaceRootFor } from "./workspace";
import { writeHealthLog } from "./workspaceHealth";

/**
 * Regenerate missing launch-flow screens before web compile.
 * Fixes preview showing "Unmatched Route" when model.json has welcome/role but app/*.tsx don't.
 */
export async function ensureWorkspaceRouterSync(
  projectId: string,
  model: ExpoAppModel,
  mp: MasterBuildPrompt
): Promise<boolean> {
  const appDir = path.join(workspaceRootFor(projectId), "app");
  const missing = flowRoutesMissing(appDir, model);
  if (missing.length === 0) return false;

  await generateExpoRouterApp(workspaceRootFor(projectId), model, mp);
  writeHealthLog(projectId, {
    action: "regen_router",
    ok: true,
    detail: `Generated missing routes: ${missing.join(", ")}`,
  });
  return true;
}

/** Load model from workspace JSON and sync router if needed. */
export async function ensureWorkspaceRouterSyncFromDisk(
  projectId: string,
  mp: MasterBuildPrompt
): Promise<boolean> {
  const raw = await loadModelFromWorkspace(projectId);
  if (!raw) return false;
  const model = coerceExpoAppModel(raw);
  return ensureWorkspaceRouterSync(projectId, model, mp);
}
