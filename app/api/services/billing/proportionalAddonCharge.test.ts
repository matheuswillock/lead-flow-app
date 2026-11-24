import { describe, expect, it } from "bun:test";
import { calculateProportionalAddonCharge, ProportionalChargeError } from "./proportionalAddonCharge";

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
