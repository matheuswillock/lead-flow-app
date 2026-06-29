export interface ICnpjLookupService {
  lookupRazaoSocial(cnpj: string): Promise<string | null>;
}

export interface ResolveLeadRazaoSocialInput {
  cnpj?: string | null;
  previousCnpj?: string | null;
  previousRazaoSocial?: string | null;
}

export interface ResolveLeadRazaoSocialResult {
  razaoSocial: string | null;
  lookupAttempted: boolean;
  lookupSucceeded: boolean;
}
