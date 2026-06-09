import type { ConnectorId } from "@/lib/connectors/catalog";
import { connectedIntegrationIds } from "./modes";
import type { Project } from "@/lib/types";

export interface PrivacyChecklistItem {
  id: string;
  title: string;
  detail: string;
  requiredBefore: ConnectorId[];
}

const ITEMS: PrivacyChecklistItem[] = [
  {
    id: "privacy_policy",
    title: "Privacy policy published",
    detail: "App Store and GDPR expect a policy before analytics and ads collect user data.",
    requiredBefore: ["posthog", "admob", "onesignal", "appsflyer"],
  },
  {
    id: "analytics_consent",
    title: "Analytics consent in onboarding",
    detail: "Tell users you use product analytics; offer opt-out where required.",
    requiredBefore: ["posthog"],
  },
  {
    id: "replay_consent",
    title: "Session replay disclosure",
    detail: "PostHog replay may record screens — disclose in privacy policy.",
    requiredBefore: ["posthog"],
  },
  {
    id: "push_consent",
    title: "Push permission timing",
    detail: "Ask for push after value — not on first launch.",
    requiredBefore: ["onesignal"],
  },
];

export function privacyChecklistForProject(project: Project): PrivacyChecklistItem[] {
  const connected = new Set(connectedIntegrationIds(project));
  return ITEMS.filter((item) => item.requiredBefore.some((id) => connected.has(id)));
}

export function privacyBlockingMessage(project: Project): string | null {
  if (project.insightsState?.privacyAcknowledgedAt) return null;
  const items = privacyChecklistForProject(project);
  if (!items.length) return null;
  return `Before full analytics go live, complete: ${items.map((i) => i.title).join(", ")}.`;
}
