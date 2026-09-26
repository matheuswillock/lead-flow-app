export interface ILandingPagesService {
  getLandingPagesApiUrl(teamId: string): string
  getLandingDomainApiUrl(teamId: string): string
  getEmailSettingsApiUrl(): string
}
