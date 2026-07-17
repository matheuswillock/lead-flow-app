import { afterEach, describe, expect, it } from "bun:test";
import {
  DEFAULT_SITE_FRAME_ANCESTORS,
  buildSiteFrameAncestorsDirective,
  getSiteSecurityHeaders,
  getWhatsAppSecurityHeaders,
} from "@/lib/security/site-frame-ancestors";

describe("site frame ancestors", () => {
  const originalAncestors = process.env.SITE_FRAME_ANCESTORS;

  afterEach(() => {
    if (originalAncestors === undefined) {
      delete process.env.SITE_FRAME_ANCESTORS;
    } else {
      process.env.SITE_FRAME_ANCESTORS = originalAncestors;
    }
  });

  it("does not set X-Frame-Options on site headers", () => {
    const headers = getSiteSecurityHeaders();
    expect(headers.find((header) => header.key === "X-Frame-Options")).toBeUndefined();
  });

  it("sets frame-ancestors with Willocks House defaults and self", () => {
    const csp = getSiteSecurityHeaders().find(
      (header) => header.key === "Content-Security-Policy",
    );
    expect(csp?.value).toStartWith("frame-ancestors 'self'");

    for (const origin of DEFAULT_SITE_FRAME_ANCESTORS) {
      expect(csp?.value).toContain(origin);
    }
  });

  it("merges extra origins from SITE_FRAME_ANCESTORS", () => {
    process.env.SITE_FRAME_ANCESTORS = "https://preview.exemplo.com, https://outro.exemplo.com";

    const directive = buildSiteFrameAncestorsDirective();
    expect(directive).toContain("https://preview.exemplo.com");
    expect(directive).toContain("https://outro.exemplo.com");
  });

  it("keeps WhatsApp routes self-framed only without X-Frame-Options", () => {
    const headers = getWhatsAppSecurityHeaders();
    expect(headers.find((header) => header.key === "X-Frame-Options")).toBeUndefined();

    const csp = headers.find((header) => header.key === "Content-Security-Policy");
    expect(csp?.value).toBe("frame-ancestors 'self'");
  });
});
