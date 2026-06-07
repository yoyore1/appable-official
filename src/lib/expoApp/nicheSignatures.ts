/**
 * Niche intelligence — smart details users never say out loud.
 * Kimi weaves essentials + signatures into tabs, copy, and list items.
 */
import type { AppCategory } from "./inferCategory";

export type AppShape =
  | "local_marketplace"
  | "live_tracking"
  | "booking"
  | "delivery"
  | "content_library"
  | "habit_streak"
  | "finance"
  | "travel"
  | "dating_match"
  | "health_medical"
  | "real_estate"
  | "events"
  | "job_gig"
  | "parenting"
  | "automotive"
  | "outdoor_trails"
  | "alarm_safety"
  | "language_learn"
  | "wellness_mind"
  | "inventory_smb"
  | "community_forum"
  | "music_audio"
  | "photo_social"
  | "crypto_portfolio"
  | "notes_docs";

export interface NicheIntel {
  shapes: AppShape[];
  essentialFeatures: string[];
  /** Category-native “of course this app has…” moments — show in UI/copy. */
  signatureFeatures: string[];
  /** Concrete screens or states to seed (even as mock UI). */
  signatureScreens: string[];
  /** Extra Kimi directives — one block per detected shape. */
  buildDirectives: string[];
}

interface ShapeDef {
  id: AppShape;
  pattern: RegExp;
  weight: number;
  categories?: AppCategory[];
  essentials: { text: string; unless?: RegExp }[];
  signatures: string[];
  screens: string[];
  directive: string;
}

function has(blob: string, re: RegExp): boolean {
  return re.test(blob);
}

function pushUnless(
  out: string[],
  blob: string,
  items: { text: string; unless?: RegExp }[]
) {
  for (const { text, unless } of items) {
    if (unless && unless.test(blob)) continue;
    if (!out.includes(text)) out.push(text);
  }
}

