import { LeadStatus, AgeRange } from "@prisma/client";

export interface LeadResponseDTO {
  id: string;
  managerId: string;
  assignedTo: string | null;
  status: LeadStatus;
  name: string;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
  age: AgeRange[];
  hasHealthPlan: boolean | null;
  currentValue: number | null;
  referenceHospital: string | null;
  currentTreatment: string | null;
  meetingDate: string | null;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
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
  activities?: LeadActivityResponseDTO[];
}

export interface LeadActivityResponseDTO {
  id: string;
  type: string;
  body: string | null;
  payload: any;
  createdAt: string;
  author?: {
    id: string;
    fullName: string | null;
    email: string;
  } | null;
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
  lead: LeadResponseDTO;
  message: string;
}

export interface UpdateLeadResponseDTO {
  success: boolean;
  lead: LeadResponseDTO;
  message: string;
}

export interface DeleteLeadResponseDTO {
  success: boolean;
  message: string;
}