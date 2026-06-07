"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import {
  googleAuthAction,
  signInAction,
  signUpAction,
  type AuthState,
} from "@/server/auth";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn-primary w-full" disabled={pending}>
      {pending ? "One sec…" : label}
    </button>
  );
}

export function AuthForm({
  mode,
  projectId,
}: {
  mode: "signup" | "login";
  projectId?: string;
}) {
  const action = mode === "signup" ? signUpAction : signInAction;
  const [state, formAction] = useFormState<AuthState, FormData>(action, null);

  return (
    <div className="space-y-4">
      <form action={googleAuthAction}>
        <button className="btn-secondary w-full">
          <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
            <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1A6.2 6.2 0 0 1 12 5.7c1.8 0 3 .76 3.7 1.4l2.5-2.4A9.6 9.6 0 0 0 12 2a10 10 0 1 0 0 20c5.8 0 9.6-4 9.6-9.7 0-.65-.07-1.14-.16-1.6Z" />
          </svg>
          Continue with Google
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-warmgrey">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>

      <form action={formAction} className="space-y-3">
        {projectId && (
          <input type="hidden" name="projectId" value={projectId} />
        )}
        {mode === "signup" && (
          <div>
            <label className="label" htmlFor="name">Your name</label>
            <input id="name" name="name" className="input mt-1" placeholder="Jordan" autoComplete="name" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input mt-1" placeholder="you@email.com" autoComplete="email" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" required className="input mt-1" placeholder="••••••••" autoComplete={mode === "signup" ? "new-password" : "current-password"} />
        </div>

        {mode === "signup" && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl bg-sand/60 p-3 text-sm text-charcoal-soft">
            <input type="checkbox" name="dataSharing" className="mt-0.5 h-4 w-4 accent-coral" />
            <span>
              Allow your build patterns to improve Appable for everyone? Your idea
              stays private — only code structure is shared.
            </span>
          </label>
        )}

        {state?.error && (
          <p className="flex items-center gap-2 rounded-xl bg-coral/10 px-3 py-2 text-sm text-coral-deep">
            <AlertCircle className="h-4 w-4" /> {state.error}
          </p>
        )}

        <SubmitButton label={mode === "signup" ? "Create account" : "Sign in"} />
      </form>

      <p className="text-center text-sm text-charcoal-soft">
        {mode === "signup" ? (
          <>Already have an account? <Link href={projectId ? `/login?project=${projectId}` : "/login"} className="font-medium text-coral hover:underline">Sign in</Link></>
        ) : (
          <>New here? <Link href={projectId ? `/signup?project=${projectId}` : "/signup"} className="font-medium text-coral hover:underline">Create an account</Link></>
        )}
      </p>
    </div>
  );
}
