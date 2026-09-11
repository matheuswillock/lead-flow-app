#!/usr/bin/env bun
/**
 * Inicia o túnel ngrok do app, encerrando instâncias anteriores.
 * Uso: bun scripts/ngrok-start.ts lead-flow
 *
 * No plano ngrok free há um único domínio reservado — só um túnel por vez.
 */

import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dirname, "..");
const tunnel = process.argv[2];

if (tunnel !== "lead-flow") {
  console.error("Uso: bun scripts/ngrok-start.ts lead-flow");
  process.exit(1);
}

function stopExistingNgrok(): void {
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/F", "/IM", "ngrok.exe"], { stdio: "ignore" });
    return;
  }

  spawnSync("pkill", ["-f", "ngrok start"], { stdio: "ignore" });
}

function resolveUserConfig(): string {
  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (!localAppData) {
      throw new Error("LOCALAPPDATA não definido — não foi possível localizar ngrok.yml do usuário.");
    }
    return resolve(localAppData, "ngrok", "ngrok.yml");
  }

  const home = process.env.HOME ?? process.env.USERPROFILE;
  if (!home) {
    throw new Error("HOME não definido — não foi possível localizar ngrok.yml do usuário.");
  }

  return resolve(home, ".config", "ngrok", "ngrok.yml");
}

function startTunnel(): void {
  const userConfig = resolveUserConfig();
  const projectConfig = resolve(ROOT, "ngrok.yml");

  const child = spawn(
    "ngrok",
    ["start", tunnel, "--config", projectConfig, "--config", userConfig],
    { stdio: "inherit", shell: process.platform === "win32" }
  );

  child.on("exit", (code) => process.exit(code ?? 0));
}

stopExistingNgrok();
console.info(`[ngrok] Encerrando túneis anteriores e iniciando: ${tunnel}`);
console.info("[ngrok] Domínio: https://nonzero-rodrick-mentholated.ngrok-free.dev → :3000");

startTunnel();
