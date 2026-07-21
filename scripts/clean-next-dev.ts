/**
 * Removes `.next` and stops stray dev processes that lock Turbopack manifests on Windows.
 * Usage: bun run dev:clean
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = process.cwd();
const nextDir = join(projectRoot, ".next");

function info(msg: string) {
  console.info(`  ${msg}`);
}

function killWindowsPort(port: number) {
  const netstat = spawnSync("netstat", ["-ano"], { encoding: "utf8", shell: false });
  if (netstat.status !== 0) return;

  const pids = new Set<number>();
  for (const line of netstat.stdout.split("\n")) {
    if (!line.includes(`:${port}`) || !line.includes("LISTENING")) continue;
    const pid = Number.parseInt(line.trim().split(/\s+/).pop() ?? "", 10);
    if (Number.isFinite(pid) && pid > 0) pids.add(pid);
  }

  for (const pid of pids) {
    info(`Encerrando processo na porta ${port} (PID ${pid})…`);
    spawnSync("taskkill", ["/F", "/PID", String(pid)], { stdio: "ignore", shell: false });
  }
}

function removeNextDir() {
  info("Removendo .next…");
  rmSync(nextDir, { recursive: true, force: true });
  info("✓ Cache .next removido");
}

console.info("\n▶ Limpando cache de desenvolvimento do Next.js");

if (process.platform === "win32") {
  killWindowsPort(3000);
}

try {
  removeNextDir();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\n❌ Não foi possível remover .next: ${message}`);
  console.error("  Feche todos os terminais com `bun dev`, pare o Cursor de indexar, e tente de novo.");
  console.error("  Se persistir, exclua manualmente a pasta .next ou reinicie o PC.");
  process.exit(1);
}
