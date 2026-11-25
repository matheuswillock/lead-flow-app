import { describe, expect, it } from "bun:test";
import {
  calculateProportionalAddonCharge,
  maxInstallmentsForCycle,
  ProportionalChargeError,
  resolveAddonMaxInstallments,
  STANDALONE_CHARGE_MAX_INSTALLMENTS,
  validateRequestedInstallments,
} from "./proportionalAddonCharge";

// Datas em UTC (a contagem de dias é feita em UTC).
const utc = (year: number, monthIndex: number, day: number) => new Date(Date.UTC(year, monthIndex, day));
const now = utc(2026, 0, 15); // 15/jan/2026

describe("calculateProportionalAddonCharge", () => {
  it("plano anual com 10 meses restantes cobra o add-on por 10 meses (total = delta × 10)", () => {
    const endDate = utc(2026, 10, 15); // 15/nov/2026 => exatamente 10 meses após 15/jan

    const charge = calculateProportionalAddonCharge({ billingDelta: 30, endDate, now });

    expect(charge.remainingMonths).toBe(10);
    expect(charge.totalCharge).toBe(300);
  });

  it("fim exatamente em aniversário conta meses inteiros (hoje 23/nov/2026, fim 23/set/2027 → 10)", () => {
    const today = utc(2026, 10, 23);

    const charge = calculateProportionalAddonCharge({
      billingDelta: 30,
      endDate: utc(2027, 8, 23),
      now: today,
    });

    expect(charge.remainingMonths).toBe(10);
    expect(charge.totalCharge).toBe(300);
  });

  it("fração do mês parcial conta por dias (hoje 23/nov/2026, fim 02/nov/2027 → 11 + 10/31 ≈ 11,32)", () => {
    const today = utc(2026, 10, 23);

    const charge = calculateProportionalAddonCharge({
      billingDelta: 30,
      endDate: utc(2027, 10, 2),
      now: today,
    });

    expect(charge.remainingMonths).toBe(11.32);
    expect(charge.totalCharge).toBe(339.6);
  });

  it("cliente no mês de renovação (fim no mesmo mês, antes do aniversário) cobra no mínimo 1 mês", () => {
    const charge = calculateProportionalAddonCharge({
      billingDelta: 25.5,
      endDate: utc(2026, 0, 31),
      now,
    });

    expect(charge.remainingMonths).toBe(1);
    expect(charge.totalCharge).toBe(25.5);
  });

  it("fim no mesmo dia de hoje cobra o mínimo de 1 mês", () => {
    const today = utc(2026, 10, 23);

    const charge = calculateProportionalAddonCharge({ billingDelta: 10, endDate: today, now: today });

    expect(charge.remainingMonths).toBe(1);
    expect(charge.totalCharge).toBe(10);
  });

  it("fim do ciclo já passado cobra o mínimo de 1 mês", () => {
    const charge = calculateProportionalAddonCharge({
      billingDelta: 10,
      endDate: utc(2025, 11, 1),
      now,
    });

    expect(charge.remainingMonths).toBe(1);
    expect(charge.totalCharge).toBe(10);
  });

  it("sem data de fim e sem delta (assinatura permanente) devolve cobrança zero, sem lançar", () => {
    expect(calculateProportionalAddonCharge({ billingDelta: 0, endDate: null, now })).toEqual({
      remainingMonths: 0,
      totalCharge: 0,
    });
  });

  it("sem data de fim lança ProportionalChargeError (nunca cobra 1 mês em silêncio)", () => {
    expect(() => calculateProportionalAddonCharge({ billingDelta: 40, endDate: null, now })).toThrow(
      ProportionalChargeError
    );
    expect(() => calculateProportionalAddonCharge({ billingDelta: 40, endDate: null, now })).toThrow(
      "Não foi possível calcular a cobrança proporcional: a assinatura não tem data de fim de ciclo."
    );
  });

  it("data de fim inválida é tratada como ausente", () => {
    expect(() =>
      calculateProportionalAddonCharge({ billingDelta: 40, endDate: new Date("nao-e-data"), now })
    ).toThrow(ProportionalChargeError);
  });

  it("arredonda o total em centavos", () => {
    const charge = calculateProportionalAddonCharge({
      billingDelta: 10.005,
      endDate: utc(2026, 2, 15), // 2 meses exatos
      now,
    });

    expect(charge.remainingMonths).toBe(2);
    expect(charge.totalCharge).toBe(20.01);
  });
});

describe("maxInstallmentsForCycle", () => {
  it.each([
    ["monthly", 1],
    ["MONTHLY", 1],
    ["quarterly", 3],
    ["QUARTERLY", 3],
    ["quadrimester", 4],
    ["semiannual", 6],
    ["SEMIANNUALLY", 6],
    ["annual", 12],
    ["YEARLY", 12],
    [" Annual ", 12],
  ])("ciclo %p permite até %p parcelas", (cycle, expected) => {
    expect(maxInstallmentsForCycle(cycle)).toBe(expected);
  });

  it.each([null, undefined, "", "WEEKLY", "constructor"])("ciclo ausente ou desconhecido (%p) cai em 1x", (cycle) => {
    expect(maxInstallmentsForCycle(cycle)).toBe(1);
  });
});

describe("resolveAddonMaxInstallments", () => {
  it("mensal é sempre 1x, mesmo com mais de um mês restante", () => {
    expect(resolveAddonMaxInstallments({ cycle: "monthly", remainingMonths: 1.5 })).toBe(1);
  });

  it("anual com o ano inteiro restante permite 12x", () => {
    expect(resolveAddonMaxInstallments({ cycle: "annual", remainingMonths: 12 })).toBe(12);
    expect(resolveAddonMaxInstallments({ cycle: "YEARLY", remainingMonths: 12.4 })).toBe(12);
  });

  it("anual não passa dos meses que ainda restam ao contrato (piso de 1x)", () => {
    expect(resolveAddonMaxInstallments({ cycle: "annual", remainingMonths: 5.9 })).toBe(5);
    expect(resolveAddonMaxInstallments({ cycle: "annual", remainingMonths: 1 })).toBe(1);
    expect(resolveAddonMaxInstallments({ cycle: "annual", remainingMonths: 0.4 })).toBe(1);
  });

  it("cobrança avulsa do backoffice é à vista", () => {
    expect(STANDALONE_CHARGE_MAX_INSTALLMENTS).toBe(1);
  });
});

describe("validateRequestedInstallments", () => {
  it("aceita de 1 até o máximo do ciclo", () => {
    expect(validateRequestedInstallments(1, 1)).toBeNull();
    expect(validateRequestedInstallments(12, 12)).toBeNull();
  });

  it("mensal rejeita 2x e anual rejeita 13x, com mensagem em PT-BR", () => {
    expect(validateRequestedInstallments(2, 1)).toBe("Este contrato permite apenas pagamento à vista (1x) no cartão.");
    expect(validateRequestedInstallments(13, 12)).toBe(
      "Parcelamento acima do permitido: este contrato permite até 12x no cartão.",
    );
  });

  it.each([0, -3, 2.5, Number.NaN])("rejeita quantidade inválida (%p)", (requested) => {
    expect(validateRequestedInstallments(requested, 12)).toBe("Número de parcelas inválido.");
  });
});
