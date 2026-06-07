import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import type { AppCategory } from "./inferCategory";
import { inferCategory } from "./inferCategory";
import { inferAppTopology } from "./appTopology";
import { buildInterviewContext } from "./interviewContext";
import { flowFromSpec, inferProductSpec } from "./productSpec";
import { foodImage, imageForCategory, onboardingImage, petImage } from "./images";
import type { ExpoAppModelInput, ExpoListItem } from "./types";

function item(
  id: string,
  title: string,
  subtitle: string,
  meta: string,
  imageIndex: number,
  badge?: string
): ExpoListItem {
  return {
    id,
    title,
    subtitle,
    meta,
    badge,
    imageUrl: foodImage(imageIndex),
  };
}

function cookingSeed(mp: MasterBuildPrompt): ExpoAppModelInput {
  const name = mp.appName;
  return {
    category: "cooking",
    tabs: [
      { id: "home", label: "Home", icon: "home" },
      { id: "recipes", label: "Recipes", icon: "chef-hat" },
      { id: "lists", label: "Lists", icon: "shopping-cart" },
      { id: "profile", label: "Profile", icon: "user" },
    ],
    onboarding: [
      {
        title: "Scan → full recipe",
        subtitle: `Tap scan on home — photo becomes ingredients + steps in seconds. Real recipe on screen one, not a tutorial.`,
        imageUrl: onboardingImage(0),
        demonstrates: mp.features[0] ?? "Photo to recipe",
        ctaLabel: "Show me",
        kind: "feature_demo",
      },
      {
        title: "Set your taste once",
        subtitle:
          "Pick spice, diet, and portions — every suggestion from here respects how you actually cook.",
        imageUrl: onboardingImage(1),
        demonstrates: "Dietary preferences",
        ctaLabel: "Set preferences",
        kind: "personalization",
      },
      {
        title: "Lists link to recipes",
        subtitle:
          "Open any recipe → Add to shopping list — grocery items appear in Lists tab with real names.",
        imageUrl: onboardingImage(2),
        demonstrates: mp.features[1] ?? "Grocery lists",
        ctaLabel: "Let's cook",
        kind: "completion",
      },
    ],
    home: {
      headline: "What's for dinner?",
      subheadline: `Hey — ready to cook something great for ${mp.audience.toLowerCase()}?`,
      heroLabel: "Scan ingredients",
      heroSublabel: "Camera or camera roll → recipe in seconds",
      sections: [
        {
          title: "Tonight's picks",
          items: [
            item(
              "r1",
              "One-pan lemon chicken",
              "Mild spice · 25 min · feeds 4",
              "25 min",
              0,
              "Easy"
            ),
            item(
              "r2",
              "Creamy tuscan pasta",
              "Comfort food · vegetarian option",
              "32 min",
              1,
              "Popular"
            ),
            item(
              "r3",
              "Sheet-pan fajita bowls",
              "Medium spice · kid-friendly sides",
              "28 min",
              2
            ),
          ],
        },
        {
          title: "From your last scan",
          items: [
            item(
              "s1",
              "Tomato basil risotto",
              "Built from your fridge photo yesterday",
              "40 min",
              3
            ),
            item(
              "s2",
              "Garlic butter shrimp",
              "Used your 'date night' preference",
              "18 min",
              4,
              "Saved"
            ),
          ],
        },
      ],
    },
    tabScreens: {
      recipes: {
        title: "Your recipes",
        subtitle: "Saved, scanned, and tailored to your pantry",
        items: [
          item("rb1", "Mediterranean grain bowl", "High protein · lunch prep", "20 min", 0),
          item("rb2", "Slow-cooker chili", "Feeds 6 · medium spice", "4 hr", 1, "Batch"),
          item("rb3", "Avocado toast deluxe", "5-ingredient brunch", "10 min", 2),
          item("rb4", "Honey soy salmon", "Low carb · weeknight", "22 min", 3),
          item("rb5", "Veggie stir-fry", "Uses what you scanned last", "15 min", 4),
        ],
      },
      lists: {
        title: "Grocery lists",
        subtitle: "Tap to check off — share with one tap",
        items: [
          item("g1", "Weeknight essentials", "12 items · 2 checked off", "Updated today", 5),
          item("g2", "Lemon chicken night", "8 items · shared with Mom", "Shared", 0),
          item("g3", "Sunday meal prep", "15 items · est. $48", "$48 est.", 1),
        ],
      },
    },
    profile: {
      displayName: "Your kitchen",
      tagline: `${name} · ${mp.vibe} cook`,
      stats: [
        { label: "Recipes saved", value: "24" },
        { label: "Lists shared", value: "6" },
        { label: "Scans", value: "18" },
      ],
      settings: [
        { label: "Dietary preferences", icon: "utensils" },
        { label: "Spice & portions", icon: "settings" },
        { label: "Notifications", icon: "bell" },
        { label: "Privacy", icon: "shield" },
        { label: "Help & support", icon: "help-circle" },
      ],
    },
  };
}

