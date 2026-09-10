import { describe, expect, it } from "bun:test";
import { isBlockedFromAutomaticMigration } from "./migration-gates";

describe("isBlockedFromAutomaticMigration — gate C5 dos permanentes+ativos (T-20.23)", () => {
  it("permanente + active → marcado (ex.: Bruno)", () => {
    expect(
      isBlockedFromAutomaticMigration({ hasPermanentSubscription: true, subscriptionStatus: "active" }),
    ).toBe(true);
  });

  it("permanente + past_due → marcado (ex.: Matheus/Corretor Seguro — casos reais)", () => {
    expect(
      isBlockedFromAutomaticMigration({ hasPermanentSubscription: true, subscriptionStatus: "past_due" }),
    ).toBe(true);
  });

  it("permanente sem assinatura (status null) → NÃO marcado", () => {
    expect(
      isBlockedFromAutomaticMigration({ hasPermanentSubscription: true, subscriptionStatus: null }),
    ).toBe(false);
  });

  it("permanente + canceled → NÃO marcado (não é mais 'ativa')", () => {
    expect(
      isBlockedFromAutomaticMigration({ hasPermanentSubscription: true, subscriptionStatus: "canceled" }),
    ).toBe(false);
  });

  it("ativa sem flag hasPermanentSubscription → NÃO marcado", () => {
    expect(
      isBlockedFromAutomaticMigration({ hasPermanentSubscription: false, subscriptionStatus: "active" }),
    ).toBe(false);
  });

  it("nem permanente nem ativa → NÃO marcado", () => {
    expect(
      isBlockedFromAutomaticMigration({ hasPermanentSubscription: false, subscriptionStatus: null }),
    ).toBe(false);
  });
});
