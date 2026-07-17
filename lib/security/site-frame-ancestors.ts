type Header = { key: string; value: string };

export const DEFAULT_SITE_FRAME_ANCESTORS = [
  "https://willockshouse.com",
  "https://www.willockshouse.com",
  "http://localhost:3000",
] as const;

/**
 * Rotas públicas (LiveFrame) que podem ser embutidas por Willocks House /
 * `SITE_FRAME_ANCESTORS`. Demais rotas usam política DENY/`'none'`.
 */
export const LIVE_FRAME_HEADER_SOURCES = ["/", "/prime", "/recursos"] as const;

function parseExtraFrameAncestors(raw: string | undefined): string[] {
  if (!raw?.trim()) {
    return [];
  }

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function buildSiteFrameAncestorsDirective(
  extraAncestorsEnv = process.env.SITE_FRAME_ANCESTORS,
): string {
  const ancestors = [
    ...DEFAULT_SITE_FRAME_ANCESTORS,
    ...parseExtraFrameAncestors(extraAncestorsEnv),
  ];

  const uniqueAncestors = [...new Set(ancestors)];
  return `frame-ancestors 'self' ${uniqueAncestors.join(" ")}`;
}

const baseSecurityHeaders: Header[] = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

/** Headers para rotas LiveFrame/públicas embutíveis (allowlist externa). */
export function getSiteSecurityHeaders(): Header[] {
  return [
    { key: "Content-Security-Policy", value: buildSiteFrameAncestorsDirective() },
    ...baseSecurityHeaders,
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
}

export const getLiveFrameSecurityHeaders = getSiteSecurityHeaders;

/**
 * Headers para rotas autenticadas/admin e demais páginas do app.
 * Equivale ao antigo X-Frame-Options: DENY (sem allowlist externa).
 */
export function getLockedSiteSecurityHeaders(): Header[] {
  return [
    { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
    { key: "X-Frame-Options", value: "DENY" },
    ...baseSecurityHeaders,
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ];
}

export function getWhatsAppSecurityHeaders(): Header[] {
  return [
    { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
    ...baseSecurityHeaders,
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(self), geolocation=()",
    },
  ];
}

/**
 * Matcher do catch-all DENY: qualquer path com ≥1 segmento, exceto LiveFrame,
 * lead-form e rotas WhatsApp (que têm headers próprios).
 * A raiz `/` fica só no matcher LiveFrame (`.+` não casa path vazio).
 */
export function buildLockedSiteHeaderSource(): string {
  const excludedPrefixes = ["lead-form", ...LIVE_FRAME_HEADER_SOURCES.filter((s) => s !== "/")].map(
    (source) => source.replace(/^\//, ""),
  );
  const prefixExclusion = excludedPrefixes.map((prefix) => `${prefix}(?:/|$)`).join("|");
  return `/((?!${prefixExclusion}|[^/]+/whatsapp(?:/|$)).+)`;
}
