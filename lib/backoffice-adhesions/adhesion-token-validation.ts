import { createHash, randomBytes } from "node:crypto"
import type { BackofficeAdhesionStatus } from "@prisma/client"
import { prisma } from "@/app/api/infra/data/prisma"

export type BackofficeAdhesionTokenValidationStatus =
  | "valid"
  | "missing"
  | "not_found"
  | "expired"
  | "not_payable"

export interface BackofficeAdhesionTokenValidationResult {
  status: BackofficeAdhesionTokenValidationStatus
  adhesionId: string | null
  expiresAt: Date | null
  adhesionStatus: BackofficeAdhesionStatus | null
}

export interface BackofficeAdhesionTokenValidationOptions {
  allowedStatuses?: BackofficeAdhesionStatus[]
  expirePendingToken?: boolean
}

export function generateBackofficeAdhesionToken(): string {
  return randomBytes(32).toString("base64url")
}

export function hashBackofficeAdhesionToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex")
}

export function getBackofficeAdhesionTokenPreview(token: string): string {
  return token.slice(0, 8)
}

export async function validateBackofficeAdhesionToken(
  token: string | null | undefined,
  options: BackofficeAdhesionTokenValidationOptions = {}
): Promise<BackofficeAdhesionTokenValidationResult> {
  const normalizedToken = token?.trim()
  if (!normalizedToken) {
    return {
      status: "missing",
      adhesionId: null,
      expiresAt: null,
      adhesionStatus: null,
    }
  }

  const tokenHash = hashBackofficeAdhesionToken(normalizedToken)
  const adhesion = await prisma.backofficeAdhesion.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      status: true,
      expiresAt: true,
    },
  })

  if (!adhesion) {
    return {
      status: "not_found",
      adhesionId: null,
      expiresAt: null,
      adhesionStatus: null,
    }
  }

  const now = new Date()
  const isExpired = adhesion.expiresAt.getTime() <= now.getTime()
  if (isExpired) {
    if (options.expirePendingToken !== false && adhesion.status === "pending") {
      await prisma.backofficeAdhesion.update({
        where: { id: adhesion.id },
        data: { status: "expired" },
      })
    }

    return {
      status: "expired",
      adhesionId: adhesion.id,
      expiresAt: adhesion.expiresAt,
      adhesionStatus: adhesion.status,
    }
  }

  const allowedStatuses = options.allowedStatuses ?? ["pending"]
  if (!allowedStatuses.includes(adhesion.status)) {
    return {
      status: "not_payable",
      adhesionId: adhesion.id,
      expiresAt: adhesion.expiresAt,
      adhesionStatus: adhesion.status,
    }
  }

  return {
    status: "valid",
    adhesionId: adhesion.id,
    expiresAt: adhesion.expiresAt,
    adhesionStatus: adhesion.status,
  }
}
