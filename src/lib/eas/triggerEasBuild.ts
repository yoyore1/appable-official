import { execFile } from "child_process";
import { promisify } from "util";
import { stat } from "fs/promises";
import path from "path";
import { easConfig, integrations } from "@/lib/config";
import { workspaceRootFor } from "@/lib/codeAgent/workspace";

const execFileAsync = promisify(execFile);

export type EasBuildProfile = "preview" | "production" | "development";

export type EasBuildResult =
  | { ok: true; message: string; log?: string }
  | { ok: false; message: string; setup?: string };

/** Trigger EAS cloud build from project workspace (Rork-style publish path). */
export async function triggerEasBuild(
  projectId: string,
  profile: EasBuildProfile = "preview",
  platform: "ios" | "android" | "all" = "all"
): Promise<EasBuildResult> {
  const root = workspaceRootFor(projectId);

  try {
    await stat(path.join(root, "eas.json"));
  } catch {
    return {
      ok: false,
      message: "No EAS config yet — run a full build first.",
    };
  }

  if (!integrations.eas || !easConfig.token) {
    return {
      ok: false,
      message: "EAS is not connected on the server.",
      setup:
        "Add EXPO_TOKEN to your Appable server env, link your Expo account, then try again. " +
        "Or open the exported project locally and run: npx eas build --profile preview",
    };
  }

  const args = [
    "eas",
    "build",
    "--profile",
    profile,
    "--platform",
    platform,
    "--non-interactive",
    "--no-wait",
  ];

  try {
    const { stdout, stderr } = await execFileAsync("npx", args, {
      cwd: root,
      timeout: 180_000,
      shell: process.platform === "win32",
      env: {
        ...process.env,
        EXPO_TOKEN: easConfig.token,
      },
    });
    const log = `${stdout}\n${stderr}`.trim();
    const urlMatch = log.match(/https:\/\/expo\.dev\/[^\s]+/);
    return {
      ok: true,
      message: urlMatch
        ? `EAS build started — track progress: ${urlMatch[0]}`
        : "EAS build queued — check your Expo dashboard for status.",
      log: log.slice(0, 2000),
    };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const log = `${e.stdout ?? ""}\n${e.stderr ?? ""}`.trim();
    return {
      ok: false,
      message: log.slice(0, 500) || e.message || "EAS build failed to start.",
      setup:
        "Ensure EXPO_TOKEN is valid and the project slug is registered: npx eas init in the workspace.",
    };
  }
}
