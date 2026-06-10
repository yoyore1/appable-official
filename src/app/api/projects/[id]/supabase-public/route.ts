import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { decryptSupabaseConnectorSecrets } from "@/lib/connectors/supabaseConnector";
import { getCurrentUser } from "@/lib/session";

/** Public Supabase client config for preview sign-up (anon key only). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const project = await db.getProject(params.id);
  if (!project || project.userId !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const connector = project.supabaseConnector;
  if (!connector || connector.public.status !== "connected") {
    return NextResponse.json({ error: "not_connected" }, { status: 409 });
  }

  try {
    const { anonKey } = decryptSupabaseConnectorSecrets(connector);
    return NextResponse.json({
      url: connector.public.url,
      anonKey,
      projectRef: connector.public.projectRef,
      profilesTable: "appable_profiles",
    });
  } catch {
    return NextResponse.json(
      {
        error: "decrypt_failed",
        message:
          "Reconnect Supabase in Connections — stored keys no longer match this server.",
      },
      { status: 409 }
    );
  }
}
