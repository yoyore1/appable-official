"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { Download, FileText, ImageIcon, Clapperboard, Wand2 } from "lucide-react";
import { generateFullLaunchPack, buyLaunchAsset } from "@/server/projects";
import type { LaunchAssets } from "@/lib/types";

export function LaunchPanel({
  projectId,
  launch,
}: {
  projectId: string;
  launch: LaunchAssets;
}) {
  const [pending, startTransition] = useTransition();
  const [working, setWorking] = useState<string | null>(null);

  function run(label: string, fn: () => Promise<void>) {
    setWorking(label);
    startTransition(async () => {
      await fn();
      setWorking(null);
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button
          className="btn-primary"
          disabled={pending}
          onClick={() => run("all", () => generateFullLaunchPack(projectId))}
        >
          <Wand2 className="h-4 w-4" />
          {working === "all" ? "Creating everything…" : "Generate everything"}
        </button>
        <button
          className="btn-secondary"
          disabled={pending}
          onClick={() => run("aso", () => buyLaunchAsset(projectId, "aso"))}
        >
          <FileText className="h-4 w-4" /> ASO copy
        </button>
        <button
          className="btn-secondary"
          disabled={pending}
          onClick={() => run("screenshots", () => buyLaunchAsset(projectId, "screenshots"))}
        >
          <ImageIcon className="h-4 w-4" /> Screenshots
        </button>
        <button
          className="btn-secondary"
          disabled={pending}
          onClick={() => run("video", () => buyLaunchAsset(projectId, "video"))}
        >
          <Clapperboard className="h-4 w-4" /> Video ads
        </button>
      </div>

      {/* ASO */}
      {launch.aso && (
        <div className="card p-5">
          <h4 className="font-semibold">App Store copy</h4>
          <dl className="mt-3 space-y-2 text-sm">
            <Row k="Title" v={launch.aso.title} />
            <Row k="Subtitle" v={launch.aso.subtitle} />
            <Row k="Keywords" v={launch.aso.keywords.join(", ")} />
          </dl>
          <p className="mt-3 whitespace-pre-line text-sm text-charcoal-soft">
            {launch.aso.description}
          </p>
        </div>
      )}

      {/* Icon + screenshots */}
      {(launch.icon || launch.screenshots) && (
        <div className="card p-5">
          <h4 className="font-semibold">Icon &amp; screenshots</h4>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            {launch.icon && (
              <div className="text-center">
                <Image src={launch.icon.url} alt="App icon" width={72} height={72} className="rounded-2xl shadow-soft" unoptimized />
                <p className="mt-1 text-xs text-warmgrey">Icon</p>
              </div>
            )}
            {launch.screenshots?.map((s) => (
              <div key={s.caption} className="text-center">
                <Image src={s.url} alt={s.caption} width={90} height={180} className="rounded-xl shadow-soft" unoptimized />
                <p className="mt-1 max-w-[90px] truncate text-xs text-warmgrey">{s.caption}</p>
              </div>
            ))}
          </div>
          <a className="btn-ghost mt-3 inline-flex" href="#" onClick={(e) => e.preventDefault()}>
            <Download className="h-4 w-4" /> Download all (coming soon)
          </a>
        </div>
      )}

      {/* Video ads */}
      {launch.videoAds && (
        <div className="card p-5">
          <h4 className="font-semibold">Video ad scripts</h4>
          <div className="mt-3 space-y-3">
            {launch.videoAds.map((v) => (
              <div key={v.title} className="rounded-2xl bg-sand/50 p-3">
                <p className="font-medium">{v.title}</p>
                <p className="mt-1 whitespace-pre-line text-sm text-charcoal-soft">{v.script}</p>
                <p className="mt-1 text-xs text-warmgrey">{v.spec}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-warmgrey">{k}</dt>
      <dd className="text-charcoal">{v}</dd>
    </div>
  );
}
