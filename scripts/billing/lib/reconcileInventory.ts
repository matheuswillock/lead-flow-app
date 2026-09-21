/**
 * Reconciliação banco × conta Asaas × planilha do owner — 30-E1 (T-30.2).
 *
 * Função pura: recebe os dados já carregados (Asaas + banco + planilha) e
 * devolve uma classificação nomeada de cada divergência. Nunca faz média
 * silenciosa (regra §2.3 da auditoria) — toda divergência entre fontes vira
 * uma linha do relatório com o id/e-mail da origem.
 *
 * Os 5 casos de reconciliação (§7.3 do plano de migração):
 *   INTEGRO             — cus_/sub_ do banco existe e está consistente no Asaas
 *   ORFAO                — ponteiro do banco não existe na conta Asaas
 *   DIVERGENCIA_STATUS   — sub_ existe nos dois lados mas o status diverge
 *   FANTASMA             — customer/subscription existe no Asaas e não está no banco
 *   SEM_BANCO            — pagante da planilha do owner sem nenhum cus_ no banco
 */

import { mapSubscriptionStatusFromPayload } from "@/lib/billing/asaas-subscription-status"
import type { AsaasCustomer, AsaasPayment, AsaasSubscription } from "./asaasInventoryTypes"
import type { DbCustomerPointer, DbSubscriptionPointer } from "./IBillingInventoryRepository"

export type ReconciliationCaseCode =
  | "INTEGRO"
  | "ORFAO"
  | "DIVERGENCIA_STATUS"
  | "FANTASMA"
  | "SEM_BANCO"

export type ReconciliationCase = {
  code: ReconciliationCaseCode
  detail: string
  asaasId?: string
  dbRefId?: string
  email?: string | null
}

export type DueAfterEndAnomaly = {
  asaasSubscriptionId: string
  profileId: string
  nextDueDate: string
  subscriptionEndDate: string
}

export type OpenInstallment = {
  installmentId: string
  customerId: string
  futureParcelsCount: number
  nextDueDate: string
}

export type OwnerSpreadsheetEntry = {
  name: string
  email: string
}

export type ReconciliationReport = {
  ran: true
  cases: ReconciliationCase[]
  countsByCode: Record<ReconciliationCaseCode, number>
  dueAfterEnd: DueAfterEndAnomaly[]
  openInstallments: OpenInstallment[]
  /** false quando nenhuma planilha foi fornecida — SEM_BANCO nunca roda "no escuro" */
  spreadsheetChecked: boolean
}

export type ReconcileInventoryInput = {
  asaasCustomers: AsaasCustomer[]
  asaasSubscriptions: AsaasSubscription[]
  /** payments PENDING + OVERDUE + CREDIT_CARD já concatenados pelo chamador */
  asaasPayments: AsaasPayment[]
  dbCustomerPointers: DbCustomerPointer[]
  dbSubscriptionPointers: DbSubscriptionPointer[]
  ownerSpreadsheet?: OwnerSpreadsheetEntry[]
  /** injetável para testes determinísticos; default = agora */
  today?: Date
}

function computeOpenInstallments(payments: AsaasPayment[], today: Date): OpenInstallment[] {
  const byInstallment = new Map<string, AsaasPayment[]>()

  for (const payment of payments) {
    if (!payment.installment) continue
    const group = byInstallment.get(payment.installment) ?? []
    group.push(payment)
    byInstallment.set(payment.installment, group)
  }

  const result: OpenInstallment[] = []
  for (const [installmentId, group] of byInstallment) {
    const futureParcels = group
      .filter((p) => p.status === "PENDING" && new Date(p.dueDate).getTime() > today.getTime())
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())

    if (futureParcels.length === 0) continue

    result.push({
      installmentId,
      customerId: group[0]!.customer,
      futureParcelsCount: futureParcels.length,
      nextDueDate: futureParcels[0]!.dueDate,
    })
  }

  return result
}

