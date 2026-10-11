import { isIP } from "node:net"

function firstHeaderValue(value: string | null): string | null {
  const candidate = value?.split(",")[0]?.trim()
  return candidate && isIP(candidate) > 0 ? candidate : null
}

type ClientIpEnvironment = {
  VERCEL?: string
  NODE_ENV?: string
}

export function getTrustedClientIp(
  headers: Headers,
  environment: ClientIpEnvironment = {
    VERCEL: process.env.VERCEL,
    NODE_ENV: process.env.NODE_ENV,
  },
): string | null {
  const isVercelRequest =
    environment.VERCEL === "1" && Boolean(headers.get("x-vercel-id"))
  if (isVercelRequest) {
    return firstHeaderValue(headers.get("x-vercel-forwarded-for"))
  }

  if (!["development", "test"].includes(environment.NODE_ENV ?? "")) {
    return null
  }

  return firstHeaderValue(headers.get("x-forwarded-for")) ?? firstHeaderValue(headers.get("x-real-ip"))
}
