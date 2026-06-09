import type { ExpoAppModel } from "./types";

export interface PreviewCopyField {
  path: string;
  value: string;
  screen: string;
  label: string;
}

/** All user-visible copy lines — client-safe (no LLM / Node imports). */
export function listEditableCopyFields(
  model: ExpoAppModel,
  appName: string
): PreviewCopyField[] {
  const t: PreviewCopyField[] = [];
  const push = (path: string, value: string | undefined, screen: string, label: string) => {
    const v = (value ?? "").trim();
    if (!v) return;
    t.push({ path, value: v, screen, label });
  };

  const flow = model.flow;
  push("flow.welcomeTitle", flow?.welcomeTitle ?? `Welcome to ${appName}`, "welcome", "Welcome title");
  push("flow.welcomeSubtitle", flow?.welcomeSubtitle ?? "How will you use the app?", "welcome", "Welcome subtitle");

  for (let i = 0; i < (flow?.roles?.length ?? 0); i++) {
    const role = flow!.roles![i]!;
    push(`flow.roles[${i}].label`, role.label, "role", `${role.label} title`);
    push(`flow.roles[${i}].description`, role.description, "role", `${role.label} description`);
  }

  push("flow.setupTitle", flow?.setupTitle, "setup", "Setup title");
  push("flow.setupSubtitle", flow?.setupSubtitle, "setup", "Setup subtitle");
  push("flow.setupSubmitLabel", flow?.setupSubmitLabel, "setup", "Setup button");

  for (let i = 0; i < (flow?.setupFields?.length ?? 0); i++) {
    const f = flow!.setupFields![i]!;
    push(`flow.setupFields[${i}].label`, f.label, "setup", `Setup field: ${f.label}`);
    push(`flow.setupFields[${i}].placeholder`, f.placeholder, "setup", `Placeholder: ${f.label}`);
    push(`flow.setupFields[${i}].section`, f.section, "setup", `Section: ${f.section}`);
  }

  const auth = flow?.auth;
  if (auth) {
    push("flow.auth.signUpTitle", auth.signUpTitle, "sign-up", "Sign-up title");
    push("flow.auth.signUpSubtitle", auth.signUpSubtitle, "sign-up", "Sign-up subtitle");
    push("flow.auth.signInTitle", auth.signInTitle, "sign-in", "Sign-in title");
    push("flow.auth.signInSubtitle", auth.signInSubtitle, "sign-in", "Sign-in subtitle");
    push("flow.auth.submitLabel", auth.submitLabel, "sign-up", "Sign-up button");
    push("flow.auth.signInSubmitLabel", auth.signInSubmitLabel, "sign-in", "Sign-in button");
  }

  push("home.headline", model.home.headline, "home", "Home headline");
  push("home.subheadline", model.home.subheadline, "home", "Home subheadline");
  push("home.heroLabel", model.home.heroLabel, "home", "Home hero label");
  push("home.heroSublabel", model.home.heroSublabel, "home", "Home hero sublabel");
  push("profile.tagline", model.profile.tagline, "profile", "Profile tagline");

  for (let i = 0; i < model.onboarding.length; i++) {
    const slide = model.onboarding[i]!;
    const screen = i === 0 ? "onboarding-0" : "onboarding";
    push(`onboarding[${i}].title`, slide.title, screen, `Onboarding slide ${i + 1} title`);
    push(`onboarding[${i}].subtitle`, slide.subtitle, screen, `Onboarding slide ${i + 1} subtitle`);
    push(`onboarding[${i}].ctaLabel`, slide.ctaLabel, screen, `Onboarding slide ${i + 1} button`);
  }

  for (const tab of model.tabs) {
    const items = model.tabScreens[tab.id]?.items ?? [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i]!;
      const base = `tabScreens.${tab.id}.items[${i}]`;
      const screen = tab.id;
      if (it.title?.trim()) {
        push(`${base}.title`, it.title, screen, `${tab.label} card ${i + 1} title`);
      }
      if (it.subtitle?.trim()) {
        push(`${base}.subtitle`, it.subtitle, screen, `${tab.label} card ${i + 1} subtitle`);
      }
      if (it.primaryAction?.trim()) {
        push(`${base}.primaryAction`, it.primaryAction, screen, `${tab.label} card ${i + 1} button`);
      }
    }
  }

  return t;
}

export function getCopyFieldByPath(
  model: ExpoAppModel,
  appName: string,
  path: string
): PreviewCopyField | null {
  return listEditableCopyFields(model, appName).find((f) => f.path === path) ?? null;
}

/**
 * Target field + minimal same-screen context for tap-to-edit coaching.
 * Role paths only include that role's label/description — not the other role.
 */
export function getScopedCopyFields(
  model: ExpoAppModel,
  appName: string,
  path: string
): { target: PreviewCopyField; siblings: PreviewCopyField[] } | null {
  const fields = listEditableCopyFields(model, appName);
  const target = fields.find((f) => f.path === path);
  if (!target) return null;

  const roleMatch = path.match(/^flow\.roles\[(\d+)\]/);
  let siblings: PreviewCopyField[];
  if (roleMatch) {
    const prefix = `flow.roles[${roleMatch[1]}]`;
    siblings = fields.filter((f) => f.path.startsWith(prefix) && f.path !== path);
  } else {
    siblings = fields.filter((f) => f.screen === target.screen && f.path !== path);
  }

  return { target, siblings };
}
