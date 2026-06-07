import type { MasterBuildPrompt } from "@/lib/types";

export type AppCapability =
  | "camera"
  | "image_picker"
  | "vision_ai"
  | "speech_to_text"
  | "text_to_speech"
  | "image_generation";

export interface AppCapabilityPlan {
  capabilities: AppCapability[];
  /** Primary live demo action label in preview. */
  heroAction: string;
  heroSublabel: string;
  visionPrompt: string;
}

/** Read interview/master prompt and decide which APIs to wire in preview. */
export function inferAppCapabilities(mp: MasterBuildPrompt): AppCapabilityPlan {
  const blob = [
    mp.description,
    mp.audience,
    mp.twist ?? "",
    ...mp.features,
    mp.appName,
  ].join(" ").toLowerCase();

  const caps = new Set<AppCapability>(["camera", "image_picker"]);

  const photoRecipe =
    (/photo|pic|camera|snap|scan|roll|upload/.test(blob) &&
      /recipe|food|cook|meal|dish|ingredient/.test(blob)) ||
    /take a pic/.test(blob);

  if (photoRecipe || /scan|see|identify|ocr|read.*image|vision/.test(blob)) {
    caps.add("vision_ai");
  }
  if (/voice|speak|dictat|audio note|transcribe/.test(blob)) {
    caps.add("speech_to_text");
  }
  if (/read aloud|tts|talk back|audio recipe/.test(blob)) {
    caps.add("text_to_speech");
  }
  if (/generate image|avatar|ai art/.test(blob)) {
    caps.add("image_generation");
  }

  if (photoRecipe) {
    return {
      capabilities: [...caps],
      heroAction: "Scan a dish",
      heroSublabel: "Camera or photo library → real recipe",
      visionPrompt:
        "This is a photo of food. Identify the dish, list main ingredients, and write a detailed home-cook recipe with steps. Be specific and practical.",
    };
  }

  if (/shop|list|grocery|cart/.test(blob)) {
    return {
      capabilities: [...caps],
      heroAction: "Snap ingredients",
      heroSublabel: "We'll build your shopping list",
      visionPrompt:
        "List every food item visible in this image as a grocery shopping list with quantities where possible.",
    };
  }

  return {
    capabilities: [...caps],
    heroAction: "Open camera",
    heroSublabel: "Take or upload a photo to try it",
    visionPrompt: "Describe what you see in detail and suggest what the user could do next in this app.",
  };
}
