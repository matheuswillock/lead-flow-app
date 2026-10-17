export interface IPreScheduleSlotRepository {
  countTransferRoutesBySourceTeam(teamId: string): Promise<number>
  findTeamMeetingDuration(teamId: string): Promise<number | null>
  findTeamMasterTimezone(teamId: string): Promise<string | null>
  findTransferLeadMeetingDatesInDay(
    teamId: string,
    dayStart: Date,
    dayEnd: Date,
    excludeLeadId?: string
  ): Promise<Array<{ meetingDate: Date | null }>>
}
