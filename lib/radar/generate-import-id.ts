import { randomBytes } from "crypto"

export function generateRadarImportId(): string {
  return randomBytes(4).toString("hex")
}
