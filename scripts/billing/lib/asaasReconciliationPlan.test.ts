import { describe, expect, it } from "bun:test"
import { buildReconciliationPlan, type ReconciliationDecision } from "./asaasReconciliationPlan"
import type { ReconciliationReport } from "./reconcileInventory"

function report(): ReconciliationReport {
  return {
    ran: true,
    spreadsheetChecked: true,
    cases: [
      {
        code: "ORFAO",
        asaasId: "cus_test",
        dbRefId: "profile-test",
        email: "test@example.com",
        detail: "customer órfão",
      },
      {
        code: "ORFAO",
        asaasId: "sub_test",
        dbRefId: "subscription-row",
        profileId: "profile-subscription-owner",
        detail: "subscription órfã",
      },
      {
        code: "FANTASMA",
        asaasId: "cus_ghost",
        email: null,
        detail: "customer fantasma",
      },
      {
        code: "DIVERGENCIA_STATUS",
        asaasId: "sub_status",
        dbRefId: "subscription-status",
        profileId: "profile-status-owner",
        detail: "status divergente",
      },
    ],
    countsByCode: { INTEGRO: 0, ORFAO: 2, DIVERGENCIA_STATUS: 1, FANTASMA: 1, SEM_BANCO: 0 },
    dueAfterEnd: [
      {
        asaasSubscriptionId: "sub_due",
        profileId: "profile-due",
        nextDueDate: "2026-12-01",
        subscriptionEndDate: "2026-09-01",
      },
    ],
    openInstallments: [],
  }
}

describe("buildReconciliationPlan", () => {
  it("transforma órfãos, fantasmas, divergência e datas em itens nomeados", () => {
    const plan = buildReconciliationPlan(report(), [], "2026-10-12T00:00:00.000Z")

    expect(plan.items.map((item) => item.key)).toEqual([
      "orfao:cus_test",
      "orfao:sub_test",
      "fantasma:cus_ghost",
      "status:sub_status",
      "due-after-end:sub_due",
    ])
    expect(plan.unresolvedKeys).toEqual(["orfao:cus_test", "orfao:sub_test", "fantasma:cus_ghost"])
    expect(plan.items.find((item) => item.key === "status:sub_status")?.defaultAction).toBe("block_locally")
    expect(plan.items.find((item) => item.key === "orfao:sub_test")?.profileId).toBe("profile-subscription-owner")
    expect(plan.items.find((item) => item.key === "status:sub_status")?.profileId).toBe("profile-status-owner")
  })

  it("aceita decisão explícita e rejeita ação incompatível", () => {
    const decisions: ReconciliationDecision[] = [
      { key: "orfao:cus_test", action: "provision_primary_customer", reason: "Cliente pagante confirmado" },
      { key: "orfao:sub_test", action: "remote_review", reason: "Assinatura exige conferência" },
      { key: "fantasma:cus_ghost", action: "retain_until_manual_removal", reason: "Aguardar validação jurídica" },
    ]
    const plan = buildReconciliationPlan(report(), decisions)
    expect(plan.unresolvedKeys).toEqual([])

    expect(() =>
      buildReconciliationPlan(report(), [
        { key: "orfao:sub_test", action: "provision_primary_customer", reason: "Ação errada" },
      ])
    ).toThrow("não permitida")
  })

  it("exige justificativa para qualquer decisão", () => {
    expect(() =>
      buildReconciliationPlan(report(), [
        { key: "orfao:cus_test", action: "ignore_test_record", reason: "teste" },
      ])
    ).toThrow("justificativa")
  })

  it("permite remoção nominal de customer fantasma, sem abrir essa ação para outros tipos", () => {
    const plan = buildReconciliationPlan(report(), [
      { key: "fantasma:cus_ghost", action: "remove_ghost_customer", reason: "Customer sem referência local" },
    ])
    expect(plan.decisions[0]?.action).toBe("remove_ghost_customer")
    expect(() =>
      buildReconciliationPlan(report(), [
        { key: "orfao:sub_test", action: "remove_ghost_customer", reason: "Ação incompatível" },
      ])
    ).toThrow("não permitida")
  })
})
