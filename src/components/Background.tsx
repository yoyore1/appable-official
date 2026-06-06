import { cn } from "@/lib/utils";

/** The signature breathing coral mesh. `calm` dials it way back for interiors. */
export function Background({ calm = false }: { calm?: boolean }) {
  return <div className={cn("mesh", calm && "mesh--calm")} aria-hidden />;
}
