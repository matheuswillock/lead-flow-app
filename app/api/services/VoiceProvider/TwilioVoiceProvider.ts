import twilio from "twilio"
import { decryptDialerSecret } from "@/lib/dialer/secret-crypto"
import type {
  IVoiceProvider,
  ISubaccountResult,
  ICallParams,
  ICallStatus,
  IRecordingResult,
} from "./IVoiceProvider"

export class TwilioVoiceProvider implements IVoiceProvider {
  private readonly masterAccountSid: string
  private readonly masterAuthToken: string

  constructor() {
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    if (!sid || !token) {
      throw new Error("TWILIO_ACCOUNT_SID e TWILIO_AUTH_TOKEN são obrigatórios")
    }
    this.masterAccountSid = sid
    this.masterAuthToken = token
  }

  private masterClient() {
    return twilio(this.masterAccountSid, this.masterAuthToken)
  }

  private subClient(subaccountSid: string, encryptedToken: string) {
    const token = decryptDialerSecret(encryptedToken)
    if (!token) throw new Error("Não foi possível decifrar o token da subconta Twilio")
    return twilio(subaccountSid, token)
  }

  async createSubaccount(name: string): Promise<ISubaccountResult> {
    const account = await this.masterClient().api.v2010.accounts.create({
      friendlyName: name,
    })
    return {
      subaccountSid: account.sid,
      authToken: account.authToken,
    }
  }

  async provisionNumber(
    subaccountSid: string,
    authToken: string,
    bundleSid: string,
    addressSid: string,
  ): Promise<{ numberSid: string; phoneNumber: string }> {
    const client = this.subClient(subaccountSid, authToken)
    const available = await client
      .availablePhoneNumbers("BR")
      .local.list({ limit: 1 })

    if (!available.length) {
      throw new Error("Nenhum número local BR disponível na Twilio")
    }

    const purchased = await client.incomingPhoneNumbers.create({
      phoneNumber: available[0].phoneNumber,
      bundleSid,
      addressSid,
    })

    return {
      numberSid: purchased.sid,
      phoneNumber: purchased.phoneNumber,
    }
  }

  async createApiKey(
    subaccountSid: string,
    authToken: string,
  ): Promise<{ apiKeySid: string; apiKeySecret: string }> {
    const client = this.subClient(subaccountSid, authToken)
    const key = await client.newKeys.create({
      friendlyName: "studio-voice-dialer",
    })
    return {
      apiKeySid: key.sid,
      apiKeySecret: key.secret,
    }
  }

  async createTwimlApp(
    subaccountSid: string,
    authToken: string,
    voiceUrl: string,
    statusCallbackUrl: string,
  ): Promise<{ appSid: string }> {
    const client = this.subClient(subaccountSid, authToken)
    const app = await client.applications.create({
      friendlyName: "studio-voice-dialer",
      voiceUrl,
      voiceMethod: "POST",
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: "POST",
    })
    return { appSid: app.sid }
  }

  async suspendSubaccount(subaccountSid: string, _authToken: string): Promise<void> {
    await this.masterClient().api.v2010.accounts(subaccountSid).update({
      status: "suspended",
    })
  }

  async reactivateSubaccount(subaccountSid: string, _authToken: string): Promise<void> {
    await this.masterClient().api.v2010.accounts(subaccountSid).update({
      status: "active",
    })
  }

  generateAccessToken(
    identity: string,
    subaccountSid: string,
    apiKeySid: string,
    apiKeySecret: string,
    appSid: string,
  ): string {
    const { AccessToken } = twilio.jwt
    const { VoiceGrant } = AccessToken

    const grant = new VoiceGrant({
      outgoingApplicationSid: appSid,
      incomingAllow: true,
    })

    const token = new AccessToken(subaccountSid, apiKeySid, apiKeySecret, {
      identity,
      ttl: 3600,
    })
    token.addGrant(grant)
    return token.toJwt()
  }

  async initiateCall(params: ICallParams): Promise<{ callSid: string }> {
    const client = this.subClient(params.subaccountSid, params.authToken)
    const call = await client.calls.create({
      to: params.to,
      from: params.from,
      url: params.twimlUrl,
      statusCallback: params.statusCallbackUrl,
      statusCallbackMethod: "POST",
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
      machineDetection: params.machineDetection ?? "Enable",
      timeout: params.timeout ?? 15,
    })
    return { callSid: call.sid }
  }

  async fetchCall(
    callSid: string,
    subaccountSid: string,
    authToken: string,
  ): Promise<ICallStatus> {
    const client = this.subClient(subaccountSid, authToken)
    const call = await client.calls(callSid).fetch()
    return {
      status: call.status as ICallStatus["status"],
      duration: call.duration ? parseInt(call.duration, 10) : undefined,
      answeredBy: call.answeredBy as ICallStatus["answeredBy"],
    }
  }

  async hangupCall(
    callSid: string,
    subaccountSid: string,
    authToken: string,
  ): Promise<void> {
    const client = this.subClient(subaccountSid, authToken)
    await client.calls(callSid).update({ status: "completed" })
  }

  async fetchRecording(
    recordingSid: string,
    subaccountSid: string,
    authToken: string,
  ): Promise<IRecordingResult> {
    const client = this.subClient(subaccountSid, authToken)
    const recording = await client.recordings(recordingSid).fetch()
    return {
      recordingSid: recording.sid,
      mediaUrl: `https://api.twilio.com${recording.uri.replace(".json", ".mp3")}`,
    }
  }

  async downloadRecordingBuffer(
    recordingSid: string,
    subaccountSid: string,
    authToken: string,
  ): Promise<Buffer> {
    const { mediaUrl } = await this.fetchRecording(recordingSid, subaccountSid, authToken)
    const decryptedToken = decryptDialerSecret(authToken)
    if (!decryptedToken) {
      throw new Error("Não foi possível decifrar o token para download da gravação")
    }

    const credentials = Buffer.from(`${subaccountSid}:${decryptedToken}`).toString("base64")
    const response = await fetch(mediaUrl, {
      headers: { Authorization: `Basic ${credentials}` },
    })

    if (!response.ok) {
      throw new Error(`Falha ao baixar gravação: ${response.status} ${response.statusText}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    return Buffer.from(arrayBuffer)
  }

  async deleteRecording(
    recordingSid: string,
    subaccountSid: string,
    authToken: string,
  ): Promise<void> {
    const client = this.subClient(subaccountSid, authToken)
    await client.recordings(recordingSid).remove()
  }
}
