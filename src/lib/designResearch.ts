import type { InterviewTurn, MasterBuildPrompt, Vibe } from "@/lib/types";

export interface DesignProfile {
  colors: string;
  colorsShort: string;
  vibe: Vibe;
  fontDisplay: string;
  fontBody: string;
  rationale: string;
  tabHints: string[];
}

/** User wants us to pick — not a specific palette. */
export function isDeferToRecommendation(answer: string): boolean {
  const a = answer.trim().toLowerCase();
  if (!a) return true;
  return /recommend|you think|u think|think is best|pick for me|your call|up to you|whatever you|you decide|surprise|idk|don't know|anything|best.*color|what.*best/i.test(
    a
  );
}

/**
 * Light demographic + category research (rules, no extra API burn).
 * Tuned for clean, trustworthy UI — especially cooking / family apps.
 */
export function recommendDesignProfile(
  ctx: string,
  vibeOverride?: Vibe
): DesignProfile {
  const c = ctx.toLowerCase();
  const vibe = vibeOverride ?? inferVibeFromCtx(c);

  if (/recipe|food|cook|meal|kitchen|dish|grocery|ingredient/.test(c)) {
    const moms = /mom|mother|parent|family|young adult|meal prep|busy/.test(c);
    return {
      colors: moms
        ? "Sage green, warm cream, soft terracotta accents"
        : "Warm terracotta, cream white, forest green accents",
      colorsShort: moms ? "Sage green & warm cream" : "Terracotta & soft white",
      vibe,
      fontDisplay: "Fraunces",
      fontBody: "DM Sans",
      rationale: moms
        ? "Sage and cream feel calm and kitchen-ready — moms and busy cooks trust soft, readable screens over loud colors."
        : "Terracotta and cream read warm and appetizing without feeling like a generic food blog.",
      tabHints: ["Home", "Recipes", "Lists", "Profile"],
    };
  }

  if (/dog|pet|walk|walker|paw|puppy/.test(c)) {
    return {
      colors: "Forest green, warm cream, sky blue accents",
      colorsShort: "Forest green & warm cream",
      vibe,
      fontDisplay: "Fraunces",
      fontBody: "Nunito Sans",
      rationale:
        "Green and cream feel friendly and outdoorsy — pet apps should feel trustworthy and warm, not clinical.",
      tabHints: ["Home", "Walks", "Messages", "Profile"],
    };
  }

  if (/fitness|workout|gym|health|run/.test(c)) {
    return {
      colors: "Electric teal, charcoal, energetic coral highlights",
      colorsShort: "Teal & charcoal",
      vibe,
      fontDisplay: "Outfit",
      fontBody: "Inter",
      rationale: "High-contrast teal + charcoal feels energetic but still clean — gym apps need clarity at a glance.",
      tabHints: ["Today", "Workouts", "Progress", "Profile"],
    };
  }

  if (/finance|money|budget|bank|invest/.test(c)) {
    return {
      colors: "Deep navy, warm gold, clean off-white",
      colorsShort: "Navy & gold",
      vibe,
      fontDisplay: "Source Serif 4",
      fontBody: "IBM Plex Sans",
      rationale: "Navy and gold signal trust without feeling corporate-cold — normies still want warmth in money apps.",
      tabHints: ["Overview", "Spending", "Goals", "Profile"],
    };
  }

  if (/social|chat|friend|community|dating/.test(c)) {
    return {
      colors: "Warm coral, soft sand, gentle lavender accents",
      colorsShort: "Coral & warm sand",
      vibe,
      fontDisplay: "Sora",
      fontBody: "Nunito Sans",
      rationale: "Coral and sand feel friendly and approachable — social apps should invite, not intimidate.",
      tabHints: ["Feed", "Discover", "Messages", "Profile"],
    };
  }

  return {
    colors: "Appable coral, warm cream, soft charcoal accents",
    colorsShort: "Coral & warm cream",
    vibe,
    fontDisplay: "Fraunces",
    fontBody: "DM Sans",
    rationale: "Warm coral and cream keep it clean and on-brand — readable for any everyday audience.",
    tabHints: ["Home", "Explore", "Saved", "Profile"],
  };
}

function inferVibeFromCtx(c: string): Vibe {
  if (/luxury|fashion|premium|boutique/.test(c)) return "Luxury";
  if (/recipe|food|mom|family|wellness|calm|journal/.test(c)) return "Soft";
  if (/game|finance|fitness|business|pro/.test(c)) return "Bold";
  if (/photo|video|film|creative|art/.test(c)) return "Cinematic";
  return "Minimal";
}

function interviewBlob(interview: InterviewTurn[]): string {
  const a = (id: string) =>
    interview.find((t) => t.questionId === id)?.answer ?? "";
  return [a("idea"), a("twist"), a("reference_name"), a("audience"), a("features")]
    .filter(Boolean)
    .join(" ");
}

export function profileFromInterview(interview: InterviewTurn[]): DesignProfile {
  return recommendDesignProfile(interviewBlob(interview));
}

export function profileFromMasterPrompt(mp: MasterBuildPrompt): DesignProfile {
  const ctx = [mp.description, mp.audience, mp.twist, ...mp.features, mp.appName].join(" ");
  return recommendDesignProfile(ctx, mp.vibe);
}

/** One-line ack when user defers colors to us. */
export function recommendColorsAck(interview: InterviewTurn[]): string {
  const p = profileFromInterview(interview);
  const audience = interviewBlob(interview).match(/mom|young adult|busy|family/i)?.[0];
  if (audience) {
    return `For ${audience}s — ${p.colorsShort.toLowerCase()}. ${p.rationale.split("—")[0]?.trim()}.`;
  }
  return `I'd go ${p.colorsShort.toLowerCase()} — ${p.rationale}`;
}
