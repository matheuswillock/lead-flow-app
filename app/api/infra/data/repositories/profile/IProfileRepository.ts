import type { Profile, UserRole } from "@prisma/client";
import type { AsaasAccountId } from "@/lib/asaas";

export interface IProfileRepository {
  findById(id: string): Promise<Profile | null>;
  findBySupabaseId(supabaseId: string): Promise<Profile | null>;
  findBySupabaseIdWithRelations(supabaseId: string): Promise<Profile | null>;
  findFirstTeamIdByProfileId(profileId: string): Promise<string | null>;
  existingByEmailOrPhone(
    email: string,
    phone: string,
    excludeProfileId?: string
  ): Promise<boolean>;
  findByEmail(email: string): Promise<Profile | null>;
  findByGoogleEmail(googleEmail: string): Promise<Profile | null>;
  createProfile(
    fullName: string,
    phone: string,
    password: string,
    email: string,
    role: UserRole,
    asaasCustomerId?: string,
    subscriptionId?: string,
    cpfCnpj?: string,
    subscriptionStatus?: string,
    subscriptionPlan?: string,
    operatorCount?: number,
    subscriptionStartDate?: Date,
    trialEndDate?: Date,
    postalCode?: string,
    address?: string,
    addressNumber?: string,
    neighborhood?: string,
    complement?: string,
    city?: string,
    state?: string,
    managerId?: string
  ): Promise<{ profileId: string; supabaseId: string } | null>;
  createProfileWithSupabaseId(
    supabaseId: string,
    fullName: string,
    phone: string,
    email: string,
    role: UserRole,
    asaasCustomerId?: string,
    subscriptionId?: string,
    cpfCnpj?: string,
    subscriptionStatus?: string,
    subscriptionPlan?: string,
    operatorCount?: number,
    subscriptionStartDate?: Date,
    trialEndDate?: Date,
    postalCode?: string,
    address?: string,
    addressNumber?: string,
    neighborhood?: string,
    complement?: string,
    city?: string,
    state?: string,
    managerId?: string
  ): Promise<{ profileId: string; supabaseId: string } | null>;
  updateProfile(
    supabaseId: string,
    updates: { 
      fullName?: string; 
      phone?: string; 
      email?: string;
      cpfCnpj?: string;
      postalCode?: string;
      address?: string;
      addressNumber?: string;
      neighborhood?: string;
      complement?: string;
      city?: string;
      state?: string;
      functions?: ("SDR" | "CLOSER")[];
    }
  ): Promise<Profile | null>;
  updateProfileById(
    profileId: string,
    updates: {
      fullName?: string;
      phone?: string;
      email?: string;
      role?: string;
      functions?: ("SDR" | "CLOSER")[];
    }
  ): Promise<Profile | null>;
  updateProfileIcon(
    supabaseId: string,
    profileIconId: string | null,
    profileIconUrl: string | null
  ): Promise<Profile | null>;
  updateGoogleCalendarAuth(
    supabaseId: string,
    updates: {
      accessToken?: string | null;
      refreshToken?: string | null;
      expiresAt?: Date | null;
      email?: string | null;
      connected?: boolean;
    }
  ): Promise<Profile | null>;
  updatePassword(supabaseId: string, newPassword: string): Promise<boolean>;
  deleteProfile(supabaseId: string): Promise<Profile | null>;
  createBackofficeProfile(
    supabaseId: string,
    email: string,
    fullName: string
  ): Promise<{ profileId: string }>;
  findAsaasSyncProfileById(profileId: string): Promise<{
    id: string;
    fullName: string | null;
    email: string;
    cpfCnpj: string | null;
    phone: string | null;
    postalCode: string | null;
    address: string | null;
    addressNumber: string | null;
    neighborhood: string | null;
    complement: string | null;
    asaasCustomerId: string | null;
  } | null>;
  updateAsaasCustomerId(profileId: string, asaasCustomerId: string): Promise<void>;
  /** Dados minimos de contato, para notificacao e rotulo em atividade. */
  findContactById(id: string): Promise<ProfileContact | null>;
  /** Identidade Supabase do perfil, para acoes executadas em nome dele. */
  findIdentityById(id: string): Promise<ProfileIdentity | null>;
  /** Fuso horario configurado, para exibicao e para o bootstrap do form publico. */
  findTimezoneBySupabaseId(supabaseId: string): Promise<{ id: string; timezone: string } | null>;
  /** Id e e-mail do solicitante, para reautenticacao por senha e log de auditoria. */
  findAuthContactBySupabaseId(supabaseId: string): Promise<{ id: string; email: string } | null>;
  /** Atualiza o fuso e devolve o id do perfil, para invalidacao em cascata. */
  updateTimezoneBySupabaseId(supabaseId: string, timezone: string): Promise<{ id: string } | null>;
  /**
   * Primeiro master com assinatura vigente. Fallback da ingestao do Meta quando
   * o webhook chega sem `managerId` no query param.
   */
  findFirstActiveMasterManager(): Promise<ProfileIdentity | null>;
  /**
   * Perfil com a conexao Google, para operar o calendario em nome dele.
   * Devolve o Profile completo porque `cancelCalendarEvent` o recebe como organizer.
   */
  findWithGoogleConnectionById(id: string): Promise<ProfileWithGoogleConnection | null>;
  /** Marca o inicio do trial pos-checkout (CheckoutAsaasUseCase — E5). */
  markProfileCheckoutTrialStarted(profileId: string): Promise<void>;
  /** Rollback parcial de checkout: remove o asaasCustomerId gravado. */
  clearAsaasCustomerId(supabaseId: string): Promise<void>;
  /**
   * Cria o perfil do operador a partir de um PendingOperator confirmado
   * (CheckoutAsaasUseCase.processOperatorCheckoutPaid — E5).
   */
  createOperatorProfileFromPendingOperator(input: {
    supabaseId: string;
    fullName: string;
    email: string;
    role: UserRole;
    functions: ("SDR" | "CLOSER")[];
    managerId: string;
  }): Promise<Profile>;
  incrementOperatorCount(profileId: string): Promise<void>;
  /**
   * Filtra por conta (E4/E5 de [[10 — Fundações Multi-conta — Backend]],
   * C33) — o mesmo asaasSubscriptionId pode existir nas duas contas durante
   * a janela dual.
   */
  findByAsaasSubscriptionIdAndAccount(
    subscriptionId: string,
    account: AsaasAccountId
  ): Promise<Profile | null>;
  activateSubscription(profileId: string): Promise<void>;
}

export type ProfileContact = Pick<Profile, "id" | "email" | "fullName">;

export type ProfileIdentity = Pick<Profile, "id" | "supabaseId">;

export type ProfileWithGoogleConnection = Profile & {
  googleConnection: {
    accessToken: string | null;
    refreshToken: string | null;
    tokenExpiresAt: Date | null;
    revokedAt: Date | null;
  } | null;
};
