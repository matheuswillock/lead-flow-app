/**
 * normalize-google-auth.ts
 *
 * Contexto:
 *   O profile do usuário b44aa5af-f609-493f-afd1-1a736348b1df está sem Google conectado
 *   na tabela public.profiles, mas o auth.users ainda mantém a identidade Google em
 *   raw_app_meta_data.providers e possivelmente na auth.identities.
 *
 * Ações executadas:
 *   1. Exibir estado atual no auth schema
 *   2. Remover identity Google da auth.identities
 *   3. Normalizar raw_app_meta_data para provider/providers = email
 *   4. Exibir estado final para conferência
 *
 * Uso:
 *   Dry-run:
 *     bunx tsx scripts/admin/normalize-google-auth.ts --dry-run
 *
 *   Execução real:
 *     bunx tsx scripts/admin/normalize-google-auth.ts --confirm
 */

import "dotenv/config";
import { prisma } from "@/app/api/infra/data/prisma";

const AUTH_USER_ID = "b44aa5af-f609-493f-afd1-1a736348b1df";

async function getCurrentState() {
  const [userRows, identityRows] = await Promise.all([
    prisma.$queryRaw<Array<{
      id: string;
      email: string;
      raw_app_meta_data: unknown;
      updated_at: Date;
    }>>`
      SELECT id, email, raw_app_meta_data, updated_at
      FROM auth.users
      WHERE id = ${AUTH_USER_ID}::uuid
    `,
    prisma.$queryRaw<Array<{
      id: string;
      provider: string;
      identity_data: unknown;
    }>>`
      SELECT id, provider, identity_data
      FROM auth.identities
      WHERE user_id = ${AUTH_USER_ID}::uuid
      ORDER BY created_at ASC
    `,
  ]);

  return {
    user: userRows[0] ?? null,
    identities: identityRows,
  };
}

async function normalize() {
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`
      DELETE FROM auth.identities
      WHERE user_id = ${AUTH_USER_ID}::uuid
        AND provider = 'google'
    `;

    await tx.$executeRaw`
      UPDATE auth.users
      SET raw_app_meta_data = jsonb_set(
          jsonb_set(COALESCE(raw_app_meta_data, '{}'::jsonb), '{provider}', '"email"'::jsonb, true),
          '{providers}',
          '["email"]'::jsonb,
          true
        ),
        updated_at = now()
      WHERE id = ${AUTH_USER_ID}::uuid
    `;
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const confirm = process.argv.includes("--confirm");

  if (!dryRun && !confirm) {
    console.error("Use --dry-run para revisar ou --confirm para executar.");
    process.exit(1);
  }

  const before = await getCurrentState();
  console.info("[normalize-google-auth] BEFORE", JSON.stringify(before, null, 2));

  if (dryRun) {
    console.info("[normalize-google-auth] DRY RUN - nenhuma alteração aplicada.");
    return;
  }

  await normalize();

  const after = await getCurrentState();
  console.info("[normalize-google-auth] AFTER", JSON.stringify(after, null, 2));
  console.info("[normalize-google-auth] DONE");
}

main()
  .catch((error) => {
    console.error("[normalize-google-auth] FAILED:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
