import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { inferCategory, type AppCategory } from "./inferCategory";
import { inferAppTopology, type AppTopologyPlan } from "./appTopology";
import { inferNicheIntel, type AppShape } from "./nicheSignatures";

export interface InterviewBuildContext {
  turns: InterviewTurn[];
  transcript: string;
  /** Every Q&A pair verbatim — primary source of truth for the build. */
  qaPairs: { questionId: string; question: string; answer: string }[];
  category: AppCategory;
  /** What the user explicitly asked for (features + follow-up flows). */
  userStatedFeatures: string[];
  /** Smart additions we believe this app needs (messaging, profiles, etc.). */
  essentialFeatures: string[];
  /** Detected product shapes (marketplace, tracking, booking, …). */
  appShapes: AppShape[];
  /** Category-native “of course it has…” UI moments — user never asked. */
  signatureFeatures: string[];
  /** Concrete screens/states to seed in the model. */
  signatureScreens: string[];
  /** Two-sided apps — roles + per-role tab/home plan. */
  topology: AppTopologyPlan;
  /** Domain rules for the LLM — only apply to THIS app's category. */
  domainRules: string[];
  /** Things we must NOT generate (e.g. recipes on a dog-walking app). */
  forbidden: string[];
  generationDirectives: string[];
}

function blobFrom(mp: MasterBuildPrompt, turns: InterviewTurn[]): string {
  const fromInterview = turns.map((t) => `${t.question} ${t.answer}`).join(" ");
  return [
    fromInterview,
    mp.description,
    mp.audience,
    mp.twist ?? "",
    ...mp.features,
    mp.appName,
    mp.layoutArchetype,
    ...mp.screens,
  ]
    .filter(Boolean)
    .join(" ");
}

function statedFeatures(mp: MasterBuildPrompt, turns: InterviewTurn[]): string[] {
  const out = new Set<string>();
  for (const f of mp.features) {
    const t = f.trim();
    if (t.length > 2) out.add(t);
  }
  for (const turn of turns) {
    if (turn.questionId === "features" || turn.questionId === "followup_features") {
      turn.answer
        .split(/[,;]|\band\b/i)
        .map((s) => s.trim())
        .filter((s) => s.length > 3)
        .forEach((s) => out.add(s));
    }
    if (turn.questionId === "followup_idea" || turn.questionId === "followup_detail_depth") {
      const a = turn.answer.trim();
      if (a.length > 8) out.add(a);
    }
  }
  return [...out];
}

/** Smart essentials — only when the user didn't already cover them. */
function inferEssentialFeatures(
  category: AppCategory,
  blob: string,
  stated: string[]
): string[] {
  const statedBlob = stated.join(" ").toLowerCase();
  const has = (re: RegExp) => re.test(statedBlob) || re.test(blob);

  const essentials: string[] = [];

  if (category === "pets") {
    if (!has(/message|chat|inbox|notify/)) essentials.push("Owner ↔ walker messaging");
    if (!has(/profile|rating|review|trust|verif/)) essentials.push("Walker profiles & ratings");
    if (!has(/pay|price|budget|\$/)) essentials.push("Set budget & pay per walk");
    if (!has(/breed|dog|pet profile/)) essentials.push("Dog profiles (breed, notes)");
    if (!has(/area|location|nearby|map/)) essentials.push("Location & nearby requests");
    if (!has(/save|favorite|bookmark/)) essentials.push("Save trusted walkers");
  }

  if (category === "cooking") {
    if (!has(/list|grocery|shop/)) essentials.push("Shopping lists linked to recipes");
    if (!has(/save|favorite/)) essentials.push("Save favorite recipes");
  }

  if (category === "fitness") {
    if (!has(/plan|schedule|calendar/)) essentials.push("Weekly workout plan");
    if (!has(/streak|progress|stat/)) essentials.push("Progress & streak tracking");
  }

  if (category === "productivity") {
    if (!has(/remind|notification/)) essentials.push("Reminders & due dates");
    if (!has(/save|archive|library/)) essentials.push("Saved / archived items");
  }

  if (category === "shopping") {
    if (!has(/cart|checkout|wish/)) essentials.push("Cart & wishlist");
    if (!has(/save|favorite/)) essentials.push("Save products");
  }

  if (category === "education") {
    if (!has(/save|library|bookmark/)) essentials.push("Save to library");
    if (!has(/progress|resume|continue/)) essentials.push("Resume where you left off");
  }

  if (category === "social") {
    if (!has(/notif|message|inbox/)) essentials.push("Notifications & messages");
    if (!has(/profile|follow/)) essentials.push("Profiles & follows");
  }

  if (
    category === "general" &&
    /match|apply|book|schedule|request|hire|find people|connect people/.test(blob)
  ) {
    if (!has(/message|chat/)) essentials.push("In-app messaging");
    if (!has(/profile|rating|review/)) essentials.push("User profiles & trust signals");
  }

  // Universal preview affordances (already wired in smartInteractions)
  essentials.push("Save favorites on detail cards");
  essentials.push("Working profile settings rows");
  essentials.push("Sign out and Delete account in Profile settings");

  return [...new Set(essentials)];
}

