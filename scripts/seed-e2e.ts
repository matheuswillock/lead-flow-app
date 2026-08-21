/**
 * Seed do Postgres local para Playwright E2E.
 *
 * NÃO chama prisma/seed-app.ts (Auth remoto). Aqui só: probe do catálogo
 * storage/auth (aplica stub só se faltar), migrations + catálogo backoffice +
 * Profile/Team master determinístico.
 *
 * Como rodar:
 *   bun run db:seed:e2e
 *
 * Pré-requisito: Postgres local em :55322 (`bun run local:up`).
 * Carrega `.env.test` se existir; senão `.env` (só para placeholders não-DB).
 * DATABASE_URL/DIRECT_URL do ambiente são ignorados — o seed sempre grava
 * em LOCAL_DB_URL (`127.0.0.1:55322`), como `db:seed:local`.
 */

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient, type UserFunction } from "@prisma/client";
import { LOCAL_DB_ADMIN_URL, LOCAL_DB_URL } from "./lib/local-stack";
import {
  parseStorageAuthCatalog,
  STORAGE_AUTH_CATALOG_PROBE_SQL,
  type StorageAuthCatalog,
} from "./lib/e2e-storage-auth-catalog";
import {
  E2E_MASTER_EMAIL,
  E2E_MASTER_FULL_NAME,
  E2E_MASTER_SUPABASE_ID,
  E2E_TEAM_NAME,
} from "../lib/e2e/constants";

const MASTER_FUNCTIONS: UserFunction[] = ["SDR", "CLOSER"];

if (existsSync(join(process.cwd(), ".env.test"))) {
  loadEnv({ path: ".env.test" });
} else {
  loadEnv();
}

function info(msg: string) {
  console.info(`  ${msg}`);
}

function step(label: string) {
  console.info(`\n▶ ${label}`);
}

