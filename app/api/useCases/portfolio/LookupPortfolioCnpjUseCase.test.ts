import { describe, expect, it } from 'bun:test';
import { LookupPortfolioCnpjUseCase } from './LookupPortfolioCnpjUseCase';

describe('LookupPortfolioCnpjUseCase', () => {
  it('retorna a razão social encontrada para o CNPJ informado', async () => {
    const useCase = new LookupPortfolioCnpjUseCase({
      lookupRazaoSocial: async () => 'Empresa de Exemplo LTDA',
    });

    const output = await useCase.execute('12.345.678/0001-95');

    expect(output.isValid).toBe(true);
    expect(output.result).toEqual({ razaoSocial: 'Empresa de Exemplo LTDA' });
  });
});
