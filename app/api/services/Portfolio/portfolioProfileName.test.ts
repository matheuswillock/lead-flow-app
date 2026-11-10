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

  describe('removido do time pelo manager (o perfil continua existindo)', () => {
    const closer = { fullName: 'Ana Closer', deletedAt: null };

    it('sem vínculo com o time da carteira, aparece como desligado', () => {
      expect(portfolioProfileName({ ...closer, teamMemberships: [{ teamId: 'outro-time' }] }, 'time-1')).toBe(
        'Ana Closer (desligado)',
      );
      expect(portfolioProfileName({ ...closer, teamMemberships: [] }, 'time-1')).toBe('Ana Closer (desligado)');
    });

    it('com vínculo com o time da carteira, segue sem marca', () => {
      expect(
        portfolioProfileName({ ...closer, teamMemberships: [{ teamId: 'time-1' }, { teamId: 'outro-time' }] }, 'time-1'),
      ).toBe('Ana Closer');
    });

    it('sem informação de vínculo não marca ninguém como desligado', () => {
      expect(portfolioProfileName(closer, 'time-1')).toBe('Ana Closer');
    });
  });
});
