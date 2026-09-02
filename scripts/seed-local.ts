/**
 * Seed do Postgres local (db-only).
 *
 * NÃO chama prisma/seed-app.ts — aquele script usa auth.admin.createUser /
 * updateUserById contra NEXT_PUBLIC_SUPABASE_URL + service role para os
 * usuários REAIS. Aqui só: migrations + catálogo Prisma + (opcional) uma das
 * duas pontes de login abaixo. Profile/Team/assinatura só no Postgres :55322.
 *
 * `--local-user` cria/atualiza a conta sintética de teste no Auth remoto
 * (e-mail e senha de LOCAL_DEV_USER_EMAIL / LOCAL_DEV_USER_PASSWORD no `.env`)
 * e o Profile + "Time Local" vitalício no Postgres local. É o caminho padrão
 * para dev sem dados reais — nenhuma conta real é usada.
 *
 * `--backoffice-user` idem para o contexto do backoffice: conta sintética
 * (LOCAL_DEV_BACKOFFICE_EMAIL / LOCAL_DEV_BACKOFFICE_PASSWORD, obrigatoriamente
 * @corretorstudio.com.br) + Profile role=backoffice + BackofficeUser fullAccess
 * no Postgres local.
 *
 * `--link-remote-user` lê (só leitura) um usuário REAL do Auth remoto e cria o
 * Profile local dele — use após `--clone` ou quando for trabalhar com dados
 * remotos. Nenhum dos três altera assinatura/dados de produção.
 *
 *   bun run db:seed:local
 *   bun run db:seed:local -- --local-user
 *   bun run db:seed:local -- --backoffice-user
 *   bun run db:seed:local -- --link-remote-user voce@email
 */

import "dotenv/config";

import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient, type UserFunction } from "@prisma/client";
import {
  applyAuthStubSchema,
  applyPendingLocalMigrations,
  LOCAL_DB_URL,
} from "./lib/local-stack";

const DEFAULT_TEAM_NAME = "Meu Time";
const LOCAL_DEV_TEAM_NAME = "Time Local";
/** Marcador em user_metadata que autoriza --local-user a gerenciar a conta. */
const LOCAL_DEV_TEST_USER_MARKER = "local_dev_test_user";
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

function parseArgs(rawArgs: string[]): {
  linkEmail: string | null;
  createLocalUser: boolean;
  createBackofficeUser: boolean;
} {
  const args = rawArgs.filter((arg) => arg !== "--");
  let linkEmail: string | null = null;
  let createLocalUser = false;
  let createBackofficeUser = false;

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
    if (arg === "--local-user") {
      createLocalUser = true;
      continue;
    }
    if (arg === "--backoffice-user") {
      createBackofficeUser = true;
      continue;
    }
    fail(`Flag desconhecida: ${arg}`);
  }

  if (linkEmail && (createLocalUser || createBackofficeUser)) {
    fail("Use --local-user/--backoffice-user OU --link-remote-user, não os dois.");
  }

  return { linkEmail, createLocalUser, createBackofficeUser };
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

