import { ActivityType } from "@prisma/client";
import { Output } from "@/lib/output";

export interface ContactsStats {
  total: number;
  lastContactDate: string | null;
  effectivenessRate: number;
}

export interface ContactDTO {
  id: string;
  type: string;
  body: string | null;
  outcome: string | null;
  duration: number | null;
  contactDate: string | null;
  contactTime: string | null;
  createdAt: string;
  author: {
    id: string;
    fullName: string | null;
    email: string;
    avatarUrl: string | null;
  } | null;
}

export interface ContactsResult {
  stats: ContactsStats;
  contacts: ContactDTO[];
}

export interface CreateContactInput {
  type: ActivityType;
  body?: string;
  outcome?: string;
  duration?: number;
  contactDate?: string;
  contactTime?: string;
}

export interface ILeadContactsUseCase {
  listContacts(leadId: string, teamId: string): Promise<Output>;
  createContact(
    leadId: string,
    teamId: string,
    profileId: string,
    data: CreateContactInput
  ): Promise<Output>;
}
