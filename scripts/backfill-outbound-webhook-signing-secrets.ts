#!/usr/bin/env tsx
/**
 * Backfill: gera um segredo de assinatura HMAC para webhook de saída
 * (`direction: "outbound"`) que exista sem `signingSecretCipher` (SPEC 20 — A-E1).
 *
 * Contexto: a migration `20260921235600_add-team-webhook-signing-secret.sql` só
 * criou as colunas `signingSecretCipher`/`signingSecretPreview` vazias — não gera
 * segredo para linha nenhuma. `TeamWebhookService.create()` e `rotateSigningSecret()`
 * sempre geram um segredo válido, então este script é defensivo: cobre qualquer
 * linha que viesse a existir sem ter passado por esses dois caminhos (ex.: um insert
 * manual, um bug futuro).
 *
 * Tamanho medido do caso (não é estimativa): `select count(*) from
 * corretor_studio_team_webhooks where direction = 'outbound'` no banco de produção
 * devolveu 0 em 09/09 e de novo em 22/09. Hoje este script não tem nada para
 * corrigir — ele existe para não deixar a lacuna aberta se isso mudar antes do
 * gestor rodar uma rotação manual.
 *
 * O segredo gerado NUNCA é impresso em texto puro (nem em dry-run, nem em
 * --apply) — só a cifra e o preview (`buildWebhookSigningSecretPreview`, os
 * últimos caracteres) são gravados. Para o gestor CONHECER o valor do segredo e
 * configurá-lo no receptor, ele precisa rotacionar via UI (`POST
 * /api/v1/integrations/webhooks/:id/signing-secret`) depois do backfill — o
 * mesmo fluxo de "reveal-once" usado em qualquer criação/rotação.
 *
 * Dry-run é o padrão. `--apply` grava no banco apontado por DATABASE_URL e só
 * deve rodar com autorização explícita do owner — nunca contra o remoto sem ela.
 *
 * Uso:
 *   bun run backfill:outbound-webhook-signing-secrets
 *   bun run backfill:outbound-webhook-signing-secrets -- --apply
 */

import { prisma } from "@/app/api/infra/data/prisma"
import {
  buildWebhookSigningSecretPreview,
  encryptWebhookSigningSecret,
  generateWebhookSigningSecret,
} from "@/lib/webhooks/webhookSigningSecurity"

const APPLY = process.argv.includes("--apply")
const LOG = "[backfill-outbound-webhook-signing-secrets]"

async function main() {
  console.info(`${LOG} Iniciando`, { modo: APPLY ? "APPLY (grava no banco)" : "dry-run" })

  const rows = await prisma.teamWebhook.findMany({
    where: { direction: "outbound", signingSecretCipher: null },
    select: { id: true, name: true, teamId: true },
  })

  if (rows.length === 0) {
    console.info(`${LOG} Nenhum webhook de saída sem segredo. Nada a fazer.`)
    return
  }

  console.info(`${LOG} ${rows.length} webhook(s) de saída sem segredo encontrado(s).`)
  for (const row of rows.slice(0, 20)) {
    console.info("  ~", { id: row.id, name: row.name, teamId: row.teamId })
  }
  if (rows.length > 20) {
    console.info(`  … e mais ${rows.length - 20} webhook(s).`)
  }

  if (!APPLY) {
    console.info(`${LOG} Dry-run: nada foi gravado. Rode com --apply após autorização.`)
    return
  }

  let updated = 0
  let failed = 0

  for (const row of rows) {
    try {
      const secret = generateWebhookSigningSecret()
      const cipher = encryptWebhookSigningSecret(secret)
      if (!cipher) {
        failed += 1
        console.error(
          `${LOG} Falha ao cifrar o segredo — verifique a configuração de cifra do servidor`,
          { id: row.id, name: row.name }
        )
        continue
      }

      await prisma.teamWebhook.update({
        where: { id: row.id },
        data: {
          signingSecretCipher: cipher,
          signingSecretPreview: buildWebhookSigningSecretPreview(secret),
        },
      })
      updated += 1
      console.info(`${LOG} Segredo gerado (não exibido aqui) para ${row.id} (${row.name})`, {
        teamId: row.teamId,
        aviso: "oriente o gestor a rotacionar via UI para conhecer o valor",
      })
    } catch (error) {
      failed += 1
      console.error(`${LOG} Falha ao atualizar — segue retentável`, {
        id: row.id,
        name: row.name,
        error,
      })
    }
  }

  if (failed > 0) process.exitCode = 1

  console.info(`${LOG} Concluído`, { total: rows.length, updated, failed })
}

main()
  .catch((error) => {
    console.error(`${LOG} Falhou`, error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
