/**
 * Mapeamento canônico Asaas → status local (Estágio 1 / D5 / C0).
 * Sem fallback para 'active': status/evento desconhecido retorna undefined.
 */

export type LocalSubscriptionStatus = "active" | "suspended" | "canceled";

/** Eventos reais de assinatura emitidos pela API Asaas. */
export const ASAAS_REAL_SUBSCRIPTION_EVENTS = [
  "SUBSCRIPTION_CREATED",
  "SUBSCRIPTION_UPDATED",
  "SUBSCRIPTION_INACTIVATED",
  "SUBSCRIPTION_DELETED",
] as const;

export type AsaasRealSubscriptionEvent =
  (typeof ASAAS_REAL_SUBSCRIPTION_EVENTS)[number];

export function isAsaasRealSubscriptionEvent(
  event: string
): event is AsaasRealSubscriptionEvent {
  return (ASAAS_REAL_SUBSCRIPTION_EVENTS as readonly string[]).includes(event);
}

export function mapSubscriptionStatusFromEvent(
  event: string
): LocalSubscriptionStatus | undefined {
  switch (event) {
    case "SUBSCRIPTION_CREATED":
      return "active";
    case "SUBSCRIPTION_INACTIVATED":
      return "suspended";
    case "SUBSCRIPTION_DELETED":
      return "canceled";
    case "SUBSCRIPTION_UPDATED":
      // Status vem do payload
      return undefined;
    default:
      // Eventos inventados (ACTIVATED/SUSPENDED/CANCELED) → não mapear
      return undefined;
  }
}

export function mapSubscriptionStatusFromPayload(
  status: string | undefined
): LocalSubscriptionStatus | undefined {
  if (!status) return undefined;
  const s = status.toUpperCase();
  if (s === "ACTIVE") return "active";
  if (s === "INACTIVE") return "suspended";
  if (s === "EXPIRED") return "canceled";
  // Legados raros — manter se ainda aparecerem
  if (s === "SUSPENDED" || s === "INACTIVATED") return "suspended";
  if (s === "CANCELLED" || s === "CANCELED") return "canceled";
  return undefined;
}

/**
 * Resolve status local sem reativar conta em caso desconhecido.
 * Preferência: payload (fonte de verdade do objeto) > evento.
 */
export function resolveLocalSubscriptionStatus(params: {
  event: string;
  payloadStatus?: string;
}): LocalSubscriptionStatus | undefined {
  const fromPayload = mapSubscriptionStatusFromPayload(params.payloadStatus);
  if (fromPayload) return fromPayload;
  return mapSubscriptionStatusFromEvent(params.event);
}

/** Dias em past_due antes de solicitar INACTIVE no Asaas. */
export const PAST_DUE_INACTIVE_AFTER_DAYS = 15;
