/**
 * Remove somente ponteiros locais para assinaturas legacy 404 dos três perfis
 * de desenvolvimento já provisionados na primary. Nunca exclui customer,
 * assinatura ou cobrança no Asaas. Dry-run é o comportamento padrão.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { Prisma } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"
import {
  planDevelopmentSubscriptionPointerCleanup,
  type DevelopmentSubscriptionPointerTarget,
} from "./lib/clearDevelopmentSubscriptionPointers"

type Arguments = { input: string; output?: string; apply: boolean }

function parseArguments(argv: string[]): Arguments {
  const input = argv.find((argument) => argument.startsWith("--input="))?.slice("--input=".length)
  if (!input) throw new Error("Uso: --input=<targets.json> [--output=<plan.json>] [--apply]")
  return {
    input,
    output: argv.find((argument) => argument.startsWith("--output="))?.slice("--output=".length),
    apply: argv.includes("--apply"),
  }
}

function assertApplyAuthorization(args: Arguments): void {
  if (!args.apply) return
  if (process.env.ASAAS_DEVELOPMENT_POINTER_CLEANUP_APPLY !== "1") {
    throw new Error(
      "Recusado: --apply exige ASAAS_DEVELOPMENT_POINTER_CLEANUP_APPLY=1; nenhuma exclusão remota é permitida por este script"
    )
  }
}

function readTargets(path: string): DevelopmentSubscriptionPointerTarget[] {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"))
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("--input deve conter alvos")
  return parsed.map((value, index) => {
    if (!value || typeof value !== "object") throw new Error(`alvo ${index + 1} inválido`)
    const target = value as Record<string, unknown>
    if (
      typeof target.profileId !== "string" ||
      typeof target.email !== "string" ||
      typeof target.legacySubscriptionId !== "string"
    ) {
      throw new Error(`alvo ${index + 1} precisa de profileId, email e legacySubscriptionId`)
    }
    return {
      profileId: target.profileId,
      email: target.email,
      legacySubscriptionId: target.legacySubscriptionId,
    }
  })
}

async function loadProfiles(targets: readonly DevelopmentSubscriptionPointerTarget[]) {
  return prisma.profile.findMany({
    where: { id: { in: targets.map((target) => target.profileId) } },
    select: {
      id: true,
      email: true,
      asaasCustomerId: true,
      asaasCustomerAccount: true,
      asaasSubscriptionId: true,
      asaasSubscriptionAccount: true,
      hasPermanentSubscription: true,
      subscription: {
        select: {
          asaasSubscriptionId: true,
          asaasSubscriptionAccount: true,
          hasPermanentSubscription: true,
        },
      },
    },
  })
}

async function applyCleanup(targets: readonly DevelopmentSubscriptionPointerTarget[]): Promise<void> {
  await prisma.$transaction(async (transaction) => {
    for (const target of targets) {
      const profile = await transaction.profile.findUniqueOrThrow({
        where: { id: target.profileId },
        select: {
          id: true,
          email: true,
          asaasSubscriptionId: true,
          asaasSubscriptionAccount: true,
          subscription: {
            select: {
              id: true,
              asaasSubscriptionId: true,
              asaasSubscriptionAccount: true,
            },
          },
        },
      })
      if (
        profile.email.trim().toLowerCase() !== target.email.trim().toLowerCase() ||
        profile.asaasSubscriptionId !== target.legacySubscriptionId ||
        profile.asaasSubscriptionAccount !== "legacy" ||
        profile.subscription?.asaasSubscriptionId !== target.legacySubscriptionId ||
        profile.subscription.asaasSubscriptionAccount !== "legacy"
      ) {
        throw new Error(`ponteiro mudou desde o dry-run para ${target.profileId}; reexecute o inventário`)
      }

      await transaction.profile.update({
        where: { id: target.profileId },
        data: { asaasSubscriptionId: null, asaasSubscriptionAccount: "primary" },
      })
      if (profile.subscription) {
        await transaction.profileSubscription.update({
          where: { profileId: target.profileId },
          data: { asaasSubscriptionId: null, asaasSubscriptionAccount: "primary" },
        })
      }
      await transaction.subscriptionChangeLog.create({
        data: {
          profileId: target.profileId,
          source: "asaas_migration",
          changeType: "legacy_development_pointer_cleared",
          before: {
            profileAsaasSubscriptionId: target.legacySubscriptionId,
            profileSubscriptionAsaasSubscriptionId: target.legacySubscriptionId,
          } satisfies Prisma.InputJsonValue,
          after: {
            profileAsaasSubscriptionId: null,
            profileSubscriptionAsaasSubscriptionId: null,
            reason: "development account with permanent subscription; legacy subscription returned 404",
          } satisfies Prisma.InputJsonValue,
          metadata: { targetEmail: target.email } satisfies Prisma.InputJsonValue,
        },
      })
    }
  })
}

async function main(): Promise<void> {
  const args = parseArguments(process.argv.slice(2))
  assertApplyAuthorization(args)
  const targets = readTargets(args.input)
  const profiles = await loadProfiles(targets)
  const plan = planDevelopmentSubscriptionPointerCleanup({ targets, profiles })
  const blocked = plan.filter((item) => item.action === "blocked")
  if (blocked.length > 0) throw new Error(`plano bloqueado: ${blocked.map((item) => `${item.target.email}: ${item.reason}`).join("; ")}`)
  const serialized = JSON.stringify({ generatedAt: new Date().toISOString(), apply: args.apply, plan }, null, 2)
  if (args.output) writeFileSync(args.output, serialized, "utf-8")
  process.stdout.write(`${serialized}\n`)
  if (args.apply) {
    await applyCleanup(plan.filter((item) => item.action === "clear").map((item) => item.target))
  }
}

main()
  .catch((error) => {
    console.error("[clear-development-subscription-pointers] erro fatal:", error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
