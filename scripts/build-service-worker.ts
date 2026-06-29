import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

const entrypoint = join(process.cwd(), "lib/web-push/service-worker.ts");
const outfile = join(process.cwd(), "public/sw.js");

await mkdir(dirname(outfile), { recursive: true });

const result = await Bun.build({
  entrypoints: [entrypoint],
  outdir: dirname(outfile),
  naming: "sw.js",
  target: "browser",
  format: "iife",
  minify: process.env.NODE_ENV === "production",
});

if (!result.success) {
  console.error("[build:sw] Falha ao gerar service worker:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.info(`[build:sw] Gerado ${outfile}`);
