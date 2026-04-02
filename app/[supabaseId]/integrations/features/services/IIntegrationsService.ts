export interface BuildLeadFormUrlParams {
  appUrl: string;
  supabaseId: string;
  teamId: string;
}

export interface IIntegrationsService {
  resolveAppUrl(): string;
  buildLeadFormUrl(params: BuildLeadFormUrlParams): string;
  copyToClipboard(value: string): Promise<boolean>;
}
