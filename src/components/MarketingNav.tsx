import Link from "next/link";
import { Logo } from "@/components/Logo";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Logo />
        <nav className="flex items-center gap-2">
          <Link href="/course" className="btn-ghost hidden sm:inline-flex">
            Course
          </Link>
          <Link href="/login" className="btn-ghost">
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary">
            Start building
          </Link>
        </nav>
      </div>
    </header>
  );
}
