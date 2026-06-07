/**
 * Two-sided / multi-role apps — who opens the app vs what the product does.
 * Role choice is first-run UX, not an interview question.
 */
import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import type { AppCategory } from "./inferCategory";
import { inferCategory } from "./inferCategory";
import type { AppShape } from "./nicheSignatures";
import type { ExpoIconName } from "./types";

export type AppTopology = "single" | "dual_symmetric" | "dual_asymmetric";

export interface InferredRole {
  id: string;
  label: string;
  description: string;
  emoji?: string;
}

export interface RoleTabPlan {
  roleId: string;
  roleLabel: string;
  homeHeadline: string;
  homeSubheadline: string;
  heroLabel: string;
  heroSublabel: string;
  /** tab id → what this tab shows FOR THIS ROLE */
  tabPurposes: Record<string, string>;
  signatures: string[];
  essentials: string[];
}

export interface AppTopologyPlan {
  topology: AppTopology;
  roles: InferredRole[];
  hasDualRoles: boolean;
  /** Shared tab bar — same ids for all roles, different content per role */
  tabs: { id: string; label: string; icon: ExpoIconName; purpose: string }[];
  roleTabPlans: RoleTabPlan[];
  buildDirectives: string[];
}

function blob(mp: MasterBuildPrompt, interview: InterviewTurn[]): string {
  const fromInterview = interview.map((t) => `${t.question} ${t.answer}`).join(" ");
  return [
    fromInterview,
    mp.description,
    mp.audience,
    ...mp.features,
    mp.appName,
  ]
    .join(" ")
    .toLowerCase();
}

function dualSidedMarketplace(text: string): boolean {
  return (
    /dog owner|dog walker|owner.*walker|walker.*owner|both sides|two sides|vice versa|post.*apply|apply.*request|match both|people who wanna walk|people who want to walk|as an owner|as a walker|babysitter.*parent|parent.*babysitter|freelancer.*client|buyer.*seller|seller.*buyer|host.*guest|guest.*host|provider.*customer/i.test(
      text
    ) ||
    (/match|marketplace|hire|gig|local service|nearby/i.test(text) &&
      /walk|pet|dog|sit|care|task|service/i.test(text))
  );
}

function audienceSkewsOneSide(text: string): "owner" | "walker" | "provider" | "consumer" | null {
  if (/dog owner|pet parent|need.*walk|need someone to walk/i.test(text) && !/walker looking|i walk dogs|earn.*walk/i.test(text)) {
    return "owner";
  }
  if (/dog walker|i walk dogs|walker looking|earn.*gig|looking for gigs/i.test(text) && !/dog owner|need walks/i.test(text)) {
    return "walker";
  }
  if (/seller|vendor|provider|freelancer offering/i.test(text) && !/buyer|shopper|customer/i.test(text)) {
    return "provider";
  }
  if (/buyer|shopper|customer|need help nearby/i.test(text) && !/seller|provider/i.test(text)) {
    return "consumer";
  }
  return null;
}

function rolesForPets(text: string, appName: string): InferredRole[] {
  return [
    {
      id: "owner",
      label: /dog|pet|puppy/i.test(text) ? "Dog owner" : "Client",
      description: "I need someone to help with my dog",
      emoji: "🏠",
    },
    {
      id: "walker",
      label: /dog|pet|puppy/i.test(text) ? "Dog walker" : "Provider",
      description: "I want to walk dogs and earn",
      emoji: "🚶",
    },
  ];
}

function rolesForGenericMarketplace(text: string): InferredRole[] {
  if (/buyer|seller|shop/i.test(text)) {
    return [
      { id: "buyer", label: "Buyer", description: "I need something locally", emoji: "🛒" },
      { id: "seller", label: "Seller", description: "I offer products or services", emoji: "📦" },
    ];
  }
  return [
    { id: "client", label: "Client", description: "I need help nearby", emoji: "🔍" },
    { id: "provider", label: "Provider", description: "I offer a local service", emoji: "💼" },
  ];
}

