import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { decryptSupabaseConnectorSecrets } from "@/lib/connectors/supabaseConnector";
import { getCurrentUser } from "@/lib/session";

/** Preview sign-in — email + password against the linked Supabase project. */
export async function POST(
  req: Request,
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

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  if (!email.includes("@") || password.length < 6) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });
  }

  const { anonKey } = decryptSupabaseConnectorSecrets(connector);
  const supabase = createClient(connector.public.url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error || !data.user) {
    const msg = error?.message ?? "Could not sign in";
    const status = /invalid|credentials|not found/i.test(msg) ? 401 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  return NextResponse.json({ ok: true, userId: data.user.id });
}
