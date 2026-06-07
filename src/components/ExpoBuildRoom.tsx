"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Pencil, Send, Sparkles } from "lucide-react";
import { ExpoLivePreview } from "@/components/ExpoLivePreview";
import { TypingIndicator } from "@/components/TypingIndicator";
import { expoBuildSteps } from "@/lib/expoBuildProgress";
import { planChecklist } from "@/lib/expoPreviewTheme";
import type { ExpoAppModel } from "@/lib/expoApp/types";
import {
  expoTweakChat,
  prepareExpoBuild,
  runExpoWebBuild,
  updateExpoPlan,
} from "@/server/projects";
import type { MasterBuildPrompt } from "@/lib/types";

type Phase = "summary" | "edit" | "building" | "done";

type Bubble = { id: string; role: "ai" | "user"; text: string };

export function ExpoBuildRoom({
  projectId,
  initialPlan,
  initialModel,
}: {
  projectId: string;
  initialPlan: MasterBuildPrompt;
  initialModel?: ExpoAppModel | null;
}) {
  const [plan, setPlan] = useState(initialPlan);
  const [appModel, setAppModel] = useState<ExpoAppModel | null>(initialModel ?? null);
  const [phase, setPhase] = useState<Phase>(initialModel ? "done" : "summary");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [busy, setBusy] = useState(false);
  const [buildPercent, setBuildPercent] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [buildLabels, setBuildLabels] = useState<string[]>([]);
  const [tweakInput, setTweakInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const buildTimers = useRef<ReturnType<typeof setInterval>[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const serverPercentRef = useRef(0);

  const [editForm, setEditForm] = useState({
    appName: plan.appName,
    description: plan.description,
    audience: plan.audience,
    features: plan.features.join("\n"),
    colors: plan.colors,
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, phase, buildPercent]);

  const initialized = useRef(false);
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    void prepareExpoBuild(projectId);
    setBubbles([
      {
        id: "intro",
        role: "ai",
        text: `Alright — let's build **${initialPlan.appName}** right here on the web. No download. Here's everything from your plan:`,
      },
      { id: "checklist", role: "ai", text: formatChecklist(initialPlan) },
      {
        id: "confirm-prompt",
        role: "ai",
        text: "Look good? **Confirm** to start building, or **Edit** if you want to tweak anything first.",
      },
    ]);
  }, [projectId, initialPlan]);

  function clearBuildTimers() {
    buildTimers.current.forEach(clearInterval);
    buildTimers.current = [];
  }

  async function onConfirm() {
    if (busy) return;
    setBusy(true);
    clearBuildTimers();
    setBubbles((b) => [
      ...b,
      { id: "u-confirm", role: "user", text: "Confirm — build it" },
      {
        id: "ai-go",
        role: "ai",
        text: `On it — building **${plan.appName}** now. Watch the progress below and the phone on the right.`,
      },
    ]);
    setPhase("building");
    setBuildPercent(4);
    serverPercentRef.current = 4;
    setStepIdx(0);
    setBuildLabels([expoBuildSteps(plan)[0]?.label ?? "Starting…"]);

    const poll = () => {
      void fetch(`/api/projects/${projectId}/build-progress`)
        .then((r) => r.json())
        .then((data: { active?: boolean; label?: string; index?: number; percent?: number }) => {
          if (!data.active) return;
          if (typeof data.percent === "number") {
            serverPercentRef.current = data.percent;
            setBuildPercent((p) => Math.max(p, data.percent!));
          }
          if (typeof data.index === "number") setStepIdx(data.index);
          if (data.label) {
            setBuildLabels((prev) => {
              const base = (s: string) => s.replace(/\s*—.*$/, "").trim();
              const next = data.label!;
              const last = prev[prev.length - 1];
              if (last && base(last) === base(next)) {
                return [...prev.slice(0, -1), next];
              }
              if (prev.some((p) => base(p) === base(next))) return prev;
              return [...prev, next];
            });
          }
        })
        .catch(() => undefined);
    };

    poll();
    pollRef.current = setInterval(poll, 500);
    buildTimers.current.push(pollRef.current);

    const creep = setInterval(() => {
      setBuildPercent((p) => {
        const ceiling = Math.min(92, serverPercentRef.current + 5);
        if (p >= ceiling) return p;
        return p + 1;
      });
    }, 3500);
    buildTimers.current.push(creep);

    try {
      const result = await runExpoWebBuild(projectId);
      clearBuildTimers();
      setBuildPercent(100);
      setAppModel(result.model);
      setBubbles((b) => [
        ...b,
        {
          id: "done",
          role: "ai",
          text: `**${plan.appName}** is ready. 🎉 Tap any card → **Save** or add to your list/plan tab. Profile settings work.`,
        },
      ]);
      setPhase("done");
    } catch {
      clearBuildTimers();
      setBubbles((b) => [
        ...b,
        { id: "err", role: "ai", text: "Hit a snag — try Confirm again in a sec." },
      ]);
      setPhase("summary");
    } finally {
      clearBuildTimers();
      setBusy(false);
    }
  }

  function onEdit() {
    setEditForm({
      appName: plan.appName,
      description: plan.description,
      audience: plan.audience,
      features: plan.features.join("\n"),
      colors: plan.colors,
    });
    setBubbles((b) => [
      ...b,
      { id: "u-edit", role: "user", text: "Edit my plan" },
      { id: "ai-edit", role: "ai", text: "No problem — tweak anything below, then hit **Save & review**." },
    ]);
    setPhase("edit");
  }

  async function onSaveEdit() {
    if (busy) return;
    setBusy(true);
    const features = editForm.features
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const patch: MasterBuildPrompt = {
      ...plan,
      appName: editForm.appName.trim() || plan.appName,
      description: editForm.description.trim() || plan.description,
      audience: editForm.audience.trim() || plan.audience,
      features: features.length ? features : plan.features,
      colors: editForm.colors.trim() || plan.colors,
    };
    try {
      const next = await updateExpoPlan(projectId, patch);
      setPlan(next);
      setAppModel(null);
      setBubbles((b) => [
        ...b,
        { id: "u-saved", role: "user", text: "Saved my changes" },
        { id: "ai-updated", role: "ai", text: "Updated — here's your plan now:" },
        { id: "checklist2", role: "ai", text: formatChecklist(next) },
        {
          id: "confirm2",
          role: "ai",
          text: "Ready? **Confirm** to build, or **Edit** again.",
        },
      ]);
      setPhase("summary");
    } catch {
      setBubbles((b) => [
        ...b,
        { id: "save-err", role: "ai", text: "Couldn't save — try again." },
      ]);
    } finally {
      setBusy(false);
    }
  }

  const showPreview = phase === "building" || phase === "done" || Boolean(appModel);

  return (
    <div className="grid min-h-0 flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_min(380px,40vw)]">
      <div className="card-float flex min-h-0 flex-col overflow-hidden p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-coral text-sm font-bold text-white">
            A
          </span>
          <div>
            <p className="text-sm font-semibold">Build here · Expo</p>
            <p className="text-xs text-warmgrey">Your app, in the browser</p>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {bubbles.map((b) => (
            <div
              key={b.id}
              className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                b.role === "ai"
                  ? "bg-cream text-charcoal shadow-inset"
                  : "ml-auto bg-coral text-white"
              }`}
            >
              <ChecklistText text={b.text} />
            </div>
          ))}
          {phase === "building" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="card-float space-y-3 p-4"
            >
              <div className="flex items-center justify-between text-xs text-warmgrey">
                <span className="font-medium text-charcoal">Building {plan.appName}</span>
                <span>{Math.round(buildPercent)}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-line/80">
                <motion.div
                  className="h-full rounded-full bg-coral"
                  animate={{ width: `${buildPercent}%` }}
                  transition={{ duration: 0.35, ease: "easeOut" }}
                />
              </div>
              <div className="space-y-2">
                {buildLabels.map((label, i) => (
                  <motion.div
                    key={`${label}-${i}`}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 text-sm text-charcoal"
                  >
                    <span
                      className={
                        i < buildLabels.length - 1
                          ? "grid h-5 w-5 place-items-center rounded-full bg-moss/15 text-moss"
                          : "grid h-5 w-5 place-items-center rounded-full bg-coral/15 text-coral"
                      }
                    >
                      {i < buildLabels.length - 1 ? (
                        "✓"
                      ) : (
                        <Sparkles className="h-3 w-3 animate-pulse-soft" />
                      )}
                    </span>
                    {label}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
          {busy && phase !== "building" && <TypingIndicator />}
          <div ref={endRef} className="h-px" />
        </div>

        {phase === "summary" && (
          <div className="mt-3 flex shrink-0 gap-2 border-t border-line/60 pt-3">
            <button
              type="button"
              onClick={() => void onConfirm()}
              disabled={busy}
              className="btn-primary inline-flex flex-1 items-center justify-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              Confirm — build it
            </button>
            <button
              type="button"
              onClick={onEdit}
              disabled={busy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-semibold text-charcoal transition hover:border-coral/40"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
          </div>
        )}

        {phase === "edit" && (
          <div className="mt-3 shrink-0 space-y-2 border-t border-line/60 pt-3">
            <EditField
              label="App name"
              value={editForm.appName}
              onChange={(v) => setEditForm((f) => ({ ...f, appName: v }))}
            />
            <EditField
              label="Idea"
              value={editForm.description}
              onChange={(v) => setEditForm((f) => ({ ...f, description: v }))}
              rows={2}
            />
            <EditField
              label="For"
              value={editForm.audience}
              onChange={(v) => setEditForm((f) => ({ ...f, audience: v }))}
            />
            <EditField
              label="Features (one per line)"
              value={editForm.features}
              onChange={(v) => setEditForm((f) => ({ ...f, features: v }))}
              rows={3}
            />
            <EditField
              label="Colors"
              value={editForm.colors}
              onChange={(v) => setEditForm((f) => ({ ...f, colors: v }))}
            />
            <button
              type="button"
              onClick={() => void onSaveEdit()}
              disabled={busy}
              className="btn-primary w-full"
            >
              Save & review
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="mt-3 shrink-0 space-y-2 border-t border-line/60 pt-3">
            <p className="text-xs text-warmgrey">Spotted something? One line — we&apos;ll update the preview live:</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!tweakInput.trim() || busy) return;
                const msg = tweakInput.trim();
                setTweakInput("");
                setBusy(true);
                setBubbles((b) => [...b, { id: `tu-${Date.now()}`, role: "user", text: msg }]);
                void expoTweakChat(projectId, msg)
                  .then((res) => {
                    if (res.ok) setAppModel(res.model);
                    setBubbles((b) => [
                      ...b,
                      {
                        id: `ta-${Date.now()}`,
                        role: "ai",
                        text: res.ok ? res.reply : res.message,
                      },
                    ]);
                  })
                  .finally(() => setBusy(false));
              }}
            >
              <input
                value={tweakInput}
                onChange={(e) => setTweakInput(e.target.value)}
                placeholder="e.g. profile buttons don't work…"
                className="min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral/50"
                disabled={busy}
              />
              <button type="submit" className="btn-primary !px-3" disabled={busy || !tweakInput.trim()}>
                <Send className="h-4 w-4" />
              </button>
            </form>
            <Link
              href={`/project/${projectId}`}
              className="inline-block text-sm font-semibold text-coral-deep hover:underline"
            >
              ← Back to your app hub
            </Link>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center lg:sticky lg:top-20 lg:self-start">
        {showPreview ? (
          <ExpoLivePreview
            projectId={projectId}
            model={appModel}
            building={phase === "building"}
            buildPercent={buildPercent}
            startPastOnboarding
            alive={phase === "done"}
          />
        ) : (
          <div className="rounded-2xl border border-dashed border-line/80 bg-cream/50 p-6 text-center">
            <Sparkles className="mx-auto h-8 w-8 text-coral/60" />
            <p className="mt-2 text-xs text-warmgrey">
              Your live preview appears here when you confirm
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatChecklist(mp: MasterBuildPrompt): string {
  const lines = planChecklist(mp).map((item) => `✓ **${item.label}:** ${item.value}`);
  return lines.join("\n");
}

function ChecklistText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className="whitespace-pre-wrap">
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-charcoal">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

function EditField({
  label,
  value,
  onChange,
  rows = 1,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <label className="block text-xs">
      <span className="font-semibold text-warmgrey">{label}</span>
      {rows > 1 ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral/50"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none focus:border-coral/50"
        />
      )}
    </label>
  );
}
