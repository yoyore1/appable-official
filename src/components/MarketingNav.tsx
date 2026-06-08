import Link from "next/link";
import { Logo } from "@/components/Logo";
import type { UserAccount } from "@/lib/types";

export function MarketingNav({ user }: { user?: UserAccount | null }) {
  return (
    <header className="sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/course" className="btn-ghost hidden sm:inline-flex">
            Course
          </Link>
          {user ? (
            <Link href="/dashboard" className="btn-primary btn-pill !py-2 text-sm">
              My apps
            </Link>
          ) : (
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
