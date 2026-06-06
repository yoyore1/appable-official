"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clearSession, setSession } from "@/lib/session";

export type AuthState = { error?: string } | null;

function dest(depositPaid: boolean) {
  return depositPaid ? "/dashboard" : "/deposit";
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;
  const dataSharing = formData.get("dataSharing") === "on";

  if (!email || !email.includes("@")) return { error: "Enter a valid email." };
  if (password.length < 6) return { error: "Password needs at least 6 characters." };

  const existing = await db.getUserByEmail(email);
  if (existing) return { error: "That email already has an account — try signing in." };

  const user = await db.createUser({ email, password, name });
  await db.updateUser(user.id, { dataSharingOptIn: dataSharing });
  setSession(user.id);
  // First signup routes into the $1 deposit flow before dashboard access.
  redirect("/deposit");
}

export async function signInAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  const user = await db.getUserByEmail(email);
  if (!user) return { error: "No account with that email." };
  const ok = await db.verifyPassword(email, password);
  if (!ok) return { error: "Wrong password — try again." };

  setSession(user.id);
  redirect(dest(user.depositPaid));
}

/**
 * Google OAuth. With real Supabase this redirects to the Supabase OAuth URL.
 * In MOCK MODE we create/sign in a demo Google user so the flow is testable.
 */
export async function googleAuthAction(): Promise<void> {
  const email = "you@gmail.com";
  let user = await db.getUserByEmail(email);
  if (!user) user = await db.createUser({ email, name: "Google User" });
  setSession(user.id);
  redirect(dest(user.depositPaid));
}

export async function signOutAction(): Promise<void> {
  clearSession();
  redirect("/");
}
