#!/usr/bin/env tsx
/* eslint-disable no-console */
/**
 * T-40.21 de [[40 — Checkout, Adesões e Add-ons — Backend]] (E6/DA4) — script
 * read-only. Lista PIX/checkouts pendentes nas superfícies que esta SPEC
 * cobre (PendingAction, BackofficeAdhesion, PlatformPurchase) — insumo do
 * inventário M0.1 de [[30 — Migração de Conta (execução) — Backend]], usado
 * no freeze curto pré-flip (DA4): tudo listado aqui precisa liquidar ou ser
 * explicitamente acompanhado antes da conta atual virar "legacy".
 *
 * Nunca escreve no banco. Não chama a API do Asaas — lê só o que já está
 * persistido localmente (paymentId, valor, conta, e-mail do responsável).
 *
 * Uso: bunx tsx scripts/inventory-pending-asaas-payments.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

type InventoryRow = {
  source: "PendingAction" | "BackofficeAdhesion" | "PlatformPurchase"
  id: string
  asaasPaymentId: string | null
  asaasAccount: string
  status: string
  email: string | null
  amount: string | null
  createdAt: Date
}

async function collectPendingActions(): Promise<InventoryRow[]> {
  const rows = await prisma.pendingAction.findMany({
    where: { status: "pending", paymentId: { not: null } },
    select: {
      id: true,
      paymentId: true,
      status: true,
      createdAt: true,
      // Achado Codex (PR #1137, P2): a conta da cobrança é a persistida na
      // própria action (gravada no instante em que o paymentId nasceu),
      // nunca a do master.asaasCustomerAccount atual — que pode ter
      // migrado desde então (E4/C33, mesmo achado já fechado em
      // checkPaymentStatus e confirm-payment).
      asaasAccount: true,
      master: { select: { email: true } },
    },
  })

  return rows.map((row) => ({
    source: "PendingAction" as const,
    id: row.id,
    asaasPaymentId: row.paymentId,
    asaasAccount: row.asaasAccount,
    status: row.status,
    email: row.master?.email ?? null,
    amount: null,
    createdAt: row.createdAt,
  }))
}

async function collectBackofficeAdhesions(): Promise<InventoryRow[]> {
  const rows = await prisma.backofficeAdhesion.findMany({
    where: {
      status: "pending",
      OR: [{ asaasPaymentId: { not: null } }, { billingType: "PIX" }],
    },
    select: {
      id: true,
      email: true,
      status: true,
      asaasPaymentId: true,
      asaasAccount: true,
      createdAt: true,
    },
  })

  return rows.map((row) => ({
    source: "BackofficeAdhesion" as const,
    id: row.id,
    asaasPaymentId: row.asaasPaymentId,
    asaasAccount: row.asaasAccount,
    status: row.status,
    email: row.email,
    amount: null,
    createdAt: row.createdAt,
  }))
}

async function collectPlatformPurchases(): Promise<InventoryRow[]> {
  const rows = await prisma.platformPurchase.findMany({
    where: { status: "pending" },
    select: {
      id: true,
      asaasPaymentId: true,
      asaasAccount: true,
      status: true,
      amount: true,
      createdAt: true,
      profile: { select: { email: true } },
    },
  })

  return rows.map((row) => ({
    source: "PlatformPurchase" as const,
    id: row.id,
    asaasPaymentId: row.asaasPaymentId,
    asaasAccount: row.asaasAccount,
    status: row.status,
    email: row.profile?.email ?? null,
    amount: row.amount?.toString() ?? null,
    createdAt: row.createdAt,
  }))
}

async function main() {
  console.log("═══════════════════════════════════════════════════")
  console.log("📋 Inventário de PIX/checkouts pendentes (T-40.21)")
  console.log("═══════════════════════════════════════════════════\n")

  const [pendingActions, adhesions, purchases] = await Promise.all([
    collectPendingActions(),
    collectBackofficeAdhesions(),
    collectPlatformPurchases(),
  ])

  const all = [...pendingActions, ...adhesions, ...purchases].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )

  if (all.length === 0) {
    console.log("✅ Nenhum PIX/checkout pendente encontrado nas 3 superfícies.")
    await prisma.$disconnect()
    return
  }

  console.log(`⚠️  ${all.length} registro(s) pendente(s) — acompanhar até liquidar antes do flip:\n`)
  for (const row of all) {
    console.log(
      `[${row.source}] id=${row.id} paymentId=${row.asaasPaymentId ?? "—"} ` +
        `account=${row.asaasAccount} status=${row.status} email=${row.email ?? "—"} ` +
        `amount=${row.amount ?? "—"} createdAt=${row.createdAt.toISOString()}`
    )
  }

  console.log("\n───────────────────────────────────────────────────")
  console.log(`Total: ${all.length} (PendingAction=${pendingActions.length}, ` +
    `BackofficeAdhesion=${adhesions.length}, PlatformPurchase=${purchases.length})`)
  console.log("Insumo para o inventário M0.1 de [[30 — Migração de Conta (execução) — Backend]].")

  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error("❌ Erro ao gerar inventário:", error)
  await prisma.$disconnect()
  process.exit(1)
})