function fitnessSeed(mp: MasterBuildPrompt): ExpoAppModelInput {
  const name = mp.appName;
  const f0 = mp.features[0] ?? "Workouts";
  return {
    category: "fitness",
    tabs: [
      { id: "home", label: "Home", icon: "home" },
      { id: "workouts", label: "Workouts", icon: "utensils" },
      { id: "plan", label: "Plan", icon: "list" },
      { id: "profile", label: "Profile", icon: "user" },
    ],
    onboarding: [
      {
        title: "Move on your schedule",
        subtitle: `${name} fits real life for ${mp.audience.toLowerCase()} — short sessions that actually stick.`,
        imageUrl: onboardingImage(0),
      },
      {
        title: f0,
        subtitle: `Every workout opens with full steps — no guessing, no filler demos.`,
        imageUrl: onboardingImage(1),
      },
      {
        title: "Plan it once",
        subtitle: "Add any session to your weekly plan and track progress on Profile.",
        imageUrl: onboardingImage(2),
      },
    ],
    home: {
      headline: "Ready to move?",
      subheadline: `Today's pick for ${mp.audience.toLowerCase()} — tap to start.`,
      heroLabel: "Quick start",
      heroSublabel: "20-min session · no equipment",
      sections: [
        {
          title: "Today's workout",
          items: [
            item("w1", "Core & cardio blast", "Low impact · 22 min", "22 min", 0, "Today"),
            item("w2", "Upper body strength", "Dumbbells optional · 30 min", "30 min", 1),
            item("w3", "Mobility reset", "Perfect after desk work", "15 min", 2),
          ],
        },
        {
          title: "From your plan",
          items: [
            item("p1", "Wednesday: legs", "Scheduled · 2 of 4 done", "Leg day", 3),
            item("p2", "Friday: HIIT", "On your calendar", "25 min", 4),
          ],
        },
      ],
    },
    tabScreens: {
      workouts: {
        title: "Workout library",
        subtitle: f0,
        items: [
          item("wb1", "Full-body burner", "No equipment · 20 min", "20 min", 0),
          item("wb2", "Runner's strength", "Build resilience · 35 min", "35 min", 1),
          item("wb3", "Yoga flow", "Recovery day · 25 min", "25 min", 2),
          item("wb4", "Tabata finisher", "High intensity · 12 min", "12 min", 3),
        ],
      },
      plan: {
        title: "Your plan",
        subtitle: "This week",
        items: [
          item("pl1", "Mon — Core & cardio blast", "Completed", "Done", 0),
          item("pl2", "Wed — Upper body strength", "Up next", "Scheduled", 1),
          item("pl3", "Fri — Tabata finisher", "Queued", "25 min", 2),
        ],
      },
    },
    profile: {
      displayName: "Your fitness",
      tagline: `${name} · ${mp.vibe}`,
      stats: [
        { label: "Workouts", value: "18" },
        { label: "Saved", value: "9" },
        { label: "Streak", value: "5d" },
      ],
      settings: [
        { label: "Goals & level", icon: "settings" },
        { label: "Reminders", icon: "bell" },
        { label: "Connected apps", icon: "heart" },
        { label: "Privacy", icon: "shield" },
        { label: "Help", icon: "help-circle" },
      ],
    },
  };
}

