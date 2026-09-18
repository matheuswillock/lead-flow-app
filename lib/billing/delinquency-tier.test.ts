import { describe, expect, it } from "bun:test";
import {
  DELINQUENCY_CRM_ONLY_AFTER_DAYS,
  DELINQUENCY_CUT_OFF_AFTER_DAYS,
  resolveDelinquencyTier,
} from "./delinquency-tier";

const NOW = new Date("2026-09-17T12:00:00.000Z");

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);
}

describe("resolveDelinquencyTier — Fase 4 (E1 do plano de Assinaturas)", () => {
  it("status active nunca degrada, mesmo com due date antiga", () => {
    expect(
      resolveDelinquencyTier({
        subscriptionStatus: "active",
        subscriptionNextDueDate: daysAgo(30),
        now: NOW,
      }),
    ).toBe("full_access");
  });

  it("status trial nunca degrada", () => {
    expect(
      resolveDelinquencyTier({
        subscriptionStatus: "trial",
        subscriptionNextDueDate: daysAgo(30),
        now: NOW,
      }),
    ).toBe("full_access");
  });

  it("hasPermanentSubscription nunca degrada, mesmo past_due há 30 dias", () => {
    expect(
      resolveDelinquencyTier({
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: daysAgo(30),
        hasPermanentSubscription: true,
        now: NOW,
      }),
    ).toBe("full_access");
  });

  it("past_due sem subscriptionNextDueDate não pune sem evidência (fail-open, espelha DA3 da E20)", () => {
    expect(
      resolveDelinquencyTier({
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: null,
        now: NOW,
      }),
    ).toBe("full_access");
  });

  it("dia 0 (venceu hoje) → acesso total", () => {
    expect(
      resolveDelinquencyTier({
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: daysAgo(0),
        now: NOW,
      }),
    ).toBe("full_access");
  });

  it("dia 4 → acesso total (ainda dentro da janela 0-5)", () => {
    expect(
      resolveDelinquencyTier({
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: daysAgo(4),
        now: NOW,
      }),
    ).toBe("full_access");
  });

  it("dia 5 (limiar) → somente CRM", () => {
    expect(
      resolveDelinquencyTier({
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: daysAgo(DELINQUENCY_CRM_ONLY_AFTER_DAYS),
        now: NOW,
      }),
    ).toBe("crm_only");
  });

  it("dia 10 → somente CRM", () => {
    expect(
      resolveDelinquencyTier({
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: daysAgo(10),
        now: NOW,
      }),
    ).toBe("crm_only");
  });

  it("dia 14 → somente CRM (ainda não cortou)", () => {
    expect(
      resolveDelinquencyTier({
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: daysAgo(14),
        now: NOW,
      }),
    ).toBe("crm_only");
  });

  it("dia 15 (limiar) → corte total", () => {
    expect(
      resolveDelinquencyTier({
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: daysAgo(DELINQUENCY_CUT_OFF_AFTER_DAYS),
        now: NOW,
      }),
    ).toBe("cut_off");
  });

  it("dia 40 → corte total", () => {
    expect(
      resolveDelinquencyTier({
        subscriptionStatus: "past_due",
        subscriptionNextDueDate: daysAgo(40),
        now: NOW,
      }),
    ).toBe("cut_off");
  });

  it("status suspended/canceled não passam pelo predicado de past_due (tratados em outro lugar) — full_access aqui, quem corta é o gate de assinatura ativa", () => {
    expect(
      resolveDelinquencyTier({
        subscriptionStatus: "canceled",
        subscriptionNextDueDate: daysAgo(40),
        now: NOW,
      }),
    ).toBe("full_access");
  });
});