function inferRoles(category: AppCategory, text: string, appName: string): InferredRole[] {
  if (category === "pets" || (/dog|pet|walk|walker/i.test(text) && dualSidedMarketplace(text))) {
    return rolesForPets(text, appName);
  }
  if (dualSidedMarketplace(text)) {
    if (/teacher|student|tutor|learner/i.test(text)) {
      return [
        { id: "learner", label: "Learner", description: "I'm here to learn", emoji: "📚" },
        { id: "teacher", label: "Teacher", description: "I teach or tutor", emoji: "✏️" },
      ];
    }
    if (/host|guest|rent|airbnb/i.test(text)) {
      return [
        { id: "host", label: "Host", description: "I list my space or service", emoji: "🏡" },
        { id: "guest", label: "Guest", description: "I browse and book", emoji: "🔍" },
      ];
    }
    return rolesForGenericMarketplace(text);
  }
  return [];
}

function petTabs(features: string[]): AppTopologyPlan["tabs"] {
  const f = features;
  return [
    { id: "home", label: "Home", icon: "home", purpose: "Role-specific home — see roleTabPlans" },
    { id: "walks", label: "Walks", icon: "search", purpose: f[0] ?? "Walks & requests" },
    { id: "messages", label: "Chat", icon: "bell", purpose: f[1] ?? "Messaging" },
    { id: "profile", label: "You", icon: "user", purpose: "Profile & settings" },
  ];
}

function rolePlansForPets(
  shapes: AppShape[],
  roles: InferredRole[],
  features: string[]
): RoleTabPlan[] {
  const hasTracking = shapes.includes("live_tracking");
  const owner = roles.find((r) => r.id === "owner");
  const walker = roles.find((r) => r.id === "walker");
  const plans: RoleTabPlan[] = [];

  if (owner) {
    plans.push({
      roleId: "owner",
      roleLabel: owner.label,
      homeHeadline: "Walks near you",
      homeSubheadline: "Post a request or track an active walk",
      heroLabel: "Post a walk request",
      heroSublabel: "Breed, area & pay — walkers apply in minutes",
      tabPurposes: {
        home: hasTracking
          ? "Map + live walker tracking during active walks + post CTA"
          : "Post request + upcoming walks + applicant alerts",
        walks: "My posted requests, applicants, upcoming & history",
        messages: "Chat with matched walkers",
        profile: "My dogs, payment methods, saved walkers",
      },
      essentials: hasTracking
        ? ["Live map: see walker en route and during walk", "Notify when walk starts/ends"]
        : ["See applicant profiles before accepting"],
      signatures: hasTracking
        ? [
            "Active walk map with walker pin + ETA",
            "Push-style banner: Walker is on the way",
            "End walk confirmation + rate walker",
          ]
        : [
            "Applicant cards with rating & completed walks",
            "Rebook same walker from history",
          ],
    });
  }

  if (walker) {
    plans.push({
      roleId: "walker",
      roleLabel: walker.label,
      homeHeadline: "Gigs near you",
      homeSubheadline: "Browse open walks and manage active jobs",
      heroLabel: "Browse open walks",
      heroSublabel: "Apply to requests in your area",
      tabPurposes: {
        home: "Nearby open requests list — NO owner-style ‘track my walker’ map",
        walks: "My applications, accepted walks, active job + mark complete",
        messages: "Chat with dog owners",
        profile: "Service area, hourly rate, earnings, verification",
      },
      essentials: [
        "Set service radius & hourly rate",
        "Earnings summary on profile",
        "Active job card with Start / Complete walk",
      ],
      signatures: [
        "Apply to walk with one tap",
        "Active walk mode: timer + navigate (walker’s own session, not tracking someone else)",
        "Weekly earnings stat on profile",
      ],
    });
  }

  return plans;
}

