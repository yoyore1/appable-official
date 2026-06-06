/**
 * CLI driver for the Appable Builder engine (Phase 1).
 *
 *   npm run build:app -- --project sample --mode base --verbose
 *   npm run build:app -- --project PRJ_xxx --mode full --email you@x.com --password ...
 *
 * With no flags it builds the bundled sample app in mock mode.
 */
import { buildApp } from "./buildAgent.js";
import type { BuildMode } from "./types.js";

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) {
    return process.argv[i + 1];
  }
  return fallback;
}
function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const projectId = arg("project", "sample")!;
  const mode = (arg("mode", "base") as BuildMode) ?? "base";
  const email = arg("email");
  const password = arg("password");
  const verbose = flag("verbose");

  try {
    const result = await buildApp({ projectId, mode, email, password, verbose });
    console.log(
      `\nDone → ${result.appName} (${result.mode}) · ${result.fileCount} files · ` +
        `${result.compiled ? "compiled" : "needs attention"} · ship: ${result.shipPath}`
    );
    console.log(`Project: ${result.projectDir}`);
  } catch (e) {
    console.error(`\n✗ ${(e as Error).message}`);
    process.exit(1);
  }
}

main();
