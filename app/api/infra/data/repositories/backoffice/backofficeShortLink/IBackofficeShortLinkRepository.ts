export interface IBackofficeShortLinkRepository {
  findByTargetUrl(targetUrl: string): Promise<{ code: string; expiresAt: Date | null } | null>
  findByTargetUrlAfterRace(targetUrl: string): Promise<{ code: string; expiresAt: Date | null } | null>
  create(input: { code: string; targetUrl: string; expiresAt?: Date | null }): Promise<{ code: string }>
}
