import { networkInterfaces } from "os";
import { appUrl } from "@/lib/config";

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isIpv4(family: string | number): boolean {
  return family === "IPv4" || family === 4;
}

/** First non-internal IPv4 on the LAN — for phone QR codes during local dev. */
export function lanIpv4(): string | null {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      if (isIpv4(net.family) && !net.internal) return net.address;
    }
  }
  return null;
}

/** Origin phones can open — swaps localhost for LAN IP when needed. */
export function previewOriginFromRequest(
  requestHost?: string | null,
  requestProto?: string | null
): string {
  const configured = appUrl.replace(/\/$/, "");
  let configuredUrl: URL;
  try {
    configuredUrl = new URL(configured);
  } catch {
    return configured;
  }

  const host = requestHost?.split(",")[0]?.trim();
  if (host) {
    const hostname = host.split(":")[0] ?? "";
    if (!isLocalHost(hostname)) {
      const proto = requestProto?.split(",")[0]?.trim() || "http";
      return `${proto}://${host}`;
    }
  }

  if (!isLocalHost(configuredUrl.hostname)) return configured;

  const ip = lanIpv4();
  if (ip) {
    const port = configuredUrl.port || "3000";
    return `http://${ip}:${port}`;
  }

  return configured;
}

export function phonePreviewPath(projectId: string): string {
  return `/project/${projectId}/expo/preview`;
}

export function phonePreviewUrl(
  projectId: string,
  requestHost?: string | null,
  requestProto?: string | null
): string {
  return `${previewOriginFromRequest(requestHost, requestProto)}${phonePreviewPath(projectId)}`;
}

export function previewUrlIsLocalOnly(url: string): boolean {
  try {
    return isLocalHost(new URL(url).hostname);
  } catch {
    return true;
  }
}
