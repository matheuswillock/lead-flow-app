import type {
  CarteiraData,
  CarteiraDetailData,
  CarteiraFiltersState,
  CarteiraRow,
  CreateCarteiraPayload,
  UpdateCarteiraData,
  UpdateCarteiraDetailPayload,
} from '../context/CarteiraTypes';

export interface ICarteiraService {
  createEntry(supabaseId: string, teamId: string, payload: CreateCarteiraPayload): Promise<CarteiraDetailData>;
  listPortfolio(supabaseId: string, teamId: string, filters: CarteiraFiltersState): Promise<CarteiraData>;
  updateEntry(supabaseId: string, teamId: string, leadId: string, data: UpdateCarteiraData): Promise<CarteiraRow>;
  getEntryDetail(supabaseId: string, teamId: string, leadId: string): Promise<CarteiraDetailData>;
  updateEntryDetail(supabaseId: string, teamId: string, leadId: string, payload: UpdateCarteiraDetailPayload): Promise<CarteiraDetailData>;
}
