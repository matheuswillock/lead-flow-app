import { describe, expect, it } from "bun:test";
import { lifecycleEventFromSubscriptionStatus } from "./lifecycleEventFromSubscriptionStatus";

describe("lifecycleEventFromSubscriptionStatus", () => {
  it("sem status anterior + active → contracted (primeira contratação)", () => {
    expect(lifecycleEventFromSubscriptionStatus(null, "active")).toBe("contracted");
    expect(lifecycleEventFromSubscriptionStatus(undefined, "active")).toBe("contracted");
  });

  it("trial + active → contracted", () => {
    expect(lifecycleEventFromSubscriptionStatus("trial", "active")).toBe("contracted");
  });

  it("active + active → renewed (renovação recorrente, não restored)", () => {
    expect(lifecycleEventFromSubscriptionStatus("active", "active")).toBe("renewed");
  });

  it("past_due + active → restored (reativação pós-atraso)", () => {
    expect(lifecycleEventFromSubscriptionStatus("past_due", "active")).toBe("restored");
  });

  it("suspended + active → restored (reativação pós-suspensão)", () => {
    expect(lifecycleEventFromSubscriptionStatus("suspended", "active")).toBe("restored");
  });

  it("canceled + active → restored (reativação pós-cancelamento)", () => {
    expect(lifecycleEventFromSubscriptionStatus("canceled", "active")).toBe("restored");
  });

  it("qualquer anterior + past_due → overdue", () => {
    expect(lifecycleEventFromSubscriptionStatus("active", "past_due")).toBe("overdue");
  });

  it("qualquer anterior + suspended → reduced", () => {
    expect(lifecycleEventFromSubscriptionStatus("active", "suspended")).toBe("reduced");
  });

  it("qualquer anterior + canceled → cut", () => {
    expect(lifecycleEventFromSubscriptionStatus("active", "canceled")).toBe("cut");
  });

  it("status novo não mapeado → null", () => {
    expect(lifecycleEventFromSubscriptionStatus("active", "trial")).toBeNull();
  });
});
