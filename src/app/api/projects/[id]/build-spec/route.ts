import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isServiceAuthed } from "@/lib/serviceAuth";

/**
 * GET /api/projects/:id/build-spec
 * Full product contract for Void — plan, interview, expoAppModel, capability audit, readiness.
 */
export async function GET(
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
  if (!project.masterPrompt) {
    return NextResponse.json({ error: "not_ready" }, { status: 409 });
  }

  const { supabaseConnectorForBuilder } = await import(
    "@/lib/connectors/supabaseConnector"
  );
  const { sdkConnectorsForBuilder } = await import("@/lib/connectors/sdkConnector");

  let readiness: import("@/lib/expoApp/readinessAudit").AppReadinessAudit | null =
    null;

  if (project.expoAppModel) {
    const { auditAppReadiness, enrichAuditWithState } = await import(
      "@/lib/expoApp/readinessAudit"
    );
    const audit = auditAppReadiness(
      project.expoAppModel,
      project.masterPrompt,
      project.interview ?? []
    );
    readiness = enrichAuditWithState(
      audit,
      project.readinessState,
      project.readinessState?.pinnedItemId
    );
  }

  return NextResponse.json({
    projectId: project.id,
    userId: project.userId,
    status: project.status,
    target: project.target ?? null,
    masterPrompt: project.masterPrompt,
    interview: project.interview ?? [],
    expoAppModel: project.expoAppModel ?? null,
    capabilityAudit: project.expoAppModel?.capabilityAudit ?? null,
    readiness,
    connectors: {
      supabase: supabaseConnectorForBuilder(project.supabaseConnector),
      sdk: sdkConnectorsForBuilder(project.sdkConnectors),
      marketplaceSelections: project.marketplaceSelections ?? [],
    },
  });
}
