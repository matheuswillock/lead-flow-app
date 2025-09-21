import type { Output } from "@/lib/output";
import type { RequestToRegisterUserProfile } from "../../v1/profiles/DTO/requestToRegisterUserProfile";

export interface ProfileInfo {
  id: string;
  role: 'manager' | 'operator';
  managerId: string | null;
  fullName: string | null;
  email: string;
}

/**
 * Interface for Profile Use Cases
 * Defines the contract for all profile-related business operations
 */
export interface IProfileUseCase {
  registerUserProfile(input: RequestToRegisterUserProfile): Promise<Output>;
  getProfileBySupabaseId(supabaseId: string): Promise<Output>;
  getProfileInfoBySupabaseId(supabaseId: string): Promise<ProfileInfo | null>;
  updateProfile(supabaseId: string, updates: { fullName?: string; phone?: string; email?: string }): Promise<Output>;
  updateProfileIcon(supabaseId: string, profileIconId: string | null): Promise<Output>;
  updatePassword(supabaseId: string, newPassword: string): Promise<Output>;
  deleteProfile(supabaseId: string): Promise<Output>;
}
