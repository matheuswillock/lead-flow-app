export interface ShortLinkRecord {
  code: string
  expiresAt: Date | null
}

export interface ShortLinkTargetRecord {
  targetUrl: string
  expiresAt: Date | null
}

export interface IShortLinkRepository {
  findByTargetUrl(targetUrl: string): Promise<ShortLinkRecord | null>
  findByCode(code: string): Promise<ShortLinkTargetRecord | null>
  create(input: { code: string; targetUrl: string; expiresAt?: Date }): Promise<ShortLinkRecord>
}