function productivitySeed(mp: MasterBuildPrompt): ExpoAppModelInput {
  const name = mp.appName;
  const f0 = mp.features[0] ?? "Tasks";
  const f1 = mp.features[1] ?? "Lists";
  return {
    category: "productivity",
    tabs: [
      { id: "home", label: "Home", icon: "home" },
      { id: "tasks", label: "Tasks", icon: "list" },
      { id: "library", label: "Library", icon: "book-open" },
      { id: "profile", label: "Profile", icon: "user" },
    ],
    onboarding: [
      {
        title: "Focus without friction",
        subtitle: `${name} keeps ${mp.audience.toLowerCase()} on track — capture, organize, done.`,
        imageUrl: onboardingImage(0),
      },
      {
        title: f0,
        subtitle: `Real task names and checkoffs — not empty shells.`,
        imageUrl: onboardingImage(1),
      },
      {
        title: f1,
        subtitle: "Save anything to your library and pick up where you left off.",
        imageUrl: onboardingImage(2),
      },
    ],
    home: {
      headline: "What's next?",
      subheadline: `Your ${mp.vibe.toLowerCase()} command center for ${mp.audience.toLowerCase()}.`,
      heroLabel: "Quick capture",
      heroSublabel: "Add a task in one tap",
      sections: [
        {
          title: "Due today",
          items: [
            item("t1", "Review project brief", "High priority · 15 min", "Today", 0, "Due"),
            item("t2", "Send follow-up email", "Waiting on reply", "2 pm", 1),
            item("t3", "Plan tomorrow", "5 min reset", "Evening", 2),
          ],
        },
        {
          title: "Recently saved",
          items: [
            item("r1", "Meeting notes — Q2 goals", "Saved yesterday", "Notes", 3),
            item("r2", "Reading list item", "Added from share", "Library", 4),
          ],
        },
      ],
    },
    tabScreens: {
      tasks: {
        title: "All tasks",
        subtitle: f0,
        items: [
          item("ta1", "Draft outline", "In progress · 45 min left", "Focus", 0),
          item("ta2", "Call vendor", "Scheduled 3pm", "Call", 1),
          item("ta3", "Weekly review", "Recurring · Friday", "Repeat", 2),
          item("ta4", "Inbox zero sweep", "15 min batch", "Quick", 3),
        ],
      },
      library: {
        title: "Library",
        subtitle: f1,
        items: [
          item("li1", "Saved templates", "3 items", "Templates", 5),
          item("li2", "Shared lists", "From team", "Shared", 0),
          item("li3", "Archived projects", "12 items", "Archive", 1),
        ],
      },
    },
    profile: {
      displayName: mp.appName,
      tagline: `${mp.vibe} · get things done`,
      stats: [
        { label: "Tasks done", value: "47" },
        { label: "Saved", value: "14" },
        { label: "Streak", value: "7d" },
      ],
      settings: [
        { label: "Account", icon: "user" },
        { label: "Notifications", icon: "bell" },
        { label: "Themes", icon: "settings" },
        { label: "Privacy", icon: "shield" },
        { label: "Help", icon: "help-circle" },
      ],
    },
  };
}

