"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { VoiceMicButton } from "@/components/VoiceMicButton";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import { FIRST_INTERVIEW_QUESTION } from "@/lib/interviewFlow";
import {
  COLD_START_KEY,
  MAX_SUGGEST_IDEAS_USES,
  PENDING_IDEA_KEY,
  SUGGEST_IDEAS_USES_KEY,
} from "@/lib/landingHandoff";
import {
  deepLoadingLines,
  suggestBatchLoadingForTopic,
} from "@/lib/suggestLoadingCopy";
import type { LayoutArchetype } from "@/lib/archetypes";

type SuggestedAppIdea = {
  name: string;
  description: string;
  explanation: string;
  archetype: LayoutArchetype;
  nicheTopic: string;
};

const SILVER_BADGE =
  "bg-slate-100 text-slate-700 ring-1 ring-slate-200/80";

const IDEA_RANKS = [
  {
    label: "Best match",
    className: "bg-amber-100 text-amber-900 ring-1 ring-amber-300/70",
  },
  { label: "Great fit", className: SILVER_BADGE },
  { label: "Also strong", className: SILVER_BADGE },
] as const;

const ROTATING_PLACEHOLDERS = [
  "e.g. A dog-walking app for busy pet owners…",
  "Try 'gym' or 'meal prep'…",
  "e.g. A budget tracker for freelancers…",
  "Just say 'cooking' and I'll suggest ideas",
  "e.g. A booking app for tutors or nail techs…",
  "Try 'habits', 'journaling', or 'meditation'…",
  "What are you into?",
];

function readSuggestUses(): number {
  if (typeof window === "undefined") return 0;
  const raw = sessionStorage.getItem(SUGGEST_IDEAS_USES_KEY);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, MAX_SUGGEST_IDEAS_USES);
}

function writeSuggestUses(n: number) {
  sessionStorage.setItem(
    SUGGEST_IDEAS_USES_KEY,
    String(Math.min(n, MAX_SUGGEST_IDEAS_USES))
  );
}

function RotatingStatus({
  lines,
  active,
}: {
  lines: readonly string[];
  active: boolean;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!active) return;
    setIdx(0);
    const id = setInterval(() => setIdx((i) => (i + 1) % lines.length), 1400);
    return () => clearInterval(id);
  }, [active, lines]);

  if (!active) return null;

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={lines[idx]}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.3 }}
        className="text-sm font-medium text-charcoal-soft"
      >
        {lines[idx]}
      </motion.p>
    </AnimatePresence>
  );
}

