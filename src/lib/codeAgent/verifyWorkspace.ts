import { execFile } from "child_process";
import { promisify } from "util";
import { stat } from "fs/promises";
import path from "path";
import { workspaceRootFor } from "./workspace";

const execFileAsync = promisify(execFile);

/** Run TypeScript check on workspace after every Build edit (simulator-safe verify). */
export async function verifyWorkspaceBuild(
  projectId: string
): Promise<{ ok: boolean; output: string }> {
  const root = workspaceRootFor(projectId);
  try {
    await stat(path.join(root, "package.json"));
  } catch {
    return { ok: false, output: "Workspace not scaffolded yet." };
  }

  try {
    const { stdout, stderr } = await execFileAsync("npx", ["tsc", "--noEmit"], {
      cwd: root,
      timeout: 90_000,
      shell: process.platform === "win32",
    });
    const out = `${stdout}\n${stderr}`.trim();
    return { ok: true, output: out || "Typecheck passed." };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const out = `${e.stdout ?? ""}\n${e.stderr ?? ""}\n${e.message ?? ""}`.trim();
    return { ok: false, output: out.slice(0, 4000) };
  }
}
