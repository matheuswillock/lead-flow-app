import { Output } from "@/lib/output"
import type { BackofficeUser, Profile } from "@prisma/client"
import { isValidTimezone } from "@/lib/dates"
import type { IBackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/IBackofficeUserRepository"
import { BackofficeUserRepository } from "@/app/api/infra/data/repositories/backoffice/BackofficeUserRepository"
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository"
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository"
import { validateUpdatePasswordRequest } from "@/app/api/v1/profiles/DTO/requestToUpdatePassword"
import type {
  IBackofficeAccountUseCase,
  UpdateBackofficeAccountDTO,
  UpdateBackofficeGoogleConnectionDTO,
} from "./IBackofficeAccountUseCase"

const BACKOFFICE_EMAIL_DOMAIN = "@corretorstudio.com"

function trimString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  return value.trim()
}

function normalizeBackofficeEmail(value: unknown): string | undefined {
  const email = trimString(value)?.toLowerCase()
  return email || undefined
}

function isValidBackofficeEmail(value: string): boolean {
  const prefix = value.endsWith(BACKOFFICE_EMAIL_DOMAIN)
    ? value.slice(0, -BACKOFFICE_EMAIL_DOMAIN.length)
    : ""

  return /^[^\s@]+$/.test(prefix) && value === `${prefix}${BACKOFFICE_EMAIL_DOMAIN}`
}

function mapAccount(profile: Profile, user: BackofficeUser) {
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
    isActive: user.isActive,
    isSdr: user.isSdr,
    isCloser: user.isCloser,
    googleCalendarConnected: user.googleCalendarConnected,
    googleEmail: user.googleEmail,
    timezone: user.timezone,
  }
}

export class BackofficeAccountUseCase implements IBackofficeAccountUseCase {
  constructor(
    private readonly userRepo: IBackofficeUserRepository,
    private readonly profileRepo: IProfileRepository
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

      return new Output(true, [], [], mapAccount(profile, user))
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
          return new Output(false, [], ["E-mail deve pertencer ao domínio @corretorstudio.com"], null)
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

      return new Output(true, ["Conta atualizada com sucesso"], [], mapAccount(updatedProfile, updatedUser))
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

      const updatedUser = await this.userRepo.update(user.id, {
        googleCalendarConnected: true,
        googleAccessToken: accessToken,
        googleRefreshToken:
          data.refreshToken === undefined
            ? user.googleRefreshToken
            : trimString(data.refreshToken) || null,
        googleTokenExpiresAt: expiresAt,
        googleEmail: normalizeBackofficeEmail(data.email) ?? null,
      })

      return new Output(true, ["Google Calendar conectado"], [], {
        googleCalendarConnected: updatedUser.googleCalendarConnected,
        googleEmail: updatedUser.googleEmail,
        timezone: updatedUser.timezone,
      })
    } catch (error) {
      console.error("[BackofficeAccountUseCase][connectGoogle]", error)
      return new Output(false, [], ["Erro ao conectar Google Calendar"], null)
    }
  }

  async disconnectGoogle(profileId: string): Promise<Output> {
    try {
      const user = await this.userRepo.findByProfileId(profileId)
      if (!user) {
        return new Output(false, [], ["Conta backoffice não encontrada"], null)
      }

      await this.userRepo.update(user.id, {
        googleCalendarConnected: false,
        googleAccessToken: null,
        googleRefreshToken: null,
        googleTokenExpiresAt: null,
        googleEmail: null,
      })

      return new Output(true, ["Google Calendar desconectado"], [], null)
    } catch (error) {
      console.error("[BackofficeAccountUseCase][disconnectGoogle]", error)
      return new Output(false, [], ["Erro ao desconectar Google Calendar"], null)
    }
  }
}

export const backofficeAccountUseCase = new BackofficeAccountUseCase(
  new BackofficeUserRepository(),
  profileRepository
)
