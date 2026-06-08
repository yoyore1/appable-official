import type { ProjectReadinessState } from "@/lib/types";
import type { AppReadinessAudit, ReadinessStatus } from "./readinessAudit";

function oauthItemStatus(
  id: "google-sign-in" | "apple-sign-in",
  authInPreview: boolean,
  state: ProjectReadinessState | null | undefined
): ReadinessStatus {
  if (state?.items[id]?.decision === "done") return "have";
  if (authInPreview) return "partial";
  return "missing";
}

/** Checklist rows for Google / Apple setup + mark Done from user progress. */
export function enrichOAuthSetupStatus(
  audit: AppReadinessAudit,
  authInPreview: boolean,
  state: ProjectReadinessState | null | undefined
): AppReadinessAudit {
  const items = audit.items.map((item) => {
    if (item.id === "google-sign-in") {
      const status = oauthItemStatus("google-sign-in", authInPreview, state);
      return {
        ...item,
        status,
        plainWhy:
          status === "have"
            ? "Google login is configured — users can tap Continue with Google in your app."
            : status === "partial"
              ? "Buttons are in the preview. Follow the Google guide under Connections (copy-paste URLs) — email still works for testing."
              : "One-tap Google login — set up after basic sign-up is in the preview.",
        inPreview: authInPreview,
      };
    }
    if (item.id === "apple-sign-in") {
      const status = oauthItemStatus("apple-sign-in", authInPreview, state);
      return {
        ...item,
        status,
        plainWhy:
          status === "have"
            ? "Apple login is configured — required on iOS if you offer Google or email sign-in."
            : status === "partial"
              ? "Do this before the App Store. Step-by-step guide under Connections → Set up Apple login."
              : "Sign in with Apple — plan before App Store submission ($99/yr Apple Developer).",
        inPreview: authInPreview,
      };
    }
    return item;
  });

  return { ...audit, items };
}