function petsSeed(mp: MasterBuildPrompt, interview: InterviewTurn[] = []): ExpoAppModelInput {
  const spec = inferProductSpec(mp, interview);
  const ctx = buildInterviewContext(mp, interview);
  const topology = inferAppTopology(mp, interview, ctx.appShapes);
  const f0 = mp.features[0] ?? "Browse open walks";
  const f1 = mp.features[1] ?? "Messages";
  const ownerPlan = topology.roleTabPlans.find((p) => p.roleId === "owner");
  const walkerPlan = topology.roleTabPlans.find((p) => p.roleId === "walker");
  const petItem = (
    id: string,
    title: string,
    subtitle: string,
    meta: string,
    imageIndex: number,
    extra?: Partial<ExpoListItem>
  ): ExpoListItem => ({
    id,
    title,
    subtitle,
    meta,
    imageUrl: petImage(imageIndex),
    detailType: "article",
    primaryAction: "Accept Walk",
    ...extra,
  });

  const tabs =
    topology.tabs.length > 0
      ? topology.tabs.map(({ id, label, icon }) => ({ id, label, icon }))
      : [
          { id: "home", label: "Home", icon: "home" as const },
          { id: "walks", label: "Walks", icon: "search" as const },
          { id: "messages", label: "Chat", icon: "bell" as const },
          { id: "profile", label: "You", icon: "user" as const },
        ];

  return {
    category: "pets",
    flow: flowFromSpec(spec),
    tabs,
    onboarding: [
      {
        title: "Post a walk in seconds",
        subtitle:
          "Enter breed, neighborhood, and budget — verified walkers apply within minutes.",
        imageUrl: petImage(0),
        demonstrates: mp.features[0] ?? "Post walk requests",
        ctaLabel: "See how it works",
        kind: "feature_demo",
      },
      {
        title: "Message before you book",
        subtitle: "Chat with walkers, check reviews, and confirm the details.",
        imageUrl: petImage(1),
        demonstrates: f1,
        ctaLabel: "Next",
        kind: "value_prop",
      },
      {
        title: "You're set",
        subtitle: `Trusted walks for ${mp.audience.toLowerCase()} — book with confidence.`,
        imageUrl: petImage(2),
        demonstrates: "Book & pay securely",
        ctaLabel: "Find a walker",
        kind: "completion",
      },
    ],
    home: {
      headline: ownerPlan?.homeHeadline ?? "Walks near you",
      subheadline:
        ownerPlan?.homeSubheadline ??
        `Connect dogs with walkers who love them — built for ${mp.audience.toLowerCase()}.`,
      heroLabel: ownerPlan?.heroLabel ?? "Post a walk request",
      heroSublabel:
        ownerPlan?.heroSublabel ?? "Breed, area & budget — walkers apply in minutes",
      sections: [
        {
          title: "Active walk",
          items: [
            petItem("w-map", "Sarah is walking Buddy", "Live map · ETA 4 min", "In progress", 0, {
              badge: "Live",
              tags: ["GPS tracking"],
              primaryAction: "View map",
              forRole: "owner",
            }),
          ],
        },
        {
          title: "Open nearby",
          items: [
            petItem("w1", "Your post · Buddy", "3 walkers applied", "0.4 mi", 1, {
              badge: "Applicants",
              tags: ["Buddy · L"],
              subtitle: "Maple St · 45 min · morning",
              primaryAction: "Review applicants",
              forRole: "owner",
            }),
          ],
        },
      ],
    },
    homeByRole: spec.hasDualRoles
      ? {
          owner: {
            headline: ownerPlan?.homeHeadline ?? "Walks near you",
            subheadline:
              ownerPlan?.homeSubheadline ?? "Post a request or track an active walk",
            heroLabel: ownerPlan?.heroLabel ?? "Post a walk request",
            heroSublabel:
              ownerPlan?.heroSublabel ?? "Breed, area & pay — walkers apply in minutes",
            sections: [
              {
                title: "Active walk",
                items: [
                  petItem("w-map", "Sarah is walking Buddy", "Live map · ETA 4 min", "In progress", 0, {
                    badge: "Live",
                    tags: ["GPS tracking"],
                    primaryAction: "View map",
                  }),
                ],
              },
              {
                title: "Applicants",
                items: [
                  petItem("w1", "Buddy · Golden Retriever", "3 walkers applied", "0.4 mi", 1, {
                    badge: "New",
                    tags: ["Buddy · L"],
                    subtitle: "Maple St · 45 min",
                    primaryAction: "Review applicants",
                  }),
                ],
              },
            ],
          },
          walker: {
            headline: walkerPlan?.homeHeadline ?? "Gigs near you",
            subheadline:
              walkerPlan?.homeSubheadline ?? "Browse open walks and manage active jobs",
            heroLabel: walkerPlan?.heroLabel ?? "Browse open walks",
            heroSublabel: walkerPlan?.heroSublabel ?? "Apply to requests in your area",
            sections: [
              {
                title: "Open near you",
                items: [
                  petItem("g1", "Buddy · Golden Retriever", "$22 · 45 min", "0.4 mi", 2, {
                    badge: "New",
                    tags: ["Buddy · L"],
                    subtitle: "Maple St · morning slot",
                    primaryAction: "Apply",
                  }),
                  petItem("g2", "Luna · Lab mix", "$18 · 30 min", "0.8 mi", 3, {
                    subtitle: "Oak Park · flexible",
                    primaryAction: "Apply",
                  }),
                ],
              },
              {
                title: "Active job",
                items: [
                  petItem("g-active", "Walking Max · Husky", "Timer 18:42 · Crissy Field", "In progress", 4, {
                    badge: "Active",
                    primaryAction: "Complete walk",
                  }),
                ],
              },
            ],
          },
        }
      : undefined,
    tabScreens: {
      walks: {
        title: "Walks",
        subtitle: "Requests & sessions",
        items: [
          petItem("b1", "Buddy · Golden Retriever", "Jun 14 · 9:00 AM · 1h walk", "Dolores Park", 0, {
            tags: ["Buddy · L"],
            quote: "Buddy loves fetch! Bring a ball if you can.",
            primaryAction: "Accept Walk",
            forRole: "walker",
          }),
          petItem("b2", "Luna & Mochi", "Jun 14 · 4:00 PM · 45m walk", "Alamo Square", 1, {
            tags: ["Luna · S", "Mochi · S"],
            quote: "Both are leash trained.",
            primaryAction: "Accept Walk",
            forRole: "walker",
          }),
          petItem("m1", "My post · Buddy", "3 applicants · Jun 14", "Pending", 2, {
            primaryAction: "Review",
            forRole: "owner",
          }),
          petItem("m2", "Saturday with Alex K.", "Accepted · 9:00 AM", "Confirmed", 3, {
            primaryAction: "Message",
            forRole: "walker",
          }),
        ],
      },
      messages: {
        title: "Chat",
        subtitle: f1,
        items: [
          petItem("c1", "Sarah M.", "Re: Buddy walk tomorrow", "2 new", 0, {
            primaryAction: "Reply",
          }),
          petItem("c2", "Jamie L.", "Thanks for walking Max!", "Yesterday", 1, {
            primaryAction: "Reply",
          }),
        ],
      },
    },
    profile: {
      displayName: mp.appName,
      tagline: `${mp.vibe} · trusted local walks`,
      stats: [
        { label: "Walks booked", value: "8" },
        { label: "Saved walkers", value: "3" },
        { label: "Rating", value: "4.9" },
      ],
      settings: [
        { label: "My dogs", icon: "user" },
        { label: "Payment", icon: "settings" },
        { label: "Notifications", icon: "bell" },
        { label: "Safety", icon: "shield" },
        { label: "Help & support", icon: "help-circle" },
      ],
    },
  };
}

