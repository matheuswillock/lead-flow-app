import { randomBytes } from "node:crypto";
import { hashStudioWebhookToken } from "@/lib/webhooks/studioWebhookSecurity";

/**
 * Catálogo da API Studio (SPEC 14, DA1): recursos de API são código versionado; só a ativação por
 * time vive no banco (`TeamApiResourceActivation`). Cada recurso tem escopo e token próprios, e o
 * time vem do token, nunca da URL.
 */
export type ApiStudioResource = {
  slug: string;
  name: string;
  summary: string;
  status: "ga" | "beta" | "deprecated";
  /** Prefixo do token, para scanners de segredo vazado acharem o formato. */
  tokenPrefix: string;
  /** Chamadas por janela e por token (cada consulta pode chamar o `freeBusy` do Google). */
  rateLimit: { limit: number; windowMs: number };
};

export const API_STUDIO_RESOURCES = {
  availability: {
    slug: "availability",
    name: "Horários disponíveis",
    summary: "Consulta, por dia, os horários livres de cada closer do time.",
    status: "ga",
    tokenPrefix: "cs_avail_",
    rateLimit: { limit: 30, windowMs: 60_000 },
  },
} as const satisfies Record<string, ApiStudioResource>;

export type ApiStudioResourceSlug = keyof typeof API_STUDIO_RESOURCES;

export function getApiStudioResource(slug: string): ApiStudioResource | null {
  return Object.prototype.hasOwnProperty.call(API_STUDIO_RESOURCES, slug)
    ? API_STUDIO_RESOURCES[slug as ApiStudioResourceSlug]
    : null;
}

/** `crypto.randomBytes(32)` (256 bits) com o prefixo do recurso. Mostrado uma vez só. */
export function generateApiResourceToken(slug: ApiStudioResourceSlug): string {
  return `${API_STUDIO_RESOURCES[slug].tokenPrefix}${randomBytes(32).toString("hex")}`;
}

/** SHA-256 em hex, o mesmo algoritmo dos tokens de webhook. Só o hash é persistido. */
export function hashApiResourceToken(token: string): string {
  return hashStudioWebhookToken(token);
}

/** Prefixo do recurso + últimos 4 caracteres: o suficiente para reconhecer o token na tela. */
export function buildApiResourceTokenPreview(token: string): string {
  const prefixEnd = token.indexOf("_", token.indexOf("_") + 1) + 1;
  return `${token.slice(0, prefixEnd)}…${token.slice(-4)}`;
}