function domainRulesFor(category: AppCategory, mp: MasterBuildPrompt): string[] {
  const f = mp.features;
  const rules: Record<AppCategory, string[]> = {
    pets: [
      `THIS IS A PET / DOG-WALKING APP — NOT a cooking or recipe app.`,
      `Tabs: Home (nearby requests + post), Walks (browse/apply), Messages (owner ↔ walker), Profile.`,
      `Content: walk requests (breed, duration, area, budget), walker profiles, chat threads, upcoming bookings.`,
      `Hero: post a walk request or browse nearby walks — NOT food scan or recipes.`,
      `Detail cards: walk info, walker bio, booking steps — NEVER ingredients or recipe steps.`,
      `Implement user features: ${f.join(" · ")}`,
    ],
    cooking: [
      `Cooking app: recipes tab with ingredients + steps, lists tab tied to recipe names.`,
      `Photo/scan → recipe only when user asked for it.`,
    ],
    fitness: [
      `Fitness: workouts with step-by-step sessions; plan tab for scheduled items.`,
      `Stats on profile (sessions, streak).`,
    ],
    productivity: [
      `Productivity: tasks with checkoffs; library for saved items.`,
    ],
    shopping: [
      `Shopping: product browse + cart; detail → add to cart.`,
    ],
    education: [
      `Education: discover lessons + library; each lesson has learning steps.`,
    ],
    social: [
      `Social: feed/discover + inbox; save posts; profile grid.`,
    ],
    general: [
      `Build exactly what the user described — tabs and copy match their domain.`,
      `Use their feature names in tab labels and hero actions where sensible.`,
    ],
  };
  return rules[category] ?? rules.general;
}

function forbiddenFor(category: AppCategory): string[] {
  const base = [
    "Generic placeholder copy (Tap to explore, Sample item, Lorem, Coming soon)",
    "Cooking/recipe UI on non-cooking apps (recipes tab, ingredients, chef-hat, grocery-from-recipe)",
  ];
  if (category === "pets") {
    return [
      ...base,
      "Recipes tab, ingredients lists, cooking steps, chef-hat icon, food scan → recipe",
      "Meal planning, grocery lists, spice settings",
      "Shop tab, product catalog, cart, Add to cart, storefront — unless user asked to sell products",
      "Social feed / timeline / followers — this is a service marketplace, not a social network",
    ];
  }
  if (category !== "cooking") {
    return [...base, "Defaulting to recipe/cooking structure when user did not ask for food"];
  }
  return base;
}

function generationDirectives(
  mp: MasterBuildPrompt,
  turns: InterviewTurn[],
  category: AppCategory,
  stated: string[],
  essential: string[],
  niche: ReturnType<typeof inferNicheIntel>,
  topology: AppTopologyPlan
): string[] {
  const directives: string[] = [
    `App name: "${mp.appName}". Audience: ${mp.audience}. Vibe: ${mp.vibe}. Colors: ${mp.colors}.`,
    `Layout archetype (internal): ${mp.layoutArchetype}. Screens they expect: ${mp.screens.join(", ")}.`,
    "Honor EVERY interview answer below — tabs, hero, onboarding slides, and list items must reflect their exact words.",
  ];

  if (mp.twist) directives.push(`User's twist: ${mp.twist}`);

  for (const turn of turns) {
    directives.push(`Q (${turn.questionId}): ${turn.question}\nA: ${turn.answer}`);
  }

  directives.push(`User-stated features (must appear in UI): ${stated.join(" · ") || mp.features.join(" · ")}`);
  directives.push(
    `Essential features to include (smart additions): ${essential.filter((e) => !/save favorite|settings rows/i.test(e)).join(" · ")}`
  );

  if (niche.shapes.length > 0) {
    directives.push(`Detected app shapes: ${niche.shapes.join(", ")}`);
  }
  if (niche.signatureFeatures.length > 0) {
    directives.push(
      `Signature UI (must show in tabs/copy — user never asked): ${niche.signatureFeatures.join(" · ")}`
    );
  }
  if (niche.signatureScreens.length > 0) {
    directives.push(
      `Seed these screens/states in tabScreens or home sections: ${niche.signatureScreens.join(" · ")}`
    );
  }
  directives.push(...niche.buildDirectives);
  directives.push(...topology.buildDirectives);

  if (topology.hasDualRoles) {
    directives.push(
      `Dual-role tabs (shared ids): ${topology.tabs.map((t) => `${t.id}=${t.label}`).join(", ")}`
    );
  }

  if (category === "pets") {
    directives.push(
      "Onboarding slide 1: post/browse a walk — real request on screen. Slide 2: messaging or matching. Slide 3: booking confirmed.",
      'CTAs like "Find a walker" / "Post a walk" — never "Let\'s cook".',
      "Include map strip or map card on Home if not already present — local pet apps expect it."
    );
  }

  return directives;
}

/** Full interview + master prompt → build context for generate/blueprint/enrich. */
export function buildInterviewContext(
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): InterviewBuildContext {
  const turns = interview.filter((t) => t.answer?.trim());
  const blob = blobFrom(mp, turns);
  const category = inferCategory(mp, turns);
  const userStatedFeatures = statedFeatures(mp, turns);
  const niche = inferNicheIntel(blob, category, userStatedFeatures);
  const topology = inferAppTopology(mp, turns, niche.shapes);
  const categoryEssentials = inferEssentialFeatures(
    category,
    blob,
    userStatedFeatures
  );
  const essentialFeatures = [
    ...new Set([
      ...categoryEssentials,
      ...niche.essentialFeatures,
    ]),
  ];

  return {
    turns,
    transcript: blob,
    qaPairs: turns.map((t) => ({
      questionId: t.questionId,
      question: t.question,
      answer: t.answer,
    })),
    category,
    userStatedFeatures,
    essentialFeatures,
    appShapes: niche.shapes,
    signatureFeatures: niche.signatureFeatures,
    signatureScreens: niche.signatureScreens,
    topology,
    domainRules: domainRulesFor(category, mp),
    forbidden: forbiddenFor(category),
    generationDirectives: generationDirectives(
      mp,
      turns,
      category,
      userStatedFeatures,
      essentialFeatures,
      niche,
      topology
    ),
  };
}
