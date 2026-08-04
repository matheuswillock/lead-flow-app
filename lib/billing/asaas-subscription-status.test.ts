import { describe, expect, test } from "bun:test";
import {
  isAsaasRealSubscriptionEvent,
  mapSubscriptionStatusFromEvent,
  mapSubscriptionStatusFromPayload,
  resolveLocalSubscriptionStatus,
} from "./asaas-subscription-status";

describe("asaas-subscription-status", () => {
  test("reconhece apenas eventos reais", () => {
    expect(isAsaasRealSubscriptionEvent("SUBSCRIPTION_UPDATED")).toBe(true);
    expect(isAsaasRealSubscriptionEvent("SUBSCRIPTION_INACTIVATED")).toBe(true);
    expect(isAsaasRealSubscriptionEvent("SUBSCRIPTION_ACTIVATED")).toBe(false);
    expect(isAsaasRealSubscriptionEvent("SUBSCRIPTION_SUSPENDED")).toBe(false);
    expect(isAsaasRealSubscriptionEvent("SUBSCRIPTION_CANCELED")).toBe(false);
  });

  test("mapeia payload INACTIVE → suspended e EXPIRED → canceled", () => {
    expect(mapSubscriptionStatusFromPayload("INACTIVE")).toBe("suspended");
    expect(mapSubscriptionStatusFromPayload("EXPIRED")).toBe("canceled");
    expect(mapSubscriptionStatusFromPayload("ACTIVE")).toBe("active");
    expect(mapSubscriptionStatusFromPayload("UNKNOWN")).toBeUndefined();
  });

  test("não reativa com fallback active quando status/evento desconhecido", () => {
    expect(
      resolveLocalSubscriptionStatus({
        event: "SUBSCRIPTION_UPDATED",
        payloadStatus: "INACTIVE",
      })
    ).toBe("suspended");

    expect(
      resolveLocalSubscriptionStatus({
        event: "SUBSCRIPTION_UPDATED",
        payloadStatus: "WEIRD",
      })
    ).toBeUndefined();

    expect(
      resolveLocalSubscriptionStatus({
        event: "SUBSCRIPTION_ACTIVATED",
        payloadStatus: undefined,
      })
    ).toBeUndefined();

    expect(mapSubscriptionStatusFromEvent("SUBSCRIPTION_CREATED")).toBe("active");
    expect(mapSubscriptionStatusFromEvent("SUBSCRIPTION_DELETED")).toBe("canceled");
  });
});
