import type { ICarteiraService } from './ICarteiraService';
import type {
  CarteiraData,
  CarteiraDetailData,
  CarteiraFiltersState,
  CarteiraRow,
  CreateCarteiraPayload,
  UpdateCarteiraData,
  UpdateCarteiraDetailPayload,
} from '../context/CarteiraTypes';

class CarteiraService implements ICarteiraService {
  async createEntry(
    supabaseId: string,
    teamId: string,
    payload: CreateCarteiraPayload
  ): Promise<CarteiraDetailData> {
    const res = await fetch('/api/v1/portfolio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-supabase-user-id': supabaseId,
        'x-team-id': teamId,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.isValid) throw new Error(json.errorMessages?.[0] ?? 'Erro ao adicionar cliente');
    return json.result as CarteiraDetailData;
  }

  async listPortfolio(
    supabaseId: string,
    teamId: string,
    filters: CarteiraFiltersState
  ): Promise<CarteiraData> {
    const params = new URLSearchParams();

    if (filters.search) params.set('search', filters.search);
    if (filters.portfolioStatuses.length) params.set('portfolioStatuses', filters.portfolioStatuses.join(','));
    if (filters.sources.length) params.set('sources', filters.sources.join(','));
    if (filters.sdrIds.length) params.set('sdrIds', filters.sdrIds.join(','));
    if (filters.closerIds.length) params.set('closerIds', filters.closerIds.join(','));
    if (filters.operadora) params.set('operadora', filters.operadora);
    if (filters.contractDateStart) params.set('contractDateStart', filters.contractDateStart);
    if (filters.contractDateEnd) params.set('contractDateEnd', filters.contractDateEnd);
    if (filters.dueDateStart) params.set('dueDateStart', filters.dueDateStart);
    if (filters.dueDateEnd) params.set('dueDateEnd', filters.dueDateEnd);
    if (filters.documentSearch) params.set('documentSearch', filters.documentSearch);
    params.set('page', String(filters.page));
    params.set('pageSize', String(filters.pageSize));

    const res = await fetch(`/api/v1/portfolio?${params.toString()}`, {
      headers: { 'x-supabase-user-id': supabaseId, 'x-team-id': teamId },
    });

    const json = await res.json();
    if (!json.isValid) throw new Error(json.errorMessages?.[0] ?? 'Erro ao buscar carteira');
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
    if (!json.isValid) throw new Error(json.errorMessages?.[0] ?? 'Erro ao atualizar carteira');
    return json.result as CarteiraRow;
  }

  async getEntryDetail(
    supabaseId: string,
    teamId: string,
    leadId: string
  ): Promise<CarteiraDetailData> {
    const res = await fetch(`/api/v1/portfolio/${leadId}/detail`, {
      headers: { 'x-supabase-user-id': supabaseId, 'x-team-id': teamId },
    });

    const json = await res.json();
    if (!json.isValid) throw new Error(json.errorMessages?.[0] ?? 'Erro ao buscar detalhe');
    return json.result as CarteiraDetailData;
  }

  async updateEntryDetail(
    supabaseId: string,
    teamId: string,
    leadId: string,
    payload: UpdateCarteiraDetailPayload
  ): Promise<CarteiraDetailData> {
    const res = await fetch(`/api/v1/portfolio/${leadId}/detail`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-supabase-user-id': supabaseId,
        'x-team-id': teamId,
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (!json.isValid) throw new Error(json.errorMessages?.[0] ?? 'Erro ao atualizar dados');
    return json.result as CarteiraDetailData;
  }
}

export const carteiraService = new CarteiraService();
