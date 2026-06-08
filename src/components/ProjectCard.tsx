import Link from "next/link";
import { PhonePreview } from "@/components/PhonePreview";
import { projectAppHref } from "@/lib/projectRoutes";
import { cn, timeAgo } from "@/lib/utils";
import type { Project } from "@/lib/types";

const statusMeta: Record<Project["status"], { label: string; cls: string }> = {
  interviewing: { label: "In progress", cls: "bg-peach/40 text-charcoal" },
  ready: { label: "Ready to build", cls: "bg-coral/15 text-coral-deep" },
  building: { label: "Building…", cls: "bg-coral/15 text-coral-deep" },
  live: { label: "Live 🎉", cls: "bg-moss/15 text-moss" },
};

export function ProjectCard({ project }: { project: Project }) {
  const meta = statusMeta[project.status];
  const href = projectAppHref(project);

  return (
    <Link href={href} className="card group block p-3 transition hover:shadow-float hover:-translate-y-0.5">
      <PhonePreview
        hue={8 + project.thumbnailHue}
        label={project.masterPrompt?.appName ?? project.name}
        status={project.masterPrompt?.vibe ?? undefined}
        description={project.masterPrompt?.description}
        features={project.masterPrompt?.features}
        compact
      />
      <div className="mt-3 flex items-center justify-between px-1 pb-1">
        <div className="min-w-0">
          <p className="truncate font-semibold">{project.name}</p>
          <p className="text-xs text-warmgrey">Updated {timeAgo(project.updatedAt)}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", meta.cls)}>
          {meta.label}
        </span>
      </div>
    </Link>
  );
}
