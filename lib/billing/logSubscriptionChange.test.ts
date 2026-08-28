import { describe, expect, it } from "bun:test";
import {
  lifecycleEventFromSubscriptionStatus,
  toSubscriptionChangeLogFields,
} from "./logSubscriptionChange";

describe("logSubscriptionChange helpers", () => {
  it("espelha eventType em changeType para compatibilidade", () => {
    expect(toSubscriptionChangeLogFields("contracted")).toEqual({
      eventType: "contracted",
      changeType: "contracted",
    });
  });

  it("mapeia status local para evento de timeline", () => {
    expect(lifecycleEventFromSubscriptionStatus("past_due")).toBe("overdue");
    expect(lifecycleEventFromSubscriptionStatus("active")).toBe("restored");
    expect(lifecycleEventFromSubscriptionStatus("suspended")).toBe("reduced");
    expect(lifecycleEventFromSubscriptionStatus("canceled")).toBe("cut");
    expect(lifecycleEventFromSubscriptionStatus("trial")).toBeNull();
  });
});
