type Header = { key: string; value: string };

export const DEFAULT_LEAD_FORM_FRAME_ANCESTORS = [
  "https://*.3c.plus",
  "https://*.facebook.com",
  "https://*.meta.com",
  "https://business.facebook.com",
  "https://web.whatsapp.com",
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

function buildFrameAncestorsDirective(): string {
  const ancestors = [
    ...DEFAULT_LEAD_FORM_FRAME_ANCESTORS,
    ...parseExtraFrameAncestors(process.env.LEAD_FORM_FRAME_ANCESTORS),
  ];

  const uniqueAncestors = [...new Set(ancestors)];
  return `frame-ancestors 'self' ${uniqueAncestors.join(" ")}`;
}

export function getLeadFormEmbedHeaders(): Header[] {
  return [
    { key: "Content-Security-Policy", value: buildFrameAncestorsDirective() },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    { key: "X-DNS-Prefetch-Control", value: "on" },
  ];
}
