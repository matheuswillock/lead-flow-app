import { describe, expect, it } from "bun:test";
import { FEATURE_SLUGS } from "@/lib/features/feature-slugs";
import {
  DELINQUENCY_CRM_ONLY_AFTER_DAYS,
  DELINQUENCY_CUT_OFF_AFTER_DAYS,
  isAllowedUnderCrmOnly,
  resolveDelinquencyTier,
  resolveEffectiveNextDueDate,
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

describe("isAllowedUnderCrmOnly — degrau crm_only preserva TODO o CRM (achado cursor PR #1198)", () => {
  it("crm-automations sobrevive — não está em FEATURE_PRODUCT_SLUG_MAP, mas é CRM", () => {
    expect(isAllowedUnderCrmOnly(FEATURE_SLUGS.CRM_AUTOMATIONS)).toBe(true);
  });

  it("todo slug CRM_* de FEATURE_SLUGS sobrevive — trava regressão quando nascer um novo", () => {
    const crmSlugs = Object.entries(FEATURE_SLUGS)
      .filter(([key]) => key === "CRM" || key.startsWith("CRM_"))
      .map(([, slug]) => slug);
    expect(crmSlugs.length).toBeGreaterThan(5);
    for (const slug of crmSlugs) {
      expect(isAllowedUnderCrmOnly(slug)).toBe(true);
    }
  });

  it("e-mail, whatsapp e radar NÃO sobrevivem", () => {
    expect(isAllowedUnderCrmOnly(FEATURE_SLUGS.EMAIL)).toBe(false);
    expect(isAllowedUnderCrmOnly(FEATURE_SLUGS.EMAIL_CAMPAIGNS)).toBe(false);
    expect(isAllowedUnderCrmOnly(FEATURE_SLUGS.WHATSAPP)).toBe(false);
    expect(isAllowedUnderCrmOnly(FEATURE_SLUGS.RADAR)).toBe(false);
  });

  it("slug desconhecido não sobrevive (fail-closed no degrau)", () => {
    expect(isAllowedUnderCrmOnly("slug-que-nao-existe")).toBe(false);
  });
});

describe("resolveEffectiveNextDueDate — dessincronia Profile × ProfileSubscription (achado codex P1 PR #1198)", () => {
  const older = new Date("2026-08-01T00:00:00.000Z");
  const newer = new Date("2026-09-15T00:00:00.000Z");

  it("ProfileSubscription nula → usa a data do Profile (webhook só atualiza lá)", () => {
    expect(resolveEffectiveNextDueDate(null, newer)).toEqual(newer);
  });

  it("Profile nula → usa a da ProfileSubscription", () => {
    expect(resolveEffectiveNextDueDate(newer, null)).toEqual(newer);
  });

  it("ProfileSubscription velha e Profile fresca → usa a mais recente (não pune por dado velho)", () => {
    expect(resolveEffectiveNextDueDate(older, newer)).toEqual(newer);
  });

  it("ProfileSubscription fresca e Profile velha → usa a mais recente", () => {
    expect(resolveEffectiveNextDueDate(newer, older)).toEqual(newer);
  });

  it("ambas nulas → null (sem evidência, sem punição)", () => {
    expect(resolveEffectiveNextDueDate(null, null)).toBeNull();
  });
});
