export interface MetaLeadIntegration {
  id: string;
  managerId: string;
  teamId: string | null;
  pageId: string;
  verifyToken: string;
  isActive: boolean;
  defaultAssigneeId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppIntegration {
  id: string;
  managerId: string;
  teamId: string | null;
  phoneNumberId: string;
  businessAccountId?: string | null;
  businessPhoneNumber?: string | null;
  verifyToken: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationTeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface IntegrationState {
  metaIntegration: MetaLeadIntegration | null;
  whatsAppIntegration: WhatsAppIntegration | null;
  teamMembers: IntegrationTeamMember[];
  isLoading: boolean;
  error: string | null;
}
