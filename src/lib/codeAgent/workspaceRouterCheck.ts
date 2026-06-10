import type { ExpoAppModel } from "@/lib/expoApp/types";
import fs from "node:fs";
import path from "node:path";
import { workspaceRootFor } from "./workspace";

export function flowRoutesMissing(appDir: string, model: ExpoAppModel): string[] {
  const missing: string[] = [];
  if (model.flow?.welcomeTitle && !fs.existsSync(path.join(appDir, "welcome.tsx"))) {
    missing.push("welcome.tsx");
  }
  if (model.flow?.roles?.length && !fs.existsSync(path.join(appDir, "role.tsx"))) {
    missing.push("role.tsx");
  }
  if (model.flow?.setupTitle && !fs.existsSync(path.join(appDir, "setup.tsx"))) {
    missing.push("setup.tsx");
  }
  if (model.flow?.auth?.enabled && !fs.existsSync(path.join(appDir, "sign-in.tsx"))) {
    missing.push("sign-in.tsx");
  }
  return missing;
}

/** True when expo-router files don't match model (causes Unmatched Route in preview). */
export function workspaceRouterOutOfSync(
  projectId: string,
  model: ExpoAppModel
): boolean {
  const appDir = path.join(workspaceRootFor(projectId), "app");
  if (!fs.existsSync(path.join(appDir, "index.tsx"))) return true;
  return flowRoutesMissing(appDir, model).length > 0;
}
