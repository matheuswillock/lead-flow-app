/**
 * Dump manual do banco para um diretório local, com verificação de integridade.
 *
 * Uso:
 *   bun run db:backup -- /mnt/Armazenamento/Backup
 *
 * Cada execução cria a própria pasta com data e hora:
 *   /mnt/Armazenamento/Backup/2026-08-25_01-19/leadflow.dump
 *   /mnt/Armazenamento/Backup/2026-08-25_01-19/backup.json
 *
 * A conexão sai de `BACKUP_DATABASE_URL` (se definida) ou do `DIRECT_URL` do
 * `.env` na raiz do repositório.
 *
 * Por que não `source .env`: a linha do `DATABASE_URL` contém
 * `?pgbouncer=true&connection_limit=1&...`, e o `&` sem aspas faz o shell
 * interpretar como operador de background — o source aborta ali, a variável
 * fica vazia e o `pg_dump` cai no socket local. O erro que aparece fala de
 * `/var/run/postgresql`, que não tem relação nenhuma com a causa. Aqui o
 * arquivo é lido como texto, nunca executado.
 */

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";

const ENV_FILE = join(process.cwd(), ".env");
const CONNECTION_ENV_KEY = "DIRECT_URL";

function fail(message: string, ...details: string[]): never {
  console.error(`\n❌ ${message}`);
  for (const detail of details) {
    console.error(`   ${detail}`);
  }
  process.exit(1);
}

function run(command: string, args: string[], inheritStderr = false) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", inheritStderr ? "inherit" : "pipe"],
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout?.toString() ?? "",
    stderr: result.stderr?.toString() ?? "",
    spawnError: result.error,
  };
}

