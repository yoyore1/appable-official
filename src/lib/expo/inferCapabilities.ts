import type { InterviewTurn, MasterBuildPrompt } from "@/lib/types";
import { inferCategory } from "@/lib/expoApp/inferCategory";

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

function interviewBlob(interview: InterviewTurn[]): string {
  return interview.map((t) => `${t.question} ${t.answer}`).join(" ").toLowerCase();
}

/** Read interview/master prompt and decide which APIs to wire in preview. */
export function inferAppCapabilities(
  mp: MasterBuildPrompt,
  interview: InterviewTurn[] = []
): AppCapabilityPlan {
  const category = inferCategory(mp, interview);
  const blob = [
    interviewBlob(interview),
    mp.description,
    mp.audience,
    mp.twist ?? "",
    ...mp.features,
    mp.appName,
  ]
    .join(" ")
    .toLowerCase();

  const caps = new Set<AppCapability>(["camera", "image_picker"]);

  const photoRecipe =
    category === "cooking" &&
    (/photo|pic|camera|snap|scan|roll|upload/.test(blob) &&
      /recipe|food|cook|meal|dish|ingredient/.test(blob)) ||
    (category === "cooking" && /take a pic/.test(blob));

  if (photoRecipe || (/scan|see|identify|ocr|read.*image|vision/.test(blob) && category === "cooking")) {
    caps.add("vision_ai");
  }
  if (/voice|speak|dictat|audio note|transcribe/.test(blob)) {
    caps.add("speech_to_text");
  }
  if (/read aloud|tts|talk back|audio recipe/.test(blob) && category === "cooking") {
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

  if (category === "pets") {
    return {
      capabilities: [...caps],
      heroAction: "Post a walk request",
      heroSublabel: "Breed, area & budget — walkers apply in minutes",
      visionPrompt:
        "Describe the dog breed and setting if visible. Suggest walk duration and what an owner should note for a walker.",
    };
  }

  if (category === "fitness") {
    return {
      capabilities: [...caps],
      heroAction: "Start today's workout",
      heroSublabel: "Quick session tailored to your level",
      visionPrompt: "Describe the exercise or form visible and suggest a short workout adjustment.",
    };
  }

  if (category === "shopping" && /shop|list|grocery|cart/.test(blob)) {
    return {
      capabilities: [...caps],
      heroAction: "Snap to add",
      heroSublabel: "Photo → item added to your list",
      visionPrompt:
        "List every product visible in this image for a shopping list with quantities where possible.",
    };
  }

  if (/shop|list|grocery|cart/.test(blob) && category === "cooking") {
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
    heroAction:
      category === "productivity"
        ? "Quick capture"
        : category === "education"
          ? "Continue learning"
          : "Get started",
    heroSublabel: mp.features[0] ?? "Open the core flow your users need first",
    visionPrompt: "Describe what you see in detail and suggest what the user could do next in this app.",
  };
}
