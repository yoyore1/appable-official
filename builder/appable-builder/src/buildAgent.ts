/**
 * The Appable Builder core loop (Phase 1):
 *   validate user → fetch master prompt → inject similar builds → generate a
 *   SwiftUI app with Kimi → error-fixing loop → ship (Mac Xcode / Windows
 *   Codemagic) → report usage (build/review split) → write to the platform cache.
 *
 * All machinery is translated to friendly progress; raw detail only in verbose.
 */
import { budgets, integrations, outputDir } from "./config.js";
import { Progress } from "./log.js";
import { detectOS } from "./os.js";
import {
  fetchMasterPrompt,
  findSimilar,
  postCache,
  reportUsage,
  validateUser,
} from "./platform.js";
import { estimateTokens, generateProject, proposeFixes } from "./model.js";
import { staticCheck, xcodeBuild } from "./compile.js";
import { generateCodemagicYaml, codemagicGuide } from "./codemagic.js";
import { writeOne, writeProject } from "./fsutil.js";
import type { BuildMode, BuildResult, GeneratedFile } from "./types.js";

export interface BuildOptions {
  projectId: string;
  mode: BuildMode;
  email?: string;
  password?: string;
  verbose?: boolean;
}

function appFolder(appName: string): string {
  return appName.replace(/[^a-zA-Z0-9]/g, "") || "App";
}

export async function buildApp(opts: BuildOptions): Promise<BuildResult> {
  const p = new Progress({ verbose: opts.verbose });
  const osInfo = detectOS();

  p.heading("Appable Builder");
  p.detail(`platform=${osInfo.platform} ship=${osInfo.ship} model=${integrations.buildModel ? "Kimi" : "mock"} api=${integrations.platform ? "live" : "mock"}`);

  // 1. Auth + balance
  p.step("Signing you in…");
  const user = await validateUser(opts.email ?? "you@gmail.com", opts.password ?? "mock");
  p.ok(`Welcome, ${user.name ?? user.email}. You have ${user.buildPower} build power.`);

  const budget = opts.mode === "full" ? budgets.full : budgets.base;
  if (user.buildPower <= 0) {
    throw new Error("You're out of build power — top up on getappable.com to keep going.");
  }

  // 2. Master prompt
  p.step("Getting your app plan…");
  const { masterPrompt: mp, userId } = await fetchMasterPrompt(opts.projectId);
  p.ok(`Building “${mp.appName}” — ${mp.vibe.toLowerCase()}, for ${mp.audience}`);

  // 3. Similar builds (reference injection)
  const category = (mp.features[0] ?? "app").toLowerCase().split(" ")[0];
  const refs = await findSimilar({ category, features: mp.features, vibe: mp.vibe }, userId);
  if (refs.length) p.detail(`injected ${refs.length} reference build(s) from cache`);

  // 4. Generate
  p.step("Designing your onboarding ✨");
  let files = await generateProject(mp, opts.mode, refs);
  p.step("Setting up your screens");
  p.step("Making it beautiful…");

  // 5. Write to disk
  const folder = appFolder(mp.appName);
  const projectDir = await writeProject(outputDir, folder, files);
  p.ok(`Created ${files.length} files`);
  p.detail(`→ ${projectDir}`);

  // 6. Error-fixing loop
  let rounds = 0;
  let compiled = false;
  while (rounds < budgets.errorFixMaxRounds) {
    const issues = osInfo.canRunXcode ? await xcodeBuild(projectDir) : staticCheck(files);
    if (issues.length === 0) {
      compiled = true;
      break;
    }
    rounds++;
    p.fixing(`Hit a small snag — fixing it now (round ${rounds}).`);
    issues.forEach((i) => p.detail(`${i.file}${i.line ? ":" + i.line : ""} — ${i.message}`));
    const fixes = await proposeFixes(files, issues);
    if (fixes.length === 0) {
      p.detail("agent proposed no changes; stopping fix loop");
      break;
    }
    files = applyFixes(files, fixes);
    for (const f of fixes) await writeOne(projectDir, f);
  }
  if (compiled) p.ok(rounds === 0 ? "Everything compiled first try." : `All sorted after ${rounds} fix round(s).`);
  else p.fixing("This one's being stubborn — saved everything; you can retry or get help.");

  // 7. Ship path
  let codemagicYaml: string | undefined;
  if (osInfo.ship === "windows") {
    codemagicYaml = generateCodemagicYaml(mp, folder);
    await writeOne(projectDir, { path: "codemagic.yaml", contents: codemagicYaml });
    p.heading("Get it on your iPhone (Windows → Codemagic)");
    codemagicGuide(mp).forEach((line) => p.step(line));
  } else {
    p.heading("Run it on your Mac");
    p.step("Open in Xcode: `xcodegen generate && open " + folder + ".xcodeproj`");
    p.step("Or press Run — I'll launch the simulator for you.");
  }

  // 8. Usage accounting (build/review split)
  const totalTokens = Math.min(
    budget,
    files.reduce((sum, f) => sum + estimateTokens(f.contents), estimateTokens(JSON.stringify(mp)))
  );
  const build = Math.round(totalTokens * budgets.buildReviewSplit);
  const review = totalTokens - build;
  const buildPower = Math.max(1, Math.round(build / 100));
  const reviewPower = Math.max(0, Math.round(review / 100));
  await reportUsage(userId, { build: buildPower, review: reviewPower });
  p.detail(`usage reported: ${buildPower} build / ${reviewPower} review power`);

  // 9. Cache write (respects platform-tracked opt-in)
  await postCache({
    userId,
    category,
    features: mp.features,
    vibe: mp.vibe,
    colors: mp.colors,
    codeRef: projectDir,
  });

  p.celebrate(`Meet ${mp.appName}. This is really yours.`);

  return {
    appName: mp.appName,
    bundleId: `com.appable.${folder.toLowerCase()}`,
    mode: opts.mode,
    projectDir,
    fileCount: files.length,
    rounds,
    compiled,
    usage: { build: buildPower, review: reviewPower },
    shipPath: osInfo.ship,
    codemagicYaml,
  };
}

function applyFixes(files: GeneratedFile[], fixes: GeneratedFile[]): GeneratedFile[] {
  const map = new Map(files.map((f) => [f.path, f]));
  for (const fix of fixes) map.set(fix.path, fix);
  return [...map.values()];
}
