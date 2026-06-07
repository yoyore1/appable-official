import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { buildInterviewContext } from "./interviewContext";
import type { AppCategory } from "./inferCategory";
import type {
  ExpoAppFlow,
  ExpoBuildRecap,
  ExpoSetupField,
  ExpoUserRole,
} from "./types";

export interface ProductSpec {
  category: AppCategory;
  hasDualRoles: boolean;
  roles: ExpoUserRole[];
  setupFields: ExpoSetupField[];
  welcomeTitle: string;
  welcomeSubtitle: string;
  setupTitle: string;
  setupSubtitle: string;
  primaryActions: string[];
  seedHints: string[];
}

function blob(mp: MasterBuildPrompt, interview: InterviewTurn[]): string {
  return buildInterviewContext(mp, interview).transcript.toLowerCase();
}

function dualSidedMarketplace(text: string): boolean {
  return (
    /dog owner|dog walker|owner.*walker|walker.*owner|people who wanna walk|people who want to walk|vice versa|both sides|two sides|as an owner|as a walker|post.*request.*apply|browse.*apply/i.test(
      text
    ) || (/match|marketplace|hire|find people|connect.*with/i.test(text) && /walk|pet|dog|sitter|care/i.test(text))
  );
}

function rolesForCategory(category: AppCategory, text: string, appName: string): ExpoUserRole[] {
  if (category === "pets" || dualSidedMarketplace(text)) {
    return [
      {
        id: "owner",
        label: "Dog owner",
        description: "I need someone to walk my dog",
        emoji: "🏠",
      },
      {
        id: "walker",
        label: "Dog walker",
        description: "I want to walk dogs and earn",
        emoji: "🚶",
      },
    ];
  }
  if (/buyer|seller|shop|sell|vendor|merchant/i.test(text) && category === "shopping") {
    return [
      { id: "buyer", label: "Shopper", description: "Browse and buy", emoji: "🛒" },
      { id: "seller", label: "Seller", description: "List products", emoji: "📦" },
    ];
  }
  if (/teacher|student|tutor|learner/i.test(text) && category === "education") {
    return [
      { id: "learner", label: "Learner", description: "Take lessons", emoji: "📚" },
      { id: "teacher", label: "Teacher", description: "Share lessons", emoji: "✏️" },
    ];
  }
  if (/host|guest|renter|landlord/i.test(text)) {
    return [
      { id: "host", label: "Host", description: "List your space or service", emoji: "🏡" },
      { id: "guest", label: "Guest", description: "Browse and book", emoji: "🔍" },
    ];
  }
  return [];
}

function setupFieldsFor(
  category: AppCategory,
  roles: ExpoUserRole[],
  text: string
): ExpoSetupField[] {
  if (category === "pets" || roles.some((r) => r.id === "owner" || r.id === "walker")) {
    const fields: ExpoSetupField[] = [
      { id: "name", label: "Your name", placeholder: "Full name", required: true },
      {
        id: "area",
        label: "Your neighborhood",
        placeholder: "e.g. Mission, SF",
        required: true,
      },
      {
        id: "bio",
        label: "Short bio",
        placeholder: "Tell walkers about you and your dog…",
        kind: "textarea",
      },
    ];
    if (/owner|walk my|need someone/i.test(text) || roles[0]?.id === "owner") {
      fields.push(
        { id: "dog_name", label: "Dog's name", placeholder: "Buddy", section: "My dog" },
        {
          id: "breed",
          label: "Breed",
          placeholder: "Golden Retriever",
          section: "My dog",
        },
        {
          id: "size",
          label: "Size",
          kind: "select",
          options: ["Small", "Medium", "Large"],
          section: "My dog",
        }
      );
    }
    return fields;
  }
  if (category === "fitness") {
    return [
      { id: "name", label: "Your name", placeholder: "Full name", required: true },
      {
        id: "goal",
        label: "Main goal",
        placeholder: "e.g. Run a 5K",
        required: true,
      },
      {
        id: "level",
        label: "Experience level",
        kind: "select",
        options: ["Beginner", "Intermediate", "Advanced"],
      },
    ];
  }
  if (category === "productivity") {
    return [
      { id: "name", label: "Your name", placeholder: "Full name", required: true },
      {
        id: "focus",
        label: "What are you focusing on?",
        placeholder: "Work, school, personal…",
      },
    ];
  }
  return [
    { id: "name", label: "Your name", placeholder: "Full name", required: true },
    {
      id: "about",
      label: "About you",
      placeholder: "A line about how you'll use this app",
      kind: "textarea",
    },
  ];
}