const SHAPES: ShapeDef[] = [
  {
    id: "local_marketplace",
    pattern:
      /dog walk|walker|pet sit|babysit|taskrabbit|gig|freelance|nearby|neighborhood|local service|match.*owner|both sides|apply.*request|hire.*local|marketplace/i,
    weight: 3,
    essentials: [
      { text: "Distance / area on every listing", unless: /map|mile|km|radius|near/i },
      { text: "Owner ↔ provider messaging", unless: /message|chat|inbox/i },
      { text: "Profiles with ratings & review count", unless: /rating|review|star|trust/i },
      { text: "Request status chips (open · matched · done)", unless: /status|progress|active/i },
      { text: "Post with budget / rate field", unless: /pay|budget|\$|rate|price/i },
    ],
    signatures: [
      "Map or map-card on Home showing pins for nearby open requests",
      "Filter by distance / neighborhood",
      "‘Active job’ card when a match is in progress",
      "Rebook from history — ‘same walker again’",
      "Trust row: verified badge, walks completed, response time",
    ],
    screens: [
      "Home with map strip + open requests list",
      "Post request form (area, budget, notes)",
      "Applicant list / match confirmation",
      "Active session in progress",
      "Chat thread tied to a booking",
    ],
    directive:
      "LOCAL MARKETPLACE: Users expect map/nearby, distance, match status, and in-progress job state — even if they only said ‘match people’.",
  },
  {
    id: "live_tracking",
    pattern:
      /track|tracker|gps|live location|where is|real.?time|en route|on the way|geofence|follow.*route|delivery status|walk in progress|last seen/i,
    weight: 3,
    essentials: [
      { text: "Map-first or prominent map card", unless: /map/i },
      { text: "Live / in-progress status banner", unless: /live|progress|active|en route/i },
    ],
    signatures: [
      "Map with moving pin or route line (mock OK)",
      "ETA or ‘started at’ timestamp",
      "End / complete session CTA",
      "Safe zone or area radius copy for trackers",
      "Notification-style alert row (‘left safe zone’)",
    ],
    screens: [
      "Live map view",
      "Session detail (timer, route, status)",
      "History of past sessions with map thumb",
    ],
    directive:
      "TRACKING SHAPE: Map + live session state are signature — not optional extras.",
  },
  {
    id: "booking",
    pattern:
      /book|appointment|schedule|calendar|slot|reserv|salon|clinic|doctor|dentist|table at|time slot/i,
    weight: 3,
    essentials: [
      { text: "Calendar or date strip picker", unless: /calendar|date|slot/i },
      { text: "Confirmation screen with date/time summary", unless: /confirm/i },
      { text: "Reschedule / cancel policy line", unless: /reschedul|cancel/i },
      { text: "Reminder chip (push-style copy)", unless: /remind/i },
    ],
    signatures: [
      "Provider availability grid (morning / afternoon)",
      "Booking reference ID on confirmation",
      "Add to calendar affordance in copy",
      "Upcoming vs past appointments tabs",
    ],
    screens: ["Pick service → pick slot → confirm", "Upcoming bookings", "Booking detail"],
    directive: "BOOKING: Show slot selection, confirmation, and upcoming list — feels like Calendly-class UX.",
  },
  {
    id: "delivery",
    pattern: /deliver|courier|driver|order food|takeout|pickup|restaurant order|dash|uber eats/i,
    weight: 2,
    essentials: [
      { text: "Order status timeline", unless: /status|track/i },
      { text: "Delivery address + instructions", unless: /address/i },
    ],
    signatures: [
      "Status steps: placed → preparing → on the way → delivered",
      "Driver name + contact when en route",
      "ETA countdown copy",
      "Reorder from past orders",
    ],
    screens: ["Menu browse", "Cart", "Order tracking", "Order history"],
    directive: "DELIVERY: Status timeline + ETA are mandatory signature UI.",
  },
  {
    id: "content_library",
    pattern:
      /recipe|course|lesson|article|read|watch|tutorial|step.?by.?step|library|bookmark|save.*content/i,
    weight: 2,
    categories: ["cooking", "education", "general"],
    essentials: [
      { text: "Continue / resume row on Home", unless: /resume|continue/i },
      { text: "Save to library / favorites", unless: /save|favorite|library/i },
    ],
    signatures: [
      "Step-by-step mode with progress (Step 2 of 8)",
      "Related items carousel",
      "Empty library state that teaches first save",
      "Duration / difficulty meta on cards",
    ],
    screens: ["Home continue row", "Detail with steps", "Saved library", "Search/filter"],
    directive: "CONTENT LIBRARY: Resume + structured detail (steps) + saved collection.",
  },
  {
    id: "habit_streak",
    pattern: /habit|streak|routine|daily check|quit|sober|journal|mood|accountability/i,
    weight: 2,
    essentials: [
      { text: "Streak counter or weekly grid", unless: /streak|grid|week/i },
      { text: "Today’s check-in CTA on Home", unless: /check.?in|today/i },
    ],
    signatures: [
      "Gentle miss-day copy (not punishing)",
      "Weekly completion heatmap or dots",
      "Reminder time setting in profile",
      "Celebrate milestone toast copy",
    ],
    screens: ["Today check-in", "Streak stats", "History log"],
    directive: "HABITS: Streak visualization + one-tap daily check-in on Home.",
  },
  {
    id: "finance",
    pattern: /budget|expense|spend|money|finance|bank|invoice|bill|savings|invest|portfolio/i,
    weight: 2,
    essentials: [
      { text: "Month-to-date summary card", unless: /month|summary|total/i },
      { text: "Category breakdown", unless: /categor/i },
    ],
    signatures: [
      "Spending vs budget bar per category",
      "Recent transactions list with icons",
      "Quick-add expense FAB copy",
      "Safe ‘demo money’ amounts — realistic not random",
    ],
    screens: ["Dashboard summary", "Category detail", "Add transaction"],
    directive: "FINANCE: Dashboard with categories + recent activity — not a blank form app.",
  },
  {
    id: "travel",
    pattern: /flight|hotel|trip|vacation|itinerary|travel|airbnb|booking\.com|packing/i,
    weight: 2,
    essentials: [
      { text: "Trip dates + destination header", unless: /date|trip|destination/i },
      { text: "Saved trips or wishlist", unless: /save|wish/i },
    ],
    signatures: [
      "Day-by-day itinerary tabs",
      "Price or deal badge on listings",
      "Flight/hotel card with times + layover copy",
      "Packing checklist section optional",
    ],
    screens: ["Search results", "Trip overview", "Itinerary day view"],
    directive: "TRAVEL: Trips as first-class objects with dates and saved items.",
  },
  {
    id: "dating_match",
    pattern: /dating|swipe|match|tinder|bumble|singles|romance|meet people/i,
    weight: 2,
    essentials: [
      { text: "Match inbox separate from messages", unless: /match|inbox/i },
      { text: "Profile photos + short bio", unless: /profile|photo|bio/i },
    ],
    signatures: [
      "Mutual match celebration moment copy",
      "Distance on profile cards",
      "Report / block in settings (trust)",
      "Prompts or icebreaker on match thread",
    ],
    screens: ["Discover / swipe deck", "Matches list", "Chat"],
    directive: "DATING: Match queue + chat + rich profiles — never a generic list app.",
  },
  {
    id: "health_medical",
    pattern: /symptom|medication|meds|pill|doctor|patient|health record|blood pressure|glucose|therapy/i,
    weight: 2,
    essentials: [
      { text: "Log entry with date/time", unless: /log|history/i },
      { text: "Disclaimer / not medical advice footer", unless: /disclaimer|not medical/i },
    ],
    signatures: [
      "Trend chart placeholder for vitals",
      "Medication reminder schedule rows",
      "Export or share with provider copy",
      "Calm, accessible typography — not alarmist",
    ],
    screens: ["Today health log", "History chart", "Meds schedule"],
    directive: "HEALTH: Logging + trends + reminders; include soft medical disclaimer in profile.",
  },
  {
    id: "real_estate",
    pattern: /rent|lease|apartment|house|property|realtor|listing|zillow|roommate/i,
    weight: 2,
    essentials: [
      { text: "Price + beds/baths on every card", unless: /bed|bath|\$|price/i },
      { text: "Map of listings", unless: /map/i },
    ],
    signatures: [
      "Photo gallery on detail (swipe dots)",
      "Neighborhood / commute hint",
      "Contact agent / schedule tour CTA",
      "Save favorites heart on cards",
    ],
    screens: ["Map + list search", "Listing detail", "Saved homes"],
    directive: "REAL ESTATE: Listing cards with price, beds, map — tour/contact CTA.",
  },
  {
    id: "events",
    pattern: /event|ticket|rsvp|concert|meetup|conference|venue|festival/i,
    weight: 2,
    essentials: [
      { text: "Date/time + venue on cards", unless: /venue|date|time/i },
      { text: "RSVP or ticket status", unless: /rsvp|ticket/i },
    ],
    signatures: [
      "Calendar export copy",
      "Friends attending / spots left",
      "QR ticket mock on confirmation",
      "Discover near me vs online filter",
    ],
    screens: ["Event discover", "Event detail", "My tickets"],
    directive: "EVENTS: Event cards with venue, RSVP state, and ticket confirmation.",
  },
  {
    id: "job_gig",
    pattern: /job|career|resume|apply|hiring|recruit|linkedin|gig work|shift/i,
    weight: 2,
    essentials: [
      { text: "Apply / save job actions", unless: /apply|save/i },
      { text: "Application status", unless: /status|applied/i },
    ],
    signatures: [
      "Salary or hourly range on listings",
      "Skills match tags",
      "Application submitted confirmation",
      "Saved jobs tab",
    ],
    screens: ["Job search", "Job detail", "Applications tracker"],
    directive: "JOBS: Search + detail + applied status tracker.",
  },
  {
    id: "parenting",
    pattern: /parent|mom|dad|kid|child|baby|family calendar|school|chore chart/i,
    weight: 2,
    essentials: [
      { text: "Family member avatars / roles", unless: /family|member|kid/i },
      { text: "Shared calendar or task assignee", unless: /calendar|assign/i },
    ],
    signatures: [
      "Chore checkboxes per child",
      "Gentle reward / streak for kids",
      "Pickup schedule or custody calendar copy",
      "Emergency contact row in profile",
    ],
    screens: ["Family home", "Chore board", "Calendar"],
    directive: "PARENTING: Multi-person household — assign tasks, shared calendar.",
  },
  {
    id: "automotive",
    pattern: /car|vehicle|parking|fuel|gas|mileage|mechanic|auto repair|vin\b/i,
    weight: 2,
    essentials: [
      { text: "Vehicle profile (make/model/year)", unless: /vehicle|car|model/i },
    ],
    signatures: [
      "Maintenance reminder by mileage/date",
      "Fuel log or charge session row",
      "Parking spot pin on map",
      "Service history list",
    ],
    screens: ["Garage", "Log service/fuel", "Reminders"],
    directive: "AUTOMOTIVE: Vehicle-centric home + maintenance reminders.",
  },
  {
    id: "outdoor_trails",
    pattern: /hike|trail|camp|outdoor|climb|run route|strava|peak/i,
    weight: 2,
    essentials: [
      { text: "Trail distance + difficulty", unless: /difficult|mile|km/i },
      { text: "Map of route", unless: /map|route/i },
    ],
    signatures: [
      "Elevation gain on detail",
      "Offline / download trail copy",
      "Recent activity feed",
      "Weather line on trail header",
    ],
    screens: ["Trail map", "Trail detail", "My activities"],
    directive: "OUTDOOR: Map routes with distance, difficulty, elevation.",
  },
  {
    id: "alarm_safety",
    pattern:
      /alarm|wake up|sunlight|photo.*proof|verify.*photo|emergency|sos|panic|safety check/i,
    weight: 3,
    essentials: [
      { text: "Alarm / challenge step (photo, math, scan)", unless: /alarm|challenge|verify/i },
      { text: "Streak or success confirmation", unless: /streak|success/i },
    ],
    signatures: [
      "Morning alarm card with next ring time",
      "Photo verification step mock UI",
      "Cannot dismiss without completing challenge copy",
      "Weekly wake-up stats",
    ],
    screens: ["Alarm home", "Challenge capture", "History / streak"],
    directive: "ALARM/SAFETY: Challenge-to-dismiss + streak — core loop visible on Home.",
  },
  {
    id: "language_learn",
    pattern: /language|learn spanish|duolingo|vocab|flashcard|translate|lesson/i,
    weight: 2,
    essentials: [
      { text: "Daily lesson progress ring", unless: /progress|lesson|daily/i },
      { text: "Streak for practice days", unless: /streak/i },
    ],
    signatures: [
      "Bite-sized lesson cards",
      "XP or points on profile",
      "Pronunciation / listen button copy",
      "Unit map vertical path mock",
    ],
    screens: ["Today lesson", "Lesson steps", "Profile progress"],
    directive: "LANGUAGE: Daily lesson + streak + unit progress path.",
  },
  {
    id: "wellness_mind",
    pattern: /meditat|mindful|breath|calm|sleep|mental health|journal prompt/i,
    weight: 2,
    essentials: [
      { text: "Session length picker", unless: /minute|duration|length/i },
      { text: "Ambient / soundscape label", unless: /sound|music|ambient/i },
    ],
    signatures: [
      "Breathing animation placeholder copy",
      "Session complete summary",
      "Gentle streak without guilt copy",
      "Bedtime wind-down section",
    ],
    screens: ["Home calm card", "Active session", "History"],
    directive: "WELLNESS: Timed session + completion summary + soft streak.",
  },
  {
    id: "inventory_smb",
    pattern: /inventory|stock|sku|warehouse|small business|pos|point of sale/i,
    weight: 2,
    essentials: [
      { text: "Low-stock alert row", unless: /low stock|alert/i },
      { text: "Quantity on hand per item", unless: /quantity|count|stock/i },
    ],
    signatures: [
      "Barcode scan affordance in copy",
      "Adjust stock + / − steppers",
      "Category filters for products",
      "Today’s sales mini summary",
    ],
    screens: ["Inventory list", "Item detail", "Adjust stock"],
    directive: "INVENTORY: Stock counts, low alerts, quick adjust — SMB ops feel.",
  },
  {
    id: "community_forum",
    pattern: /forum|thread|subreddit|community post|discussion|group chat|channel/i,
    weight: 2,
    essentials: [
      { text: "Upvote / reply counts on posts", unless: /upvote|reply|comment/i },
      { text: "Channels or topics list", unless: /channel|topic/i },
    ],
    signatures: [
      "Pinned post on channel home",
      "User flair or role badge",
      "Sort by hot / new toggle copy",
      "Report post in overflow menu copy",
    ],
    screens: ["Channel list", "Thread feed", "Post detail"],
    directive: "COMMUNITY: Threads with replies, channels, engagement counts.",
  },
  {
    id: "music_audio",
    pattern: /music|playlist|song|spotify|podcast|listen|album|artist/i,
    weight: 2,
    essentials: [
      { text: "Now playing mini bar", unless: /now playing|player/i },
      { text: "Playlist save / follow", unless: /playlist|save|follow/i },
    ],
    signatures: [
      "Playback controls on detail",
      "Queue or up next list",
      "Album art prominent on cards",
      "Shuffle / repeat toggle copy",
    ],
    screens: ["Browse", "Now playing", "Library"],
    directive: "AUDIO: Now-playing bar + library — feels like a listener app.",
  },
  {
    id: "photo_social",
    pattern: /photo share|instagram|gallery|album|selfie|filter|stories/i,
    weight: 2,
    essentials: [
      { text: "Grid profile of posts", unless: /grid|profile/i },
      { text: "Like / comment counts", unless: /like|comment/i },
    ],
    signatures: [
      "Stories ring on avatars",
      "Double-tap save copy",
      "Camera tab or prominent upload",
      "Hashtag chips on posts",
    ],
    screens: ["Feed", "Profile grid", "Upload / camera"],
    directive: "PHOTO SOCIAL: Feed + profile grid + camera/upload entry.",
  },
  {
    id: "crypto_portfolio",
    pattern: /crypto|bitcoin|ethereum|wallet|token|defi|nft/i,
    weight: 1,
    essentials: [
      { text: "Portfolio total + 24h change", unless: /portfolio|change|%/i },
      { text: "Asset list with ticker symbols", unless: /ticker|symbol|btc|eth/i },
    ],
    signatures: [
      "Green/red delta on holdings",
      "Buy / sell CTA (demo only)",
      "Transaction history",
      "Not financial advice footer",
    ],
    screens: ["Portfolio home", "Asset detail", "Activity"],
    directive: "CRYPTO: Portfolio header + holdings list + disclaimer.",
  },
  {
    id: "notes_docs",
    pattern: /note|notebook|document|memo|wiki|knowledge base|docs/i,
    weight: 1,
    essentials: [
      { text: "Search across notes", unless: /search/i },
      { text: "Folders or tags", unless: /folder|tag/i },
    ],
    signatures: [
      "Last edited timestamp on cards",
      "Pin note to top",
      "Rich text preview line",
      "Quick capture FAB",
    ],
    screens: ["Note list", "Note editor view", "Search"],
    directive: "NOTES: List + search + tags; editor view with last edited.",
  },
];

