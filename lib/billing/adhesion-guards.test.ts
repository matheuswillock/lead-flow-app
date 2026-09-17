import { describe, expect, it } from "bun:test";
import { validateAdhesionSubscriptionWrite } from "./adhesion-guards";

const dueEqualsEnd = (iso: string) => ({
  subscriptionEndDate: new Date(iso),
  subscriptionNextDueDate: new Date(iso),
});

describe("validateAdhesionSubscriptionWrite — fixtures da tabela §3.1 da 01", () => {
  it("Carlos Henrique — 151,10/mês gravado como MONTHLY com total 453,30 (3 meses) → rejeitado", () => {
    const result = validateAdhesionSubscriptionWrite({
      cycle: "monthly",
      ...dueEqualsEnd("2026-10-20T00:00:00.000Z"),
      monthlyTotalAmount: 151.1,
      totalAmount: 453.3,
    });
    expect(result.valid).toBe(false);
  });

  it("Rodrigo Moreno — 171,00/mês gravado como MONTHLY com total 513,00 (3 meses) → rejeitado", () => {
    const result = validateAdhesionSubscriptionWrite({
      cycle: "monthly",
      ...dueEqualsEnd("2026-10-20T00:00:00.000Z"),
      monthlyTotalAmount: 171.0,
      totalAmount: 513.0,
    });
    expect(result.valid).toBe(false);
  });

  it("Jean Cristian — 91,40/mês gravado como MONTHLY com total 274,20 (venda trimestral) → rejeitado", () => {
    const result = validateAdhesionSubscriptionWrite({
      cycle: "monthly",
      ...dueEqualsEnd("2026-10-20T00:00:00.000Z"),
      monthlyTotalAmount: 91.4,
      totalAmount: 274.2,
    });
    expect(result.valid).toBe(false);
  });

  it("Erick — due (2027-07-20) posterior ao fim (2026-10-20) → rejeitado (invariante temporal)", () => {
    const result = validateAdhesionSubscriptionWrite({
      cycle: "quarterly",
      subscriptionEndDate: new Date("2026-10-20T00:00:00.000Z"),
      subscriptionNextDueDate: new Date("2027-07-20T00:00:00.000Z"),
      monthlyTotalAmount: 91.4,
      totalAmount: 274.2,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("due"))).toBe(true);
    }
  });

  it("adesão correta — 274,20 total / QUARTERLY, due = fim → aceita", () => {
    const result = validateAdhesionSubscriptionWrite({
      cycle: "quarterly",
      ...dueEqualsEnd("2026-10-20T00:00:00.000Z"),
      monthlyTotalAmount: 91.4,
      totalAmount: 274.2,
    });
    expect(result.valid).toBe(true);
  });

  it("Patricia Cordeiro — 598,80 total / SEMIANNUALLY já correta (marcada ✓ na 01) → aceita", () => {
    const result = validateAdhesionSubscriptionWrite({
      cycle: "semiannual",
      ...dueEqualsEnd("2027-04-20T00:00:00.000Z"),
      monthlyTotalAmount: 99.8,
      totalAmount: 598.8,
    });
    expect(result.valid).toBe(true);
  });

  it("ciclo desconhecido → rejeitado", () => {
    const result = validateAdhesionSubscriptionWrite({
      cycle: "biweekly",
      ...dueEqualsEnd("2026-10-20T00:00:00.000Z"),
      monthlyTotalAmount: 100,
      totalAmount: 100,
    });
    expect(result.valid).toBe(false);
  });
});
