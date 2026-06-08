"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import {
  getStepById,
  type InterviewStep,
  type InterviewStepId,
} from "@/lib/interviewFlow";
import { APPABLE_PICK } from "@/lib/interviewSuggestions";
import {
  answerInterview,
  finishInterview,
  getInterviewStepChoices,
} from "@/server/projects";
import { AiBudgetBar } from "@/components/AiBudgetBar";
import { Confetti } from "@/components/Confetti";
import { TypingIndicator } from "@/components/TypingIndicator";

type Bubble = {
  id: string;
  role: "ai" | "user";
  text: string;
  questionId?: InterviewStepId;
};

const buildingSteps = [
  "Perfect — building your app now…",
  "Reading your idea ✨",
  "Designing your onboarding",
  "Setting up your screens",
  "Making it beautiful…",
  "Almost there",
];

const STEP_MS = 1400;
/** Pause before a follow-up question (no filler ack). */
const QUESTION_TYPING_MS = 450;
/** Pause before a rare ack (Let Appable pick echo). */
const TYPING_MS = 700;
/** Gap between ack and next question. */
const STAGGER_MS = 600;

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function questionBubbleId(stepId: InterviewStepId) {
  return `q-${stepId}`;
}

export type InterviewBootstrap =
  | { kind: "afterAnswer"; acks: string[]; question: InterviewStep }
  | { kind: "afterAnswerPending"; question: InterviewStep }
  | { kind: "firstQuestion"; question: InterviewStep };

