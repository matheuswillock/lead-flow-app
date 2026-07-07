import type { TeamAutomationEvent } from "@/lib/team-automation/types";

export interface ITeamAutomationDispatcherService {
  dispatch(event: TeamAutomationEvent): Promise<void>;
}
