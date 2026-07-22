import { Output } from "@/lib/output"
import type { BackofficeUser, Profile } from "@prisma/client"
import { isValidTimezone } from "@/lib/dates"
import {
  backofficeEmailDomainErrorMessage,
  isValidBackofficeEmail,
  normalizeBackofficeEmail as normalizeBackofficeEmailValue,
} from "@/lib/backoffice/email-domain"
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository"
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository"
import { validateUpdatePasswordRequest } from "@/app/api/v1/profiles/DTO/requestToUpdatePassword"
import type {
  IBackofficeAccountUseCase,
  UpdateBackofficeAccountDTO,
  UpdateBackofficeGoogleConnectionDTO,
} from "./IBackofficeAccountUseCase"
import { IBackofficeUserRepository } from "../../infra/data/repositories/backoffice/UserRepository/IBackofficeUserRepository"
import { BackofficeUserRepository } from "../../infra/data/repositories/backoffice/UserRepository/BackofficeUserRepository"
import type { IGoogleOAuthConnectionRepository } from "../../infra/data/repositories/googleOAuthConnection/IGoogleOAuthConnectionRepository"
import { GoogleOAuthConnectionRepository } from "../../infra/data/repositories/googleOAuthConnection/GoogleOAuthConnectionRepository"
import type { IBackofficeGoogleConnectionResolverService } from "../../services/Backoffice/backofficeGoogleConnection/IBackofficeGoogleConnectionResolverService"
import { BackofficeGoogleConnectionResolverService } from "../../services/Backoffice/backofficeGoogleConnection/BackofficeGoogleConnectionResolverService"
import { isGoogleConnectionActive } from "@/lib/google/connection"
import { getScopesForGoogleConnection } from "@/lib/google/get-scopes-for-connection"
import { fetchGoogleGrantedScopes } from "@/lib/google/scopes"

export const BACKOFFICE_GOOGLE_EMAIL_CONFLICT_MESSAGE =
  "Este e-mail Google já está vinculado a outro usuário."

function trimString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  return value.trim()
}

function normalizeBackofficeEmail(value: unknown): string | undefined {
  const email = trimString(value)
  return email ? normalizeBackofficeEmailValue(email) : undefined
}

function mapAccount(
  profile: Profile,
  user: BackofficeUser,
  organizer: {
    source: "backoffice_user" | "linked_profile"
    connection: { googleEmail: string; refreshToken: string | null; revokedAt: Date | null }
  } | null = null
) {
  return {
    profileId: profile.id,
    supabaseId: profile.supabaseId,
    backofficeUserId: user.id,
    fullName: profile.fullName,
    email: profile.email,
    phone: profile.phone,
    cpfCnpj: profile.cpfCnpj,
    postalCode: profile.postalCode,
    address: profile.address,
    addressNumber: profile.addressNumber,
    neighborhood: profile.neighborhood,
    complement: profile.complement,
    city: profile.city,
    state: profile.state,
    profileIconId: profile.profileIconId,
    profileIconUrl: profile.profileIconUrl,
    fullAccess: user.fullAccess,
    isOperator: !user.fullAccess,
    isActive: user.isActive,
    isSdr: user.isSdr,
    isCloser: user.isCloser,
    googleCalendarConnected: isGoogleConnectionActive(organizer?.connection),
    googleEmail: organizer?.connection.googleEmail ?? null,
    googleConnectionSource: organizer?.source ?? null,
    timezone: user.timezone,
  }
}

export class BackofficeAccountUseCase implements IBackofficeAccountUseCase {
  constructor(
    private readonly userRepo: IBackofficeUserRepository,
    private readonly profileRepo: IProfileRepository,
    private readonly connectionRepo: IGoogleOAuthConnectionRepository,
    private readonly googleResolver: IBackofficeGoogleConnectionResolverService
  ) {}

  async getAccount(profileId: string): Promise<Output> {
    try {
      const [profile, user] = await Promise.all([
        this.profileRepo.findById(profileId),
        this.userRepo.findByProfileId(profileId),
      ])

      if (!profile || !user) {
        return new Output(false, [], ["Conta backoffice não encontrada"], null)
      }

      if (!profile.supabaseId) {
        return new Output(false, [], ["Perfil sem autenticação vinculada"], null)
      }

      const organizer = await this.googleResolver.resolveForBackofficeUser(user.id)
      return new Output(
        true,
        [],
        [],
        mapAccount(profile, user, organizer)
      )
    } catch (error) {
      console.error("[BackofficeAccountUseCase][getAccount]", error)
      return new Output(false, [], ["Erro ao buscar conta backoffice"], null)
    }
  }

