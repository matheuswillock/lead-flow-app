import type { LeadResponseDTO } from "./leadResponseDTO";

export type DeferredTransferScheduleParams = {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  leadStatus: string;
  leadManagerId: string;
  leadAssignedTo: string | null;
  leadAssigneeEmail: string | null;
  leadCurrentCloserId: string | null;
  leadCode: string | null;
  closerId: string;
  teamId: string;
  meetingDate?: string;
  meetingTitle: string;
  meetingNotes?: string;
  meetingLink?: string;
  meetingType?: "online" | "call" | "whatsapp" | null;
  extraGuests?: string[];
  createdByProfileId: string;
  transitionStatusToScheduled?: boolean;
};

export type TransferLeadBetweenTeamsResult = {
  lead: LeadResponseDTO;
  schedulePending?: boolean;
  deferredSchedule?: DeferredTransferScheduleParams;
  transferredByProfileId?: string;
  sourceTeamId?: string;
  targetTeamId?: string;
};
