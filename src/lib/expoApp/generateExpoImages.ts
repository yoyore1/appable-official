import { integrations } from "@/lib/config";
import { generateImage } from "@/lib/deepinfra";
import { setBuildProgress } from "@/lib/buildProgressStore";
import type { MasterBuildPrompt } from "@/lib/types";
import type { AppCategory } from "./inferCategory";
import type { ExpoAppModelInput, ExpoListItem } from "./types";

const MAX_IMAGES = 6;

function promptForItem(
  title: string,
  mp: MasterBuildPrompt,
  category: AppCategory
): string {
  const app = mp.appName;
  if (category === "pets") {
    return `Warm lifestyle photo for mobile app "${app}": ${title}. Happy dogs on a neighborhood walk, green park, natural daylight, no text overlay, photorealistic`;
  }
  if (category === "cooking") {
    return `Appetizing food photo for "${app}": ${title}. Kitchen lighting, no text, photorealistic`;
  }
  if (category === "fitness") {
    return `Fitness app photo for "${app}": ${title}. Gym or outdoor workout, energetic, no text`;
  }
  if (category === "social") {
    return `Friendly social app scene for "${app}": ${title}. People connecting, warm tones, no text`;
  }
  return `Mobile app lifestyle photo for "${app}": ${title}. Clean modern scene matching ${mp.audience}, no text overlay`;
}

async function fluxUrl(
  prompt: string,
  size: "1024x1024" | "512x512" = "512x512"
): Promise<string | null> {
  try {
    const imgs = await generateImage({ prompt, size });
    return imgs[0]?.dataUrl ?? null;
  } catch (err) {
    console.warn("[generateExpoImages]", err);
    return null;
  }
}

function collectItems(input: ExpoAppModelInput): ExpoListItem[] {
  const items: ExpoListItem[] = [];
  for (const sec of input.home.sections) {
    for (const it of sec.items) items.push(it);
  }
  for (const screen of Object.values(input.tabScreens)) {
    for (const it of screen.items) items.push(it);
  }
  return items.slice(0, MAX_IMAGES);
}

/** FLUX images for list cards — category-aware prompts. */
export async function generateExpoImages(
  input: ExpoAppModelInput,
  mp: MasterBuildPrompt,
  category: AppCategory,
  projectId?: string
): Promise<ExpoAppModelInput> {
  if (!integrations.imageGenModel) return input;

  const targets = collectItems(input);
  if (!targets.length) return input;

  const urlById = new Map<string, string>();
  let done = 0;

  for (const item of targets) {
    if (projectId) {
      const pct = 72 + Math.round((done / targets.length) * 14);
      setBuildProgress(projectId, {
        stepId: "images",
        label: `Creating photo ${done + 1} of ${targets.length}…`,
        index: 5,
        total: 8,
        percent: pct,
      });
    }

    const url = await fluxUrl(promptForItem(item.title, mp, category));
    if (url) urlById.set(item.id, url);
    done += 1;
  }

  if (!urlById.size) return input;

  const mapItem = (it: ExpoListItem) =>
    urlById.has(it.id) ? { ...it, imageUrl: urlById.get(it.id)! } : it;

  return {
    ...input,
    home: {
      ...input.home,
      sections: input.home.sections.map((sec) => ({
        ...sec,
        items: sec.items.map(mapItem),
      })),
    },
    tabScreens: Object.fromEntries(
      Object.entries(input.tabScreens).map(([k, screen]) => [
        k,
        { ...screen, items: screen.items.map(mapItem) },
      ])
    ),
  };
}
