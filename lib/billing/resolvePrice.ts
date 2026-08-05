import { prisma } from "@/app/api/infra/data/prisma";
import type { BackofficeAdhesionBillingCycle, BackofficePaymentMethod } from "@prisma/client";

export type ResolvePriceInput = {
  featureSlug?: string;
  productId?: string;
  cycle: "MONTHLY" | "QUARTERLY" | "SEMIANNUALLY" | "YEARLY" | string;
  method?: "PIX" | "CREDIT_CARD" | "BOLETO" | string;
};

/**
 * Estágio 6 / D1 — resolve preço via catálogo BackofficeProduct (+ payment rules).
 * Sem literais System A. Retorna null se não houver regra (UI deve Skeleton).
 */
export async function resolvePrice(input: ResolvePriceInput): Promise<number | null> {
  const billingCycle = toBillingCycle(input.cycle);
  const paymentMethod = toPaymentMethod(input.method ?? "PIX");
  if (!billingCycle || !paymentMethod) return null;

  const product = input.productId
    ? await prisma.backofficeProduct.findFirst({
        where: { id: input.productId, isActive: true },
        select: {
          paymentRules: {
            select: { price: true, billingCycle: true, paymentMethod: true },
          },
        },
      })
    : input.featureSlug
      ? await prisma.backofficeProduct.findFirst({
          where: {
            isActive: true,
            featureSlugs: { has: input.featureSlug },
          },
          select: {
            paymentRules: {
              select: { price: true, billingCycle: true, paymentMethod: true },
            },
          },
        })
      : null;

  if (!product) return null;

  const exact = product.paymentRules.find(
    (r) => r.billingCycle === billingCycle && r.paymentMethod === paymentMethod
  );
  if (exact) return Number(exact.price);

  const byCycle = product.paymentRules.find((r) => r.billingCycle === billingCycle);
  if (byCycle) return Number(byCycle.price);

  return null;
}

function toBillingCycle(cycle: string): BackofficeAdhesionBillingCycle | null {
  const c = cycle.toUpperCase();
  if (c === "MONTHLY" || c === "MONTH") return "monthly";
  if (c === "QUARTERLY" || c === "QUARTER") return "quarterly";
  if (c === "SEMIANNUALLY" || c === "SEMIANNUAL" || c === "SEMI_ANNUAL") return "semiannual";
  if (c === "YEARLY" || c === "ANNUAL" || c === "YEAR") return "annual";
  if (c === "MONTHLY".toLowerCase()) return "monthly";
  const lower = cycle.toLowerCase();
  if (lower === "monthly" || lower === "quarterly" || lower === "semiannual" || lower === "annual") {
    return lower as BackofficeAdhesionBillingCycle;
  }
  return null;
}

function toPaymentMethod(method: string): BackofficePaymentMethod | null {
  const m = method.toUpperCase();
  if (m === "PIX") return "PIX";
  if (m === "CREDIT_CARD" || m === "CARD") return "CREDIT_CARD";
  return null;
}
