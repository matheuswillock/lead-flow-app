import { Output } from "@/lib/output"
import { DialerRepository } from "@/app/api/infra/data/repositories/dialer/DialerRepository"
import type { IDialerRepository } from "@/app/api/infra/data/repositories/dialer/IDialerRepository"
import { TwilioVoiceProvider } from "@/app/api/services/VoiceProvider/TwilioVoiceProvider"
import type { IVoiceProvider } from "@/app/api/services/VoiceProvider/IVoiceProvider"
import { decryptDialerSecret } from "@/lib/dialer/secret-crypto"
import type { IDialerTokenUseCase } from "./IDialerTokenUseCase"

export class DialerTokenUseCase implements IDialerTokenUseCase {
  constructor(
    private readonly repository: IDialerRepository = new DialerRepository(),
    private readonly voiceProvider: IVoiceProvider = new TwilioVoiceProvider(),
  ) {}

  async generateToken(teamId: string, profileId: string): Promise<Output> {
    const team = await this.repository.findTeamDialerConfig(teamId)

    if (!team?.dialerEnabled) {
      return new Output(false, [], ["Discadora não está ativa para este time"], null)
    }

    if (
      !team.twilioSubaccountSid ||
      !team.twilioApiKeySid ||
      !team.twilioApiKeySecret ||
      !team.twilioAppSid
    ) {
      return new Output(false, [], ["Configuração Twilio incompleta para este time"], null)
    }

    const apiKeySecret = decryptDialerSecret(team.twilioApiKeySecret)
    if (!apiKeySecret) {
      console.error("[DialerTokenUseCase] Falha ao decifrar API key secret", { teamId })
      return new Output(false, [], ["Erro interno ao gerar token"], null)
    }

    const token = this.voiceProvider.generateAccessToken(
      profileId,
      team.twilioSubaccountSid,
      team.twilioApiKeySid,
      apiKeySecret,
      team.twilioAppSid,
    )

    return new Output(true, [], [], { token, identity: profileId })
  }
}

export const dialerTokenUseCase = new DialerTokenUseCase()