function readConnectionUrlFromEnvFile(): string | null {
  if (!existsSync(ENV_FILE)) return null;

  const line = readFileSync(ENV_FILE, "utf8")
    .split("\n")
    .find((entry) => entry.startsWith(`${CONNECTION_ENV_KEY}=`));

  if (!line) return null;

  return line.slice(CONNECTION_ENV_KEY.length + 1).trim().replace(/^["']|["']$/g, "");
}

function resolveConnectionUrl(): string {
  const url = process.env.BACKUP_DATABASE_URL?.trim() || readConnectionUrlFromEnvFile();

  if (!url) {
    fail(
      "Nenhuma string de conexão encontrada.",
      `Defina BACKUP_DATABASE_URL ou mantenha ${CONNECTION_ENV_KEY} em ${ENV_FILE}.`,
    );
  }

  // O transaction pooler (6543, pgbouncer) não suporta pg_dump: ele não
  // mantém a sessão entre statements, e o dump precisa de uma.
  if (url.includes(":6543") || url.includes("pgbouncer=true")) {
    fail(
      "A string de conexão aponta para o transaction pooler (6543) — pg_dump não funciona nele.",
      `Use ${CONNECTION_ENV_KEY} (session pooler, porta 5432) ou a conexão direta.`,
    );
  }

  return url;
}

function describeConnection(url: string): string {
  return url.replace(/^(\w+:\/\/)([^:@]+)(:[^@]*)?@/, "$1$2:***@");
}

function assertPgDumpAvailable(): string {
  const version = run("pg_dump", ["--version"]);

  if (version.spawnError || version.status !== 0) {
    fail(
      "pg_dump não encontrado no PATH.",
      "Instale o cliente do PostgreSQL 17+ ou rode via Docker: docker run --rm postgres:17 pg_dump ...",
    );
  }

  return version.stdout.trim();
}

const DUMP_FILE_NAME = "leadflow.dump";
const METADATA_FILE_NAME = "backup.json";

/** Pasta do backup: `<destino>/AAAA-MM-DD_HH-MM`, uma por execução. */
function buildRunDirectoryName(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const date = [now.getFullYear(), pad(now.getMonth() + 1), pad(now.getDate())].join("-");
  const time = [pad(now.getHours()), pad(now.getMinutes())].join("-");
  return `${date}_${time}`;
}

function resolveDestinationRoot(): string {
  const [rawDestination] = process.argv.slice(2);

  if (!rawDestination) {
    fail(
      "Informe a pasta de destino do backup.",
      "Exemplo: bun run db:backup -- /mnt/Armazenamento/Backup",
    );
  }

  return resolve(rawDestination);
}

/**
 * Criada só depois que conexão e `pg_dump` já passaram: uma validação que
 * falha não pode deixar pasta vazia para trás — ela bloquearia a nova
 * tentativa no mesmo minuto.
 */
function createRunDirectory(destinationRoot: string, now: Date): string {
  const runDirectory = join(destinationRoot, buildRunDirectoryName(now));

  if (existsSync(runDirectory)) {
    fail(
      `Já existe um backup desta mesma data e hora: ${runDirectory}`,
      "Aguarde um minuto ou remova a pasta antes de repetir.",
    );
  }

  try {
    mkdirSync(runDirectory, { recursive: true });
  } catch (error) {
    fail(
      `Não foi possível criar a pasta do backup: ${runDirectory}`,
      error instanceof Error ? error.message : String(error),
    );
  }

  return runDirectory;
}

/**
 * Um dump truncado passa no `ls -lh` e só falha na hora da restauração.
 * `pg_restore -l` lê o índice interno do arquivo — é o teste barato que
 * separa "existe" de "presta".
 */
function verifyDump(dumpPath: string): { tocEntries: number; tablesWithData: number } {
  const listing = run("pg_restore", ["-l", dumpPath]);

  if (listing.status !== 0) {
    fail(
      "O arquivo foi gravado mas pg_restore não conseguiu ler o índice — dump inválido ou truncado.",
      listing.stderr.trim() || "sem detalhe do pg_restore",
    );
  }

  const lines = listing.stdout.split("\n");
  const tocEntries = lines.filter((line) => /^\d/.test(line)).length;
  const tablesWithData = lines.filter((line) => line.includes("TABLE DATA")).length;

  if (tablesWithData === 0) {
    fail(
      "O dump não contém nenhuma tabela com dados.",
      "Verifique se a conexão aponta para o banco certo.",
    );
  }

  return { tocEntries, tablesWithData };
}

function computeSha256(filePath: string): Promise<string> {
  // Lê em stream: um dump de centenas de MB não precisa caber em memória.
  return new Promise((resolvePromise, rejectPromise) => {
    const hash = createHash("sha256");
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", rejectPromise)
      .on("end", () => resolvePromise(hash.digest("hex")));
  });
}

function formatSize(bytes: number): string {
  const megabytes = bytes / 1024 / 1024;
  if (megabytes < 1024) return `${megabytes.toFixed(1)} MB`;
  return `${(megabytes / 1024).toFixed(2)} GB`;
}

async function main(): Promise<void> {
  const destinationRoot = resolveDestinationRoot();
  const connectionUrl = resolveConnectionUrl();
  const pgDumpVersion = assertPgDumpAvailable();

  const startedAtDate = new Date();
  const runDirectory = createRunDirectory(destinationRoot, startedAtDate);
  const dumpPath = join(runDirectory, DUMP_FILE_NAME);

  console.info(`\n▶ ${pgDumpVersion}`);
  console.info(`▶ Origem:  ${describeConnection(connectionUrl)}`);
  console.info(`▶ Destino: ${dumpPath}\n`);

  const startedAt = Date.now();
  const dump = run(
    "pg_dump",
    [connectionUrl, "--format=custom", "--no-owner", "--no-acl", "--verbose", "--file", dumpPath],
    true,
  );

  if (dump.status !== 0) {
    fail(
      "pg_dump falhou.",
      "Se a mensagem acima citar incompatibilidade de versão, rode via Docker:",
      "docker run --rm --network host -v <destino>:/backup -e PGURL=\"$DIRECT_URL\" postgres:17 \\",
      '  sh -c \'pg_dump "$PGURL" -Fc --no-owner --no-acl -f /backup/leadflow.dump\'',
    );
  }

  const durationSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(0));
  const { tocEntries, tablesWithData } = verifyDump(dumpPath);
  const checksum = await computeSha256(dumpPath);
  const sizeBytes = statSync(dumpPath).size;

  writeFileSync(
    join(runDirectory, METADATA_FILE_NAME),
    `${JSON.stringify(
      {
        startedAt: startedAtDate.toISOString(),
        durationSeconds,
        fileName: DUMP_FILE_NAME,
        sizeBytes,
        checksumSha256: checksum,
        tocEntries,
        tablesWithData,
        pgDumpVersion,
      },
      null,
      2,
    )}\n`,
  );

  console.info("\n✅ Backup concluído e verificado:");
  console.info(`   pasta:    ${runDirectory}`);
  console.info(`   arquivo:  ${DUMP_FILE_NAME}`);
  console.info(`   tamanho:  ${formatSize(sizeBytes)} (${sizeBytes} bytes)`);
  console.info(`   duração:  ${durationSeconds}s`);
  console.info(`   conteúdo: ${tocEntries} entradas no índice, ${tablesWithData} tabelas com dados`);
  console.info(`   sha256:   ${checksum}`);
  console.info("\nRestaurar:");
  console.info(`   pg_restore --no-owner --no-acl -d <url-destino> ${dumpPath}`);
}

main().catch((error: unknown) => {
  fail("Erro inesperado no backup.", error instanceof Error ? error.message : String(error));
});
