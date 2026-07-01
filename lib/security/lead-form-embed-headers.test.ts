import { afterEach, describe, expect, it } from "bun:test";
import {
  DEFAULT_LEAD_FORM_FRAME_ANCESTORS,
  getLeadFormEmbedHeaders,
} from "@/lib/security/lead-form-embed-headers";

describe("getLeadFormEmbedHeaders", () => {
  const originalAncestors = process.env.LEAD_FORM_FRAME_ANCESTORS;

  afterEach(() => {
    if (originalAncestors === undefined) {
      delete process.env.LEAD_FORM_FRAME_ANCESTORS;
    } else {
      process.env.LEAD_FORM_FRAME_ANCESTORS = originalAncestors;
    }
  });

  it("does not set X-Frame-Options", () => {
    const headers = getLeadFormEmbedHeaders();
    expect(headers.find((header) => header.key === "X-Frame-Options")).toBeUndefined();
  });

  it("sets frame-ancestors with defaults and self", () => {
    const csp = getLeadFormEmbedHeaders().find((header) => header.key === "Content-Security-Policy");
    expect(csp?.value).toStartWith("frame-ancestors 'self'");

    for (const origin of DEFAULT_LEAD_FORM_FRAME_ANCESTORS) {
      expect(csp?.value).toContain(origin);
    }
  });

  it("merges extra origins from LEAD_FORM_FRAME_ANCESTORS", () => {
    process.env.LEAD_FORM_FRAME_ANCESTORS = "https://painel.cliente.com, https://outro.exemplo.com";

    const csp = getLeadFormEmbedHeaders().find((header) => header.key === "Content-Security-Policy");
    expect(csp?.value).toContain("https://painel.cliente.com");
    expect(csp?.value).toContain("https://outro.exemplo.com");
  });
});
