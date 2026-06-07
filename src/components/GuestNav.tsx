import Link from "next/link";
import { Logo } from "@/components/Logo";

export function GuestNav() {
  return (
    <header className="sticky top-0 z-30 border-b border-line/40 bg-cream/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
        <Logo href="/" />
        <Link href="/login" className="btn-ghost text-sm">
          Sign in
        </Link>
      </div>
    </header>
  );
}
