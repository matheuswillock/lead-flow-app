type Header = { key: string; value: string };

export const DEFAULT_SITE_FRAME_ANCESTORS = [
  "https://willockshouse.com",
  "https://www.willockshouse.com",
  "http://localhost:3000",
] as const;

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

export function getSiteSecurityHeaders(): Header[] {
  return [
    { key: "Content-Security-Policy", value: buildSiteFrameAncestorsDirective() },
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
