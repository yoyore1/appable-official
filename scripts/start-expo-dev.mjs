#!/usr/bin/env node
/**
 * Starts the shared Expo shell with tunnel and writes exp:// URL for the web QR.
 * Run alongside `npm run dev` in a second terminal.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".data");
const outFile = path.join(dataDir, "expo-dev-url.json");

function lanIpv4() {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] ?? []) {
      const family = net.family;
      if ((family === "IPv4" || family === 4) && !net.internal) return net.address;
    }
  }
  return "localhost";
}

const apiBase = process.env.EXPO_PUBLIC_APPABLE_API_URL ?? `http://${lanIpv4()}:3000`;

fs.mkdirSync(dataDir, { recursive: true });

function captureExpUrl(chunk) {
  const text = chunk.toString();
  const match = text.match(/exp:\/\/[^\s"'<>]+/);
  if (!match) return;
  const url = match[0].replace(/[.,;]+$/, "");
  fs.writeFileSync(
    outFile,
    JSON.stringify({ url, updatedAt: new Date().toISOString() }, null, 2)
  );
  console.log(`\n[appable] Expo Go URL saved for web QR: ${url}\n`);
}

console.log(`[appable] Expo shell API base: ${apiBase}`);
console.log("[appable] Starting Expo with tunnel — first run may take a minute…\n");

const child = spawn("npx", ["expo", "start", "--tunnel"], {
  cwd: path.join(root, "expo-shell"),
  env: { ...process.env, EXPO_PUBLIC_APPABLE_API_URL: apiBase },
  shell: true,
  stdio: ["inherit", "pipe", "pipe"],
});

child.stdout.on("data", (d) => {
  process.stdout.write(d);
  captureExpUrl(d);
});
child.stderr.on("data", (d) => {
  process.stderr.write(d);
  captureExpUrl(d);
});

child.on("exit", (code) => process.exit(code ?? 0));
