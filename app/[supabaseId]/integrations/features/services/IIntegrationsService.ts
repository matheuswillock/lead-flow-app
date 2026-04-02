export interface BuildLeadFormUrlParams {
  appUrl: string;
  teamId: string;
}

export interface IIntegrationsService {
  resolveAppUrl(): string;
  buildLeadFormUrl(params: BuildLeadFormUrlParams): string;
  copyToClipboard(value: string): Promise<boolean>;
}
