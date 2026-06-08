"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { scrollToBuildBox } from "@/lib/scrollToBuild";

type Props = {
  children: React.ReactNode;
  className?: string;
};

export function ScrollToBuildLink({ children, className }: Props) {
  const pathname = usePathname();

  return (
    <Link
      href="/#build-box"
      className={className}
      onClick={(e) => {
        if (pathname !== "/") return;
        e.preventDefault();
        scrollToBuildBox(true);
        window.history.replaceState(null, "", "#build-box");
      }}
    >
      {children}
    </Link>
  );
}
