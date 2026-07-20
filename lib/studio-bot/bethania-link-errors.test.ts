import { describe, expect, test } from "bun:test";
import {
  BETHANIA_LINK_ERROR_CODES,
  buildBethaniaLinkErrorResult,
  mapServiceErrorToBethaniaLinkCode,
} from "./bethania-link-errors";

describe("bethania-link-errors", () => {
  test("mapeia RATE_LIMIT para código estável", () => {
    expect(mapServiceErrorToBethaniaLinkCode("RATE_LIMIT")).toBe(
      BETHANIA_LINK_ERROR_CODES.RATE_LIMIT
    );
  });

  test("buildBethaniaLinkErrorResult inclui correlationId curto", () => {
    const result = buildBethaniaLinkErrorResult("RATE_LIMIT");
    expect(result.errorCode).toBe(BETHANIA_LINK_ERROR_CODES.RATE_LIMIT);
    expect(result.correlationId).toMatch(/^[a-f0-9]{12}$/);
  });

  test("erro interno usa BETHANIA_LINK_INTERNAL", () => {
    const result = buildBethaniaLinkErrorResult(null, { isInternal: true });
    expect(result.errorCode).toBe(BETHANIA_LINK_ERROR_CODES.INTERNAL);
  });
});
