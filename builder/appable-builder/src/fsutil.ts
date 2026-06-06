import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { GeneratedFile } from "./types.js";

export async function writeProject(
  baseDir: string,
  appFolder: string,
  files: GeneratedFile[]
): Promise<string> {
  const projectDir = resolve(baseDir, appFolder);
  await rm(projectDir, { recursive: true, force: true });
  for (const f of files) {
    const full = join(projectDir, f.path);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, f.contents, "utf8");
  }
  return projectDir;
}

export async function writeOne(projectDir: string, file: GeneratedFile): Promise<void> {
  const full = join(projectDir, file.path);
  await mkdir(dirname(full), { recursive: true });
  await writeFile(full, file.contents, "utf8");
}
