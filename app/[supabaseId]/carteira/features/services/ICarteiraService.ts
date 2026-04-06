import type { CarteiraData, CarteiraFiltersState, CarteiraRow, UpdateCarteiraData } from '../context/CarteiraTypes';

export interface ICarteiraService {
  listPortfolio(supabaseId: string, teamId: string, filters: CarteiraFiltersState): Promise<CarteiraData>;
  updateEntry(supabaseId: string, teamId: string, leadId: string, data: UpdateCarteiraData): Promise<CarteiraRow>;
}
