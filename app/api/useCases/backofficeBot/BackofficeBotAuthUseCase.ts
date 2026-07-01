import { Output } from "@/lib/output";
import { backofficeBotAuthService } from "@/app/api/services/backofficeBot/BackofficeBotAuthService";
import type { IBackofficeBotAuthUseCase } from "./IBackofficeBotAuthUseCase";

function mapAuthError(error: string): string {
  switch (error) {
    case "PHONE_INVALID":
      return "Número de telefone inválido";
    case "RATE_LIMIT":
      return "Limite de geração de código atingido. Tente novamente mais tarde.";
    case "AUTH_EXPIRED_OTP":
      return "Código expirado ou inválido";
    case "AUTH_INVALID_CODE":
      return "Código incorreto";
    case "PHONE_ALREADY_LINKED":
      return "Este número já está vinculado a outra conta";
    case "PROFILE_NOT_FOUND":
      return "Perfil não encontrado";
    case "TEAM_NOT_FOUND":
      return "Time ativo não encontrado";
    case "NOT_LINKED":
      return "Nenhum vínculo ativo encontrado";
    default:
      return "Não foi possível concluir a operação";
  }
}

export class BackofficeBotAuthUseCase implements IBackofficeBotAuthUseCase {
  async requestCode(email: string, normalizedPhone: string): Promise<Output> {
    try {
      const result = await backofficeBotAuthService.requestCode(email, normalizedPhone);
      if (!result.ok) {
        return new Output(false, [], [mapAuthError(result.error)], null);
      }

      const { challengeId, expiresAt } = result.result;
      return new Output(true, [], [], { challengeId, expiresAt });
    } catch (error) {
      console.error("[BackofficeBotAuthUseCase][requestCode]", error);
      return new Output(false, [], ["Erro ao solicitar código"], null);
    }
  }

  async verifyCode(normalizedPhone: string, code: string): Promise<Output> {
    try {
      const result = await backofficeBotAuthService.verifyCode(normalizedPhone, code);
      if (!result.ok) {
        return new Output(false, [], [mapAuthError(result.error)], { errorCode: result.error });
      }
      return new Output(true, ["Vínculo confirmado"], [], result.result);
    } catch (error) {
      console.error("[BackofficeBotAuthUseCase][verifyCode]", error);
      return new Output(false, [], ["Erro ao verificar código"], null);
    }
  }

  async linkInitiate(profileId: string): Promise<Output> {
    try {
      const result = await backofficeBotAuthService.linkInitiate(profileId);
      if (!result.ok) {
        return new Output(false, [], [mapAuthError(result.error)], null);
      }
      return new Output(true, [], [], result.result);
    } catch (error) {
      console.error("[BackofficeBotAuthUseCase][linkInitiate]", error);
      return new Output(false, [], ["Erro ao iniciar vínculo"], null);
    }
  }

  async linkStatus(profileId: string): Promise<Output> {
    try {
      const result = await backofficeBotAuthService.linkStatus(profileId);
      return new Output(true, [], [], result.result);
    } catch (error) {
      console.error("[BackofficeBotAuthUseCase][linkStatus]", error);
      return new Output(false, [], ["Erro ao consultar vínculo"], null);
    }
  }

  async revokeLink(profileId: string): Promise<Output> {
    try {
      const result = await backofficeBotAuthService.revokeLink(profileId);
      if (!result.ok) {
        return new Output(false, [], [mapAuthError(result.error)], null);
      }
      return new Output(true, ["Vínculo revogado"], [], result.result);
    } catch (error) {
      console.error("[BackofficeBotAuthUseCase][revokeLink]", error);
      return new Output(false, [], ["Erro ao revogar vínculo"], null);
    }
  }

  async getAuthStatus(normalizedPhone: string): Promise<Output> {
    try {
      const result = await backofficeBotAuthService.getAuthStatus(normalizedPhone);
      if (!result.ok) {
        return new Output(false, [], [mapAuthError(result.error)], null);
      }
      return new Output(true, [], [], result.result);
    } catch (error) {
      console.error("[BackofficeBotAuthUseCase][getAuthStatus]", error);
      return new Output(false, [], ["Erro ao consultar status de autenticação"], null);
    }
  }
}

export const backofficeBotAuthUseCase = new BackofficeBotAuthUseCase();
