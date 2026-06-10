import type { ExpoAppModel } from "@/lib/expoApp/types";
import type { MasterBuildPrompt } from "@/lib/types";
import { generateExpoRouterApp } from "@/lib/codegen/expoRouterCodegen";

/** Write a full Expo Router app into the project workspace. */
export async function scaffoldExpoApp(
  workspaceRoot: string,
  model: ExpoAppModel,
  mp: MasterBuildPrompt
): Promise<void> {
  await generateExpoRouterApp(workspaceRoot, model, mp);
}
