#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * Fix para campanha "Empresa Consolidada — Empresa Consolidada 06" travada
 * 
 * Problema: Campanha marcada como "failed" pelo recovery de timeout (30 min),
 * mas sem dispatch nem logs associados. O reenvio falha porque não há destinatários
 * com falha para reenviar.
 * 
 * Solução: Resetar o status da campanha para permitir um novo disparo.
 */

import { prisma } from "../app/api/infra/data/prisma"

const CAMPAIGN_ID = "8000b454-0ecc-4292-bdf7-2dad9cc8ed65"

async function main() {
  console.log("═══════════════════════════════════════════════════")
  console.log("🔧 FIX: Campanha Empresa Consolidada 06")
  console.log("═══════════════════════════════════════════════════\n")

  // 1. Buscar a campanha atual
  console.log("📋 Buscando campanha atual...")
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: CAMPAIGN_ID },
    include: {
      dispatches: true,
      _count: {
        select: {
          logs: true,
        },
      },
    },
  })

  if (!campaign) {
    console.log("❌ Campanha não encontrada!")
    return
  }

  console.log("✅ Campanha encontrada:")
  console.log(`   Nome: ${campaign.name}`)
  console.log(`   Status: ${campaign.status}`)
  console.log(`   Total Recipients: ${campaign.totalRecipients}`)
  console.log(`   Total Sent: ${campaign.totalSent}`)
  console.log(`   Error: ${campaign.errorMessage}`)
  console.log(`   Dispatches: ${campaign.dispatches.length}`)
  console.log(`   Logs: ${campaign._count.logs}`)
  console.log("")

  // 2. Validar que é o caso esperado
  if (
    campaign.status !== "failed" ||
    campaign.errorMessage !== "Disparo interrompido: tempo limite de envio excedido (30 min)" ||
    campaign.dispatches.length !== 0 ||
    campaign._count.logs !== 0
  ) {
    console.log("⚠️  Campanha não está no estado esperado para o fix.")
    console.log("   Esperado: status=failed, dispatches=0, logs=0")
    console.log("   Abortando por segurança.")
    return
  }

  // 3. Resetar status da campanha
  console.log("🔄 Resetando status da campanha para 'draft'...\n")

  const updated = await prisma.emailCampaign.update({
    where: { id: CAMPAIGN_ID },
    data: {
      status: "draft",
      errorMessage: null,
    },
  })

  console.log("✅ Campanha resetada com sucesso!")
  console.log(`   Novo status: ${updated.status}`)
  console.log(`   Error message: ${updated.errorMessage}`)
  console.log("")

  console.log("═══════════════════════════════════════════════════")
  console.log("✨ FIX APLICADO COM SUCESSO!")
  console.log("═══════════════════════════════════════════════════")
  console.log("")
  console.log("Próximos passos:")
  console.log("1. O usuário pode agora disparar a campanha normalmente")
  console.log("2. O sistema criará um novo dispatch e logs")
  console.log("3. Os 206 destinatários receberão o email")
}

main()
  .catch((error) => {
    console.error("\n❌ Erro ao executar fix:", error)
    process.exit(1)
  })
  .finally(() => {
    prisma.$disconnect()
  })
