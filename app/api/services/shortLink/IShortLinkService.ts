export interface IShortLinkService {
  getOrCreate(input: { targetUrl: string; expiresAt?: Date }): Promise<string>
}
