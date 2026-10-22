import { describe, expect, it } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { PAYMENT_PROVIDER_OWNER_TYPES } from "@/lib/payment-provider/owner-types"
import { SETTLED_OWNER_TYPES } from "./PaymentOwnerSettlementService"

const root = join(import.meta.dir, "../../../..")
const read = (path: string) => readFileSync(join(root, path), "utf8")

/**
 * Guarda dos 6 pontos onde um ownerType precisa estar registrado. Se um novo ownerType do ledger
 * for esquecido em qualquer um deles, o pagamento confirmado fica sem efeito e sem alerta.
 */
describe("ownerType PAYMENT_CHARGE nos 6 pontos de registro", () => {
  it("1. owner-types.ts", () => {
    expect(PAYMENT_PROVIDER_OWNER_TYPES.PAYMENT_CHARGE).toBe("PAYMENT_CHARGE")
  })

  it("2. SETTLED_OWNER_TYPES (reconciliação e reparo)", () => {
    expect(SETTLED_OWNER_TYPES.has("PAYMENT_CHARGE")).toBe(true)
  })

  it("3. PaymentOwnerSettlementService: dependência e ramo", () => {
    const source = read("app/api/services/PaymentProviderPayment/PaymentOwnerSettlementService.ts")
    expect(source).toContain("paymentCharges: PaymentOwnerSettlement")
    expect(source).toContain("input.ownerType === PAYMENT_PROVIDER_OWNER_TYPES.PAYMENT_CHARGE")
  })

  it("4. composição injeta a liquidação por finalidade", () => {
    const source = read("app/api/services/PaymentProviderPayment/paymentOwnerSettlementComposition.ts")
    expect(source).toContain("paymentCharges: createPaymentChargeSettlement()")
  })

  it("5 e 6. os DOIS SQLs UNION ALL do PaymentProviderSessionRepository (reparo e reconciliação)", () => {
    const source = read("app/api/infra/data/repositories/paymentProviderSession/PaymentProviderSessionRepository.ts")
    const repairStart = source.indexOf("listOwnerAttemptsPendingSettlement(input")
    const reconciliationStart = source.indexOf("listOwnerAttemptsPendingReconciliation(input")
    const releaseStart = source.indexOf("releaseAttemptLease(input")
    expect(repairStart).toBeGreaterThan(-1)
    const repair = source.slice(repairStart, reconciliationStart)
    const reconciliation = source.slice(reconciliationStart, releaseStart)
    for (const sql of [repair, reconciliation]) {
      expect(sql).toContain(`s."owner_type" = 'PAYMENT_CHARGE'`)
      expect(sql).toContain(`INNER JOIN "payment_charges" c ON c."id"::text = s."owner_id"`)
    }
  })
})
