export interface ISubaccountResult {
  subaccountSid: string
  authToken: string
}

export interface ICallParams {
  to: string
  from: string
  twimlUrl: string
  statusCallbackUrl: string
  machineDetection?: "Enable" | "DetectMessageEnd"
  timeout?: number
  subaccountSid: string
  authToken: string
}

export interface ICallStatus {
  status:
    | "queued"
    | "ringing"
    | "in-progress"
    | "completed"
    | "busy"
    | "failed"
    | "no-answer"
    | "canceled"
  duration?: number
  answeredBy?: "human" | "machine_start" | "fax" | "unknown"
}

export interface IRecordingResult {
  recordingSid: string
  mediaUrl: string
}

export interface IVoiceProvider {
  // Provisionamento (1x por time na ativação do add-on)
  createSubaccount(name: string): Promise<ISubaccountResult>
  provisionNumber(
    subaccountSid: string,
    authToken: string,
    bundleSid: string,
    addressSid: string,
  ): Promise<{ numberSid: string; phoneNumber: string }>
  createApiKey(
    subaccountSid: string,
    authToken: string,
  ): Promise<{ apiKeySid: string; apiKeySecret: string }>
  createTwimlApp(
    subaccountSid: string,
    authToken: string,
    voiceUrl: string,
    statusCallbackUrl: string,
  ): Promise<{ appSid: string }>
  suspendSubaccount(subaccountSid: string, authToken: string): Promise<void>
  reactivateSubaccount(subaccountSid: string, authToken: string): Promise<void>

  // Token efêmero para o browser SDK (@twilio/voice-sdk) — nunca persistir
  generateAccessToken(
    identity: string,
    subaccountSid: string,
    apiKeySid: string,
    apiKeySecret: string,
    appSid: string,
  ): string

  // Controle de chamada (durante discagem)
  initiateCall(params: ICallParams): Promise<{ callSid: string }>
  fetchCall(
    callSid: string,
    subaccountSid: string,
    authToken: string,
  ): Promise<ICallStatus>
  hangupCall(
    callSid: string,
    subaccountSid: string,
    authToken: string,
  ): Promise<void>

  // Gravação (pós-chamada via DialerJob)
  fetchRecording(
    recordingSid: string,
    subaccountSid: string,
    authToken: string,
  ): Promise<IRecordingResult>
  downloadRecordingBuffer(
    recordingSid: string,
    subaccountSid: string,
    authToken: string,
  ): Promise<Buffer>
  deleteRecording(
    recordingSid: string,
    subaccountSid: string,
    authToken: string,
  ): Promise<void>
}
