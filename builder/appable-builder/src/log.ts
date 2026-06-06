/**
 * Friendly progress reporting. Per the design mandate, never expose machinery
 * (tokens/API/compile) — translate to outcomes. `detail()` lines are the raw
 * technical bits, shown only in advanced/verbose mode. In the Void chat UI these
 * map to status cards; here they print to the terminal.
 */
const c = {
  coral: (s: string) => `\x1b[38;5;209m${s}\x1b[0m`,
  green: (s: string) => `\x1b[38;5;71m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
};

export interface ProgressOptions {
  verbose?: boolean;
}

export class Progress {
  constructor(private opts: ProgressOptions = {}) {}

  /** A friendly, plain-language status ("Designing your onboarding ✨"). */
  step(message: string) {
    console.log(`${c.coral("●")} ${message}`);
  }

  /** A soft completion check. */
  ok(message: string) {
    console.log(`${c.green("✓")} ${message}`);
  }

  /** Reassuring note when something needed a fix. */
  fixing(message: string) {
    console.log(`${c.coral("…")} ${message}`);
  }

  /** Raw technical detail — advanced/verbose view only. */
  detail(message: string) {
    if (this.opts.verbose) console.log(`  ${c.dim(message)}`);
  }

  /** A celebration moment (soft confetti in the UI). */
  celebrate(message: string) {
    console.log(`\n${c.bold(c.coral("🎉 " + message))}\n`);
  }

  heading(message: string) {
    console.log(`\n${c.bold(message)}`);
  }
}
