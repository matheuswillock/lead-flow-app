import type { ICarteiraService } from './ICarteiraService';
import type { CarteiraData, CarteiraFiltersState, CarteiraRow, UpdateCarteiraData } from '../context/CarteiraTypes';

class CarteiraService implements ICarteiraService {
  async listPortfolio(
    supabaseId: string,
    teamId: string,
    filters: CarteiraFiltersState
  ): Promise<CarteiraData> {
    const params = new URLSearchParams();

    if (filters.search) params.set('search', filters.search);
    if (filters.portfolioStatus !== 'all') params.set('portfolioStatus', filters.portfolioStatus);
    if (filters.sdrId) params.set('sdrId', filters.sdrId);
    if (filters.closerId) params.set('closerId', filters.closerId);
    params.set('page', String(filters.page));
    params.set('pageSize', String(filters.pageSize));

    const res = await fetch(`/api/v1/portfolio?${params.toString()}`, {
      headers: {
        'x-supabase-user-id': supabaseId,
        'x-team-id': teamId,
      },
    });

    const json = await res.json();
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? 'Erro ao buscar carteira');
    }
    return json.result as CarteiraData;
  }

  async updateEntry(
    supabaseId: string,
    teamId: string,
    leadId: string,
    data: UpdateCarteiraData
  ): Promise<CarteiraRow> {
    const res = await fetch(`/api/v1/portfolio/${leadId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-supabase-user-id': supabaseId,
        'x-team-id': teamId,
      },
      body: JSON.stringify(data),
    });

    const json = await res.json();
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? 'Erro ao atualizar carteira');
    }
    return json.result as CarteiraRow;
  }
}

export const carteiraService = new CarteiraService();
