export type AuditActorContext = {
  profileId: string | null
  backofficeUserId?: string | null
  backofficeEmail?: string | null
}

export function buildAuditActorMetadata(
  actor: AuditActorContext | null | undefined,
  metadata: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    ...metadata,
    actorKind: actor?.backofficeUserId ? "backoffice_user" : actor?.profileId ? "profile" : "system",
    backofficeUserId: actor?.backofficeUserId ?? null,
    backofficeEmail: actor?.backofficeEmail ?? null,
  }
}
