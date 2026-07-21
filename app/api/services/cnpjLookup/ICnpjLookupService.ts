export interface ICnpjLookupService {
  lookupRazaoSocial(cnpj: string): Promise<string | null>;
}