function fail(msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function run(
  cmd: string,
  cmdArgs: string[],
  opts: { env?: NodeJS.ProcessEnv } = {},
): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(cmd, cmdArgs, {
    stdio: "inherit",
    shell: false,
    encoding: "utf8",
    env: { ...process.env, ...opts.env },
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function dbUrlsToTry(dbUrl: string): string[] {
  const urls = [dbUrl];
  if (dbUrl !== LOCAL_DB_ADMIN_URL) {
    urls.push(LOCAL_DB_ADMIN_URL);
  }
  return urls;
}

function stubUrlsToTry(dbUrl: string): string[] {
  const urls = [LOCAL_DB_ADMIN_URL];
  if (dbUrl !== LOCAL_DB_ADMIN_URL) {
    urls.push(dbUrl);
  }
  return urls;
}

function probeStorageAuthCatalog(dbUrl: string): StorageAuthCatalog {
  let lastDetail = "";
  for (const url of dbUrlsToTry(dbUrl)) {
    const result = spawnSync(
      "psql",
      [url, "-v", "ON_ERROR_STOP=1", "-t", "-A", "-F", "|", "-c", STORAGE_AUTH_CATALOG_PROBE_SQL],
      { encoding: "utf8", shell: false },
    );
    if (result.error) {
      lastDetail = result.error.message;
      continue;
    }
    if ((result.status ?? 1) !== 0) {
      lastDetail = (result.stderr || `psql exit ${result.status ?? 1}`).trim();
      continue;
    }
    const catalog = parseStorageAuthCatalog(result.stdout ?? "");
    if (catalog) return catalog;
    lastDetail = `stdout inesperado: ${JSON.stringify(result.stdout)}`;
  }

  fail(
    `Não foi possível inspecionar o catálogo storage/auth (${lastDetail}). ` +
      "Confira se o Postgres :55322 está no ar e se `psql` está instalado.",
  );
}

function logStorageAuthCatalog(catalog: StorageAuthCatalog) {
  info(`storage.buckets: ${catalog.storageBuckets ? "present" : "missing"}`);
  info(`storage.objects: ${catalog.storageObjects ? "present" : "missing"}`);
  info(`auth.identities: ${catalog.authIdentities ? "present" : "missing"}`);
  info(
    `auth.users.email_change_token_current: ${
      catalog.authEmailChangeTokenCurrent ? "present" : "missing"
    }`,
  );
}

function applySqlStub(dbUrl: string, relativePath: string, okMessage: string) {
  const stubFile = join(process.cwd(), relativePath);
  if (!existsSync(stubFile)) {
    fail(`Arquivo não encontrado: ${stubFile}`);
  }

  let lastDetail = "";
  for (const url of stubUrlsToTry(dbUrl)) {
    const result = spawnSync("psql", [url, "-v", "ON_ERROR_STOP=1", "-f", stubFile], {
      stdio: "inherit",
      shell: false,
      encoding: "utf8",
    });
    if (result.error) {
      lastDetail = result.error.message;
      continue;
    }
    if ((result.status ?? 1) === 0) {
      info(`✓ ${okMessage}`);
      return;
    }
    lastDetail = `psql exit ${result.status ?? 1}`;
  }

  fail(
    `Stub ${relativePath} falhou (${lastDetail}). ` +
      "Confira se o Postgres :55322 está no ar e se `psql` está instalado. " +
      "DDL em auth.* / storage.* usa supabase_admin quando o role postgres não tem permissão.",
  );
}

function applyLocalStubs(dbUrl: string) {
  step("Probing storage/auth catalog");
  let catalog = probeStorageAuthCatalog(dbUrl);
  logStorageAuthCatalog(catalog);

  if (catalog.storageBuckets && catalog.storageObjects) {
    info("✓ storage.buckets e storage.objects já existem — stub não aplicado");
  } else {
    step("Applying local storage stub (buckets + objects)");
    applySqlStub(
      dbUrl,
      join("docker", "local", "zz-init-storage-stub-schema.sql"),
      "Schema storage local compatível com migrations de bucket",
    );
    catalog = probeStorageAuthCatalog(dbUrl);
    if (!catalog.storageBuckets || !catalog.storageObjects) {
      logStorageAuthCatalog(catalog);
      fail("Stub de storage rodou, mas storage.buckets/storage.objects continuam ausentes.");
    }
  }

  if (catalog.authIdentities && catalog.authEmailChangeTokenCurrent) {
    info("✓ auth.identities e email_change_token_current já existem — stub não aplicado");
    return;
  }

  step("Applying local auth stub (GoTrue columns + identities)");
  applySqlStub(
    dbUrl,
    join("docker", "local", "zz-init-auth-stub-schema.sql"),
    "Schema auth local compatível com migrations históricas",
  );
  catalog = probeStorageAuthCatalog(dbUrl);
  if (!catalog.authIdentities || !catalog.authEmailChangeTokenCurrent) {
    logStorageAuthCatalog(catalog);
    fail("Stub de auth rodou, mas auth.identities/email_change_token_current continuam ausentes.");
  }
}

function applyLocalMigrations(dbUrl: string) {
  applyLocalStubs(dbUrl);
  step("Applying local migrations");
  const result = run("bun", ["run", "db:migrate:apply:local"]);
  if (result.status !== 0) {
    fail(
      "`db:migrate:apply:local` falhou. Veja o SQL acima. Stubs: `docker/local/zz-init-storage-stub-schema.sql` e `docker/local/zz-init-auth-stub-schema.sql`.",
    );
  }
  info("✓ Migrations aplicadas");
}

function seedBackofficeCatalog(dbUrl: string) {
  step("Seeding backoffice catalog (Prisma)");
  const result = run("bun", ["run", "db:seed:backoffice-products"], {
    env: {
      ...process.env,
      DATABASE_URL: dbUrl,
      DIRECT_URL: dbUrl,
    },
  });
  if (result.status !== 0) {
    fail("`db:seed:backoffice-products` falhou.");
  }
  info("✓ Catálogo backoffice sincronizado");
}

async function upsertE2eMaster(prisma: PrismaClient) {
  step("Upserting E2E master Profile + Team");

  const existingBySupabase = await prisma.profile.findUnique({
    where: { supabaseId: E2E_MASTER_SUPABASE_ID },
  });
  const existingByEmail = await prisma.profile.findUnique({
    where: { email: E2E_MASTER_EMAIL },
  });

  const profileData = {
    supabaseId: E2E_MASTER_SUPABASE_ID,
    email: E2E_MASTER_EMAIL,
    fullName: E2E_MASTER_FULL_NAME,
    isMaster: true,
    role: "manager" as const,
    hasPermanentSubscription: true,
    hasUnlimitedUsers: true,
    subscriptionStatus: "active" as const,
    functions: MASTER_FUNCTIONS,
  };

  const existing = existingBySupabase ?? existingByEmail;
  const profile = existing
    ? await prisma.profile.update({
        where: { id: existing.id },
        data: profileData,
      })
    : await prisma.profile.create({ data: profileData });

  const existingDefaultTeam = await prisma.team.findFirst({
    where: { masterId: profile.id, isDefault: true },
    orderBy: { createdAt: "asc" },
  });

  const team = existingDefaultTeam
    ? await prisma.team.update({
        where: { id: existingDefaultTeam.id },
        data: { name: E2E_TEAM_NAME },
      })
    : await prisma.team.create({
        data: {
          name: E2E_TEAM_NAME,
          masterId: profile.id,
          isDefault: true,
        },
      });

  await prisma.teamMember.upsert({
    where: {
      teamId_profileId: {
        teamId: team.id,
        profileId: profile.id,
      },
    },
    create: {
      teamId: team.id,
      profileId: profile.id,
      role: "manager",
      functions: MASTER_FUNCTIONS,
    },
    update: {
      role: "manager",
      functions: MASTER_FUNCTIONS,
    },
  });

  await prisma.profile.update({
    where: { id: profile.id },
    data: { activeTeamId: team.id },
  });

  await prisma.profileSubscription.upsert({
    where: { profileId: profile.id },
    create: {
      profileId: profile.id,
      hasPermanentSubscription: true,
      subscriptionStatus: "active",
    },
    update: {
      hasPermanentSubscription: true,
      subscriptionStatus: "active",
    },
  });

  info(`✓ Profile ${profile.id} (${E2E_MASTER_EMAIL}) + Team "${E2E_TEAM_NAME}"`);
  return profile;
}

async function grantE2eMasterRadarBeta(prisma: PrismaClient, profileId: string) {
  step("Granting Radar BETA to E2E master");

  const radarFeature = await prisma.backofficeFeature.findUnique({
    where: { slug: "radar" },
    select: { id: true },
  });
  if (!radarFeature) {
    fail("Feature radar ausente no catálogo após seed-backoffice-products.");
  }

  await prisma.backofficeFeatureGrant.upsert({
    where: {
      featureId_profileId_grantType: {
        featureId: radarFeature.id,
        profileId,
        grantType: "BETA",
      },
    },
    create: {
      featureId: radarFeature.id,
      profileId,
      grantType: "BETA",
      isActive: true,
      betaTeamScope: "ALL_TEAMS",
    },
    update: {
      isActive: true,
      betaTeamScope: "ALL_TEAMS",
    },
  });

  info("✓ Radar BETA liberado para o master E2E");
}

async function main() {
  const dbUrl = LOCAL_DB_URL;
  const fromEnv = process.env.DATABASE_URL?.trim();
  if (fromEnv && fromEnv !== dbUrl) {
    info(
      "⚠ DATABASE_URL do ambiente não é o Postgres :55322 — ignorado. Seed E2E grava só em 127.0.0.1:55322.",
    );
  }
  applyLocalMigrations(dbUrl);
  seedBackofficeCatalog(dbUrl);

  const prisma = new PrismaClient({ datasourceUrl: dbUrl });
  try {
    const profile = await upsertE2eMaster(prisma);
    await grantE2eMasterRadarBeta(prisma, profile.id);
  } finally {
    await prisma.$disconnect();
  }

  console.info("\n✅ Seed E2E concluído.\n");
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
