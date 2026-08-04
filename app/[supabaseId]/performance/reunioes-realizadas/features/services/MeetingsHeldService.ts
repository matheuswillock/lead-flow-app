import type { IMeetingsHeldService } from './IMeetingsHeldService';
import type { MeetingsHeldData, MeetingsHeldFiltersState } from '../context/MeetingsHeldTypes';
import { API_CLIENT_BASE } from "@/lib/route-map";

class MeetingsHeldService implements IMeetingsHeldService {
  async getMeetingsHeld(
    supabaseId: string,
    teamId: string,
    filters: MeetingsHeldFiltersState
  ): Promise<MeetingsHeldData> {
    const params = new URLSearchParams({
      startDate: filters.startDate,
      endDate: filters.endDate,
      page: String(filters.page),
      pageSize: String(filters.pageSize),
    });

    if (filters.sdrId) params.set('sdrId', filters.sdrId);
    if (filters.closerId) params.set('closerId', filters.closerId);
    if (filters.countMonth) params.set('countMonth', filters.countMonth);

    const res = await fetch(`${API_CLIENT_BASE}/performance/meetings-held?${params.toString()}`, {
      headers: {
        'x-supabase-user-id': supabaseId,
        'x-team-id': teamId,
      },
    });

    const json = await res.json();
    if (!json.isValid) {
      throw new Error(json.errorMessages?.[0] ?? 'Erro ao buscar reuniões realizadas');
    }

    return json.result as MeetingsHeldData;
  }
}

export const meetingsHeldService = new MeetingsHeldService();
