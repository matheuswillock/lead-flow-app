import { describe, expect, it } from 'bun:test';
import { LookupPortfolioCnpjUseCase } from './LookupPortfolioCnpjUseCase';

describe('LookupPortfolioCnpjUseCase', () => {
  it('retorna razão social e nome fantasia do CNPJ informado', async () => {
    const useCase = new LookupPortfolioCnpjUseCase({
      lookupRazaoSocial: async () => 'Empresa de Exemplo LTDA',
      lookupCompany: async () => ({ razaoSocial: 'Empresa de Exemplo LTDA', nomeFantasia: 'Exemplo' }),
    });

    const output = await useCase.execute('12.345.678/0001-95');

    expect(output.isValid).toBe(true);
    expect(output.result).toEqual({ razaoSocial: 'Empresa de Exemplo LTDA', nomeFantasia: 'Exemplo' });
  });

  it('retorna campos nulos quando o CNPJ não é encontrado', async () => {
    const useCase = new LookupPortfolioCnpjUseCase({
      lookupRazaoSocial: async () => null,
      lookupCompany: async () => null,
    });

    const output = await useCase.execute('12345678000195');

    expect(output.isValid).toBe(true);
    expect(output.result).toEqual({ razaoSocial: null, nomeFantasia: null });
  });
});