export function LandingHero() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [phIdx, setPhIdx] = useState(0);
  const [suggesting, setSuggesting] = useState(false);
  const [ideas, setIdeas] = useState<SuggestedAppIdea[] | null>(null);
  const [isDiscover, setIsDiscover] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [suggestUses, setSuggestUses] = useState(0);
  const [batchVariant, setBatchVariant] = useState(0);
  /** Topic the visible suggestions were generated from — kept if user clears the input. */
  const [anchorTopic, setAnchorTopic] = useState("");
  const [deepOpen, setDeepOpen] = useState<Record<number, boolean>>({});
  const [deepText, setDeepText] = useState<Record<number, string>>({});
  const [deepLoading, setDeepLoading] = useState<number | null>(null);
  const [deepMsgIdx, setDeepMsgIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const voice = useVoiceDictation({
    onTranscript: (text) => {
      setValue((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
      setSuggestError(null);
      requestAnimationFrame(() => textareaRef.current?.focus());
    },
  });

  const composing = focused || value.length > 0;
  const hasText = value.trim().length > 0;
  const suggestCapReached = suggestUses >= MAX_SUGGEST_IDEAS_USES;
  const batchLoadingLines = suggestBatchLoadingForTopic(
    value.trim() || anchorTopic
  );

  function resolveSuggestContext() {
    const typed = value.trim();
    if (typed) return { topic: typed, mode: "topic" as const };
    if (anchorTopic) return { topic: anchorTopic, mode: "topic" as const };
    return { topic: "", mode: "discover" as const };
  }

  useEffect(() => {
    setSuggestUses(readSuggestUses());
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  useEffect(() => {
    if (hasText) return;
    const id = setInterval(
      () => setPhIdx((i) => (i + 1) % ROTATING_PLACEHOLDERS.length),
      3000
    );
    return () => clearInterval(id);
  }, [hasText]);

  useEffect(() => {
    if (deepLoading === null) return;
    const idea = ideas?.[deepLoading];
    if (!idea) return;
    const lines = deepLoadingLines(idea.archetype, idea.name);
    setDeepMsgIdx(0);
    const id = setInterval(() => setDeepMsgIdx((i) => (i + 1) % lines.length), 1100);
    return () => clearInterval(id);
  }, [deepLoading, ideas]);

  const consumeUse = useCallback(() => {
    setSuggestUses((prev) => {
      const next = Math.min(prev + 1, MAX_SUGGEST_IDEAS_USES);
      writeSuggestUses(next);
      return next;
    });
  }, []);

  function goToInterview(idea: string) {
    sessionStorage.setItem(PENDING_IDEA_KEY, idea);
    sessionStorage.removeItem(COLD_START_KEY);
    router.push("/interview/start");
  }

  function goToInterviewCold() {
    sessionStorage.removeItem(PENDING_IDEA_KEY);
    sessionStorage.setItem(COLD_START_KEY, "1");
    router.push("/interview/start");
  }

  function handleStartBuilding() {
    const idea = value.trim();
    if (idea) goToInterview(idea);
    else goToInterviewCold();
  }

  function resetDeepState() {
    setDeepOpen({});
    setDeepText({});
    setDeepLoading(null);
  }

  async function runBatch(variant: number, replaceAll: boolean) {
    if (suggesting || suggestCapReached) return;
    const { topic, mode } = resolveSuggestContext();

    setSuggesting(true);
    setSuggestError(null);
    if (replaceAll) resetDeepState();

    const controller = new AbortController();
    const clientTimer = setTimeout(() => controller.abort(), 12_000);
    try {
      const res = await fetch("/api/suggest-ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, variant, mode }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error("Could not fetch ideas");
      const data = (await res.json()) as {
        ideas?: SuggestedAppIdea[];
        discover?: boolean;
      };
      setIdeas(data.ideas ?? []);
      setIsDiscover(Boolean(data.discover));
      if (value.trim()) setAnchorTopic(value.trim());
      else if (mode === "topic") setAnchorTopic(topic);
      else setAnchorTopic("");
      consumeUse();
      setBatchVariant(variant + 1);
    } catch (err) {
      const aborted =
        err instanceof Error &&
        (err.name === "AbortError" || /abort/i.test(err.message));
      setSuggestError(
        aborted
          ? "That took too long — try again, or hit Start building."
          : "Couldn't load ideas — try again in a moment."
      );
    } finally {
      clearTimeout(clientTimer);
      setSuggesting(false);
    }
  }

  async function toggleDeep(slotIndex: number) {
    const idea = ideas?.[slotIndex];
    if (!idea) return;

    if (deepOpen[slotIndex]) {
      setDeepOpen((o) => ({ ...o, [slotIndex]: false }));
      return;
    }

    if (deepText[slotIndex]) {
      setDeepOpen((o) => ({ ...o, [slotIndex]: true }));
      return;
    }

    setDeepLoading(slotIndex);
    setDeepOpen((o) => ({ ...o, [slotIndex]: true }));

    const minWait = new Promise((r) => setTimeout(r, 900));
    const controller = new AbortController();
    const clientTimer = setTimeout(() => controller.abort(), 10_000);

    try {
      const [res] = await Promise.all([
        fetch("/api/suggest-ideas/deep", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idea }),
          signal: controller.signal,
        }),
        minWait,
      ]);
      if (!res.ok) throw new Error("deep failed");
      const data = (await res.json()) as { deepExplanation?: string };
      const deep = data.deepExplanation?.trim() ?? "";
      setDeepText((t) => ({ ...t, [slotIndex]: deep }));
    } catch {
      setDeepText((t) => ({
        ...t,
        [slotIndex]:
          "This app is built for people who want something simple on their phone — open it, follow the flow above, and get value in minutes without a complicated setup.",
      }));
    } finally {
      clearTimeout(clientTimer);
      setDeepLoading(null);
    }
  }

  function pickIdea(idea: SuggestedAppIdea, slotIndex: number) {
    const deep = deepText[slotIndex];
    const full = deep
      ? `${idea.name} — ${idea.description} ${idea.explanation} ${deep}`
      : `${idea.name} — ${idea.description} ${idea.explanation}`;
    goToInterview(full);
  }

  const usesLabel = `${suggestUses}/${MAX_SUGGEST_IDEAS_USES}`;

  return (
    <div className="reveal reveal-4 mt-7">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleStartBuilding();
        }}
      >
        <div
          id="build-box"
          className={`scroll-mt-24 rounded-[1.65rem] border p-4 transition-all duration-200 sm:p-5 ${
            composing
              ? "border-coral/35 bg-white/90 shadow-[0_8px_32px_-8px_rgba(255,122,99,0.22)]"
              : "border-line/50 bg-cream/90 shadow-float backdrop-blur"
          }`}
        >
          <p className="text-[15px] font-medium text-charcoal">
            {FIRST_INTERVIEW_QUESTION.prompt}
          </p>
          <div className="relative mt-2">
            {!hasText && (
              <div
                className="pointer-events-none absolute inset-0 overflow-hidden"
                aria-hidden
              >
                <AnimatePresence mode="wait">
                  <motion.p
                    key={phIdx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.35 }}
                    className="text-[15px] leading-snug text-charcoal-soft/60"
                  >
                    {ROTATING_PLACEHOLDERS[phIdx]}
                  </motion.p>
                </AnimatePresence>
              </div>
            )}
            <textarea
              ref={textareaRef}
              name="idea"
              rows={1}
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setSuggestError(null);
              }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleStartBuilding();
                }
              }}
              aria-label={FIRST_INTERVIEW_QUESTION.prompt}
              className="max-h-[7.5rem] min-h-[2.75rem] w-full resize-none bg-transparent text-[15px] leading-snug text-charcoal outline-none"
            />
          </div>

          {(voice.statusLabel || voice.error) && (
            <p
              className={`mt-2 text-[11px] ${voice.error ? "text-coral-deep" : "text-warmgrey"}`}
              role="status"
            >
              {voice.error ?? voice.statusLabel}
            </p>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <button type="submit" className="btn-primary btn-pill w-full sm:w-auto">
              Start building <ArrowRight className="h-5 w-5" />
            </button>
            {voice.supported && (
              <VoiceMicButton
                listening={voice.listening}
                transcribing={voice.transcribing}
                disabled={suggesting}
                onClick={voice.toggle}
              />
            )}
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <button
                type="button"
                onClick={() => void runBatch(batchVariant, true)}
                disabled={suggesting || suggestCapReached}
                className="btn-pill flex flex-1 items-center justify-center gap-2 border border-line bg-white px-5 py-2.5 text-sm font-semibold text-charcoal transition hover:border-coral/40 hover:bg-cream disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial"
              >
                {suggesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 text-coral" />
                )}
                Suggest ideas
              </button>
              <span
                className="shrink-0 tabular-nums text-xs font-medium text-warmgrey"
                title="Free idea batches this visit"
                aria-live="polite"
              >
                {usesLabel}
              </span>
            </div>
          </div>
          {!hasText && !suggestCapReached && (
            <p className="mt-2 text-xs text-warmgrey">
              No topic? Suggest ideas shows 3 proven lanes in different niches.
            </p>
          )}
        </div>
      </form>

      {suggesting && (
        <div className="mt-4 space-y-3">
          <RotatingStatus lines={batchLoadingLines} active />
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl border border-line/50 bg-white/70 p-4"
            >
              <div className="h-4 w-2/5 rounded bg-line/80" />
              <div className="mt-2 h-3 w-3/5 rounded bg-line/70" />
              <div className="mt-2 h-3 w-full rounded bg-line/50" />
            </div>
          ))}
        </div>
      )}

      {suggestError && (
        <p className="mt-3 text-center text-sm text-coral-deep">{suggestError}</p>
      )}

      <AnimatePresence>
        {!suggesting && ideas && ideas.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="mt-4 space-y-2"
          >
            <p className="text-sm font-medium text-charcoal">
              {isDiscover
                ? "Not sure where to start? Pick a lane — we'll personalize it next."
                : "Pick one to personalize in the interview:"}
            </p>
            {ideas.map((idea, index) => {
              const deepLines = deepLoadingLines(idea.archetype, idea.name);
              return (
                <div
                  key={`${idea.name}-${index}-${idea.nicheTopic}`}
                  className="rounded-2xl border border-line/70 bg-white/90 p-4 shadow-float"
                >
                  <button
                    type="button"
                    onClick={() => pickIdea(idea, index)}
                    className="w-full text-left transition hover:opacity-90"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-charcoal">{idea.name}</p>
                      {IDEA_RANKS[index] && (
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${IDEA_RANKS[index]!.className}`}
                        >
                          {IDEA_RANKS[index]!.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm font-medium text-charcoal/90">
                      {idea.description}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-charcoal-soft">
                      {idea.explanation}
                    </p>
                  </button>

                  <div className="mt-4 border-t border-line/40 pt-4">
                    <div className="flex items-center justify-between gap-8">
                      <button
                        type="button"
                        onClick={() => void toggleDeep(index)}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-charcoal-soft transition hover:text-coral"
                      >
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 transition-transform ${deepOpen[index] ? "rotate-180" : ""}`}
                        />
                        Tell me more
                      </button>
                      {!suggestCapReached && (
                        <button
                          type="button"
                          onClick={() => void runBatch(batchVariant, true)}
                          disabled={suggesting}
                          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-charcoal-soft transition hover:text-coral disabled:opacity-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Similar ideas
                        </button>
                      )}
                    </div>
                    <AnimatePresence>
                      {deepOpen[index] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          {deepLoading === index ? (
                            <p className="mt-3 text-sm leading-relaxed text-warmgrey">
                              {deepLines[deepMsgIdx % deepLines.length]}
                            </p>
                          ) : (
                            <p className="mt-3 text-sm leading-relaxed text-charcoal-soft">
                              {deepText[index]}
                            </p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              );
            })}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
              {suggestCapReached ? (
                <p className="text-sm text-warmgrey">
                  That&apos;s your {MAX_SUGGEST_IDEAS_USES} for now — pick one or start
                  building.
                </p>
              ) : (
                <p className="text-xs text-warmgrey">
                  {anchorTopic && !value.trim()
                    ? `Still showing ideas for “${anchorTopic}”.`
                    : "Tap a card to build, or Similar ideas for 3 fresh ones."}
                </p>
              )}
              <span className="tabular-nums text-xs text-warmgrey">{usesLabel}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
