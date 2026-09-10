// 20 — Assinaturas — Backend E7 (C4/DA6). Guard na origem da gravação da
// adesão: mata o elo 1 da cadeia do §4 da 01 (adesão grava valor/ciclo
// errados → customer barulhento → Asaas notifica o cliente com o valor
// errado). Fixture de teste = tabela §3.1 da 01 (venda real R$ 274,20
// trimestral gravada como mensal de 79,90–171,00 nos dados históricos).
// number | string cobre input direto de teste; { toString(): string } cobre
// Prisma.Decimal (BackofficeAdhesion.monthlyTotalAmount/totalAmount) sem
// acoplar este módulo puro ao client do Prisma.
type AmountLike = number | string | { toString(): string };

export type AdhesionSubscriptionWriteGuardInput = {
  cycle: string;
  subscriptionEndDate: Date;
  subscriptionNextDueDate: Date;
  monthlyTotalAmount: AmountLike;
  totalAmount: AmountLike;
};

export type AdhesionSubscriptionWriteGuardResult =
  | { valid: true }
  | { valid: false; errors: string[] };

const CYCLE_MONTHS: Record<string, number> = {
  monthly: 1,
  quarterly: 3,
  quadrimester: 4,
  semiannual: 6,
  annual: 12,
};

/** Tolerância de arredondamento de centavos entre monthlyTotalAmount × meses e totalAmount. */
const AMOUNT_TOLERANCE = 0.01;

function toNumber(value: AmountLike): number | null {
  const n = typeof value === "number" ? value : Number(value.toString());
  return Number.isFinite(n) ? n : null;
}

export function validateAdhesionSubscriptionWrite(
  input: AdhesionSubscriptionWriteGuardInput,
): AdhesionSubscriptionWriteGuardResult {
  const errors: string[] = [];

  if (input.subscriptionNextDueDate.getTime() > input.subscriptionEndDate.getTime()) {
    errors.push(
      `subscriptionNextDueDate (${input.subscriptionNextDueDate.toISOString()}) não pode ser posterior a ` +
        `subscriptionEndDate (${input.subscriptionEndDate.toISOString()}) — due ≤ fim é invariante da adesão.`,
    );
  }

  const cycleMonths = CYCLE_MONTHS[input.cycle];
  if (!cycleMonths) {
    errors.push(
      `Ciclo "${input.cycle}" não reconhecido — valores válidos: ${Object.keys(CYCLE_MONTHS).join(", ")}.`,
    );
  }

  const monthly = toNumber(input.monthlyTotalAmount);
  const total = toNumber(input.totalAmount);
  if (cycleMonths && monthly !== null && total !== null) {
    const expectedTotal = Math.round(monthly * cycleMonths * 100) / 100;
    if (Math.abs(expectedTotal - total) > AMOUNT_TOLERANCE) {
      errors.push(
        `totalAmount (${total}) incoerente com monthlyTotalAmount × ciclo — esperado ${expectedTotal} ` +
          `(${monthly} × ${cycleMonths} meses para ciclo "${input.cycle}").`,
      );
    }
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}
