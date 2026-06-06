"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Send, Sparkles } from "lucide-react";
import { interviewQuestions } from "@/lib/config";
import { answerInterview, finishInterview } from "@/server/projects";
import { Confetti } from "@/components/Confetti";
import { TypingIndicator } from "@/components/TypingIndicator";

type Bubble = { id: string; role: "ai" | "user"; text: string };

const buildingSteps = [
  "Reading your idea ✨",
  "Designing your onboarding",
  "Setting up your screens",
  "Making it beautiful…",
  "Almost there",
];

const STEP_MS = 1400;

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export function Interview({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [bubbles, setBubbles] = useState<Bubble[]>([
    { id: "q0", role: "ai", text: interviewQuestions[0].prompt },
  ]);
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [building, setBuilding] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState(false);
  const [buildFailed, setBuildFailed] = useState(false);
  const [colorOptions, setColorOptions] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);

  const current = interviewQuestions[index];
  const choiceOptions =
    current?.id === "colors" && colorOptions.length > 0
      ? colorOptions
      : current?.kind === "choice"
        ? [...(current.options ?? [])]
        : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [bubbles, building, busy]);

  async function submit(answer: string) {
    if (!answer.trim() || busy || !current) return;
    setBusy(true);
    setValue("");
    const qId = current.id;
    setBubbles((b) => [...b, { id: `u${qId}`, role: "user", text: answer }]);

    try {
      const res = await answerInterview(projectId, qId, answer);

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

      const next = res.done ? null : interviewQuestions[res.nextIndex];
      const initialDelay = 500;
      const staggerMs = 1250;

      res.acks.forEach((ack, i) => {
        setTimeout(() => {
          setBubbles((b) => [
            ...b,
            { id: `ack${qId}-${i}`, role: "ai" as const, text: ack },
          ]);
        }, initialDelay + i * staggerMs);
      });

      const afterAcks = initialDelay + res.acks.length * staggerMs + 450;

      if (res.done) {
        setTimeout(() => void runBuild(), afterAcks);
      } else if (next) {
        if (res.colorOptions) setColorOptions(res.colorOptions);
        setIndex(res.nextIndex);
        setTimeout(() => {
          setBubbles((b) => [
            ...b,
            {
              id: `q${next.id}`,
              role: "ai",
              text: res.nextPrompt ?? next.prompt,
            },
          ]);
          setBusy(false);
        }, afterAcks);
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
      router.push(`/project/${projectId}?celebrate=1`);
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

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex min-h-0 w-full flex-1 flex-col space-y-3 overflow-y-auto overflow-x-hidden px-1 py-2">
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
              <div
                className={
                  b.role === "user"
                    ? "max-w-[85%] min-w-0 break-words rounded-3xl rounded-br-lg bg-coral/15 px-4 py-2.5 text-charcoal"
                    : "max-w-[85%] min-w-0 break-words rounded-3xl rounded-bl-lg bg-cream px-4 py-2.5 text-charcoal shadow-soft"
                }
              >
                {b.text}
              </div>
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
        <div className="shrink-0 border-t border-line/60 pt-3">
          <button
            type="button"
            className="btn-primary w-full"
            onClick={() => void runBuild()}
          >
            Try building my plan again
          </button>
        </div>
      )}
      {!building && !buildFailed && current && (
        <div className="shrink-0 space-y-3 border-t border-line/60 pt-3">
          {choiceOptions.length > 0 && (
            <div className="flex w-full flex-wrap gap-2">
              {choiceOptions.map((opt) => (
                <button
                  key={opt}
                  className="pill"
                  disabled={busy}
                  onClick={() => submit(opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(value);
            }}
            className="flex w-full min-w-0 items-center gap-2 rounded-2xl bg-cream p-2 shadow-inset"
          >
            <input
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              disabled={busy}
              placeholder={
                choiceOptions.length > 0
                  ? "Or type your own colors…"
                  : "Type your answer…"
              }
              className="min-w-0 flex-1 bg-transparent px-3 py-2 outline-none placeholder:text-warmgrey"
            />
            <button
              className="btn-primary !px-3"
              disabled={busy || !value.trim()}
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
