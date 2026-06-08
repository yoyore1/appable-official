/** Railway-style mark for Connections UI (SVG, no external assets). */
export function RailwayLogo({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M4 7h16v1.5H4V7zm0 4.25h16v1.5H4v-1.5zm0 4.25h16V17H4v-1.5z" />
    </svg>
  );
}
