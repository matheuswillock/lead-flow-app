import { Output } from '@/lib/output';
import { cnpjLookupService } from '@/app/api/services/cnpjLookup/CnpjLookupService';
import type { ICnpjLookupService } from '@/app/api/services/cnpjLookup/ICnpjLookupService';

export class LookupPortfolioCnpjUseCase {
  constructor(private readonly lookupService: ICnpjLookupService = cnpjLookupService) {}

  async execute(cnpj: string): Promise<Output> {
    try {
      const razaoSocial = await this.lookupService.lookupRazaoSocial(cnpj);
      return new Output(true, [], [], { razaoSocial });
    } catch (error) {
      console.error('[LookupPortfolioCnpjUseCase] Erro ao consultar CNPJ:', error);
      return new Output(false, [], ['Não foi possível consultar a Razão Social'], null);
    }
  }
}

export const lookupPortfolioCnpjUseCase = new LookupPortfolioCnpjUseCase();
