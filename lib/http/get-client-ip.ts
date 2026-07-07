import type { NextRequest } from "next/server"

export function getClientIpFromRequest(request: NextRequest | Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  const realIp = request.headers.get("x-real-ip")
  return forwardedFor?.split(",")[0]?.trim() || realIp || "unknown"
}