function applyLocalMigrations() {
  step("Applying local auth stub (GoTrue columns + identities)");
  if (!applyAuthStubSchema()) {
    fail(
      "Stub de auth.users/auth.identities falhou. Confira se o Postgres :55322 está no ar (`bun run local:up`).",
    );
  }
  info("✓ Schema auth local compatível com migrations históricas");

  step("Applying local migrations");
  if (!applyPendingLocalMigrations()) {
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
  teamName: string,
) {
  const existingDefaultTeam = await prisma.team.findFirst({
    where: { masterId: profileId, isDefault: true },
    orderBy: { createdAt: "asc" },
  });

  const team =
    existingDefaultTeam ??
    (await prisma.team.create({
      data: {
        name: teamName,
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

type AuthUserForLocalProfile = {
  id: string;
  email: string;
  phone?: string | null;
  fullName: string | null;
};

/** Upsert de Profile + time + vitalício — escreve SOMENTE no Postgres :55322. */
async function upsertLocalProfile(authUser: AuthUserForLocalProfile, teamName: string) {
  const prisma = new PrismaClient({ datasourceUrl: LOCAL_DB_URL });
  try {
    const existingBySupabase = await prisma.profile.findUnique({
      where: { supabaseId: authUser.id },
    });
    const existingByEmail = await prisma.profile.findUnique({
      where: { email: authUser.email },
    });

    const existing = existingBySupabase ?? existingByEmail;
    if (existing) {
      await prisma.profile.update({
        where: { id: existing.id },
        data: {
          supabaseId: authUser.id,
          email: authUser.email,
          fullName: existing.fullName ?? authUser.fullName ?? authUser.email,
          isMaster: true,
        },
      });
      await ensureDefaultTeam(
        prisma,
        existing.id,
        existing.functions.length > 0 ? existing.functions : MASTER_FUNCTIONS,
        teamName,
      );
      await grantLocalDevSubscription(prisma, existing.id);
      info(`✓ Profile local já existia (id ${existing.id}) — supabaseId alinhado; assinatura local vitalícia.`);
    } else {
      const created = await prisma.profile.create({
        data: {
          supabaseId: authUser.id,
          email: authUser.email,
          fullName: authUser.fullName ?? authUser.email,
          phone: authUser.phone || null,
          role: "manager",
          isMaster: true,
          functions: MASTER_FUNCTIONS,
        },
      });
      await ensureDefaultTeam(prisma, created.id, MASTER_FUNCTIONS, teamName);
      await grantLocalDevSubscription(prisma, created.id);
      info(`✓ Profile local criado (id ${created.id}) com assinatura local vitalícia.`);
    }
  } finally {
    await prisma.$disconnect();
  }

  info("Auth permanece remoto. hasPermanentSubscription vale só no Postgres local — recarregue o app (cache de acesso ~45s).");
}

function extractFullNameFromMetadata(metadata: Record<string, unknown> | undefined): string | null {
  return typeof metadata?.full_name === "string" ? metadata.full_name : null;
}

async function linkRemoteUser(email: string) {
  step(`Linking remote Auth user ${email} → local Profile`);
  const remoteUser = await findRemoteUserByEmail(email);
  if (!remoteUser?.email) {
    fail(`Usuário ${email} não encontrado no Auth remoto (só leitura). Confira o e-mail.`);
  }

  await upsertLocalProfile(
    {
      id: remoteUser.id,
      email: remoteUser.email,
      phone: remoteUser.phone,
      fullName: extractFullNameFromMetadata(remoteUser.user_metadata),
    },
    DEFAULT_TEAM_NAME,
  );
}

function resolveLocalDevUserCredentials(): { email: string; password: string } {
  const email = process.env.LOCAL_DEV_USER_EMAIL?.trim();
  const password = process.env.LOCAL_DEV_USER_PASSWORD?.trim();
  if (!email || !password) {
    fail(
      "Defina LOCAL_DEV_USER_EMAIL e LOCAL_DEV_USER_PASSWORD no `.env` para usar --local-user.\n" +
        "   Ex.: LOCAL_DEV_USER_EMAIL=joaocleber@gmail.com / LOCAL_DEV_USER_PASSWORD=Senha@1234",
    );
  }
  return { email, password };
}

/**
 * Conta sintética de teste: precisa existir no Auth remoto porque o login do
 * modo db-only passa pelo GoTrue remoto — é a única escrita remota deste
 * script, e só nessa conta (nunca em usuários reais).
 */
async function ensureRemoteAuthTestUser(email: string, password: string, fullName: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceRole) {
    fail(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do `.env` são obrigatórios para --local-user (Auth remoto).",
    );
  }

  const admin = createClient(url, serviceRole, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const existing = await findRemoteUserByEmail(email);
  if (existing) {
    // Sem o marcador, este e-mail pode ser de uma pessoa real (typo, endereço
    // reutilizado) — resetar a senha dela com o service role seria account
    // takeover. Só contas criadas por este script podem ser atualizadas.
    if (existing.user_metadata?.[LOCAL_DEV_TEST_USER_MARKER] !== true) {
      fail(
        `O e-mail ${email} já existe no Auth remoto SEM o marcador de conta de teste ` +
          `(user_metadata.${LOCAL_DEV_TEST_USER_MARKER}). Não vou sobrescrever a senha de uma ` +
          "conta possivelmente real — troque LOCAL_DEV_USER_EMAIL por um e-mail dedicado a teste.",
      );
    }
    const { data, error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (error) {
      fail(`Falha ao atualizar a conta de teste no Auth remoto: ${error.message}`);
    }
    info(`✓ Conta de teste já existia no Auth remoto (senha sincronizada com o .env).`);
    return data.user;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      [LOCAL_DEV_TEST_USER_MARKER]: true,
    },
  });
  if (error || !data.user) {
    fail(`Falha ao criar a conta de teste no Auth remoto: ${error?.message ?? "sem usuário retornado"}`);
  }
  info(`✓ Conta de teste criada no Auth remoto (${email}).`);
  return data.user;
}

async function createLocalDevUser() {
  const { email, password } = resolveLocalDevUserCredentials();
  step(`Ensuring local test user ${email} (synthetic account + local Profile)`);

  const authUser = await ensureRemoteAuthTestUser(email, password, "Usuário Local de Teste");
  if (!authUser.email) {
    fail("Conta de teste sem e-mail no Auth remoto — estado inesperado.");
  }

  await upsertLocalProfile(
    {
      id: authUser.id,
      email: authUser.email,
      phone: authUser.phone,
      fullName: extractFullNameFromMetadata(authUser.user_metadata) ?? "Usuário Local de Teste",
    },
    LOCAL_DEV_TEAM_NAME,
  );
}

function resolveLocalDevBackofficeCredentials(): { email: string; password: string } {
  const email = process.env.LOCAL_DEV_BACKOFFICE_EMAIL?.trim().toLowerCase();
  const password = process.env.LOCAL_DEV_BACKOFFICE_PASSWORD?.trim();
  if (!email || !password) {
    fail(
      "Defina LOCAL_DEV_BACKOFFICE_EMAIL e LOCAL_DEV_BACKOFFICE_PASSWORD no `.env` para usar --backoffice-user.\n" +
        "   Ex.: LOCAL_DEV_BACKOFFICE_EMAIL=flavio@corretorstudio.com.br / LOCAL_DEV_BACKOFFICE_PASSWORD=Backoffice@2025",
    );
  }
  // O signin do backoffice (app/backoffice/sign-in/actions.ts) rejeita qualquer
  // outro domínio — falhar aqui evita criar uma conta que nunca vai logar.
  if (!email.endsWith("@corretorstudio.com.br")) {
    fail(`LOCAL_DEV_BACKOFFICE_EMAIL precisa ser @corretorstudio.com.br (recebido: ${email}).`);
  }
  return { email, password };
}

/** Espelha prisma/seed-backoffice.ts, mas escrevendo SOMENTE no Postgres :55322. */
async function createLocalBackofficeUser() {
  const { email, password } = resolveLocalDevBackofficeCredentials();
  step(`Ensuring local backoffice test user ${email} (synthetic account + local Profile)`);

  const authUser = await ensureRemoteAuthTestUser(email, password, "Backoffice Local de Teste");
  if (!authUser.email) {
    fail("Conta de teste sem e-mail no Auth remoto — estado inesperado.");
  }

  const prisma = new PrismaClient({ datasourceUrl: LOCAL_DB_URL });
  try {
    const profile = await prisma.profile.upsert({
      where: { email: authUser.email },
      create: {
        email: authUser.email,
        role: "backoffice",
        supabaseId: authUser.id,
        fullName: "Backoffice Local de Teste",
        isMaster: false,
      },
      update: {
        role: "backoffice",
        supabaseId: authUser.id,
      },
    });

    await prisma.backofficeUser.upsert({
      where: { profileId: profile.id },
      create: {
        id: profile.id,
        profileId: profile.id,
        email: authUser.email,
        fullAccess: true,
        isActive: true,
      },
      update: {
        email: authUser.email,
        fullAccess: true,
        isActive: true,
      },
    });

    info(`✓ BackofficeUser local pronto (profileId ${profile.id}, fullAccess).`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const { linkEmail, createLocalUser, createBackofficeUser } = parseArgs(process.argv.slice(2));

  applyLocalMigrations();
  seedBackofficeCatalog();

  if (createLocalUser) {
    await createLocalDevUser();
  }
  if (createBackofficeUser) {
    await createLocalBackofficeUser();
  }
  if (linkEmail) {
    await linkRemoteUser(linkEmail);
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});
