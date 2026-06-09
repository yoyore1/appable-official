import type { Project } from "@/lib/types";
import type { InsightsWeeklyBundle } from "./types";

export interface WeeklyEmailDigest {
  to: string;
  subject: string;
  text: string;
}

/** Prepare weekly founder email — wire to Resend/SendGrid when outbound mail is enabled. */
export function buildWeeklyEmailDigest(
  project: Project,
  userEmail: string,
  bundle: InsightsWeeklyBundle
): WeeklyEmailDigest {
  const app = project.masterPrompt?.appName ?? project.name;
  const lines = bundle.snapshots
    .filter((s) => s.health === "ok" || s.health === "no_data")
    .map((s) => `• ${s.connectorId}: ${s.headline} — ${s.summary}`)
    .join("\n");

  return {
    to: userEmail,
    subject: `${app} — weekly Reports (${bundle.weekEnding})`,
    text:
      `Hi,\n\n${bundle.overallHeadline}\n\n${lines || "Connect integrations and ship to see charts next week."}\n\n` +
      `Open Reports in Appable: ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/project/${project.id}/expo\n`,
  };
}

export async function sendWeeklyEmailDigest(digest: WeeklyEmailDigest): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.info("[insights] weekly email (mock):", digest.subject, "→", digest.to);
    return true;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.INSIGHTS_EMAIL_FROM ?? "reports@appable.app",
        to: digest.to,
        subject: digest.subject,
        text: digest.text,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
