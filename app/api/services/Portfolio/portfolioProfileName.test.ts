import { describe, expect, it } from 'bun:test';
import { portfolioProfileName } from './portfolioProfileName';

describe('portfolioProfileName', () => {
  it('mantém o nome de quem continua na corretora', () => {
    expect(portfolioProfileName({ fullName: 'Ana Closer', deletedAt: null })).toBe('Ana Closer');
  });

  it('quem saiu da corretora continua com o nome atribuído, marcado como desligado', () => {
    expect(portfolioProfileName({ fullName: 'Ana Closer', deletedAt: new Date('2026-11-01T00:00:00Z') })).toBe(
      'Ana Closer (desligado)',
    );
  });

  it('nome ausente vira texto vazio, sem a marca quando ainda está ativo', () => {
    expect(portfolioProfileName({ fullName: null, deletedAt: null })).toBe('');
  });
});
