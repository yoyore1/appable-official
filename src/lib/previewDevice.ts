/** Client-side device hints for the in-browser Expo preview (not the native app). */

export type PreviewDeviceKind = "mobile" | "desktop";

export function previewDeviceKind(): PreviewDeviceKind {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent ?? "";
  if (/android|iphone|ipad|ipod|mobile/i.test(ua)) return "mobile";
  const coarse =
    typeof window !== "undefined" &&
    window.matchMedia?.("(pointer: coarse)").matches;
  if (coarse && navigator.maxTouchPoints > 0) return "mobile";
  return "desktop";
}

export function previewSupportsWebcam(): boolean {
  return (
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function previewSupportsMic(): boolean {
  return previewSupportsWebcam();
}
