export type CnpjCompanyInfo = {
  razaoSocial: string;
  nomeFantasia: string | null;
};

export interface ICnpjLookupService {
  lookupRazaoSocial(cnpj: string): Promise<string | null>;
  lookupCompany(cnpj: string): Promise<CnpjCompanyInfo | null>;
}