function generalSeed(mp: MasterBuildPrompt, category: AppCategory): ExpoAppModelInput {
  const f0 = mp.features[0] ?? "Explore";
  const f1 = mp.features[1] ?? "Discover";
  const f2 = mp.features[2] ?? "Profile";
  const tab0 = f0.split(/\s+/).slice(0, 1).join("") || "Home";
  const tab1 = f1.split(/\s+/).slice(0, 1).join("") || "Discover";

  const makeItems = (prefix: string, base: string[]): ExpoListItem[] =>
    base.map((title, i) => ({
      id: `${prefix}${i}`,
      title,
      subtitle: `Crafted for ${mp.audience.toLowerCase()} — updated today`,
      meta: i === 0 ? "New" : `${12 + i * 3} min`,
      imageUrl: imageForCategory(category, i + 2),
      badge: i === 0 ? "Featured" : undefined,
    }));

  return {
    category,
    tabs: [
      { id: "home", label: "Home", icon: "home" },
      { id: "discover", label: tab0, icon: "search" },
      { id: "library", label: tab1, icon: "book-open" },
      { id: "profile", label: "You", icon: "user" },
    ],
    onboarding: [],
    home: {
      headline: `Good to see you`,
      subheadline: mp.description,
      heroLabel: `Start with ${f0.toLowerCase()}`,
      heroSublabel: "Your main action — one tap away",
      sections: [
        {
          title: "For you today",
          items: makeItems("h", [
            `${f0} — quick start`,
            `${f1} picks`,
            `Trending with ${mp.audience.split(" ")[0]}`,
          ]),
        },
        {
          title: "Continue",
          items: makeItems("c", [
            "Pick up where you left off",
            "Yesterday's highlight",
          ]),
        },
      ],
    },
    tabScreens: {
      discover: {
        title: f0,
        subtitle: mp.features[0],
        items: makeItems("d", [
          `${f0} starter pack`,
          `${f1} walkthrough`,
          `Advanced ${f0.toLowerCase()}`,
          `Community favorites`,
        ]),
      },
      library: {
        title: f1,
        subtitle: mp.features[1] ?? "Your collection",
        items: makeItems("l", [
          `Saved ${f1.toLowerCase()}`,
          `Shared with you`,
          `Archived items`,
        ]),
      },
    },
    profile: {
      displayName: mp.appName,
      tagline: `${mp.vibe} · ${mp.colors}`,
      stats: [
        { label: "Sessions", value: "12" },
        { label: "Saved", value: "8" },
        { label: "Streak", value: "3d" },
      ],
      settings: [
        { label: "Account", icon: "user" },
        { label: "Notifications", icon: "bell" },
        { label: "Preferences", icon: "settings" },
        { label: "Privacy", icon: "shield" },
        { label: "Help", icon: "help-circle" },
      ],
    },
  };
}

export function seedExpoAppContent(
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): ExpoAppModelInput {
  const category = inferCategory(mp, interview);
  if (category === "cooking") return cookingSeed(mp);
  if (category === "pets") return petsSeed(mp, interview);
  if (category === "fitness") return fitnessSeed(mp);
  if (category === "productivity") return productivitySeed(mp);
  return generalSeed(mp, category);
}