  async updateAccount(profileId: string, data: UpdateBackofficeAccountDTO): Promise<Output> {
    try {
      const [profile, user] = await Promise.all([
        this.profileRepo.findById(profileId),
        this.userRepo.findByProfileId(profileId),
      ])

      if (!profile || !user) {
        return new Output(false, [], ["Conta backoffice não encontrada"], null)
      }

      const fullName = data.fullName !== undefined ? trimString(data.fullName) : undefined
      if (fullName !== undefined && fullName.length < 2) {
        return new Output(false, [], ["Nome deve ter pelo menos 2 caracteres"], null)
      }

      const email = data.email !== undefined ? normalizeBackofficeEmail(data.email) : undefined
      if (data.email !== undefined) {
        if (!email || !isValidBackofficeEmail(email)) {
          return new Output(false, [], [backofficeEmailDomainErrorMessage()], null)
        }

        if (email !== user.email) {
          const owner = await this.userRepo.findByEmail(email)
          if (owner && owner.id !== user.id) {
            return new Output(false, [], ["E-mail já está em uso por outro usuário backoffice"], null)
          }
        }
      }

      const profileUpdate = {
        fullName,
        email,
        phone: data.phone !== undefined ? trimString(data.phone) : undefined,
        cpfCnpj: data.cpfCnpj !== undefined ? trimString(data.cpfCnpj) : undefined,
        postalCode: data.postalCode !== undefined ? trimString(data.postalCode) : undefined,
        address: data.address !== undefined ? trimString(data.address) : undefined,
        addressNumber:
          data.addressNumber !== undefined ? trimString(data.addressNumber) : undefined,
        neighborhood:
          data.neighborhood !== undefined ? trimString(data.neighborhood) : undefined,
        complement: data.complement !== undefined ? trimString(data.complement) : undefined,
        city: data.city !== undefined ? trimString(data.city) : undefined,
        state: data.state !== undefined ? trimString(data.state) : undefined,
      }

      if (!profile.supabaseId) {
        return new Output(false, [], ["Conta sem supabaseId — não é possível atualizar o perfil"], null)
      }
      const updatedProfile = await this.profileRepo.updateProfile(profile.supabaseId, profileUpdate)
      if (!updatedProfile) {
        return new Output(false, [], ["Erro ao atualizar perfil backoffice"], null)
      }

      const updatedUser =
        email && email !== user.email ? await this.userRepo.update(user.id, { email }) : user

      const organizer = await this.googleResolver.resolveForBackofficeUser(updatedUser.id)
      return new Output(
        true,
        ["Conta atualizada com sucesso"],
        [],
        mapAccount(updatedProfile, updatedUser, organizer)
      )
    } catch (error) {
      console.error("[BackofficeAccountUseCase][updateAccount]", error)
      return new Output(false, [], ["Erro ao atualizar conta backoffice"], null)
    }
  }

  async updatePassword(supabaseId: string, password: string): Promise<Output> {
    try {
      const validated = validateUpdatePasswordRequest({ password })
      const updated = await this.profileRepo.updatePassword(supabaseId, validated.password)
      if (!updated) {
        return new Output(false, [], ["Erro ao atualizar senha"], null)
      }

      return new Output(true, ["Senha atualizada com sucesso"], [], null)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Senha inválida"
      return new Output(false, [], [message], null)
    }
  }

  async updateTimezone(profileId: string, timezone: string): Promise<Output> {
    try {
      if (!timezone || !isValidTimezone(timezone)) {
        return new Output(false, [], ["Timezone inválido"], null)
      }

      const user = await this.userRepo.findByProfileId(profileId)
      if (!user) {
        return new Output(false, [], ["Conta backoffice não encontrada"], null)
      }

      await this.userRepo.update(user.id, { timezone })
      return new Output(true, ["Fuso horário atualizado"], [], { timezone })
    } catch (error) {
      console.error("[BackofficeAccountUseCase][updateTimezone]", error)
      return new Output(false, [], ["Erro ao atualizar fuso horário"], null)
    }
  }

