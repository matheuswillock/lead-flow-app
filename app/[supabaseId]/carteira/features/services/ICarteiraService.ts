import type {
  CarteiraData,
  CarteiraDetailData,
  CarteiraFiltersState,
  CarteiraRow,
  UpdateCarteiraData,
  UpdateCarteiraDetailPayload,
} from '../context/CarteiraTypes';

export interface ICarteiraService {
  listPortfolio(supabaseId: string, teamId: string, filters: CarteiraFiltersState): Promise<CarteiraData>;
  updateEntry(supabaseId: string, teamId: string, leadId: string, data: UpdateCarteiraData): Promise<CarteiraRow>;
  getEntryDetail(supabaseId: string, teamId: string, leadId: string): Promise<CarteiraDetailData>;
  updateEntryDetail(supabaseId: string, teamId: string, leadId: string, payload: UpdateCarteiraDetailPayload): Promise<CarteiraDetailData>;
}
