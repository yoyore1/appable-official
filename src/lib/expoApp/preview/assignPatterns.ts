import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { listItemsToThreads } from "./patterns/messagingData";
import type {
  ExpoAppModel,
  ExpoCartLine,
  ExpoPreviewPatterns,
  ExpoPreviewState,
  PreviewPatternId,
} from "../types";
import { detectRequiredCapabilities } from "../capabilities/registry";
import type { CapabilityId } from "../capabilities/types";

function patternForTab(
  tabId: string,
  label: string,
  screenTitle: string,
  required: CapabilityId[]
): PreviewPatternId {
  const key = `${tabId} ${label} ${screenTitle}`.toLowerCase();

  if (/message|chat|inbox/.test(key)) {
    return required.includes("messaging") ? "inbox-threads" : "list-browse";
  }

  if (/checkout/.test(key) && required.includes("commerce")) {
    return "checkout-summary";
  }
  if (/cart|bag/.test(key) && required.includes("commerce") && !/add to/.test(key)) {
    return "cart-lines";
  }
  if (/shop|store/.test(key) && required.includes("commerce")) {
    return "shop-grid";
  }

  if (
    /list|grocery|saved|collection|plan/.test(key) &&
    required.includes("collection") &&
    !/shop|store/.test(key)
  ) {
    return "collection-list";
  }

  if (/feed|activity|post|timeline/.test(key) && required.includes("social_feed")) {
    return "feed-scroll";
  }

  if (/note|journal|memo/.test(key) && required.includes("journal")) {
    return "notes-list";
  }

  if (/habit|today|streak|routine/.test(key) && required.includes("habit_streak")) {
    return "habit-checklist";
  }

  if (
    /book|schedule|calendar|availability|slot|appointment/.test(key) &&
    required.includes("booking")
  ) {
    return "booking-browse";
  }

  if (
    /walk|request|gig|job|discover|market|applicant|nearby/.test(key) &&
    required.includes("marketplace_match")
  ) {
    return "marketplace-browse";
  }

  if (/recipe|lesson|workout|library|media|read/.test(key) && required.includes("content_browse")) {
    return "list-browse";
  }

  if (/track|log|history|stat/.test(key) && required.includes("status_workflow")) {
    return "list-browse";
  }

  return "list-browse";
}

function buildPreviewState(model: ExpoAppModel, patterns: ExpoPreviewPatterns): ExpoPreviewState {
  const state: ExpoPreviewState = { ...model.previewState };

  for (const [tabId, patternId] of Object.entries(patterns.tabs)) {
    if (patternId === "inbox-threads") {
      const items = model.tabScreens[tabId]?.items ?? [];
      if (!(state.threads?.length ?? 0) && items.length > 0) {
        state.threads = listItemsToThreads(items);
      }
    }
    if (patternId === "cart-lines" || patternId === "checkout-summary") {
      const items = model.tabScreens[tabId]?.items ?? [];
      if (!state.cart?.length && items.length > 0) {
        state.cart = items.map(
          (it): ExpoCartLine => ({
            id: it.id,
            title: it.title,
            price: it.meta ?? "$0",
            imageUrl: it.imageUrl,
            qty: 1,
          })
        );
      }
    }
  }

  return state;
}

/** Assign UI patterns + seed preview state — every tab gets a pattern, not just messaging/shop. */
export function assignPreviewPatterns(
  model: ExpoAppModel,
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): ExpoAppModel {
  const required = detectRequiredCapabilities(mp, interview);
  const tabs: ExpoPreviewPatterns["tabs"] = {};

  for (const tab of model.tabs) {
    if (tab.id === "home" || tab.id === "profile") continue;
    const screen = model.tabScreens[tab.id];
    if (!screen) continue;
    tabs[tab.id] = patternForTab(tab.id, tab.label, screen.title, required);
  }

  const messagingTabId = model.previewActions?.messagingTabId;
  if (messagingTabId && required.includes("messaging")) {
    tabs[messagingTabId] = "inbox-threads";
  }

  const patterns: ExpoPreviewPatterns = {
    tabs,
    home: "home-dashboard",
    detail: "content-detail",
  };

  const tabScreens = { ...model.tabScreens };
  for (const [tabId, patternId] of Object.entries(patterns.tabs)) {
    if (tabScreens[tabId]) {
      tabScreens[tabId] = { ...tabScreens[tabId], patternId };
    }
  }

  const previewState = buildPreviewState({ ...model, tabScreens, previewPatterns: patterns }, patterns);

  return {
    ...model,
    tabScreens,
    previewPatterns: patterns,
    previewState,
  };
}