function primaryActionsFor(category: AppCategory, roles: ExpoUserRole[]): string[] {
  if (category === "pets" || roles.length === 2) {
    return ["Accept walk", "Apply", "Book", "Post request", "Message"];
  }
  if (category === "cooking") return ["Save recipe", "Add to list", "Cook now"];
  if (category === "fitness") return ["Start workout", "Add to plan"];
  if (category === "shopping") return ["Add to cart", "Buy now"];
  if (category === "education") return ["Start lesson", "Save"];
  return ["Open", "Save", "Continue"];
}

/** Infer full product shape from interview — roles, setup wizard, actions. */
export function inferProductSpec(
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): ProductSpec {
  const ctx = buildInterviewContext(mp, interview);
  const text = blob(mp, interview);
  const topology = ctx.topology;
  const roles: ExpoUserRole[] = topology.hasDualRoles
    ? topology.roles.map((r) => ({
        id: r.id,
        label: r.label,
        description: r.description,
        emoji: r.emoji,
      }))
    : rolesForCategory(ctx.category, text, mp.appName);
  const hasDualRoles = topology.hasDualRoles || roles.length >= 2;

  return {
    category: ctx.category,
    hasDualRoles,
    roles,
    setupFields: setupFieldsFor(ctx.category, roles, text),
    welcomeTitle: `Welcome to ${mp.appName}`,
    welcomeSubtitle: hasDualRoles
      ? mp.description.slice(0, 90) || "Pick how you'll use the app"
      : mp.description.slice(0, 100) || mp.features[0] || "Let's get you set up",
    setupTitle: "Tell us about you",
    setupSubtitle: hasDualRoles
      ? "Help others know who they're working with"
      : "So we can personalize your experience",
    primaryActions: primaryActionsFor(ctx.category, roles),
    seedHints: [
      ...ctx.userStatedFeatures,
      ...ctx.essentialFeatures.filter((e) => !/save favorite|settings/i.test(e)),
    ],
  };
}

export function flowFromSpec(spec: ProductSpec): ExpoAppFlow | undefined {
  if (!spec.hasDualRoles && spec.setupFields.length <= 2) return undefined;
  return {
    welcomeTitle: spec.welcomeTitle,
    welcomeSubtitle: spec.welcomeSubtitle,
    roles: spec.roles.length ? spec.roles : undefined,
    setupTitle: spec.setupTitle,
    setupSubtitle: spec.setupSubtitle,
    setupFields: spec.setupFields,
  };
}

export function recapFromSpec(
  mp: MasterBuildPrompt,
  spec: ProductSpec,
  interview: InterviewTurn[] = []
): ExpoBuildRecap {
  const sections: ExpoBuildRecap["sections"] = [];

  const ctx = buildInterviewContext(mp, interview);
  if (spec.hasDualRoles && spec.roles.length >= 2) {
    for (const plan of ctx.topology.roleTabPlans) {
      sections.push({
        title: `As a ${plan.roleLabel}`,
        bullets: [
          plan.heroLabel,
          ...plan.essentials.slice(0, 2),
          ...plan.signatures.slice(0, 1),
        ].filter(Boolean),
      });
    }
    if (!sections.length) {
      const [a, b] = spec.roles;
      sections.push({
        title: `As a ${a.label}`,
        bullets: mp.features.slice(0, 3),
      });
      sections.push({
        title: `As a ${b.label}`,
        bullets: ["Browse open requests nearby", "Accept jobs that fit your schedule"],
      });
    }
  } else {
    sections.push({
      title: "What you can do",
      bullets: mp.features.length
        ? [...mp.features]
        : ["Explore the main tab", "Save favorites", "Manage your profile"],
    });
  }

  const suggested =
    spec.category === "pets" && !/message|chat/i.test(mp.features.join(" "))
      ? "Want real-time messaging between owners and walkers? I can add that next."
      : spec.category === "cooking" && !/voice|read aloud/i.test(mp.features.join(" "))
        ? "Want read-aloud on recipes while you cook? I can wire that up."
        : undefined;

  return {
    headline: `${mp.appName} is live!`,
    sections,
    suggestedNext: suggested,
  };
}
