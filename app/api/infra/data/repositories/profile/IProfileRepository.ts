import type { Profile, UserRole } from "@prisma/client";

export interface IProfileRepository {
  findBySupabaseId(supabaseId: string): Promise<Profile | null>;
  existingByEmailOrPhone(email: string, phone: string): Promise<boolean>;
  createProfile(
    fullName: string,
    phone: string,
    password: string,
    email: string,
    role: UserRole
  ): Promise<string | null>;
  updateProfile(
    supabaseId: string,
    updates: { fullName?: string; phone?: string; email?: string }
  ): Promise<Profile | null>;
  deleteProfile(supabaseId: string): Promise<Profile | null>;
}
