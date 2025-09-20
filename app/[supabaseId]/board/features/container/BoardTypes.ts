import { LeadStatus } from "@prisma/client";

export type Lead = {
  id: string;
  managerId: string;
  assignedTo: string | null;
  status: LeadStatus;
  name: string;
  email: string | null;
  phone: string | null;
  cnpj: string | null;
  age: number | null;
  hasHealthPlan: boolean | null;
  currentValue: number | null;
  referenceHospital: string | null;
  currentTreatment: string | null;
  meetingDate: string | null;
  notes: string | null;
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
  } | null;
};

export type ColumnKey = LeadStatus;