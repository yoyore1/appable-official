import type { IncomingMessage, ServerResponse } from "node:http";
import type { Duplex } from "node:stream";
import httpProxy from "http-proxy";
import {
  ensureWebDevServer,
  liveWebPreviewPath,
  parseLiveWebProjectId,
  webDevServerSnapshot,
} from "./webDevServer";
import { injectPreviewHtml } from "./previewBaseShim";
import { TAP_EDIT_BRIDGE } from "./tapEditBridge";

type TaggedReq = IncomingMessage & { __appableProjectId?: string };

const proxy = httpProxy.createProxyServer({
  ws: true,
  changeOrigin: true,
  xfwd: true,
});

proxy.on("error", (err, _req, res) => {
  if (res && "writeHead" in res && !res.headersSent) {
    res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("Live preview proxy error.");
  }
  console.error("[expo-live proxy]", err.message);
});

proxy.on("proxyRes", (proxyRes, req, res) => {
  const projectId = (req as TaggedReq).__appableProjectId;
  if (!projectId) {
    proxyRes.pipe(res);
    return;
  }

  const type = String(proxyRes.headers["content-type"] ?? "");
  if (!type.includes("text/html")) {
    proxyRes.pipe(res);
    return;
  }

  const chunks: Buffer[] = [];
  proxyRes.on("data", (c: Buffer) => chunks.push(c));
  proxyRes.on("end", () => {
    try {
      const html = injectPreviewHtml(
        Buffer.concat(chunks).toString("utf8"),
        projectId,
        TAP_EDIT_BRIDGE,
        "live"
      );
      const headers = { ...proxyRes.headers };
      delete headers["content-length"];
      delete headers["content-encoding"];
      if (!res.headersSent) {
        res.writeHead(proxyRes.statusCode ?? 200, headers);
      }
      res.end(html);
    } catch {
      if (!res.headersSent) {
        res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        res.end("Preview inject failed.");
      }
    }
  });
});

function metroTarget(port: number): string {
  return `http://127.0.0.1:${port}`;
}

function stripLivePrefix(url: string, projectId: string): string {
  const prefix = liveWebPreviewPath(projectId);
  if (!url.startsWith(prefix)) return url;
  const rest = url.slice(prefix.length) || "/";
  return rest.startsWith("/") ? rest : `/${rest}`;
}

function startingHtml(projectId: string): string {
  return `<!doctype html><meta charset=utf-8><body style="font-family:system-ui;padding:24px;color:#5C534F">Starting live preview for ${projectId}…</body>`;
}

function resolveProject(url: string | undefined): string | null {
  if (!url) return null;
  const pathOnly = url.split("?")[0] ?? url;
  return parseLiveWebProjectId(pathOnly);
}

/** HTTP reverse-proxy from /api/expo-live/{id}/… → Metro on the server. */
export async function handleExpoLiveHttp(
  req: IncomingMessage,
  res: ServerResponse
): Promise<boolean> {
  const projectId = resolveProject(req.url);
  if (!projectId) return false;

  const snap = webDevServerSnapshot(projectId);
  if (snap.phase !== "ready" || !snap.port) {
    ensureWebDevServer(projectId);
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    });
    res.end(startingHtml(projectId));
    return true;
  }

  const metroPath = stripLivePrefix(req.url ?? "/", projectId);
  req.url = metroPath;
  (req as TaggedReq).__appableProjectId = projectId;

  return new Promise((resolve) => {
    proxy.web(
      req,
      res,
      { target: metroTarget(snap.port!), selfHandleResponse: true },
      (err) => {
        if (err && !res.headersSent) {
          res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
          res.end("Live preview unavailable.");
        }
        resolve(true);
      }
    );
  });
}

/** WebSocket proxy for Metro HMR / live reload. */
export function handleExpoLiveUpgrade(
  req: IncomingMessage,
  socket: Duplex,
  head: Buffer
): void {
  const projectId = resolveProject(req.url);
  if (!projectId) {
    socket.destroy();
    return;
  }

  const snap = webDevServerSnapshot(projectId);
  if (snap.phase !== "ready" || !snap.port) {
    ensureWebDevServer(projectId);
    socket.destroy();
    return;
  }

  req.url = stripLivePrefix(req.url ?? "/", projectId);
  proxy.ws(req, socket, head, { target: metroTarget(snap.port) });
}
