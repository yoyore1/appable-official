/**
 * Session handling. In MOCK MODE we use a signed-ish cookie holding the user id.
 * When Supabase auth is configured, replace these helpers with Supabase SSR
 * session reads (see src/lib/supabase/server.ts). The rest of the app only
 * depends on getCurrentUser()/setSession()/clearSession().
 */
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import type { UserAccount } from "@/lib/types";

const COOKIE = "appable_session";

export function setSession(userId: string) {
  cookies().set(COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export function clearSession() {
  cookies().delete(COOKIE);
}

export async function getCurrentUser(): Promise<UserAccount | null> {
  const id = cookies().get(COOKIE)?.value;
  if (!id) return null;
  const user = await db.getUserById(id);
  if (!user) {
    clearSession();
    return null;
  }
  return user;
}

export async function requireUser(): Promise<UserAccount> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}
