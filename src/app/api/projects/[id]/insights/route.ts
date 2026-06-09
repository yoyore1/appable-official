import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { canRunWeeklyReports, reportsPhaseMessage } from "@/lib/insights/reportsLifecycle";
import { pullAllInsights } from "@/lib/insights/providers";
import { runWeeklyInsightsForProject } from "@/lib/insights/runWeekly";
import { defaultInsightsState } from "@/lib/insights/types";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const project = await db.getProject(params.id);
  if (!project || project.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    state: project.insightsState ?? defaultInsightsState(),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const project = await db.getProject(params.id);
  if (!project || project.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: "weekly" | "live" | "patch";
    patch?: Partial<import("@/lib/insights/types").ProjectInsightsState>;
  };

  if (body.action === "weekly") {
    if (!canRunWeeklyReports(project)) {
      return NextResponse.json(
        { ok: false, error: "reports_not_ready", message: reportsPhaseMessage(project) },
        { status: 400 }
      );
    }
    try {
      const { state, bundle } = await runWeeklyInsightsForProject(project);
      await db.updateProject(params.id, { insightsState: state });
      return NextResponse.json({ ok: true, state, bundle });
    } catch (e) {
      console.error("[insights weekly]", e);
      return NextResponse.json(
        {
          ok: false,
          error: e instanceof Error ? e.message : "weekly_failed",
        },
        { status: 500 }
      );
    }
  }

  if (body.action === "live") {
    const snapshots = await pullAllInsights(project);
    const prior = project.insightsState ?? defaultInsightsState();
    const state = { ...prior, lastLivePullAt: new Date().toISOString() };
    await db.updateProject(params.id, { insightsState: state });
    return NextResponse.json({ snapshots, state });
  }

  if (body.action === "patch" && body.patch) {
    const state = { ...(project.insightsState ?? defaultInsightsState()), ...body.patch };
    await db.updateProject(params.id, { insightsState: state });
    return NextResponse.json({ ok: true, state });
  }

  return NextResponse.json({ error: "bad_request" }, { status: 400 });
}
