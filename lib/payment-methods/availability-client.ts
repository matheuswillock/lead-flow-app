import { API_CLIENT_BASE } from "@/lib/route-map"

/** URL client-side (slug mascarado) do endpoint público de disponibilidade de formas de pagamento. */
export const PAYMENT_METHODS_AVAILABILITY_URL = `${API_CLIENT_BASE}/payment-methods/availability` as const
