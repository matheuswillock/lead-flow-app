import { Output } from "@/lib/output";

export interface CreateScheduleParams {
  leadId: string;
  leadName: string;
  leadEmail: string | null;
  leadStatus: string;
  leadManagerId: string;
  leadAssignedTo: string | null;
  leadAssigneeEmail: string | null;
  leadCurrentCloserId: string | null;
  /** Espelho do Meet no Lead — fallback ao preservar link na troca de closer. */
  leadMeetingLink?: string | null;
  leadCode: string | null;
  closerId: string;
  teamId: string;
  meetingDate?: string; // ISO
  meetingTitle: string;
  meetingNotes?: string;
  meetingLink?: string;
  meetingType?: "online" | "call" | "whatsapp" | null;
  durationMinutes?: number;
  extraGuests?: string[];
  createdByProfileId: string;
  transitionStatusToScheduled?: boolean;
  confirmNoShowSchedule?: boolean;
  authorAsStudio?: boolean;
}

export interface ILeadScheduleService {
  createSchedule(params: CreateScheduleParams): Promise<Output>;
}
