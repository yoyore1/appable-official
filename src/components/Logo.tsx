import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2", className)}>
      <span className="grid h-8 w-8 place-items-center rounded-xl bg-coral text-white shadow-soft">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3.5c-1.6 3.2-3 4.6-6.2 6.2 3.2 1.6 4.6 3 6.2 6.2 1.6-3.2 3-4.6 6.2-6.2-3.2-1.6-4.6-3-6.2-6.2Z"
            fill="currentColor"
          />
          <circle cx="18.5" cy="18" r="2.2" fill="currentColor" opacity="0.85" />
        </svg>
      </span>
      <span className="font-display text-xl font-semibold tracking-tight text-charcoal">
        Appable
      </span>
    </Link>
  );
}
