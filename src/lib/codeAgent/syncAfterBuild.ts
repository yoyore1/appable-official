import type { ExpoAppModel } from "@/lib/expoApp/types";
import type { MasterBuildPrompt } from "@/lib/types";
import { generateExpoRouterApp } from "@/lib/codegen/expoRouterCodegen";
import { workspaceRouterOutOfSync } from "./workspaceRouterCheck";
import { syncModelToWorkspace, workspaceRootFor } from "./workspace";

function needsRouterRegen(before: ExpoAppModel, after: ExpoAppModel): boolean {
  if (JSON.stringify(before.tabs) !== JSON.stringify(after.tabs)) return true;
  if (JSON.stringify(before.flow) !== JSON.stringify(after.flow)) return true;
  if (before.home.sections.length !== after.home.sections.length) return true;
  const tabIds = new Set(after.tabs.map((t) => t.id));
  for (const id of Object.keys(after.tabScreens)) {
    if (!tabIds.has(id) && id !== "home") return true;
  }
  return false;
}

/** Keep workspace JSON + expo-router screens aligned with DB preview model. */
export async function syncWorkspaceAfterModelChange(
  projectId: string,
  before: ExpoAppModel,
  after: ExpoAppModel,
  mp: MasterBuildPrompt
): Promise<void> {
  await syncModelToWorkspace(projectId, after);
  if (needsRouterRegen(before, after) || workspaceRouterOutOfSync(projectId, after)) {
    await generateExpoRouterApp(workspaceRootFor(projectId), after, mp);
  }
}
