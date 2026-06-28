import type { LeadProposalReviewStatus, LeadStatus, MeetingHeald } from '@prisma/client';

export interface LeadResponseDTO {
  id: string;
  leadCode: string;
  managerId: string;
  teamId: string | null;
  assignedTo: string | null;
  status: LeadStatus | null;
  name: string;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
  razaoSocial: string | null;
  age: string | null;
  currentHealthPlan: string | null;
  currentValue: number | null;
  referenceHospital: string | null;
  currentTreatment: string | null;
  meetingDate: string | null;
  meetingTitle: string | null;
  meetingNotes: string | null;
  meetingLink: string | null;
  meetingHeald: MeetingHeald | null;
  meetingPresenceConfirmed: boolean;
  meetingPresenceConfirmedAt: string | null;
  isTransfer: boolean;
  followUpAt?: string | null;
  followUpNotes?: string | null;
  followUpSourceStatus?: LeadStatus | null;
  lossReason?: string | null;
  lossReasonDetails?: string | null;
  statusEnteredAt?: string | null;
  closerId: string | null;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Novos campos de venda
  ticket: number | null;
  contractDueDate: string | null;
  soldPlan: string | null;
  meetingType: string | null;
  isReferral: boolean | null;
  referrerLeadId: string | null;
  referrerName: string | null;
  referrerPhone: string | null;
  leadTimeDueAt?: string | null;
  isLeadTimeBreached?: boolean;
  attachmentCount?: number;
  proposalReviewStatus?: LeadProposalReviewStatus | null;
  manager?: {
    id: string;
    fullName: string | null;
    email: string;
  };
  assignee?: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl?: string | null;
  } | null;
  closer?: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl?: string | null;
  } | null;
  activities?: LeadActivityResponseDTO[];
}

export interface LeadActivityResponseDTO {
  id: string;
  type: string;
  body: string | null;
  payload: any;
  createdAt: string;
  reactions?: LeadActivityReactionSummary[];
  author?: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl?: string | null;
  } | null;
}

export interface LeadActivityReactionSummary {
  emoji: string;
  unified: string;
  count: number;
  reactedByMe?: boolean;
}

export interface LeadListResponseDTO {
  leads: LeadResponseDTO[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateLeadResponseDTO {
  success: boolean;
  lead: LeadResponseDTO | null;
  message: string;
}

export interface UpdateLeadResponseDTO {
  success: boolean;
  lead: LeadResponseDTO | null;
  message: string;
}

export interface DeleteLeadResponseDTO {
  success: boolean;
  message: string;
}
