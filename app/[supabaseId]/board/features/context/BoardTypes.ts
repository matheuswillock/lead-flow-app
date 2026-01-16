import type { LeadStatus, HealthPlan } from '@prisma/client';

export type Lead = {
  id: string;
  managerId: string;
  assignedTo: string | null;
  status: LeadStatus;
  name: string;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
  age: string | null;
  currentHealthPlan: HealthPlan | null;
  currentValue: number | null;
  referenceHospital: string | null;
  currentTreatment: string | null;
  meetingDate: string | null;
  notes: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Novos campos de venda
  ticket: number | null;
  contractDueDate: string | null;
  soldPlan: HealthPlan | null;
  attachmentCount?: number;
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
};

export type ColumnKey = LeadStatus;