"use client";

import { useEffect, useRef, useState } from "react";
import { FIRST_INTERVIEW_QUESTION } from "@/lib/interviewFlow";
import { startInterviewAction } from "@/server/projects";

export function LandingHero() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [value]);

  const composing = focused || value.length > 0;

  return (
    <div id="start" className="reveal reveal-4 mt-7">
      <form
        action={startInterviewAction}
        onSubmit={() => setSubmitting(true)}
      >
        <div
          className={`rounded-[1.65rem] border p-3 transition-all duration-200 ${
            composing
              ? "border-coral/35 bg-white/90 shadow-[0_8px_32px_-8px_rgba(255,122,99,0.22)]"
              : "border-line/50 bg-cream/90 shadow-float backdrop-blur"
          }`}
        >
          <textarea
            ref={textareaRef}
            name="idea"
            required
            rows={1}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={submitting}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                const form = e.currentTarget.form;
                if (form && value.trim() && !submitting) {
                  setSubmitting(true);
                  form.requestSubmit();
                }
              }
            }}
            aria-label={FIRST_INTERVIEW_QUESTION.prompt}
            placeholder={FIRST_INTERVIEW_QUESTION.prompt}
            className="max-h-[7.5rem] min-h-[2.75rem] w-full resize-none bg-transparent px-1 py-1 text-[15px] leading-snug text-charcoal outline-none placeholder:text-charcoal-soft/70"
          />
        </div>
        <p className="mt-2 text-xs text-warmgrey">
          Press Enter to continue
        </p>
      </form>

      <p className="reveal reveal-5 mt-3 text-sm text-warmgrey">
        $1 returnable deposit — refunded automatically when you subscribe.
      </p>
    </div>
  );
}
