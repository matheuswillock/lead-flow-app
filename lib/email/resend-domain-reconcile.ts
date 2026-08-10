/** Returns true when persisted status matches the remote Resend API status. */
export function isResendDomainStatusInSync(
  persisted: string | null | undefined,
  remote: string | null | undefined
): boolean {
  return (persisted ?? null) === (remote ?? null)
}