export function Interview({
  projectId,
  ready = true,
  initialStep,
  initialBubbles,
  guestFlow = false,
  initialProgress,
  bootstrap,
  initialSuggestions = [],
  initialAppablePick,
}: {
  projectId: string;
  /** When false, UI is visible but server actions wait (landing handoff). */
  ready?: boolean;
  initialStep: InterviewStep;
  initialBubbles: Bubble[];
  guestFlow?: boolean;
  initialProgress?: { current: number; total: number };
  initialSuggestions?: string[];
  initialAppablePick?: string;
  /** Landing handoff or cold open — AI lines type in, never pop instantly. */
  bootstrap?: InterviewBootstrap;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState<InterviewStep>(initialStep);
  const [bubbles, setBubbles] = useState<Bubble[]>(initialBubbles);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [buildFailed, setBuildFailed] = useState(false);
  const [stepSuggestions, setStepSuggestions] =
    useState<string[]>(initialSuggestions);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [progress, setProgress] = useState(
    initialProgress ?? { current: 1, total: 1 }
  );
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bootstrapRan = useRef(false);
  /** Landing handoff: show idea bubble first, reveal Q2 after pills load. */
  const landingGateActive = useRef(false);
  const landingRevealStarted = useRef(false);
  const suggestionsLoadedFor = useRef<string | null>(null);
  const suggestionsRequest = useRef(0);
  const appablePickByStep = useRef<Partial<Record<InterviewStepId, string>>>(
    initialAppablePick && initialStep.id
      ? { [initialStep.id]: initialAppablePick }
      : {}
  );
  const [budgetKey, setBudgetKey] = useState(0);
  const [selectedPicks, setSelectedPicks] = useState<string[]>([]);

  const multiPickStep =
    current.id === "features" || current.id === "pool_core_loop";
  const multiPickMin = 2;
  const multiPickMax = 3;

  async function loadStepChoices(stepId: InterviewStepId): Promise<string[]> {
    const req = ++suggestionsRequest.current;
    setSuggestionsLoading(true);
    try {
      const { suggestions, appablePick } = await getInterviewStepChoices(
        projectId,
        stepId
      );
      if (req !== suggestionsRequest.current) return [];
      suggestionsLoadedFor.current = stepId;
      if (appablePick.trim()) {
        appablePickByStep.current[stepId] = appablePick.trim();
      }
      const pills =
        suggestions.length > 0 ? suggestions : [APPABLE_PICK];
      setStepSuggestions(pills);
      return pills;
    } catch {
      if (req !== suggestionsRequest.current) return [];
      suggestionsLoadedFor.current = stepId;
      const fallback = [APPABLE_PICK];
      setStepSuggestions(fallback);
      return fallback;
    } finally {
      if (req === suggestionsRequest.current) {
        setSuggestionsLoading(false);
      }
    }
  }

  async function revealQuestion(
    stepId: InterviewStepId,
    prompt: string,
    opts?: { instant?: boolean }
  ) {
    if (!opts?.instant) await delay(QUESTION_TYPING_MS);
    setBubbles((b) => [
      ...b,
      { id: questionBubbleId(stepId), role: "ai", text: prompt },
    ]);
  }

  function hasRichSuggestions(suggestions: string[]) {
    return suggestions.filter((s) => s !== APPABLE_PICK).length >= 2;
  }

  async function revealAiMessages(messages: { id: string; text: string }[]) {
    for (let i = 0; i < messages.length; i++) {
      await delay(TYPING_MS);
      const msg = messages[i];
      setBubbles((b) => [
        ...b,
        { id: msg.id, role: "ai" as const, text: msg.text },
      ]);
      if (i < messages.length - 1) {
        await delay(STAGGER_MS);
      }
    }
  }

  const suggestionPills =
    stepSuggestions.length > 0
      ? stepSuggestions
      : current.kind === "choice"
        ? [...(current.options ?? [])]
        : [];

  const textOptional = suggestionPills.length === 0 || current.kind === "text";
  const pillsOnly =
    current.kind === "choice" && stepSuggestions.length === 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, building, busy, stepSuggestions, suggestionsLoading]);

  useEffect(() => {
    setSelectedPicks([]);
  }, [current.id]);

  useEffect(() => {
    if (!bootstrap || bootstrapRan.current) return;
    bootstrapRan.current = true;

    const stepId = bootstrap.question.id;
    const prompt = bootstrap.question.prompt;
    const waitForSuggestions = bootstrap.kind === "afterAnswerPending";
    const prefetched = hasRichSuggestions(initialSuggestions);

    if (prefetched) {
      suggestionsLoadedFor.current = stepId;
      if (initialAppablePick?.trim()) {
        appablePickByStep.current[stepId] = initialAppablePick.trim();
      }
      setStepSuggestions(initialSuggestions);
    } else {
      setStepSuggestions([]);
      suggestionsLoadedFor.current = null;
    }

    if (waitForSuggestions && !prefetched) {
      landingGateActive.current = true;
      setBusy(true);
      return;
    }

    void revealQuestion(stepId, prompt, { instant: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once
  }, [bootstrap]);

  useEffect(() => {
    if (!landingGateActive.current || landingRevealStarted.current) return;
    if (!ready || !projectId) return;
    const stepId = current.id;
    if (bubbles.some((b) => b.id === questionBubbleId(stepId))) {
      landingGateActive.current = false;
      setBusy(false);
      return;
    }

    landingRevealStarted.current = true;
    void (async () => {
      setBusy(true);
      try {
        await loadStepChoices(stepId);
        await revealQuestion(stepId, current.prompt, { instant: true });
      } finally {
        landingGateActive.current = false;
        setBusy(false);
      }
    })();
  }, [ready, projectId, current.id, current.prompt, bubbles]);

  useEffect(() => {
    if (building || bootstrap) return;
    const qId = questionBubbleId(current.id);
    if (bubbles.some((b) => b.id === qId)) return;
    void revealQuestion(current.id, current.prompt, { instant: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cold open only
  }, [building, bootstrap, current.id]);

  useEffect(() => {
    if (!ready || !projectId || building) return;
    if (landingGateActive.current) return;
    if (suggestionsLoadedFor.current === current.id) return;
    if (!bubbles.some((b) => b.id === questionBubbleId(current.id))) return;
    void loadStepChoices(current.id);
  }, [ready, projectId, current.id, bubbles, building]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value, current.id]);

  function beginEdit(bubble: Bubble) {
    if (busy || building || bubble.role !== "user" || !bubble.questionId) {
      return;
    }
    const idx = bubbles.findIndex((b) => b.id === bubble.id);
    if (idx < 0) return;

    setBubbles((prev) => prev.slice(0, idx));
    const step = getStepById([], bubble.questionId);
    if (step) setCurrent(step);
    setStepSuggestions([]);
    suggestionsLoadedFor.current = null;
    void loadStepChoices(bubble.questionId);
    setValue(bubble.text);
    setSelectedPicks([]);
    setBusy(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  function togglePick(opt: string) {
    if (!ready || !projectId || busy) return;
    if (opt === APPABLE_PICK) {
      void submit(opt);
      return;
    }
    setSelectedPicks((prev) => {
      if (prev.includes(opt)) return prev.filter((p) => p !== opt);
      if (prev.length >= multiPickMax) return prev;
      return [...prev, opt];
    });
  }

  function submitSelectedPicks() {
    if (selectedPicks.length < multiPickMin) return;
    void submit(selectedPicks.join(", "));
    setSelectedPicks([]);
  }

  async function submit(answer: string) {
    if (!ready || !projectId) return;
    if ((!answer.trim() && current.id !== "colors") || busy) return;
    setBusy(true);
    setValue("");
    setSelectedPicks([]);
    setStepSuggestions([]);
    suggestionsLoadedFor.current = null;
    const qId = current.id;
    const submitted =
      answer.trim() || (current.id === "colors" ? "No preference" : answer);
    const prefetchedPick =
      submitted === APPABLE_PICK
        ? appablePickByStep.current[qId]?.trim()
        : undefined;
    const bubbleText = prefetchedPick || submitted;
    setBubbles((b) => [
      ...b,
      { id: `u${qId}`, role: "user", text: bubbleText, questionId: qId },
    ]);

    try {
      const res = await answerInterview(
        projectId,
        qId,
        submitted,
        prefetchedPick
      );

      if (!res.ok) {
        setBubbles((b) => [
          ...b,
          {
            id: `err${qId}`,
            role: "ai",
            text:
              res.error === "cap_reached"
                ? "You've used your free AI allowance for now — sign up to continue later."
                : res.error === "auth"
                  ? "Your session expired — log in again from the dashboard and start a new project."
                  : "I can't find this project anymore — go back to your dashboard and start fresh.",
          },
        ]);
        setBusy(false);
        if (res.usage) setBudgetKey((k) => k + 1);
        return;
      }

      setBudgetKey((k) => k + 1);
      setProgress(res.progress);

      if (res.storedAnswer) {
        setBubbles((b) => {
          const next = [...b];
          const last = next[next.length - 1];
          if (last?.role === "user" && last.questionId === qId) {
            next[next.length - 1] = { ...last, text: res.storedAnswer! };
          }
          return next;
        });
      }

      if (res.acks.length > 0) {
        await revealAiMessages(
          res.acks.map((ack, i) => ({
            id: `ack${qId}-${i}`,
            text: ack,
          }))
        );
      }

      if (res.done) {
        await runBuild();
      } else if (res.nextStep) {
        setCurrent(res.nextStep);
        setStepSuggestions([]);
        suggestionsLoadedFor.current = null;
        if (res.nextAppablePick?.trim()) {
          appablePickByStep.current[res.nextStep.id] = res.nextAppablePick.trim();
        }
        const rich =
          (res.suggestions?.filter((s) => s !== APPABLE_PICK).length ?? 0) >= 2;
        if (rich && res.suggestions?.length) {
          setStepSuggestions(res.suggestions);
          suggestionsLoadedFor.current = res.nextStep.id;
        } else {
          void loadStepChoices(res.nextStep.id);
        }
        setBusy(true);
        await revealQuestion(res.nextStep.id, res.nextStep.prompt, {
          instant: true,
        });
        setBusy(false);
      } else {
        setBusy(false);
      }
    } catch {
      setBubbles((b) => [
        ...b,
        {
          id: `err${qId}`,
          role: "ai",
          text: "Something hiccuped on my end — try sending that again.",
        },
      ]);
      setBusy(false);
    }
  }

  async function runBuild() {
    setBuildFailed(false);
    setBuilding(true);
    setBusy(false);
    setStepIdx(0);

    const holdStep = buildingSteps.length - 2;
    const tick = setInterval(() => {
      setStepIdx((s) => (s < holdStep ? s + 1 : s));
    }, STEP_MS);

    try {
      await finishInterview(projectId);
      clearInterval(tick);

      for (let i = holdStep; i < buildingSteps.length; i++) {
        setStepIdx(i);
        await delay(STEP_MS);
      }

      setDone(true);
      await delay(STEP_MS * 0.8);
      router.push(
        guestFlow
          ? `/signup?project=${projectId}`
          : `/project/${projectId}?celebrate=1`
      );
    } catch {
      clearInterval(tick);
      setBuilding(false);
      setBuildFailed(true);
      setBubbles((b) => [
        ...b,
        {
          id: "build-err",
          role: "ai",
          text: "I couldn't finish your plan just now — your answers are saved. Tap try again below.",
        },
      ]);
    }
  }

  const questionVisible = bubbles.some(
    (b) => b.id === questionBubbleId(current.id)
  );

  const canAnswer = ready && Boolean(projectId);

  const showComposer =
    !building &&
    !buildFailed &&
    Boolean(current) &&
    questionVisible &&
    !busy;

  const showSuggestionDock =
    questionVisible && !busy && suggestionPills.length > 0;
  const showMultiContinue =
    multiPickStep && selectedPicks.length >= multiPickMin;
  const chatScrollPad = showComposer
    ? showSuggestionDock
      ? showMultiContinue
        ? "18rem"
        : multiPickStep
          ? "17rem"
          : "15rem"
      : "8.5rem"
    : undefined;

  const inputPlaceholder =
    multiPickStep && suggestionPills.length > 0
      ? "Or type your own features…"
      : suggestionPills.length > 0
        ? "Or type your own answer…"
        : pillsOnly
          ? "Pick one above"
          : "Type your answer…";

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
      {ready && projectId ? (
        <AiBudgetBar
          projectId={projectId}
          refreshKey={budgetKey}
          variant="pill"
          className="mb-2 shrink-0 self-end"
        />
      ) : null}

      {!building && progress.total > 0 && (
        <div className="mb-3 shrink-0 px-1">
          <div className="flex items-center justify-between text-xs text-warmgrey">
            <span>
              {progress.total > 1
                ? `Step ${progress.current} of ${progress.total}`
                : "Getting started"}
            </span>
            <span className="font-medium text-coral">
              {progress.total > 1
                ? `${Math.round((progress.current / progress.total) * 100)}%`
                : ""}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/80">
            <motion.div
              className="h-full rounded-full bg-coral"
              initial={false}
              animate={{
                width:
                  progress.total > 1
                    ? `${(progress.current / progress.total) * 100}%`
                    : "12%",
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
        </div>
      )}

      <div
        className="flex min-h-0 w-full flex-1 flex-col space-y-3 overflow-y-auto overflow-x-hidden px-1 py-2"
        style={{ paddingBottom: chatScrollPad }}
      >
        <AnimatePresence initial={false}>
          {bubbles.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className={`flex w-full min-w-0 shrink-0 ${
                b.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {b.role === "user" && b.questionId ? (
                <button
                  type="button"
                  disabled={busy || building}
                  onClick={() => beginEdit(b)}
                  title="Tap to edit"
                  className="group max-w-[85%] min-w-0 break-words rounded-3xl rounded-br-lg bg-coral/15 px-4 py-2.5 text-left text-charcoal transition hover:bg-coral/22 hover:ring-2 hover:ring-coral/25 disabled:opacity-60"
                >
                  {b.text}
                  <span className="mt-1 block text-[10px] font-medium text-warmgrey opacity-0 transition group-hover:opacity-100">
                    Tap to edit
                  </span>
                </button>
              ) : (
                <div
                  className={
                    b.role === "user"
                      ? "max-w-[85%] min-w-0 break-words rounded-3xl rounded-br-lg bg-coral/15 px-4 py-2.5 text-charcoal"
                      : "max-w-[85%] min-w-0 break-words rounded-3xl rounded-bl-lg bg-cream px-4 py-2.5 text-charcoal shadow-soft"
                  }
                >
                  {b.text}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {busy && !building && (
            <TypingIndicator key="typing" />
          )}
        </AnimatePresence>

        {building && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="card-float w-full space-y-2 p-4"
          >
            {buildingSteps.slice(0, stepIdx + 1).map((s, i) => (
              <motion.div
                key={s}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className={
                    i < stepIdx || done
                      ? "grid h-5 w-5 place-items-center rounded-full bg-moss/15 text-moss"
                      : "grid h-5 w-5 place-items-center rounded-full bg-coral/15 text-coral"
                  }
                >
                  {i < stepIdx || done ? (
                    "✓"
                  ) : (
                    <Sparkles className="h-3 w-3 animate-pulse-soft" />
                  )}
                </span>
                <span className="text-charcoal">{s}</span>
              </motion.div>
            ))}
            {done && (
              <p className="pt-1 font-display text-lg font-semibold text-coral">
                Meet your app. 🎉 This is really yours.
              </p>
            )}
          </motion.div>
        )}
        <div ref={endRef} className="h-px w-full shrink-0" />
        {done && <Confetti />}
      </div>

      {buildFailed && !building && (
        <div className="absolute inset-x-0 bottom-0 z-20 px-1 pb-1">
          <div className="rounded-2xl border border-line/60 bg-cream/95 p-3 shadow-soft backdrop-blur-sm">
            <button
              type="button"
              className="btn-primary w-full"
              onClick={() => void runBuild()}
            >
              Try building my plan again
            </button>
          </div>
        </div>
      )}

      {showComposer && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 px-0 pb-0 pt-6">
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-cream via-cream/90 to-transparent"
            aria-hidden
          />
          <div className="pointer-events-auto relative mx-0 space-y-2">
            {showSuggestionDock && (
              <div className="space-y-1.5 px-0.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-warmgrey">
                  {multiPickStep
                    ? `Pick ${multiPickMin}–${multiPickMax} · tap to toggle`
                    : "Suggestions for your app"}
                </p>
                <div className="flex w-full flex-wrap gap-1.5">
                  {suggestionPills.map((opt) => {
                    const isAppable = opt === APPABLE_PICK;
                    const selected =
                      !isAppable && multiPickStep && selectedPicks.includes(opt);
                    const maxed =
                      multiPickStep &&
                      !isAppable &&
                      selectedPicks.length >= multiPickMax &&
                      !selected;
                    return (
                      <button
                        key={opt}
                        type="button"
                        data-selected={selected ? "true" : undefined}
                        className={
                          isAppable
                            ? "pill-accent !py-1.5 !text-xs shadow-soft"
                            : "pill !py-1.5 !text-xs shadow-soft"
                        }
                        disabled={busy || !canAnswer || maxed}
                        onClick={() =>
                          multiPickStep && !isAppable
                            ? togglePick(opt)
                            : submit(opt)
                        }
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
                {multiPickStep && selectedPicks.length > 0 && (
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <p className="text-[10px] text-warmgrey">
                      {selectedPicks.length < multiPickMin
                        ? `Pick ${multiPickMin - selectedPicks.length} more`
                        : `${selectedPicks.length} selected`}
                    </p>
                    <button
                      type="button"
                      className="btn-primary !rounded-full !px-4 !py-1.5 text-xs"
                      disabled={
                        busy || !canAnswer || selectedPicks.length < multiPickMin
                      }
                      onClick={submitSelectedPicks}
                    >
                      Continue
                    </button>
                  </div>
                )}
              </div>
            )}
            {textOptional && !pillsOnly && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submit(value);
                }}
                className="rounded-2xl border border-line/50 bg-cream/95 p-3 shadow-[0_4px_24px_-4px_rgba(43,38,36,0.12)] backdrop-blur-md"
              >
                <textarea
                  ref={textareaRef}
                  autoFocus
                  rows={1}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (
                        canAnswer &&
                        !busy &&
                        (value.trim() || current.id === "colors")
                      ) {
                        submit(value);
                      }
                    }
                  }}
                  disabled={busy || !canAnswer}
                  placeholder={inputPlaceholder}
                  className="max-h-40 min-h-[2.25rem] w-full resize-none bg-transparent px-1 py-1 text-sm leading-snug text-charcoal outline-none placeholder:text-warmgrey"
                />
                <p className="mt-1.5 px-1 text-[10px] text-warmgrey">
                  {multiPickStep
                    ? "Press Enter to send your own list · or pick 2–3 above"
                    : "Press Enter to send · tap any answer above to edit"}
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
