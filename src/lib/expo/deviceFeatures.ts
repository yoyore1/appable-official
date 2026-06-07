import { premiumPolishPackages } from "@/lib/expo/premiumPolish";
import type { MasterBuildPrompt } from "@/lib/types";

/** Real Expo device modules wired into every base build (no API cost). */
export const BASE_DEVICE_FEATURES = [
  {
    id: "camera",
    package: "expo-camera",
    label: "Camera",
    triggers: /photo|camera|snap|scan|barcode|qr/i,
  },
  {
    id: "image-picker",
    package: "expo-image-picker",
    label: "Photo library",
    triggers: /photo|gallery|upload|pick image|library/i,
  },
  {
    id: "haptics",
    package: "expo-haptics",
    label: "Haptic feedback",
    triggers: /.*/i,
  },
  {
    id: "location",
    package: "expo-location",
    label: "GPS / near me",
    triggers: /near me|location|map|gps|local|delivery|ride/i,
  },
  {
    id: "notifications",
    package: "expo-notifications",
    label: "Push notifications",
    triggers: /remind|notify|alert|push|schedule|habit|streak/i,
  },
  {
    id: "image",
    package: "expo-image",
    label: "Fast cached images",
    triggers: /.*/i,
  },
  {
    id: "maps",
    package: "react-native-maps",
    label: "Maps",
    triggers: /map|near me|location|delivery|ride|explore/i,
  },
] as const;

export interface DeviceFeaturePlan {
  packages: string[];
  capabilities: string[];
}

/** Which real device features this app should wire up. */
export function deviceFeaturesFor(mp: MasterBuildPrompt): DeviceFeaturePlan {
  const blob = [
    mp.description,
    mp.audience,
    ...mp.features,
    mp.appName,
    mp.twist ?? "",
  ].join(" ");

  const packages = new Set<string>();
  const capabilities: string[] = [];

  for (const feat of BASE_DEVICE_FEATURES) {
    if (feat.triggers.test(blob) || feat.id === "haptics" || feat.id === "image") {
      packages.add(feat.package);
      capabilities.push(feat.label);
    }
  }

  for (const pkg of premiumPolishPackages()) {
    packages.add(pkg);
  }

  return { packages: [...packages], capabilities };
}