const CATEGORY_BOOST: Partial<Record<AppCategory, AppShape[]>> = {
  pets: ["local_marketplace", "live_tracking", "booking"],
  cooking: ["content_library"],
  fitness: ["habit_streak", "live_tracking", "outdoor_trails"],
  productivity: ["habit_streak", "notes_docs", "booking"],
  shopping: ["delivery", "finance"],
  education: ["content_library", "language_learn"],
  social: ["photo_social", "dating_match", "community_forum"],
  general: [],
};

function detectShapes(blob: string, category: AppCategory): AppShape[] {
  const scores = new Map<AppShape, number>();

  for (const shape of SHAPES) {
    if (shape.categories && !shape.categories.includes(category) && category !== "general") {
      if (!shape.pattern.test(blob)) continue;
    }
    if (shape.pattern.test(blob)) {
      scores.set(shape.id, (scores.get(shape.id) ?? 0) + shape.weight);
    }
  }

  for (const boosted of CATEGORY_BOOST[category] ?? []) {
    scores.set(boosted, (scores.get(boosted) ?? 0) + 1);
  }

  const ranked = [...scores.entries()]
    .filter(([, s]) => s >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => id);

  if (ranked.length === 0 && category === "pets") {
    return ["local_marketplace", "live_tracking"];
  }

  return ranked.slice(0, 4);
}

