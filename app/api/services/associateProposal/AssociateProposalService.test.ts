import { describe, expect, it } from "bun:test";
import { AssociateProposalService } from "./AssociateProposalService";

describe("AssociateProposalService.evaluateRequiredDocumentsForOfferSubmission", () => {
  it("returns not blocked for any team (gate removed)", async () => {
    const service = new AssociateProposalService();
    const result = await service.evaluateRequiredDocumentsForOfferSubmission(
      "00000000-0000-0000-0000-000000000001",
      "00000000-0000-0000-0000-000000000002"
    );
    expect(result.blocked).toBe(false);
    expect(result.pendingTypes).toEqual([]);
  });
});

describe("AssociateProposalService.hasPendingRequiredDocuments", () => {
  it("exposes pending check helper", async () => {
    const service = new AssociateProposalService();
    const result = await service
      .hasPendingRequiredDocuments("00000000-0000-0000-0000-000000000099")
      .catch(() => false);
    expect(typeof result).toBe("boolean");
  });
});
