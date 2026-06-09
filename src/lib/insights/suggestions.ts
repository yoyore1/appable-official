import type { ConnectorId } from "@/lib/connectors/catalog";
import { getConnectorDefinition } from "@/lib/connectors/registry";
import type { InsightsDataStage, InsightSuggestion, IntegrationInsightSnapshot } from "./types";

type Template = Omit<InsightSuggestion, "id">;

const EXPLORE: Partial<Record<ConnectorId, Template[]>> = {
  posthog: [
    { label: "What should I track on day one?", prompt: "What PostHog events should I track on day one for this app?", mode: "explore", kind: "ask" },
    { label: "Do I need this before launch?", prompt: "Do I need PostHog before launch or after first users?", mode: "explore", kind: "explain" },
    { label: "Wire tracking in Build", prompt: "Wire PostHog events for my main tabs and funnel in the preview.", mode: "explore", kind: "build", buildPrompt: "Wire PostHog screen views and core funnel events matching our event catalog." },
  ],
  sentry: [
    { label: "Do I need Sentry before TestFlight?", prompt: "When should I connect Sentry for this app?", mode: "explore", kind: "explain" },
    { label: "What crashes matter at launch?", prompt: "What crash types should I watch for before App Store submit?", mode: "explore", kind: "ask" },
  ],
  revenuecat: [
    { label: "Should this app charge?", prompt: "Should this app use subscriptions? What would I gate?", mode: "explore", kind: "explain" },
    { label: "How do I maximize revenue?", prompt: "How can I maximize subscription revenue for this app as the builder?", mode: "explore", kind: "ask" },
  ],
  onesignal: [
    { label: "What pushes fit this app?", prompt: "What push notifications should this app send — not generic spam?", mode: "explore", kind: "ask" },
    { label: "Reduce churn with push", prompt: "How can push reduce churn for this app?", mode: "explore", kind: "explain" },
  ],
  supabase: [
    { label: "What should I store?", prompt: "What data should live in Supabase for this app?", mode: "explore", kind: "explain" },
  ],
  appfollow: [
    { label: "When do I need review monitoring?", prompt: "When should I connect AppFollow for this app?", mode: "explore", kind: "explain" },
  ],
};

const INSIGHTS: Partial<Record<ConnectorId, Template[]>> = {
  posthog: [
    { label: "Why are users dropping off?", prompt: "Based on this week's PostHog data, where is my product leaking users and why?", mode: "insights", kind: "ask" },
    { label: "What should I fix in Build?", prompt: "From this week's funnel, what is the top Build fix I should ship?", mode: "insights", kind: "build", buildPrompt: "Fix the biggest funnel drop-off from this week's analytics.", acceptanceCriteria: "Improve conversion on the weakest funnel step next week." },
    { label: "What else should I track?", prompt: "What PostHog events am I missing for a clearer picture?", mode: "insights", kind: "ask" },
  ],
  sentry: [
    { label: "What's breaking most?", prompt: "What errors dominated this week and which screen should I fix first?", mode: "insights", kind: "ask" },
    { label: "Fix top crash in Build", prompt: "Fix the top crash from this week's Sentry data in the preview.", mode: "insights", kind: "build", buildPrompt: "Address the top Sentry issue from this week.", acceptanceCriteria: "Crash-free sessions improve next week." },
  ],
  revenuecat: [
    { label: "How do I maximize revenue?", prompt: "How can I maximize subscription revenue this month based on our data?", mode: "insights", kind: "ask" },
    { label: "How do I reduce churn?", prompt: "How do I reduce subscription churn for this app?", mode: "insights", kind: "ask" },
    { label: "Improve paywall in Build", prompt: "Improve paywall UX based on trial conversion data.", mode: "insights", kind: "build", buildPrompt: "Update paywall copy and placement to improve trial conversion." },
  ],
  onesignal: [
    { label: "Improve re-engagement", prompt: "How can push improve retention based on this week's opt-in and open rates?", mode: "insights", kind: "ask" },
  ],
  supabase: [
    { label: "User growth trend", prompt: "What does this week's sign-up trend mean for my launch?", mode: "insights", kind: "ask" },
  ],
  appfollow: [
    { label: "Improve store rating", prompt: "What are reviewers complaining about and what product fix helps?", mode: "insights", kind: "ask" },
  ],
  admob: [
    { label: "Ads without hurting UX", prompt: "Is ad revenue worth the UX tradeoff this week?", mode: "insights", kind: "ask" },
  ],
};

function defaultsFor(id: ConnectorId, mode: "explore" | "insights"): Template[] {
  const name = getConnectorDefinition(id).displayName;
  if (mode === "explore") {
    return [
      { label: `How does ${name} fit?`, prompt: `How does ${name} fit this app as I'm building it?`, mode: "explore", kind: "explain" },
    ];
  }
  return [
    { label: "Explain this week", prompt: `Explain this week's ${name} numbers for my app.`, mode: "insights", kind: "ask" },
    { label: "What should I do next?", prompt: `What should I do next based on ${name} this week?`, mode: "insights", kind: "ask" },
  ];
}

export function suggestionsForIntegration(
  id: ConnectorId,
  stage: InsightsDataStage,
  snapshot?: IntegrationInsightSnapshot | null
): InsightSuggestion[] {
  const mode: "explore" | "insights" =
    stage === "explore" || stage === "waiting" ? "explore" : "insights";

  let templates = (mode === "explore" ? EXPLORE[id] : INSIGHTS[id]) ?? defaultsFor(id, mode);

  if (snapshot?.health === "error") {
    templates = [
      {
        label: "Fix connection",
        prompt: `My ${getConnectorDefinition(id).displayName} Reports connection failed — what should I check?`,
        mode: "insights",
        kind: "explain",
      },
      ...templates.slice(0, 2),
    ];
  }

  if (stage === "early" && mode === "insights") {
    templates = [
      {
        label: "Is this enough data?",
        prompt: "Is this week's sample size enough to trust these trends?",
        mode: "insights",
        kind: "ask",
      },
      ...templates,
    ];
  }

  return templates.slice(0, 5).map((t, i) => ({
    ...t,
    id: `${id}-${mode}-${i}`,
  }));
}

export function rankSuggestions(
  suggestions: InsightSuggestion[],
  snapshot?: IntegrationInsightSnapshot | null
): InsightSuggestion[] {
  if (!snapshot) return suggestions;
  if (snapshot.health === "error") {
    return [...suggestions].sort((a) => (a.label.includes("Fix") ? -1 : 1));
  }
  const drop = snapshot.metrics.dropOffStep;
  if (drop && typeof drop === "string") {
    const build = suggestions.find((s) => s.kind === "build");
    if (build) return [build, ...suggestions.filter((s) => s !== build)].slice(0, 5);
  }
  return suggestions;
}
