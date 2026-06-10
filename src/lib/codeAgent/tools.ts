import { readdir, readFile } from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import type { CodeAgentToolCall } from "./types";
import { resolveWorkspacePath, workspaceRootFor, writeWorkspaceFile } from "./workspace";

const execFileAsync = promisify(execFile);

const ALLOWED_CMDS = new Set([
  "npx tsc -p tsconfig.json --noEmit",
  "npx tsc --noEmit",
  "npm run typecheck",
]);

export async function runCodeAgentTool(
  projectId: string,
  call: CodeAgentToolCall
): Promise<{ ok: boolean; output: string }> {
  try {
    switch (call.tool) {
      case "read_file": {
        if (!call.path) return { ok: false, output: "read_file requires path" };
        const abs = resolveWorkspacePath(projectId, call.path);
        const text = await readFile(abs, "utf8");
        return { ok: true, output: text.slice(0, 24_000) };
      }
      case "write_file": {
        if (!call.path || call.content === undefined) {
          return { ok: false, output: "write_file requires path and content" };
        }
        await writeWorkspaceFile(projectId, call.path, call.content);
        return { ok: true, output: `Wrote ${call.path} (${call.content.length} bytes)` };
      }
      case "list_dir": {
        const rel = call.path ?? ".";
        const abs = resolveWorkspacePath(projectId, rel);
        const entries = await readdir(abs, { withFileTypes: true });
        const lines = entries.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
        return { ok: true, output: lines.join("\n") || "(empty)" };
      }
      case "grep": {
        if (!call.pattern) return { ok: false, output: "grep requires pattern" };
        const root = workspaceRootFor(projectId);
        const re = new RegExp(call.pattern, "i");
        const hits: string[] = [];

        async function walk(dir: string, prefix = ""): Promise<void> {
          const entries = await readdir(dir, { withFileTypes: true });
          for (const ent of entries) {
            if (ent.name === ".git" || ent.name === "node_modules") continue;
            const rel = prefix ? `${prefix}/${ent.name}` : ent.name;
            const abs = path.join(dir, ent.name);
            if (ent.isDirectory()) await walk(abs, rel);
            else if (/\.(tsx?|json)$/i.test(ent.name)) {
              const text = await readFile(abs, "utf8");
              const lines = text.split("\n");
              for (let i = 0; i < lines.length; i++) {
                if (re.test(lines[i]!)) {
                  hits.push(`${rel}:${i + 1}: ${lines[i]!.trim().slice(0, 120)}`);
                  if (hits.length >= 40) return;
                }
              }
            }
          }
        }

        await walk(root);
        return { ok: true, output: hits.join("\n") || "(no matches)" };
      }
      case "run_cmd": {
        const cmd = (call.command ?? "").trim();
        if (!ALLOWED_CMDS.has(cmd)) {
          return {
            ok: false,
            output: `Allowed: ${[...ALLOWED_CMDS].join(" | ")}`,
          };
        }
        const root = workspaceRootFor(projectId);
        const tscArgs =
          cmd === "npm run typecheck"
            ? null
            : cmd.includes("tsconfig.json")
              ? ["tsc", "-p", "tsconfig.json", "--noEmit"]
              : ["tsc", "--noEmit"];
        const { stdout, stderr } = tscArgs
          ? await execFileAsync("npx", tscArgs, {
              cwd: root,
              timeout: 120_000,
              shell: process.platform === "win32",
            })
          : await execFileAsync("npm", ["run", "typecheck"], {
              cwd: root,
              timeout: 120_000,
              shell: process.platform === "win32",
            });
        return { ok: true, output: (stdout || stderr || "ok").slice(0, 12_000) };
      }
      default:
        return { ok: false, output: `Unknown tool: ${call.tool}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, output: msg.slice(0, 2000) };
  }
}
