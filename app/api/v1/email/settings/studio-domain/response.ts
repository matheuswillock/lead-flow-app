import { Output } from "@/lib/output"

function isAccessDenied(output: Output): boolean {
  return output.errorMessages.includes("Acesso negado")
}

export function studioDomainOutputStatus(output: Output): number {
  if (output.isValid) return 200
  return isAccessDenied(output) ? 403 : 500
}
