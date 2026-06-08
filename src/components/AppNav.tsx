import Link from "next/link";
import { Zap, LogOut, ShieldQuestion } from "lucide-react";
import { Logo } from "@/components/Logo";
import { signOutAction } from "@/server/auth";
import { formatNumber } from "@/lib/utils";
import type { UserAccount } from "@/lib/types";

export function AppNav({
  user,
  wide = false,
}: {
  user: UserAccount;
  /** Full-width bar for build workspace (Replit-style). */
  wide?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/60 bg-cream/70 backdrop-blur-md">
      <div
        className={`mx-auto flex items-center justify-between px-4 py-2.5 sm:px-5 ${wide ? "max-w-none" : "max-w-6xl"}`}
      >
        <Logo href="/dashboard" />
        <div className="flex items-center gap-2">
          <Link
            href="/buy"
            className="flex items-center gap-1.5 rounded-full bg-sand px-3 py-1.5 text-sm font-medium text-charcoal hover:bg-sand/70"
            title="Build power"
          >
            <Zap className="h-4 w-4 text-coral" />
            {formatNumber(user.buildPower)}
          </Link>
          {user.isAdmin && (
            <Link href="/admin" className="btn-ghost hidden sm:inline-flex" title="Admin">
              <ShieldQuestion className="h-4 w-4" /> Admin
            </Link>
          )}
          <span className="hidden text-sm text-charcoal-soft sm:inline">
            {user.name ?? user.email}
          </span>
          <form action={signOutAction}>
            <button className="btn-ghost" title="Sign out">
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
