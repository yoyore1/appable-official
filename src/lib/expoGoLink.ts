/** Client-safe — build exp:// URL for Expo Go (no Node fs). */
export function buildExpoGoDeepLink(
  devServerUrl: string,
  projectId: string,
  previewToken: string
): string {
  const base = devServerUrl.replace(/\/$/, "");
  const normalized = base.includes("://") ? base : `exp://${base}`;
  try {
    const url = new URL(normalized);
    url.searchParams.set("projectId", projectId);
    url.searchParams.set("token", previewToken);
    return url.toString();
  } catch {
    return `${normalized}?projectId=${encodeURIComponent(projectId)}&token=${encodeURIComponent(previewToken)}`;
  }
}
