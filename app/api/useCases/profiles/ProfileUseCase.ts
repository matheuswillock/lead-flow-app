import { Output } from "@/lib/output";
import { RequestToRegisterUserProfile } from "../../v1/profiles/DTO/requestToRegisterUserProfile";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository";
import { UserRole } from "@prisma/client";
import type { IProfileUseCase } from "./IProfileUseCase";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createProfileOutput } from "../../v1/profiles/DTO/profileResponseDTO";
import { createProfileUpdateOutput } from "../../v1/profiles/DTO/profileUpdateResponseDTO";

export class RegisterNewUserProfile implements IProfileUseCase {
    constructor(private readonly repo: IProfileRepository = profileRepository) {}

    async registerUserProfile(input: RequestToRegisterUserProfile): Promise<Output> {
        try {
            if (!input || !input.fullname || !input.email || !input.phone || !input.password) {
                return new Output(false, [], ["Invalid input data"], {
                    fullName: !input?.fullname ? "Full name is required" : undefined,
                    email: !input?.email ? "Email is required" : undefined,
                    phone: !input?.phone ? "Phone number is required" : undefined,
                    password: !input?.password ? "Password is required" : undefined,
                });
            }

            const alreadyExists = await this.repo.existingByEmailOrPhone(input.email, input.phone);
            if (alreadyExists) {
                return new Output(false, [], ["User already exists with the same email or phone"], null);
            }

            const result = await this.repo.createProfile(
                input.fullname,
                input.phone,
                input.password,
                input.email,
                UserRole.manager,
            );

            if (!result) {
                return new Output(false, [], ["Failed to create user profile"], null);
            }

            return new Output(true, ["User profile registered successfully"], [], { 
                profileId: result.profileId,
                supabaseId: result.supabaseId 
            });
        } catch (error) {
            console.error("Error registering user profile:", error);
            return new Output(false, [], ["Failed to register user profile"], null);
        }
    }

    async getProfileBySupabaseId(supabaseId: string): Promise<Output> {
        try {
            if (!supabaseId) {
                return new Output(false, [], ["Supabase ID is required"], null);
            }

            const profile = await this.repo.findBySupabaseId(supabaseId);
            
            return createProfileOutput(profile);
        } catch (error) {
            console.error("Error getting profile:", error);
            return new Output(false, [], ["Failed to retrieve profile"], null);
        }
    }

    async updateProfile(supabaseId: string, updates: { fullName?: string; phone?: string; email?: string }): Promise<Output> {
        try {
            if (!supabaseId) {
                return new Output(false, [], ["Supabase ID is required"], null);
            }

            if (!updates || Object.keys(updates).length === 0) {
                return new Output(false, [], ["No updates provided"], null);
            }

            // Check if profile exists
            const existingProfile = await this.repo.findBySupabaseId(supabaseId);
            if (!existingProfile) {
                return new Output(false, [], ["Profile not found"], null);
            }

            // Check if email or phone already exists for other users
            if (updates.email || updates.phone) {
                const email = updates.email || existingProfile.email || "";
                const phone = updates.phone || existingProfile.phone || "";
                
                const alreadyExists = await this.repo.existingByEmailOrPhone(email, phone);
                if (alreadyExists && (updates.email !== existingProfile.email || updates.phone !== existingProfile.phone)) {
                    return new Output(false, [], ["Email or phone already exists"], null);
                }
            }

            const updatedProfile = await this.repo.updateProfile(supabaseId, {
                fullName: updates.fullName,
                phone: updates.phone,
                email: updates.email,
            });

            if (!updatedProfile) {
                return new Output(false, [], ["Failed to update profile"], null);
            }

            // Usar o novo DTO que retorna apenas email, fullName e phone
            return createProfileUpdateOutput(updatedProfile);
        } catch (error) {
            console.error("Error updating profile:", error);
            return new Output(false, [], ["Failed to update profile"], null);
        }
    }

    async updatePassword(supabaseId: string, newPassword: string): Promise<Output> {
        try {
            if (!supabaseId) {
                return new Output(false, [], ["Supabase ID is required"], null);
            }

            if (!newPassword || typeof newPassword !== 'string') {
                return new Output(false, [], ["New password is required"], null);
            }

            // Validações básicas de senha
            if (newPassword.length < 6) {
                return new Output(false, [], ["Password must be at least 6 characters long"], null);
            }

            if (newPassword.length > 50) {
                return new Output(false, [], ["Password must be at most 50 characters long"], null);
            }

            // Validações de senha forte
            const hasUpperCase = /[A-Z]/.test(newPassword);
            const hasNumber = /\d/.test(newPassword);
            const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
            
            if (!hasUpperCase) {
                return new Output(false, [], ["Password must contain at least one uppercase letter"], null);
            }
            
            if (!hasNumber) {
                return new Output(false, [], ["Password must contain at least one number"], null);
            }
            
            if (!hasSpecialChar) {
                return new Output(false, [], ["Password must contain at least one special character"], null);
            }

            // Verificar se o perfil existe
            const existingProfile = await this.repo.findBySupabaseId(supabaseId);
            if (!existingProfile) {
                return new Output(false, [], ["Profile not found"], null);
            }

            // Atualizar senha no Supabase Auth
            const passwordUpdated = await this.repo.updatePassword(supabaseId, newPassword);
            
            if (!passwordUpdated) {
                return new Output(false, [], ["Failed to update password"], null);
            }

            return new Output(true, ["Password updated successfully"], [], "Password updated successfully");
        } catch (error) {
            console.error("Error updating password:", error);
            return new Output(false, [], ["Failed to update password"], null);
        }
    }

    async deleteProfile(supabaseId: string): Promise<Output> {
        try {
            if (!supabaseId) {
                return new Output(false, [], ["Supabase ID is required"], null);
            }

            // Check if profile exists
            const existingProfile = await this.repo.findBySupabaseId(supabaseId);
            if (!existingProfile) {
                return new Output(false, [], ["Profile not found"], null);
            }

            // Delete from Supabase Auth first
            const supabase = await createSupabaseServer();
            if (supabase) {
                const { error: authError } = await supabase.auth.admin.deleteUser(supabaseId);
                if (authError) {
                    console.error("Error deleting user from Supabase Auth:", authError);
                    return new Output(false, [], ["Failed to delete user authentication"], null);
                }
            }

            // Delete profile from database
            const deletedProfile = await this.repo.deleteProfile(supabaseId);
            
            if (!deletedProfile) {
                return new Output(false, [], ["Failed to delete profile"], null);
            }

            return new Output(true, ["Profile and authentication deleted successfully"], [], { deletedProfile: deletedProfile.id });
        } catch (error) {
            console.error("Error deleting profile:", error);
            return new Output(false, [], ["Failed to delete profile"], null);
        }
    }
}
