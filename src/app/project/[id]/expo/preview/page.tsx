import { redirect } from "next/navigation";
import { ExpoLivePreview } from "@/components/ExpoLivePreview";
import { db } from "@/lib/db";
import { shouldShowAppableWatermark } from "@/lib/publishingTier";
import { getCurrentUser } from "@/lib/session";

/** Full-screen phone preview — opened from QR on your real device. */
export default async function ExpoMobilePreviewPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const project = await db.getProject(params.id);
  if (!project || project.userId !== user.id) redirect("/dashboard");
  if (!project.expoAppModel) redirect(`/project/${project.id}/expo`);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#e8e6e1] px-4 py-6">
      <p className="mb-4 text-center text-sm font-semibold text-charcoal">
        {project.masterPrompt?.appName ?? "Your app"}
      </p>
      <ExpoLivePreview
        projectId={project.id}
        model={project.expoAppModel}
        building={false}
        buildPercent={100}
        startPastOnboarding
        alive
        showWatermark={shouldShowAppableWatermark(user)}
      />
      <p className="mt-4 max-w-xs text-center text-[11px] text-warmgrey">
        Pinch to zoom if needed · same preview as on desktop
      </p>
    </main>
  );
}
