/**
 * Seed do Postgres local (db-only).
 *
 * NÃO chama prisma/seed-app.ts — aquele script usa auth.admin.createUser /
 * updateUserById contra NEXT_PUBLIC_SUPABASE_URL + service role, ou seja o
 * projeto Auth remoto. Aqui só: migrations + catálogo Prisma + (opcional)
 * ponte de login (leitura do Auth remoto + upsert de Profile local).
 *
 * `--link-remote-user` também marca o Profile local como vitalício
 * (`hasPermanentSubscription`) para o gate de CRM passar sem clonar
 * cobrança/Asaas. Isso NÃO altera Auth remoto nem assinatura de produção.
 *
 *   bun run db:seed:local
 *   bun run db:seed:local -- --link-remote-user voce@email
 */

import "dotenv/config";

import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient, type UserFunction } from "@prisma/client";
import { join } from "node:path";
import { LOCAL_DB_ADMIN_URL, LOCAL_DB_URL } from "./lib/local-stack";

const DEFAULT_TEAM_NAME = "Meu Time";
const MASTER_FUNCTIONS: UserFunction[] = ["SDR", "CLOSER"];

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

function parseArgs(rawArgs: string[]): { linkEmail: string | null } {
  const args = rawArgs.filter((arg) => arg !== "--");
  let linkEmail: string | null = null;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--link-remote-user") {
      const value = args[i + 1];
      if (!value || value.startsWith("-")) {
        fail("Passe o e-mail: bun run db:seed:local -- --link-remote-user voce@email");
      }
      linkEmail = value;
      i += 1;
      continue;
    }
    fail(`Flag desconhecida: ${arg}`);
  }

  return { linkEmail };
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

function applyAuthStubSchema() {
  step("Applying local auth stub (GoTrue columns + identities)");
  const stubFile = join(process.cwd(), "docker", "local", "zz-init-auth-stub-schema.sql");
  const result = spawnSync("psql", [LOCAL_DB_ADMIN_URL, "-v", "ON_ERROR_STOP=1", "-f", stubFile], {
    stdio: "inherit",
    shell: false,
    encoding: "utf8",
  });
  if ((result.status ?? 1) !== 0) {
    fail(
      "Stub de auth.users/auth.identities falhou. Confira se o Postgres :55322 está no ar (`bun run local:up`).",
    );
  }
  info("✓ Schema auth local compatível com migrations históricas");
}

function applyLocalMigrations() {
  applyAuthStubSchema();
  step("Applying local migrations");
  const result = run("bun", ["run", "db:migrate:apply:local"]);
  if (result.status !== 0) {
    fail(
      "`db:migrate:apply:local` falhou. Veja o SQL acima. Stub de auth: `docker/local/zz-init-auth-stub-schema.sql`.",
    );
  }
  info("✓ Migrations aplicadas");
}

function seedBackofficeCatalog() {
  step("Seeding backoffice catalog (Prisma)");
  const result = run("bun", ["run", "db:seed:backoffice-products"], {
    env: {
      ...process.env,
      DATABASE_URL: LOCAL_DB_URL,
      DIRECT_URL: LOCAL_DB_URL,
    },
  });
  if (result.status !== 0) {
    fail("`db:seed:backoffice-products` falhou.");
  }
  info("✓ Catálogo backoffice sincronizado");
}

async function findRemoteUserByEmail(email: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRole) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do `.env` são obrigatórios para --link-remote-user (leitura do Auth remoto).",
    );
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const normalized = email.toLowerCase();
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) {
      fail(`Falha ao ler Auth remoto: ${error.message}`);
    }
    const found = data.users.find((user) => user.email?.toLowerCase() === normalized);
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function ensureDefaultTeam(
  prisma: PrismaClient,
  profileId: string,
  functions: UserFunction[],
) {
  const existingDefaultTeam = await prisma.team.findFirst({
    where: { masterId: profileId, isDefault: true },
    orderBy: { createdAt: "asc" },
  });

  const team =
    existingDefaultTeam ??
    (await prisma.team.create({
      data: {
        name: DEFAULT_TEAM_NAME,
        masterId: profileId,
        isDefault: true,
      },
    }));

  await prisma.teamMember.upsert({
    where: {
      teamId_profileId: {
        teamId: team.id,
        profileId,
      },
    },
    create: {
      teamId: team.id,
      profileId,
      role: "manager",
      functions,
    },
    update: {
      role: "manager",
      functions,
    },
  });

  await prisma.profile.update({
    where: { id: profileId },
    data: { activeTeamId: team.id },
  });
}

/** Gate local de CRM: vitalício só no Postgres :55322, sem Asaas. */
async function grantLocalDevSubscription(prisma: PrismaClient, profileId: string) {
  await prisma.profile.update({
    where: { id: profileId },
    data: {
      isMaster: true,
      hasPermanentSubscription: true,
      hasUnlimitedUsers: true,
      subscriptionStatus: "active",
    },
  });

  await prisma.profileSubscription.upsert({
    where: { profileId },
    create: {
      profileId,
      hasPermanentSubscription: true,
      subscriptionStatus: "active",
    },
    update: {
      hasPermanentSubscription: true,
      subscriptionStatus: "active",
    },
  });
}

async function linkRemoteUser(email: string) {
  step(`Linking remote Auth user ${email} → local Profile`);
  const remoteUser = await findRemoteUserByEmail(email);
  if (!remoteUser?.email) {
    fail(`Usuário ${email} não encontrado no Auth remoto (só leitura). Confira o e-mail.`);
  }

  const fullNameFromMeta =
    typeof remoteUser.user_metadata?.full_name === "string"
      ? remoteUser.user_metadata.full_name
      : null;

  const prisma = new PrismaClient({ datasourceUrl: LOCAL_DB_URL });
  try {
    const existingBySupabase = await prisma.profile.findUnique({
      where: { supabaseId: remoteUser.id },
    });
    const existingByEmail = await prisma.profile.findUnique({
      where: { email: remoteUser.email },
    });

    const existing = existingBySupabase ?? existingByEmail;
    if (existing) {
      await prisma.profile.update({
        where: { id: existing.id },
        data: {
          supabaseId: remoteUser.id,
          email: remoteUser.email,
          fullName: existing.fullName ?? fullNameFromMeta ?? remoteUser.email,
          isMaster: true,
        },
      });
      await ensureDefaultTeam(prisma, existing.id, existing.functions.length > 0 ? existing.functions : MASTER_FUNCTIONS);
      await grantLocalDevSubscription(prisma, existing.id);
      info(`✓ Profile local já existia (id ${existing.id}) — supabaseId alinhado; assinatura local vitalícia.`);
    } else {
      const created = await prisma.profile.create({
        data: {
          supabaseId: remoteUser.id,
          email: remoteUser.email,
          fullName: fullNameFromMeta ?? remoteUser.email,
          phone: remoteUser.phone || null,
          role: "manager",
          isMaster: true,
          functions: MASTER_FUNCTIONS,
        },
      });
      await ensureDefaultTeam(prisma, created.id, MASTER_FUNCTIONS);
      await grantLocalDevSubscription(prisma, created.id);
      info(`✓ Profile local criado (id ${created.id}) com assinatura local vitalícia.`);
    }
  } finally {
    await prisma.$disconnect();
  }

  info("Auth permanece remoto. hasPermanentSubscription vale só no Postgres local — recarregue o app (cache de acesso ~45s).");
}

async function main() {
  const { linkEmail } = parseArgs(process.argv.slice(2));

  applyLocalMigrations();
  seedBackofficeCatalog();

  if (linkEmail) {
    await linkRemoteUser(linkEmail);
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
