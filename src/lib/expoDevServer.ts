import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { readExpoDevServerUrl } from "@/lib/expoGoUrl";

export type ExpoDevStatus = "idle" | "starting" | "ready" | "error";

const EXPO_SHELL = path.join(process.cwd(), "expo-shell");
const OUT_FILE = path.join(process.cwd(), ".data", "expo-dev-url.json");

type GlobalExpo = typeof globalThis & {
  __appableExpoProcess?: ChildProcess;
  __appableExpoStatus?: ExpoDevStatus;
  __appableExpoError?: string;
  __appableExpoStarting?: Promise<void>;
};

const g = globalThis as GlobalExpo;

function lanIpv4(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      const family = net.family;
      if (String(family) === "IPv4" && !net.internal) return net.address;
    }
  }
  return "localhost";
}

function captureExpUrl(chunk: Buffer | string) {
  const text = chunk.toString();
  const match = text.match(/exp:\/\/[^\s"'<>]+/);
  if (!match) return;
  const url = match[0].replace(/[.,;]+$/, "");
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(
    OUT_FILE,
    JSON.stringify({ url, updatedAt: new Date().toISOString() }, null, 2)
  );
  g.__appableExpoStatus = "ready";
}

function npmInstall(cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["install", "--prefer-offline", "--no-audit"], {
      cwd,
      shell: true,
      stdio: "ignore",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error("Could not install Expo shell"))
    );
  });
}

function spawnExpo(apiBase: string): void {
  const child = spawn("npx", ["expo", "start", "--tunnel"], {
    cwd: EXPO_SHELL,
    env: {
      ...process.env,
      EXPO_PUBLIC_APPABLE_API_URL: apiBase,
      CI: "1",
    },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  g.__appableExpoProcess = child;
  child.stdout?.on("data", captureExpUrl);
  child.stderr?.on("data", captureExpUrl);
  child.on("error", (err) => {
    g.__appableExpoStatus = "error";
    g.__appableExpoError = err.message;
  });
  child.on("exit", (code) => {
    if (g.__appableExpoStatus !== "ready") {
      g.__appableExpoStatus = "error";
      g.__appableExpoError = `Expo stopped (${code ?? "unknown"})`;
    }
    g.__appableExpoProcess = undefined;
  });
}

/** Start Metro + tunnel in the background — normies never touch a terminal. */
export async function ensureExpoDevServer(apiBase?: string): Promise<{
  status: ExpoDevStatus;
  url: string | null;
  error?: string;
}> {
  const existing = readExpoDevServerUrl();
  if (existing) {
    g.__appableExpoStatus = "ready";
    return { status: "ready", url: existing };
  }

  if (g.__appableExpoStatus === "starting" && g.__appableExpoStarting) {
    await g.__appableExpoStarting.catch(() => undefined);
    return expoDevServerSnapshot();
  }

  if (g.__appableExpoProcess && !g.__appableExpoProcess.killed) {
    return expoDevServerSnapshot();
  }

  const base = apiBase ?? `http://${lanIpv4()}:3000`;

  g.__appableExpoStatus = "starting";
  g.__appableExpoError = undefined;

  g.__appableExpoStarting = (async () => {
    if (!fs.existsSync(path.join(EXPO_SHELL, "node_modules", "expo"))) {
      await npmInstall(EXPO_SHELL);
    }
    spawnExpo(base);
  })();

  try {
    await g.__appableExpoStarting;
  } catch (err) {
    g.__appableExpoStatus = "error";
    g.__appableExpoError =
      err instanceof Error ? err.message : "Could not start phone preview";
  } finally {
    g.__appableExpoStarting = undefined;
  }

  return expoDevServerSnapshot();
}

export function expoDevServerSnapshot(): {
  status: ExpoDevStatus;
  url: string | null;
  error?: string;
} {
  const url = readExpoDevServerUrl();
  if (url) {
    g.__appableExpoStatus = "ready";
    return { status: "ready", url };
  }
  const status = g.__appableExpoStatus ?? "idle";
  return { status, url: null, error: g.__appableExpoError };
}