function rolePlansForGenericMarketplace(roles: InferredRole[]): RoleTabPlan[] {
  return roles.map((role) => {
    const isSupply = /provider|seller|host|walker|teacher/i.test(role.id);
    return {
      roleId: role.id,
      roleLabel: role.label,
      homeHeadline: isSupply ? "Your listings" : "Find help nearby",
      homeSubheadline: isSupply ? "Manage requests and jobs" : "Browse and book",
      heroLabel: isSupply ? "Create listing" : "Browse nearby",
      heroSublabel: isSupply ? "Reach people in your area" : "Compare options and apply",
      tabPurposes: {
        home: isSupply ? "Post offerings + active jobs" : "Search + saved favorites",
        discover: isSupply ? "Incoming requests" : "Browse listings",
        messages: "Chat with matches",
        profile: isSupply ? "Rates, area, reviews" : "Payment & saved providers",
      },
      essentials: [],
      signatures: [],
    };
  });
}

/** Role-scoped niche — shapes split by who holds the phone. */
export function applyShapeToRoles(
  shapes: AppShape[],
  roles: InferredRole[],
  category: AppCategory
): RoleTabPlan[] {
  if (roles.length < 2) return [];

  if (category === "pets" || shapes.includes("local_marketplace")) {
    const petPlans = rolePlansForPets(shapes, roles, []);
    if (petPlans.length) return petPlans;
  }

  return rolePlansForGenericMarketplace(roles);
}

export function inferAppTopology(
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = [],
  shapes: AppShape[] = []
): AppTopologyPlan {
  const text = blob(mp, interview);
  const category = inferCategory(mp, interview);
  const roles = inferRoles(category, text, mp.appName);
  const skew = audienceSkewsOneSide(text);

  if (roles.length < 2) {
    return {
      topology: "single",
      roles: [],
      hasDualRoles: false,
      tabs: [],
      roleTabPlans: [],
      buildDirectives: [
        "Single-role app: no role picker. One home experience for the whole audience.",
      ],
    };
  }

  const topology: AppTopology =
    skew && roles.length >= 2 ? "dual_asymmetric" : "dual_symmetric";

  const tabs =
    category === "pets" || /dog|walk|walker|pet/i.test(text)
      ? petTabs(mp.features)
      : [
          { id: "home", label: "Home", icon: "home" as const, purpose: "Role-specific dashboard" },
          { id: "discover", label: "Discover", icon: "search" as const, purpose: "Browse or incoming" },
          { id: "messages", label: "Chat", icon: "bell" as const, purpose: "Messaging" },
          { id: "profile", label: "Profile", icon: "user" as const, purpose: "Settings & stats" },
        ];

  const roleTabPlans = applyShapeToRoles(shapes, roles, category);

  const buildDirectives = [
    "DUAL-ROLE APP: Include flow.roles[] — user picks role on first open (NOT in interview).",
    "MANDATORY: homeByRole object — one home block per role id with different headline, hero, sections.",
    "MANDATORY: list items include forRole: roleId | omit for shared items.",
    "Same tab ids for everyone; tabScreens content differs by forRole tags.",
    "Owner and provider see demand-side features; walker/provider see supply-side — never swap GPS tracking (owner tracks walker, not vice versa).",
  ];

  for (const plan of roleTabPlans) {
    buildDirectives.push(
      `ROLE "${plan.roleLabel}" (${plan.roleId}): home hero "${plan.heroLabel}" — ${plan.heroSublabel}`
    );
    for (const [tabId, purpose] of Object.entries(plan.tabPurposes)) {
      buildDirectives.push(`  Tab ${tabId}: ${purpose}`);
    }
    if (plan.signatures.length) {
      buildDirectives.push(
        `  Signatures for ${plan.roleId}: ${plan.signatures.join(" · ")}`
      );
    }
  }

  if (topology === "dual_asymmetric" && skew) {
    buildDirectives.push(
      `Default demo role: ${skew} — but both roles must be fully built.`
    );
  }

  return {
    topology,
    roles,
    hasDualRoles: true,
    tabs,
    roleTabPlans,
    buildDirectives,
  };
}
