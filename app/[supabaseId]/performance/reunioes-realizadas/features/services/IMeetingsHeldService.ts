import type { MeetingsHeldData, MeetingsHeldFiltersState } from '../context/MeetingsHeldTypes';

export interface IMeetingsHeldService {
  getMeetingsHeld(
    supabaseId: string,
    teamId: string,
    filters: MeetingsHeldFiltersState
  ): Promise<MeetingsHeldData>;
}
