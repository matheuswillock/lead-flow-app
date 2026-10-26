import { API_CLIENT_BASE } from "@/lib/route-map"

export function reauthorizePaymentPath(token: string) {
  return `${API_CLIENT_BASE}/billing/card-reauthorization/${encodeURIComponent(token)}`
}