  async connectGoogle(
    profileId: string,
    data: UpdateBackofficeGoogleConnectionDTO
  ): Promise<Output> {
    try {
      const user = await this.userRepo.findByProfileId(profileId)
      if (!user) {
        return new Output(false, [], ["Conta backoffice não encontrada"], null)
      }

      const accessToken = trimString(data.accessToken)
      if (!accessToken) {
        return new Output(false, [], ["Access token Google é obrigatório"], null)
      }

      const expiresAt = data.expiresAt ? new Date(data.expiresAt) : null
      if (data.expiresAt && Number.isNaN(expiresAt?.getTime())) {
        return new Output(false, [], ["Expiração do token Google inválida"], null)
      }

      const googleEmail = normalizeBackofficeEmail(data.email) ?? null
      let connection = googleEmail
        ? await this.connectionRepo.findByGoogleEmail(googleEmail)
        : null

      if (
        connection?.ownerProfileId &&
        connection.ownerProfileId !== profileId
      ) {
        return new Output(false, [], [BACKOFFICE_GOOGLE_EMAIL_CONFLICT_MESSAGE], null)
      }

      if (!connection && googleEmail) {
        connection = await this.connectionRepo.create({
          googleEmail,
          accessToken,
          refreshToken: trimString(data.refreshToken) || null,
          tokenExpiresAt: expiresAt,
        })
      } else if (connection) {
        connection = await this.connectionRepo.updateTokens(connection.id, {
          accessToken,
          refreshToken:
            data.refreshToken === undefined
              ? connection.refreshToken
              : trimString(data.refreshToken) || null,
          tokenExpiresAt: expiresAt,
          lastRefreshedAt: new Date(),
          lastRefreshError: null,
        })
      }

      if (connection?.id) {
        const grantedScopes = await fetchGoogleGrantedScopes(accessToken).catch(() => [])
        connection = await this.connectionRepo.updateTokens(connection.id, {
          scopes: grantedScopes,
        })
      }

      const updatedUser = await this.userRepo.update(user.id, {
        googleConnectionId: connection?.id ?? user.googleConnectionId ?? null,
      })

      if (connection?.id) {
        await this.connectionRepo.attachToBackofficeUser(connection.id, user.id)
      }

      const organizer = await this.googleResolver.resolveForBackofficeUser(updatedUser.id)

      return new Output(true, ["Google Calendar conectado"], [], {
        googleCalendarConnected: !!organizer && isGoogleConnectionActive(organizer.connection),
        googleEmail: organizer?.connection.googleEmail ?? null,
        googleConnectionSource: organizer?.source ?? null,
        timezone: updatedUser.timezone,
      })
    } catch (error) {
      console.error("[BackofficeAccountUseCase][connectGoogle]", error)
      return new Output(false, [], ["Erro ao conectar Google Calendar"], null)
    }
  }

  async getGoogleScopes(profileId: string): Promise<Output> {
    try {
      const user = await this.userRepo.findByProfileId(profileId)
      if (!user) {
        return new Output(false, [], ["Conta backoffice não encontrada"], null)
      }

      const organizer = await this.googleResolver.resolveForBackofficeUser(user.id)
      if (!organizer || !isGoogleConnectionActive(organizer.connection)) {
        return new Output(true, [], [], { connected: false, scopes: [] as string[] })
      }

      const result = await getScopesForGoogleConnection(organizer.connection)
      return new Output(true, [], [], result)
    } catch (error) {
      console.error("[BackofficeAccountUseCase][getGoogleScopes]", error)
      return new Output(false, [], ["Erro ao buscar escopos Google"], null)
    }
  }

  async disconnectGoogle(profileId: string): Promise<Output> {
    try {
      const user = await this.userRepo.findByProfileId(profileId)
      if (!user) {
        return new Output(false, [], ["Conta backoffice não encontrada"], null)
      }

      // Limpa conexão própria e o vínculo legado com o perfil CS usado como fallback de Google.
      // A conexão Google do Corretor Studio (Profile) permanece intacta.
      await this.userRepo.update(user.id, {
        googleConnectionId: null,
        linkedCorretorStudioProfileId: null,
      })
      await this.connectionRepo.detachFromBackofficeUser(user.id)

      return new Output(true, ["Google Calendar desconectado"], [], null)
    } catch (error) {
      console.error("[BackofficeAccountUseCase][disconnectGoogle]", error)
      return new Output(false, [], ["Erro ao desconectar Google Calendar"], null)
    }
  }
}

export const backofficeAccountUseCase = new BackofficeAccountUseCase(
  new BackofficeUserRepository(),
  profileRepository,
  new GoogleOAuthConnectionRepository(),
  new BackofficeGoogleConnectionResolverService(new BackofficeUserRepository())
)
