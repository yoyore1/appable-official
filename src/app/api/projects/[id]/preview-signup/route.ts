import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { db } from "@/lib/db";
import { decryptSupabaseConnectorSecrets } from "@/lib/connectors/supabaseConnector";
import { getCurrentUser } from "@/lib/session";

/**
 * Preview sign-up — creates a confirmed user via service role so founders
 * aren't blocked by Supabase's default email-confirm flow while testing.
 */
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

  let body: {
    email?: string;
    password?: string;
    displayName?: string;
    role?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";
  const displayName = body.displayName?.trim() ?? "";
  const role = body.role?.trim() || null;

  if (!email.includes("@") || password.length < 6) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 400 });
  }

  const { serviceRoleKey } = decryptSupabaseConnectorSecrets(connector);
  const admin = createClient(connector.public.url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: displayName,
      role: role ?? undefined,
    },
  });

  if (createErr || !created.user) {
    const msg = createErr?.message ?? "Could not create user";
    const status = /already|registered|exists/i.test(msg) ? 409 : 400;
    return NextResponse.json({ error: msg }, { status });
  }

  const { error: profileErr } = await admin.from("appable_profiles").upsert({
    user_id: created.user.id,
    display_name: displayName || null,
    role,
    has_completed_onboarding: false,
  });

  if (profileErr) {
    return NextResponse.json(
      { error: `Account created but profile row failed: ${profileErr.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, userId: created.user.id });
}
