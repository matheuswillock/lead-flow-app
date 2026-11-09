import { afterEach, describe, expect, it } from 'bun:test';
import { CnpjLookupService } from './CnpjLookupService';

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = (async (input: RequestInfo | URL) => handler(String(input))) as typeof fetch;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('CnpjLookupService.lookupCompany', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('retorna razão social e nome fantasia da BrasilAPI', async () => {
    mockFetch(() => json({ razao_social: ' Empresa Exemplo LTDA ', nome_fantasia: ' Exemplo Corretora ' }));

    const company = await new CnpjLookupService().lookupCompany('12.345.678/0001-95');

    expect(company).toEqual({ razaoSocial: 'Empresa Exemplo LTDA', nomeFantasia: 'Exemplo Corretora' });
  });

  it('devolve nome fantasia nulo quando a Receita não informa', async () => {
    mockFetch(() => json({ razao_social: 'Empresa Exemplo LTDA', nome_fantasia: '' }));

    const company = await new CnpjLookupService().lookupCompany('12345678000195');

    expect(company).toEqual({ razaoSocial: 'Empresa Exemplo LTDA', nomeFantasia: null });
  });

  it('usa a ReceitaWS (nome e fantasia) quando a BrasilAPI não responde', async () => {
    mockFetch((url) =>
      url.includes('brasilapi')
        ? json({ message: 'CNPJ não encontrado' }, 404)
        : json({ status: 'OK', nome: 'Empresa Exemplo LTDA', fantasia: 'Exemplo Corretora' })
    );

    const company = await new CnpjLookupService().lookupCompany('12345678000195');

    expect(company).toEqual({ razaoSocial: 'Empresa Exemplo LTDA', nomeFantasia: 'Exemplo Corretora' });
  });

  it('retorna nulo para CNPJ com tamanho inválido sem consultar', async () => {
    let called = false;
    mockFetch(() => {
      called = true;
      return json({});
    });

    expect(await new CnpjLookupService().lookupCompany('123')).toBeNull();
    expect(called).toBe(false);
  });

  it('lookupRazaoSocial continua devolvendo só a razão social', async () => {
    mockFetch(() => json({ razao_social: 'Empresa Exemplo LTDA', nome_fantasia: 'Exemplo' }));

    expect(await new CnpjLookupService().lookupRazaoSocial('12345678000195')).toBe('Empresa Exemplo LTDA');
  });
});
