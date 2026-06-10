/**
 * Custom Appable server — required for live Expo previews.
 *
 * Metro runs on the server's localhost. Remote browsers load
 * /api/expo-live/{projectId}/ on this host; we proxy HTTP + WebSocket to Metro.
 * `next dev` / `next start` alone cannot do that WebSocket proxy.
 */
import { createServer } from "node:http";
import { parse } from "node:url";
import next from "next";
import {
  handleExpoLiveHttp,
  handleExpoLiveUpgrade,
} from "./src/lib/codeAgent/webDevProxy";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME ?? "0.0.0.0";
const port = parseInt(process.env.PORT ?? "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    try {
      const parsed = parse(req.url ?? "", true);
      if (parsed.pathname?.startsWith("/api/expo-live/")) {
        const handled = await handleExpoLiveHttp(req, res);
        if (handled) return;
      }
      await handle(req, res, parsed);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end("internal server error");
      }
    }
  });

  server.on("upgrade", (req, socket, head) => {
    if (req.url?.startsWith("/api/expo-live/")) {
      handleExpoLiveUpgrade(req, socket, head);
      return;
    }
    socket.destroy();
  });

  server.listen(port, hostname, () => {
    console.log(
      `> Appable ready on http://${hostname === "0.0.0.0" ? "localhost" : hostname}:${port}`
    );
    if (hostname === "0.0.0.0") {
      console.log("> Live previews proxy through /api/expo-live/{projectId}/");
    }
  });
});
