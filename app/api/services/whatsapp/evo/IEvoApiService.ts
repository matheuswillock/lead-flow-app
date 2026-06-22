export interface EvoCreateInstanceResult {
  instanceName: string
  instanceId: string | null
  status: 'open' | 'close' | 'connecting'
  qrCode: { text: string; base64: string } | null
}

export interface EvoConnectionState {
  instanceName: string
  state: 'open' | 'close' | 'connecting'
}

export interface EvoSendTextResult {
  providerMessageId: string
  status: string
}

export interface IEvoApiService {
  createInstance(params: {
    instanceName: string
    webhookUrl: string
    hostBaseUrl?: string
  }): Promise<EvoCreateInstanceResult>

  getQrCode(instanceName: string, hostBaseUrl?: string): Promise<{ text: string; base64: string }>

  getConnectionState(instanceName: string, hostBaseUrl?: string): Promise<EvoConnectionState>

  sendTextMessage(params: {
    instanceName: string
    recipientPhone: string
    text: string
    hostBaseUrl?: string
  }): Promise<EvoSendTextResult>

  disconnectInstance(instanceName: string, hostBaseUrl?: string): Promise<void>

  deleteInstance(instanceName: string, hostBaseUrl?: string): Promise<void>
}
