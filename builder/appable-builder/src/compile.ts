/**
 * Compile checking for the error-fixing loop.
 *  - Mac: real `xcodegen generate` + `xcodebuild`, parsing compiler errors.
 *  - Windows / no Xcode: a lightweight static check over the generated Swift so
 *    the loop is still meaningful; the authoritative build happens on Codemagic.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { CompileIssue, GeneratedFile } from "./types.js";

const run = promisify(execFile);

/** Heuristic static check (used off-Mac). Catches obvious structural mistakes. */
export function staticCheck(files: GeneratedFile[]): CompileIssue[] {
  const issues: CompileIssue[] = [];
  for (const f of files) {
    if (!f.path.endsWith(".swift")) continue;
    const usesSwiftUI = /\bsome View\b|: View\b|@main|SwiftUI/.test(f.contents);
    const importsSwiftUI = /^\s*import SwiftUI/m.test(f.contents);
    const importsFoundation = /^\s*import Foundation/m.test(f.contents);
    if (usesSwiftUI && !importsSwiftUI) {
      issues.push({ file: f.path, message: "missing import SwiftUI" });
    }
    if (!usesSwiftUI && /\bUUID\(\)|Foundation\b/.test(f.contents) && !importsFoundation && !importsSwiftUI) {
      issues.push({ file: f.path, message: "missing import Foundation" });
    }
    // Unbalanced braces — a cheap sanity check.
    const open = (f.contents.match(/{/g) ?? []).length;
    const close = (f.contents.match(/}/g) ?? []).length;
    if (open !== close) {
      issues.push({ file: f.path, message: `unbalanced braces (${open} open, ${close} close)` });
    }
  }
  return issues;
}

/** Real Xcode build on Mac. Returns parsed errors (empty = success). */
export async function xcodeBuild(projectDir: string): Promise<CompileIssue[]> {
  try {
    await run("xcodegen", ["generate"], { cwd: projectDir });
  } catch {
    return [{ file: "project.yml", message: "xcodegen not installed — run `brew install xcodegen`" }];
  }
  try {
    const { stderr, stdout } = await run(
      "xcodebuild",
      ["-scheme", "App", "-sdk", "iphonesimulator", "build", "CODE_SIGNING_ALLOWED=NO"],
      { cwd: projectDir, maxBuffer: 1024 * 1024 * 32 }
    );
    return parseXcodeErrors(stdout + "\n" + stderr);
  } catch (e) {
    const out = String((e as { stdout?: string; stderr?: string }).stdout ?? "") +
      String((e as { stderr?: string }).stderr ?? "");
    return parseXcodeErrors(out);
  }
}

function parseXcodeErrors(output: string): CompileIssue[] {
  const issues: CompileIssue[] = [];
  const re = /^(.*?\.swift):(\d+):\d+:\s+error:\s+(.*)$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(output))) {
    issues.push({ file: m[1], line: Number(m[2]), message: m[3] });
  }
  return issues;
}
