import os from "node:os";

export type ShipPath = "mac" | "windows";

export function detectOS(): { platform: string; ship: ShipPath; canRunXcode: boolean } {
  const platform = os.platform();
  const isMac = platform === "darwin";
  return {
    platform,
    ship: isMac ? "mac" : "windows",
    canRunXcode: isMac,
  };
}
