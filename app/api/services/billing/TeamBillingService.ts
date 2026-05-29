import { billingRepository } from "@/app/api/infra/data/repositories/billing/BillingRepository";
import { BILLING_PRICES, type BillingSummary } from "@/app/api/shared/billing/billingConfig";
import { buildBillingSummary } from "@/app/api/shared/billing/billingSummary";

export { BILLING_PRICES };
export { buildBillingSummary };

export async function getBillingSummary(masterId: string): Promise<BillingSummary> {
  const snapshot = await billingRepository.getBillingSnapshot(masterId);

  if (!snapshot) {
    throw new Error("Master não encontrado");
  }

  return buildBillingSummary(masterId, snapshot);
}
