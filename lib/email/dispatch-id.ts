/** Id do registro de envio (BackofficeEmailDispatch) devolvido por um envio rastreado do EmailService. */
export function getDispatchId(result: unknown): string | null {
  if (!result || typeof result !== "object") return null
  const dispatchIds = (result as { dispatchIds?: unknown }).dispatchIds
  return Array.isArray(dispatchIds) && typeof dispatchIds[0] === "string" ? dispatchIds[0] : null
}