export function reconcileInventory(input: ReconcileInventoryInput): ReconciliationReport {
  const {
    asaasCustomers,
    asaasSubscriptions,
    asaasPayments,
    dbCustomerPointers,
    dbSubscriptionPointers,
    ownerSpreadsheet,
    today = new Date(),
  } = input

  const cases: ReconciliationCase[] = []
  const dueAfterEnd: DueAfterEndAnomaly[] = []

  const asaasCustomerIds = new Set(asaasCustomers.map((c) => c.id))
  const asaasSubscriptionsById = new Map(asaasSubscriptions.map((s) => [s.id, s]))
  const dbKnownCustomerIds = new Set(dbCustomerPointers.map((p) => p.asaasCustomerId))
  const dbKnownSubscriptionIds = new Set(dbSubscriptionPointers.map((p) => p.asaasSubscriptionId))

  // 1) ponteiros de customer do banco: íntegro vs órfão
  for (const pointer of dbCustomerPointers) {
    if (asaasCustomerIds.has(pointer.asaasCustomerId)) {
      cases.push({
        code: "INTEGRO",
        detail: `Customer ${pointer.asaasCustomerId} (${pointer.source} ${pointer.refId}) existe na conta Asaas`,
        asaasId: pointer.asaasCustomerId,
        dbRefId: pointer.refId,
        email: pointer.email,
      })
    } else {
      cases.push({
        code: "ORFAO",
        detail: `Customer ${pointer.asaasCustomerId} (${pointer.source} ${pointer.refId}) está no banco mas não existe na conta Asaas — ponteiro órfão`,
        asaasId: pointer.asaasCustomerId,
        dbRefId: pointer.refId,
        email: pointer.email,
      })
    }
  }

  // 2) clientes fantasma: existem no Asaas, nenhum ponteiro do banco aponta pra eles
  for (const customer of asaasCustomers) {
    if (!dbKnownCustomerIds.has(customer.id)) {
      cases.push({
        code: "FANTASMA",
        detail: `Customer ${customer.id} (${customer.email}) existe na conta Asaas e não está referenciado por nenhuma linha do banco`,
        asaasId: customer.id,
        email: customer.email,
      })
    }
  }

  // 3) ponteiros de subscription do banco: órfã, íntegra ou divergência de status (+ due>fim)
  for (const pointer of dbSubscriptionPointers) {
    const asaasSub = asaasSubscriptionsById.get(pointer.asaasSubscriptionId)

    if (!asaasSub) {
      cases.push({
        code: "ORFAO",
        detail: `Subscription ${pointer.asaasSubscriptionId} (profile ${pointer.profileId}) está no banco mas não existe na conta Asaas — ponteiro órfão`,
        asaasId: pointer.asaasSubscriptionId,
        dbRefId: pointer.refId,
      })
      continue
    }

    // Status ausente ou não mapeável NUNCA vira INTEGRO: sem os dois lados
    // classificáveis não há como provar consistência, e esconder isso em
    // "íntegro" seria exatamente a média silenciosa que a regra §2.3 proíbe.
    const mappedLocalStatus = mapSubscriptionStatusFromPayload(asaasSub.status)
    if (!mappedLocalStatus || !pointer.subscriptionStatus) {
      const missingSide = !mappedLocalStatus
        ? `status Asaas "${asaasSub.status}" não mapeável pelo mapeamento canônico`
        : "status local ausente (null) no banco"
      cases.push({
        code: "DIVERGENCIA_STATUS",
        detail: `Subscription ${pointer.asaasSubscriptionId}: consistência não verificável — ${missingSide} (banco=${pointer.subscriptionStatus ?? "null"}, Asaas=${asaasSub.status})`,
        asaasId: pointer.asaasSubscriptionId,
        dbRefId: pointer.refId,
      })
    } else if (mappedLocalStatus !== pointer.subscriptionStatus) {
      cases.push({
        code: "DIVERGENCIA_STATUS",
        detail: `Subscription ${pointer.asaasSubscriptionId}: banco=${pointer.subscriptionStatus}, Asaas=${asaasSub.status} (mapeado=${mappedLocalStatus})`,
        asaasId: pointer.asaasSubscriptionId,
        dbRefId: pointer.refId,
      })
    } else {
      cases.push({
        code: "INTEGRO",
        detail: `Subscription ${pointer.asaasSubscriptionId} consistente entre banco e Asaas`,
        asaasId: pointer.asaasSubscriptionId,
        dbRefId: pointer.refId,
      })
    }

    if (asaasSub.nextDueDate && pointer.subscriptionEndDate) {
      const nextDue = new Date(asaasSub.nextDueDate)
      if (nextDue.getTime() > pointer.subscriptionEndDate.getTime()) {
        dueAfterEnd.push({
          asaasSubscriptionId: pointer.asaasSubscriptionId,
          profileId: pointer.profileId,
          nextDueDate: asaasSub.nextDueDate,
          subscriptionEndDate: pointer.subscriptionEndDate.toISOString(),
        })
      }
    }
  }

  // 4) assinaturas fantasma: existem no Asaas, nenhuma linha do banco aponta pra elas
  for (const sub of asaasSubscriptions) {
    if (!dbKnownSubscriptionIds.has(sub.id)) {
      cases.push({
        code: "FANTASMA",
        detail: `Subscription ${sub.id} (customer ${sub.customer}) existe na conta Asaas e não está referenciada por nenhuma linha do banco`,
        asaasId: sub.id,
      })
    }
  }

  // 5) planilha do owner: pagante sem nenhuma representação no banco
  let spreadsheetChecked = false
  if (ownerSpreadsheet) {
    spreadsheetChecked = true
    const knownEmails = new Set(
      dbCustomerPointers
        .map((p) => p.email?.toLowerCase().trim())
        .filter((email): email is string => !!email)
    )
    for (const entry of ownerSpreadsheet) {
      const email = entry.email.toLowerCase().trim()
      if (!knownEmails.has(email)) {
        cases.push({
          code: "SEM_BANCO",
          detail: `${entry.name} <${entry.email}> está na planilha do owner como pagante mas não tem nenhum customer no nosso banco`,
          email: entry.email,
        })
      }
    }
  }

  const countsByCode: Record<ReconciliationCaseCode, number> = {
    INTEGRO: 0,
    ORFAO: 0,
    DIVERGENCIA_STATUS: 0,
    FANTASMA: 0,
    SEM_BANCO: 0,
  }
  for (const c of cases) countsByCode[c.code] += 1

  return {
    ran: true,
    cases,
    countsByCode,
    dueAfterEnd,
    openInstallments: computeOpenInstallments(asaasPayments, today),
    spreadsheetChecked,
  }
}
