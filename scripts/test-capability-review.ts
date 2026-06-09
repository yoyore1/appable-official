/**
 * Offline test — dog-walking app through seed → enrich → finalize → capability review.
 * Run: npx tsx --tsconfig tsconfig.json scripts/test-capability-review.ts
 */
import type { InterviewTurn, MasterBuildPrompt } from "../src/lib/types";
import { enrichExpoContent } from "../src/lib/expoApp/enrichContent";
import { seedExpoAppContent } from "../src/lib/expoApp/seedContent";
import { buildTheme } from "../src/lib/expoApp/theme";
import { inferAppCapabilities } from "../src/lib/expo/inferCapabilities";
import { buildPreviewUiConfig } from "../src/lib/expoApp/previewFeatures";
import { withLegalSettings } from "../src/lib/expoApp/smartInteractions";
import { attachBuildRecap } from "../src/lib/expoApp/buildRecap";
import { enforceProductShape } from "../src/lib/expoApp/enforceProductShape";
import { completeAuthFlow } from "../src/lib/expoApp/authFlowDefaults";
import {
  auditCapabilities,
  capabilityLabel,
  detectRequiredCapabilities,
  inferBuildReviewScope,
  runCapabilityReview,
} from "../src/lib/expoApp/capabilities";
import type { ExpoAppModel } from "../src/lib/expoApp/types";

const mp: MasterBuildPrompt = {
  appName: "PawRoute",
  description: "Connect dog owners with trusted walkers in your neighborhood.",
  audience: "Dog owners and walkers",
  twist: null,
  features: [
    "Post walk requests with breed and budget",
    "Message walkers to confirm details",
    "Track active walks on a map",
  ],
  layoutArchetype: "booking-scheduling",
  vibe: "Warm",
  colors: "coral",
  screens: [],
  referenceApp: null,
};

const interview: InterviewTurn[] = [
  {
    questionId: "idea",
    question: "What's the idea?",
    answer: "Dog owners find walkers, walkers apply to jobs, they message each other",
  },
  {
    questionId: "audience",
    question: "Who is it for?",
    answer: "Dog owners and dog walkers — both sides of the marketplace",
  },
  {
    questionId: "features",
    question: "Main features?",
    answer: "Post requests, browse walkers, chat, see walk in progress on map",
  },
];

function finalizeLikeGenerate(
  input: ReturnType<typeof enrichExpoContent>,
  master: MasterBuildPrompt,
  turns: InterviewTurn[]
): ExpoAppModel {
  const cap = inferAppCapabilities(master, turns);
  const shaped = enforceProductShape({ ...input }, master, turns);
  const flow =
    shaped.flow?.auth?.enabled && shaped.flow.auth.signUpTitle
      ? {
          ...shaped.flow,
          auth: completeAuthFlow(shaped.flow.auth, master.appName),
        }
      : shaped.flow;

  const base: ExpoAppModel = {
    version: 1,
    ...shaped,
    flow,
    theme: buildTheme(master),
    capabilities: {
      enabled: cap.capabilities,
      uiFeatures: buildPreviewUiConfig(master, turns).features,
      heroAction: cap.heroAction,
      heroSublabel: cap.heroSublabel,
      visionPrompt: cap.visionPrompt,
    },
  };
  return withLegalSettings(attachBuildRecap(base, master, turns));
}

async function main() {
  console.log("=== PawRoute (dog-walking) capability review test ===\n");

  const required = detectRequiredCapabilities(mp, interview);
  console.log("Required capabilities:");
  for (const id of required) {
    console.log(`  · ${id} — ${capabilityLabel(id)}`);
  }
  const pawBad = ["commerce", "social_feed", "journal", "habit_streak"].filter((id) =>
    required.includes(id as (typeof required)[number])
  );
  if (pawBad.length) {
    throw new Error(`PawRoute should not require: ${pawBad.join(", ")}`);
  }
  console.log("  ✓ No shop/social/journal/habit capabilities (service marketplace only)\n");

  let input = seedExpoAppContent(mp, interview);
  input = enrichExpoContent(input, mp, interview);
  let model = finalizeLikeGenerate(input, mp, interview);

  const before = auditCapabilities(model, mp, interview);
  console.log("BEFORE review loop:");
  printAudit(before);

  const reviewed = runCapabilityReview(model, mp, interview);
  model = reviewed.model;

  console.log(`\nReview passes: ${reviewed.passes}`);
  if (reviewed.autoFixed.length) {
    console.log(`Auto-fixed: ${reviewed.autoFixed.join(", ")}`);
  }

  console.log("\nAFTER review loop:");
  printAudit(reviewed.report);

  console.log("\nTabs:", model.tabs.map((t) => t.label).join(" · "));
  const msgTab = model.previewActions?.messagingTabId;
  if (msgTab) {
    const threads = model.tabScreens[msgTab]?.items?.length ?? 0;
    console.log(`Messages tab (${msgTab}): ${threads} thread rows`);
  }
  console.log("\n--- Scoped Build tweak examples ---");
  for (const msg of [
    "wire messaging",
    "shorten the home headline",
    "add sign up with supabase",
  ]) {
    const scope = inferBuildReviewScope(msg, mp, interview, [], "");
    console.log(
      `  "${msg}" →`,
      scope === "skip" ? "SKIP review" : scope.map(capabilityLabel).join(" + ")
    );
  }

  const partial = finalizeLikeGenerate(seedExpoAppContent(mp, interview), mp, interview);
  const scoped = runCapabilityReview(partial, mp, interview, 2, {
    scope: inferBuildReviewScope("wire messaging", mp, interview, [], "") as import("../src/lib/expoApp/capabilities").CapabilityId[],
  });
  console.log(`\nScoped messaging-only fix passes: ${scoped.passes}, fixed: ${scoped.autoFixed.join(", ")}`);

  const shopMp: MasterBuildPrompt = {
    appName: "ThreadCart",
    description: "Browse indie fashion and checkout in one tap.",
    audience: "Shoppers",
    twist: null,
    features: ["Product browse", "Add to cart", "Checkout"],
    layoutArchetype: "marketplace-shop",
    vibe: "Clean",
    colors: "navy",
    screens: [],
    referenceApp: null,
  };
  const shopRequired = detectRequiredCapabilities(shopMp, []);
  if (!shopRequired.includes("commerce")) {
    throw new Error("Shopping app must require commerce");
  }
  console.log("\nThreadCart (shopping) requires commerce:", shopRequired.includes("commerce"));

  console.log("\nDone — open your project in the app UI for a full LLM build.");
}

function printAudit(report: ReturnType<typeof auditCapabilities>) {
  console.log(`  Pass: ${report.pass} | fixable gaps: ${report.fixableCount} | suggest-only: ${report.suggestCount}`);
  for (const r of report.results) {
    if (r.status === "have") continue;
    console.log(`  [${r.status}] ${r.capability}: ${r.gaps.map((g) => g.message).join("; ")}`);
  }
  for (const g of report.globalGaps) {
    console.log(`  [global/${g.layer}] ${g.message}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
