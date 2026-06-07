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
import { answerInterview, finishInterview } from "@/server/projects";
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
/** Pause with typing dots before each AI bubble — iMessage pace. */
const TYPING_MS = 1100;
/** Gap between back-to-back AI texts. */
const STAGGER_MS = 1250;

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function questionBubbleId(stepId: InterviewStepId) {
  return `q-${stepId}`;
}

export type InterviewBootstrap =
  | { kind: "afterAnswer"; acks: string[]; question: InterviewStep }
  | { kind: "firstQuestion"; question: InterviewStep };

export function Interview({
  projectId,
  initialStep,
  initialBubbles,
  guestFlow = false,
  initialProgress,
  bootstrap,
  initialSuggestions = [],
}: {
  projectId: string;
  initialStep: InterviewStep;
  initialBubbles: Bubble[];
  guestFlow?: boolean;
  initialProgress?: { current: number; total: number };
  initialSuggestions?: string[];
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
  const [progress, setProgress] = useState(
    initialProgress ?? { current: 1, total: 1 }
  );
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const bootstrapRan = useRef(false);

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
  }, [bubbles, building, busy]);

  useEffect(() => {
    if (!bootstrap || bootstrapRan.current) return;
    bootstrapRan.current = true;
    setBusy(true);
    void (async () => {
      const messages =
        bootstrap.kind === "afterAnswer"
          ? [
              ...bootstrap.acks.map((text, i) => ({
                id: `bootstrap-ack-${i}`,
                text,
              })),
              {
                id: questionBubbleId(bootstrap.question.id),
                text: bootstrap.question.prompt,
              },
            ]
          : [
              {
                id: questionBubbleId(bootstrap.question.id),
                text: bootstrap.question.prompt,
              },
            ];
      await revealAiMessages(messages);
      setBusy(false);
    })();
  }, [bootstrap]);

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
    setValue(bubble.text);
    setBusy(false);
    setTimeout(() => textareaRef.current?.focus(), 50);
  }

  async function submit(answer: string) {
    if ((!answer.trim() && current.id !== "colors") || busy) return;
    setBusy(true);
    setValue("");
    const qId = current.id;
    const submitted =
      answer.trim() || (current.id === "colors" ? "No preference" : answer);
    setBubbles((b) => [
      ...b,
      { id: `u${qId}`, role: "user", text: submitted, questionId: qId },
    ]);

    try {
      const res = await answerInterview(projectId, qId, submitted);

      if (!res.ok) {
        setBubbles((b) => [
          ...b,
          {
            id: `err${qId}`,
            role: "ai",
            text:
              res.error === "auth"
                ? "Your session expired — log in again from the dashboard and start a new project."
                : "I can't find this project anymore — go back to your dashboard and start fresh.",
          },
        ]);
        setBusy(false);
        return;
      }

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

      const aiMessages = [
        ...res.acks.map((ack, i) => ({
          id: `ack${qId}-${i}`,
          text: ack,
        })),
        ...(res.done || !res.nextStep
          ? []
          : [
              {
                id: questionBubbleId(res.nextStep.id),
                text: res.nextStep.prompt,
              },
            ]),
      ];

      await revealAiMessages(aiMessages);

      if (res.done) {
        await runBuild();
      } else if (res.nextStep) {
        setStepSuggestions(res.suggestions ?? []);
        setCurrent(res.nextStep);
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

  const showComposer = !building && !buildFailed && Boolean(current);

  const inputPlaceholder =
    suggestionPills.length > 0
      ? "Or type your own answer…"
      : pillsOnly
        ? "Pick one above"
        : "Type your answer…";

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col">
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
        style={{ paddingBottom: showComposer ? "7.5rem" : undefined }}
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
          {busy && !building && <TypingIndicator key="typing" />}
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
            {suggestionPills.length > 0 && (
              <div className="space-y-1.5 px-0.5">
                <p className="text-[10px] font-medium uppercase tracking-wide text-warmgrey">
                  Suggestions for your app
                </p>
                <div className="flex w-full flex-wrap gap-1.5">
                  {suggestionPills.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      className={
                        opt === APPABLE_PICK
                          ? "pill-accent !py-1.5 !text-xs shadow-soft"
                          : "pill !py-1.5 !text-xs shadow-soft"
                      }
                      disabled={busy}
                      onClick={() => submit(opt)}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
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
                      if (!busy && (value.trim() || current.id === "colors")) {
                        submit(value);
                      }
                    }
                  }}
                  disabled={busy}
                  placeholder={inputPlaceholder}
                  className="max-h-40 min-h-[2.25rem] w-full resize-none bg-transparent px-1 py-1 text-sm leading-snug text-charcoal outline-none placeholder:text-warmgrey"
                />
                <p className="mt-1.5 px-1 text-[10px] text-warmgrey">
                  Press Enter to send · tap any answer above to edit
                </p>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
