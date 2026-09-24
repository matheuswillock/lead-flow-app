import { describe, expect, it } from "bun:test";
import { UpdateLeadRequestSchema } from "./requestToUpdateLead";

describe("UpdateLeadRequestSchema email", () => {
  it("preserves explicit null so the use case can clear the email", () => {
    expect(UpdateLeadRequestSchema.parse({ email: null }).email).toBeNull();
  });

  it("keeps an omitted email out of the update payload", () => {
    expect(UpdateLeadRequestSchema.parse({ name: "Ana" })).not.toHaveProperty("email");
  });

  it("accepts a valid email", () => {
    expect(UpdateLeadRequestSchema.parse({ email: "ana@example.com" }).email).toBe("ana@example.com");
  });
});
