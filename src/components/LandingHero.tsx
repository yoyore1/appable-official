"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { FIRST_INTERVIEW_QUESTION } from "@/lib/interviewFlow";
import { COLD_START_KEY, PENDING_IDEA_KEY } from "@/lib/landingHandoff";

export function LandingHero() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const composing = focused || value.length > 0;

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

  return (
    <div id="start" className="reveal reveal-4 mt-7">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleStartBuilding();
        }}
      >
        <div
          className={`rounded-[1.65rem] border p-4 transition-all duration-200 sm:p-5 ${
            composing
              ? "border-coral/35 bg-white/90 shadow-[0_8px_32px_-8px_rgba(255,122,99,0.22)]"
              : "border-line/50 bg-cream/90 shadow-float backdrop-blur"
          }`}
        >
          <p className="text-[15px] font-medium text-charcoal">
            {FIRST_INTERVIEW_QUESTION.prompt}
          </p>
          <textarea
            ref={textareaRef}
            name="idea"
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleStartBuilding();
              }
            }}
            aria-label={FIRST_INTERVIEW_QUESTION.prompt}
            placeholder="e.g. A dog-walking app for busy pet owners…"
            className="mt-2 max-h-[7.5rem] min-h-[2.75rem] w-full resize-none bg-transparent text-[15px] leading-snug text-charcoal outline-none placeholder:text-charcoal-soft/60"
          />
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-warmgrey">Press Enter to continue</p>
            <button type="submit" className="btn-primary btn-pill w-full sm:w-auto">
              Start building <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
