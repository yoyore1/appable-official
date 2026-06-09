import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { canRunWeeklyReports } from "@/lib/insights/reportsLifecycle";
import { countConnectedIntegrations } from "@/lib/insights/modes";
import { runWeeklyInsightsForProject } from "@/lib/insights/runWeekly";
import { buildWeeklyEmailDigest, sendWeeklyEmailDigest } from "@/lib/insights/emailWeekly";

/** Weekly cron — set CRON_SECRET and call with Authorization: Bearer <secret>. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "cron_not_configured" }, { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const projects = await db.listAllProjects();
  let ran = 0;
  let emailed = 0;

  for (const project of projects) {
    if (!project.expoAppModel || countConnectedIntegrations(project) === 0) continue;
    if (!canRunWeeklyReports(project)) continue;
    const prior = project.insightsState;
    if (prior?.emailWeeklyEnabled === false) continue;

    const { state, bundle } = await runWeeklyInsightsForProject(project);
    await db.updateProject(project.id, { insightsState: state });
    ran++;

    const user = await db.getUserById(project.userId);
    if (user?.email && (prior?.emailWeeklyEnabled ?? true)) {
      const digest = buildWeeklyEmailDigest(project, user.email, bundle);
      if (await sendWeeklyEmailDigest(digest)) emailed++;
    }
  }

  return NextResponse.json({ ok: true, projectsProcessed: ran, emailsSent: emailed });
}
