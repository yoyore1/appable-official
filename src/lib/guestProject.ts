import { cookies } from "next/headers";

/** Placeholder owner until the user signs up after the interview. */
export const GUEST_USER_ID = "__guest__";

const GUEST_COOKIE = "appable_guest_project";

export function setGuestProjectCookie(projectId: string) {
  cookies().set(GUEST_COOKIE, projectId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
    secure: process.env.NODE_ENV === "production",
  });
}

export function getGuestProjectId(): string | undefined {
  return cookies().get(GUEST_COOKIE)?.value;
}

export function clearGuestProjectCookie() {
  cookies().delete(GUEST_COOKIE);
}

export function isGuestProject(userId: string): boolean {
  return userId === GUEST_USER_ID;
}
