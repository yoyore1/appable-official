import { db } from "@/lib/db";
import {
  getGuestProjectId,
  GUEST_USER_ID,
  isGuestProject,
} from "@/lib/guestProject";
import { getCurrentUser } from "@/lib/session";
import type { Project } from "@/lib/types";

export type ProjectAccess =
  | { ok: true; project: Project; isGuest: boolean }
  | { ok: false; reason: "missing" | "forbidden" };

/** Logged-in owner or guest cookie holder for a guest-owned project. */
export async function resolveProjectAccess(
  projectId: string
): Promise<ProjectAccess> {
  const project = await db.getProject(projectId);
  if (!project) return { ok: false, reason: "missing" };

  const user = await getCurrentUser();
  if (user && project.userId === user.id) {
    return { ok: true, project, isGuest: false };
  }

  if (
    isGuestProject(project.userId) &&
    getGuestProjectId() === projectId
  ) {
    return { ok: true, project, isGuest: true };
  }

  return { ok: false, reason: "forbidden" };
}
