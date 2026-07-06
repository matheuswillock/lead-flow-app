import { randomBytes } from "crypto"

export function generateEmailImportId(): string {
  return randomBytes(4).toString("hex")
}
