import type { Profile, UserRole } from "@prisma/client";

export interface IProfileRepository {
  findById(id: string): Promise<Profile | null>;
  findBySupabaseId(supabaseId: string): Promise<Profile | null>;
  findBySupabaseIdWithRelations(supabaseId: string): Promise<Profile | null>;
  existingByEmailOrPhone(email: string, phone: string): Promise<boolean>;
  findByEmail(email: string): Promise<Profile | null>;
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
    }
  ): Promise<Profile | null>;
  updateProfileById(
    profileId: string,
    updates: { fullName?: string; phone?: string; email?: string; role?: string; functions?: ("SDR" | "CLOSER")[] }
  ): Promise<Profile | null>;
  updateProfileIcon(
    supabaseId: string,
    profileIconId: string | null,
    profileIconUrl: string | null
  ): Promise<Profile | null>;
  updatePassword(supabaseId: string, newPassword: string): Promise<boolean>;
  deleteProfile(supabaseId: string): Promise<Profile | null>;
}
