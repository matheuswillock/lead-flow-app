import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function nowIso() {
  return new Date().toISOString();
}

function appendLog(logPath: string, line: string) {
  fs.appendFileSync(logPath, `[${nowIso()}] ${line}\n`, "utf-8");
}

/**
 * Extrai blocos completos de INSERT INTO "leads" ... ;,
 * mesmo quando existem comentários antes dos INSERTs.
 */
function extractInsertStatements(sql: string): string[] {
  const lines = sql.split(/\r?\n/);
  const stmts: string[] = [];

  let capturing = false;
  let buf: string[] = [];

  for (const line of lines) {
    if (!capturing) {
      if (line.startsWith('INSERT INTO "leads"')) {
        capturing = true;
        buf = [line];

        if (line.trim().endsWith(";")) {
          stmts.push(buf.join("\n"));
          capturing = false;
          buf = [];
        }
      }
      continue;
    }

    buf.push(line);

    if (line.trim().endsWith(";")) {
      stmts.push(buf.join("\n"));
      capturing = false;
      buf = [];
    }
  }

  return stmts;
}

async function main() {
  const root = process.cwd();
  const sqlPath = path.join(root, "scripts", "backfill-import-leads.sql");
  const metaPath = path.join(root, "scripts", "backfill-import-leads.meta.json");
  const logPath = path.join(root, "scripts", "backfill-import-leads.log");
  const errorsSqlPath = path.join(root, "scripts", "backfill-import-leads.errors.sql");

  if (!fs.existsSync(sqlPath)) {
    console.error(`SQL não encontrado: ${path.relative(root, sqlPath)} (rode o generator primeiro)`);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, "utf-8");
  const statements = extractInsertStatements(sql);

  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf-8")) : [];

  // limpa arquivo de erros para esta execução
  fs.writeFileSync(errorsSqlPath, `-- backfill-import-leads.errors.sql\n-- generatedAt: ${nowIso()}\n\n`, "utf-8");

  appendLog(logPath, `--- START backfill-import-leads (${statements.length} inserts) ---`);
  console.info(`[run] Iniciando execução: ${statements.length} inserts`);
  console.info(`[run] Log: ${path.relative(root, logPath)}`);
  console.info(`[run] Errors SQL: ${path.relative(root, errorsSqlPath)}`);

  if (statements.length === 0) {
    const msg = `Nenhum INSERT foi encontrado no arquivo SQL. Verifique scripts/backfill-import-leads.sql`;
    console.error(`[run] ${msg}`);
    appendLog(logPath, `ERROR: ${msg}`);
    process.exit(1);
  }

  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];

    const info = meta[i] as
      | { row?: number; id?: string; name?: string; email?: string; phone?: string; leadCode?: string }
      | undefined;

    const label = info
      ? `row=${info.row ?? i + 1} id="${info.id ?? ""}" name="${info.name ?? ""}" email="${info.email ?? ""}" phone="${info.phone ?? ""}" code="${info.leadCode ?? ""}"`
      : `idx=${i + 1}`;

    try {
      const affected = await prisma.$executeRawUnsafe(stmt);

      if (typeof affected === "number" && affected > 0) {
        inserted++;
        const msg = `OK inserted (${label})`;
        console.info(msg);
        appendLog(logPath, msg);
      } else {
        skipped++;
        const msg = `SKIP (conflict) (${label})`;
        console.info(msg);
        appendLog(logPath, msg);
      }
    } catch (err: any) {
      failed++;

      const code = err?.code ? String(err.code) : "";
      const message = err?.message ?? String(err);

      const msg = `ERROR (${label}) -> ${code ? `code=${code} ` : ""}${message}`;
      console.error(msg);
      appendLog(logPath, msg);

      // salva o INSERT que falhou para debug/reexecução
      fs.appendFileSync(errorsSqlPath, `-- ${label}\n${stmt}\n\n`, "utf-8");
    }
  }

  const summary = `--- DONE inserted=${inserted} skipped=${skipped} failed=${failed} ---`;
  console.info(summary);
  appendLog(logPath, summary);

  await prisma.$disconnect();

  if (failed > 0) process.exit(1);
}

main().catch(async (e) => {
  console.error("Backfill import failed (fatal):", e);
  await prisma.$disconnect();
  process.exit(1);
});
