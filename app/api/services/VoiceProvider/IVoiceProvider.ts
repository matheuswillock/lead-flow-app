export type VoiceProviderContact = {
  name: string;
  phone: string;
  email?: string | null;
};

export type VoiceProviderAgent = {
  id: string;
  extensionNumber: number;
};

export type VoiceProviderCallRange = {
  startDate: string;
  endDate: string;
};

export type VoiceProviderCampaignStatus = {
  id: string;
  paused: boolean;
  answeredCalls: number;
  notAnsweredCalls: number;
  abandonedCalls: number;
  failedCalls: number;
};

export type VoiceProviderCallSummary = {
  providerCallId: string;
  campaignId: string | null;
  agentName: string | null;
  phone: string;
  speakingTime: string;
  billedTime: string;
  billedValue: string;
  hasAgent: boolean;
  recordingUrl: string | null;
  callDateRfc3339: string;
};

export type VoiceProviderRecording = {
  url: string;
  expiresAt: string | null;
};

export interface IVoiceProvider {
  createTeam(name: string): Promise<{ id: string }>;
  createAgent(name: string, extensionNumber: number, email?: string | null): Promise<VoiceProviderAgent>;
  assignAgentToTeam(agentId: string, teamId: string): Promise<void>;
  syncCampaignContacts(
    campaignId: string,
    contacts: VoiceProviderContact[]
  ): Promise<{ listId: string; syncedCount: number }>;
  startCampaign(campaignId: string): Promise<void>;
  pauseCampaign(campaignId: string): Promise<void>;
  getCampaignStatus(campaignId: string, range: VoiceProviderCallRange): Promise<VoiceProviderCampaignStatus>;
  listCallsForCampaign(campaignId: string, range: VoiceProviderCallRange): Promise<VoiceProviderCallSummary[]>;
  getRecording(callId: string): Promise<VoiceProviderRecording>;
}
