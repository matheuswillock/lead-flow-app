import { afterEach, describe, expect, it } from "bun:test";
import {
  DEFAULT_SITE_FRAME_ANCESTORS,
  LIVE_FRAME_HEADER_SOURCES,
  buildLockedSiteHeaderSource,
  buildSiteFrameAncestorsDirective,
  getLockedSiteSecurityHeaders,
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

  it("does not set X-Frame-Options on LiveFrame site headers", () => {
    const headers = getSiteSecurityHeaders();
    expect(headers.find((header) => header.key === "X-Frame-Options")).toBeUndefined();
  });

  it("sets frame-ancestors with Willocks House defaults and self for LiveFrame", () => {
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

  it("locks authenticated/admin routes with DENY and frame-ancestors none", () => {
    const headers = getLockedSiteSecurityHeaders();
    expect(headers.find((header) => header.key === "X-Frame-Options")?.value).toBe("DENY");

    const csp = headers.find((header) => header.key === "Content-Security-Policy");
    expect(csp?.value).toBe("frame-ancestors 'none'");
  });

  it("scopes LiveFrame allowlist to public routes and excludes them from DENY matcher", () => {
    expect(LIVE_FRAME_HEADER_SOURCES).toContain("/");
    expect(LIVE_FRAME_HEADER_SOURCES).toContain("/prime");
    expect(LIVE_FRAME_HEADER_SOURCES).toContain("/recursos");

    const lockedSource = buildLockedSiteHeaderSource();
    expect(lockedSource).toContain("lead-form");
    expect(lockedSource).toContain("backoffice-lead-form");
    expect(lockedSource).toContain("prime");
    expect(lockedSource).toContain("recursos");
    expect(lockedSource).toContain("whatsapp");
    // `.+` evita casar a raiz `/`, que fica só no matcher LiveFrame
    expect(lockedSource.endsWith(".+)")).toBe(true);
  });

  it("keeps WhatsApp routes self-framed only without X-Frame-Options", () => {
    const headers = getWhatsAppSecurityHeaders();
    expect(headers.find((header) => header.key === "X-Frame-Options")).toBeUndefined();

    const csp = headers.find((header) => header.key === "Content-Security-Policy");
    expect(csp?.value).toBe("frame-ancestors 'self'");
  });
});
