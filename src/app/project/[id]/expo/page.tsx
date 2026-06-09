import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { Background } from "@/components/Background";
import { Confetti } from "@/components/Confetti";
import { ExpoBuildRoom } from "@/components/ExpoBuildRoom";
import { mintExpoPreviewToken } from "@/lib/expoPreviewToken";
import { isExpoAppBuilt } from "@/lib/projectRoutes";
import { getCurrentUser } from "@/lib/session";
import { db } from "@/lib/db";
import { shouldShowAppableWatermark } from "@/lib/publishingTier";

export default async function ExpoBuildPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { celebrate?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  let project = await db.getProject(params.id);
  if (!project || project.userId !== user.id) redirect("/dashboard");
  if (!user.depositPaid) redirect(`/deposit?project=${project.id}`);
  if (!project.masterPrompt) redirect(`/project/${project.id}/build`);

  if (project.expoAppModel && !project.expoPreviewToken) {
    await db.updateProject(project.id, { expoPreviewToken: mintExpoPreviewToken() });
    project = (await db.getProject(params.id))!;
  }

  const mp = project.masterPrompt;
  const built = isExpoAppBuilt(project);

  return (
    <div className="grain relative flex h-[100dvh] flex-col overflow-hidden">
      <Background calm />
      <AppNav user={user} wide />
      {searchParams.celebrate && <Confetti />}
      <header className="relative z-10 flex shrink-0 items-center gap-2 border-b border-line/40 bg-cream/50 px-3 py-2 backdrop-blur-md sm:px-4">
        <Link
          href={built ? "/dashboard" : `/project/${project.id}`}
          className="inline-flex items-center gap-0.5 rounded-lg px-1.5 py-1 text-sm text-warmgrey transition hover:bg-sand/60 hover:text-charcoal"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="hidden sm:inline">{built ? "My apps" : "Back"}</span>
        </Link>
        <span className="h-4 w-px bg-line/70" aria-hidden />
        <h1 className="truncate text-sm font-semibold text-charcoal">{mp.appName}</h1>
      </header>
      <ExpoBuildRoom
        projectId={project.id}
        initialPlan={mp}
        initialModel={project.expoAppModel}
        interview={project.interview}
        initialReadinessState={project.readinessState}
        initialBrainstormState={project.brainstormState}
        initialSupabaseConnector={project.supabaseConnector?.public ?? null}
        initialRevenueCatConnector={project.revenueCatConnector?.public ?? null}
        initialRailwayConnector={project.railwayConnector?.public ?? null}
        initialMarketplaceSelections={project.marketplaceSelections ?? []}
        initialSdkConnectors={Object.fromEntries(
          Object.entries(project.sdkConnectors ?? {}).map(([id, c]) => [
            id,
            c?.public ?? null,
          ])
        )}
        initialInsightsState={project.insightsState}
        showWatermark={shouldShowAppableWatermark(user)}
        previewToken={project.expoPreviewToken ?? null}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