/** Full niche pass — essentials, signatures, screens, Kimi directives. */
export function inferNicheIntel(
  blob: string,
  category: AppCategory,
  statedFeatures: string[]
): NicheIntel {
  const statedBlob = statedFeatures.join(" ").toLowerCase();
  const fullBlob = `${blob} ${statedBlob}`.toLowerCase();
  const shapes = detectShapes(fullBlob, category);

  const essentialFeatures: string[] = [];
  const signatureFeatures: string[] = [];
  const signatureScreens: string[] = [];
  const buildDirectives: string[] = [
    "SIGNATURE LAYER: User did not ask for everything below — include because credible apps in this niche always have them. Show in UI copy, tabs, list items, and onboarding — not as a bullet essay.",
    "Pick 2–3 signature moments max if crowded; never generic analytics dashboards.",
  ];

  const matched = SHAPES.filter((s) => shapes.includes(s.id));

  for (const shape of matched) {
    pushUnless(essentialFeatures, fullBlob, shape.essentials);
    for (const sig of shape.signatures) {
      if (!signatureFeatures.includes(sig)) signatureFeatures.push(sig);
    }
    for (const screen of shape.screens) {
      if (!signatureScreens.includes(screen)) signatureScreens.push(screen);
    }
    buildDirectives.push(shape.directive);
  }

  // Category fallbacks when no shape matched
  if (matched.length === 0) {
    buildDirectives.push(
      "Infer 1–2 signature UI moments from the user's own words (e.g. local → map, booking → calendar, content → steps)."
    );
  }

  return {
    shapes,
    essentialFeatures,
    signatureFeatures: signatureFeatures.slice(0, 8),
    signatureScreens: signatureScreens.slice(0, 10),
    buildDirectives,
  };
}
