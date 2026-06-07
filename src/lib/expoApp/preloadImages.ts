import { imageForCategory } from "./images";
import type { ExpoAppModel } from "./types";

export function collectModelImageUrls(model: ExpoAppModel): string[] {
  const urls = new Set<string>();
  for (const slide of model.onboarding) {
    if (slide.imageUrl) urls.add(slide.imageUrl);
  }
  for (const sec of model.home.sections) {
    for (const it of sec.items) {
      if (it.imageUrl) urls.add(it.imageUrl);
    }
  }
  for (const screen of Object.values(model.tabScreens)) {
    for (const it of screen.items) {
      if (it.imageUrl) urls.add(it.imageUrl);
    }
  }
  return [...urls];
}

function loadOne(url: string, timeoutMs: number): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(true);
  if (!url || url.startsWith("data:") || url.startsWith("blob:")) return Promise.resolve(true);

  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      resolve(false);
    }, timeoutMs);

    img.onload = () => {
      clearTimeout(timer);
      resolve(true);
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve(false);
    };
    img.src = url;
  });
}

/** Swap broken URLs for curated fallbacks — never show grey broken img icons. */
export function applyImageFallbacks(
  model: ExpoAppModel,
  urlMap: Record<string, string>
): ExpoAppModel {
  const pick = (url: string) => urlMap[url] ?? url;
  return {
    ...model,
    onboarding: model.onboarding.map((s) => ({
      ...s,
      imageUrl: pick(s.imageUrl),
    })),
    home: {
      ...model.home,
      sections: model.home.sections.map((sec) => ({
        ...sec,
        items: sec.items.map((it) => ({
          ...it,
          imageUrl: pick(it.imageUrl),
        })),
      })),
    },
    tabScreens: Object.fromEntries(
      Object.entries(model.tabScreens).map(([k, screen]) => [
        k,
        {
          ...screen,
          items: screen.items.map((it) => ({
            ...it,
            imageUrl: pick(it.imageUrl),
          })),
        },
      ])
    ),
  };
}

/**
 * Preload every card/hero image. Failed URLs get curated fallbacks, then those load too.
 * Resolves only when the preview can render with real pixels.
 */
export async function preloadImages(
  urls: string[],
  category = "general",
  timeoutMs = 10_000
): Promise<Record<string, string>> {
  if (typeof window === "undefined" || urls.length === 0) return {};

  const urlMap: Record<string, string> = {};
  let fallbackIdx = 0;

  await Promise.all(
    urls.map(async (url) => {
      const ok = await loadOne(url, timeoutMs);
      if (ok) {
        urlMap[url] = url;
        return;
      }
      let fallback = imageForCategory(category, fallbackIdx++);
      for (let attempt = 0; attempt < 4; attempt++) {
        const fbOk = await loadOne(fallback, timeoutMs);
        if (fbOk) {
          urlMap[url] = fallback;
          return;
        }
        fallback = imageForCategory(category, fallbackIdx++);
      }
      urlMap[url] = fallback;
      await loadOne(fallback, timeoutMs);
    })
  );

  const resolved = [...new Set(Object.values(urlMap))];
  await Promise.all(resolved.map((u) => loadOne(u, timeoutMs)));

  return urlMap;
}
