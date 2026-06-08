import type { Project } from "@/lib/types";

type ProjectNav = Pick<Project, "id" | "status" | "expoAppModel" | "masterPrompt">;

/** Where opening a project from My apps (or launch list) should land. */
export function projectAppHref(project: ProjectNav): string {
  if (project.status === "interviewing" || !project.masterPrompt) {
    return `/project/${project.id}/build`;
  }
  if (project.expoAppModel) {
    return `/project/${project.id}/expo`;
  }
  return `/project/${project.id}`;
}

export function isExpoAppBuilt(project: Pick<Project, "expoAppModel">): boolean {
  return Boolean(project.expoAppModel);
}
