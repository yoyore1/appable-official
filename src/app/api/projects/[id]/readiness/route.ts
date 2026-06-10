import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isServiceAuthed } from "@/lib/serviceAuth";
import type { ReadinessDecision } from "@/lib/types";

/**
 * PATCH /api/projects/:id/readiness
 * Void Builder persists launch-checklist progress (service-key auth).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isServiceAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const project = await db.getProject(params.id);
  if (!project) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    pinnedItemId?: string | null;
    itemId?: string;
    discussed?: boolean;
    decision?: ReadinessDecision | null;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const { defaultReadinessState, patchReadinessItem, auditAppReadiness, enrichAuditWithState } =
    await import("@/lib/expoApp/readinessAudit");

  let state = project.readinessState ?? defaultReadinessState();

  if (body.pinnedItemId !== undefined) {
    state = { ...state, pinnedItemId: body.pinnedItemId };
  }

  if (body.itemId) {
    state = patchReadinessItem(state, body.itemId, {
      ...(body.discussed !== undefined ? { discussed: body.discussed } : {}),
      ...(body.decision !== undefined ? { decision: body.decision } : {}),
    });
  }

  state = { ...state, lastAuditAt: new Date().toISOString() };
  await db.updateProject(params.id, { readinessState: state });

  let readiness = null;
  if (project.expoAppModel && project.masterPrompt) {
    const audit = auditAppReadiness(
      project.expoAppModel,
      project.masterPrompt,
      project.interview ?? []
    );
    readiness = enrichAuditWithState(audit, state, state.pinnedItemId);
  }

  return NextResponse.json({ ok: true, state, readiness });
}
