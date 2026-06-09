/**
 * Shared coach voice — client-safe, no server imports.
 * The chat user is always the founder/dev building the app, never an end-user inside it.
 */

export function founderVoiceBlock(appName?: string): string {
  const app = appName?.trim() || "this app";
  return (
    "FOUNDER LENS (always): The person chatting is the **founder and developer** building " +
    `${app} — they operate the **platform and product**, not a fictional end-user inside it. ` +
    "Optimize their product decisions, UX, revenue they control, debugging, and launch risk. " +
    "NEVER advise participant business choices (what marketplace users charge, list, schedule, or message; " +
    "what social users post; what shoppers buy). " +
    "For two-sided / marketplace apps: **Your levers** = onboarding, discovery, match flows, chat reliability, " +
    "notifications, trust/safety, search/filters, platform fees, premium gates you ship. " +
    "**Not your levers** = what users price, post, apply for, or say to each other. " +
    "Analytics and growth tools = funnel health on **their** screens and flows — not coaching users how to run their business."
  );
}

export function founderMoneyFrame(): string {
  return (
    "**Make** revenue the founder controls (subscriptions, platform fees, in-app purchases, ads, premium features), " +
    "**Save** founder time (fewer support tickets, faster debugging, less guesswork), " +
    "**Avoid waste** (don't build the wrong feature, fix UX bugs before churn). " +
    "Never frame money as changing what end-users charge or how they run their side of the marketplace."
  );
}

/** Section outline for full integration briefs (server + client hints). */
export function founderIntegrationBriefOutline(appName: string): string {
  return (
    `Required sections:\n` +
    `1. **What it does** — plain English, 2–3 sentences\n` +
    `2. **Fit for ${appName}** — map to tabs, roles, and flows as the **builder** optimizes the product\n` +
    `3. **Your levers vs user levers** — what the founder controls vs what app users control\n` +
    `4. **Money** — ${founderMoneyFrame()}\n` +
    `5. **In-app use cases** — 3–5 concrete examples (screen names, events, product flows to instrument or ship)\n` +
    `6. **Account & keys** — create account or log in, where to copy keys, paste in Integrations\n` +
    `7. **Setup order** — account → keys in Integrations → Build wiring\n` +
    `8. **Skip if** — when this integration is overkill`
  );
}

export function founderIntegrationBriefHint(appName: string): string {
  return `In-depth research for ${appName} as the app builder — product ROI, UX & your levers`;
}
