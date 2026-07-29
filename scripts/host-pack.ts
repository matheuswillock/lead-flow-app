#!/usr/bin/env bun
/**
 * Gera artefato host-pack.tar.gz + manifesto para sync via painel Ops.
 * Uso: bun run host:pack
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, cpSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(import.meta.dir, "..");
const OUT_DIR = resolve(ROOT, "deploy/hostinger/host-pack/dist");
const STAGE = resolve(OUT_DIR, "stage");
const version =
  process.env.HOST_PACK_VERSION?.trim() ||
  spawnSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).stdout.trim() ||
  `local-${Date.now()}`;

rmSync(STAGE, { recursive: true, force: true });
mkdirSync(STAGE, { recursive: true });

const includes = [
  ["n8n/workflows", "n8n/workflows"],
  ["deploy/hostinger/studio-bot-ops", "deploy/hostinger/studio-bot-ops"],
  ["deploy/hostinger/backup-supabase.sh", "deploy/hostinger/backup-supabase.sh"],
  ["deploy/hostinger/.env.ops.example", "deploy/hostinger/.env.ops.example"],
  ["deploy/hostinger/Caddyfile", "Caddyfile"],
];

for (const [from, to] of includes) {
  const src = resolve(ROOT, from);
  const dest = resolve(STAGE, to);
  if (!existsSync(src)) {
    console.warn(`[host:pack] skip missing ${from}`);
    continue;
  }
  cpSync(src, dest, { recursive: true });
}

// Compose na VPS referencia ./deploy/hostinger (layout /opt/lead-flow-bot).
writeFileSync(resolve(STAGE, "docker-compose.vps.yml"), readFileSync(resolve(ROOT, "docker-compose.vps.yml"), "utf8"));

writeFileSync(resolve(STAGE, ".host-version"), `${version}\n`);

const tarPath = resolve(OUT_DIR, `host-pack-${version}.tar.gz`);
const tar = spawnSync(
  "tar",
  ["-czf", tarPath, "-C", STAGE, "."],
  { encoding: "utf8" }
);
if (tar.status !== 0) {
  console.error(tar.stderr || tar.stdout);
  process.exit(1);
}

const buf = readFileSync(tarPath);
const sha256 = createHash("sha256").update(buf).digest("hex");
const manifest = {
  version,
  sha256,
  file: `host-pack-${version}.tar.gz`,
  createdAt: new Date().toISOString(),
  bytes: buf.length,
};
writeFileSync(resolve(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(resolve(OUT_DIR, "pack.base64"), buf.toString("base64"));

console.info(`[host:pack] version=${version}`);
console.info(`[host:pack] sha256=${sha256}`);
console.info(`[host:pack] out=${tarPath}`);
