import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * GET /api/handoff/:token
 * The Builder exchanges a single-use handoff token (from the web deep link) for
 * the app context — no manual project ID, no separate login round-trip. The
 * token itself is the credential; it's consumed on first use.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { token: string } }
) {
  const handoff = await db.consumeHandoff(params.token);
  if (!handoff) {
    return NextResponse.json(
      { error: "invalid_or_expired" },
      { status: 410 }
    );
  }

  const [project, user] = await Promise.all([
    db.getProject(handoff.projectId),
    db.getUserById(handoff.userId),
  ]);
  if (!project || !user) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (!project.masterPrompt) {
    return NextResponse.json({ error: "not_ready" }, { status: 409 });
  }

  const { supabaseConnectorForBuilder } = await import(
    "@/lib/connectors/supabaseConnector"
  );
  const { sdkConnectorsForBuilder } = await import("@/lib/connectors/sdkConnector");

  return NextResponse.json({
    app: {
      id: project.id,
      name: project.name,
      target: handoff.target ?? project.target,
      githubRepoUrl: project.githubRepoUrl,
      status: project.status,
    },
    masterPrompt: project.masterPrompt,
    connectors: {
      supabase: supabaseConnectorForBuilder(project.supabaseConnector),
      sdk: sdkConnectorsForBuilder(project.sdkConnectors),
      marketplaceSelections: project.marketplaceSelections ?? [],
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      buildPower: user.buildPower,
      reviewBalance: user.reviewBalance,
      dataSharingOptIn: user.dataSharingOptIn,
    },
  });
}
