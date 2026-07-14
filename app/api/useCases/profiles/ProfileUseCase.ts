import { Output } from "@/lib/output";
import { RequestToRegisterUserProfile, RequestToRegisterUserProfileOAuth } from "../../v1/profiles/DTO/requestToRegisterUserProfile";
import { profileRepository } from "@/app/api/infra/data/repositories/profile/ProfileRepository";
import type { IProfileRepository } from "@/app/api/infra/data/repositories/profile/IProfileRepository";
import { UserRole } from "@prisma/client";
import type { IProfileUseCase, ProfileInfo } from "./IProfileUseCase";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createProfileOutput } from "../../v1/profiles/DTO/profileResponseDTO";
import { createProfileUpdateOutput } from "../../v1/profiles/DTO/profileUpdateResponseDTO";
import { auditLogService } from "@/app/api/services/audit/AuditLogService";

export class RegisterNewUserProfile implements IProfileUseCase {
    constructor(private readonly repo: IProfileRepository = profileRepository) {}

    async registerUserProfile(input: RequestToRegisterUserProfile | RequestToRegisterUserProfileOAuth): Promise<Output> {
        try {
            console.info('🎯 [ProfileUseCase] registerUserProfile iniciado');
            console.info('📦 [ProfileUseCase] Input recebido:', {
                hasSubscriptionId: !!input.subscriptionId,
                hasAsaasCustomerId: !!input.asaasCustomerId,
                hasSubscriptionPlan: !!input.subscriptionPlan,
                hasOperatorCount: input.operatorCount !== undefined,
                subscriptionId: input.subscriptionId,
                asaasCustomerId: input.asaasCustomerId,
                subscriptionPlan: input.subscriptionPlan,
                operatorCount: input.operatorCount,
                subscriptionStatus: input.subscriptionStatus,
                role: input.role
            });
            
            const typedInput = input as RequestToRegisterUserProfile;
            if (!typedInput || !typedInput.fullname || !typedInput.email || !typedInput.phone || !typedInput.password) {
                return new Output(false, [], ["Dados inválidos"], {
                    fullName: !typedInput?.fullname ? "Nome completo é obrigatório" : undefined,
                    email: !typedInput?.email ? "E-mail é obrigatório" : undefined,
                    phone: !typedInput?.phone ? "Telefone é obrigatório" : undefined,
                    password: !typedInput?.password ? "Senha é obrigatória" : undefined,
                });
            }

            const alreadyExists = await this.repo.existingByEmailOrPhone(typedInput.email, typedInput.phone);
            if (alreadyExists) {
                return new Output(false, [], ["Usuário já cadastrado com este e-mail ou telefone"], null);
            }

            console.info('🔍 [ProfileUseCase] Valores de endereço do INPUT:', {
                postalCode: input.postalCode,
                address: input.address,
                addressNumber: input.addressNumber,
                neighborhood: input.neighborhood,
                complement: input.complement,
                city: input.city,
                state: input.state
            });
            
            const result = await this.repo.createProfile(
                typedInput.fullname,
                typedInput.phone,
                typedInput.password,
                typedInput.email,
                typedInput.role || UserRole.manager,
                typedInput.asaasCustomerId,
                typedInput.subscriptionId,
                typedInput.cpfCnpj,
                typedInput.subscriptionStatus,
                typedInput.subscriptionPlan,
                typedInput.operatorCount,
                typedInput.subscriptionStartDate,
                typedInput.trialEndDate,
                typedInput.postalCode,
                typedInput.address,
                typedInput.addressNumber,
                typedInput.neighborhood,
                typedInput.complement,
                typedInput.city,
                typedInput.state
            );

            if (!result) {
                return new Output(false, [], ["Falha ao criar perfil do usuário"], null);
            }

            await auditLogService.logAudit({
                entityType: "PROFILE",
                entityId: result.profileId,
                action: "CREATE",
                actorProfileId: result.profileId,
                before: null,
                after: { profileId: result.profileId, email: typedInput.email, role: typedInput.role || UserRole.manager },
                metadata: null,
            });

            return new Output(true, ["Perfil de usuário registrado com sucesso"], [], {
                profileId: result.profileId,
                supabaseId: result.supabaseId
            });
        } catch (error: any) {
            console.error("Erro ao registrar perfil do usuário:", error);
            
            // Retornar mensagem do erro se estiver traduzida
            const errorMessage = error.message || "Falha ao registrar perfil do usuário";
            return new Output(false, [], [errorMessage], null);
        }
    }

    async getProfileBySupabaseId(supabaseId: string): Promise<Output> {
        try {
            if (!supabaseId) {
                return new Output(false, [], ["Supabase ID is required"], null);
            }

            const profile = await this.repo.findBySupabaseIdWithRelations(supabaseId);
            
            return createProfileOutput(profile);
        } catch (error) {
            console.error("Error getting profile:", error);
            return new Output(false, [], ["Failed to retrieve profile"], null);
        }
    }

    async getProfileInfoBySupabaseId(supabaseId: string): Promise<ProfileInfo | null> {
        try {
            if (!supabaseId) {
                return null;
            }

            const profile = await this.repo.findBySupabaseId(supabaseId);
            
            if (!profile) {
                return null;
            }

            return {
                id: profile.id,
                role: profile.role as 'manager' | 'backoffice' | 'operator',
                managerId: profile.managerId,
                isMaster: profile.isMaster,
                fullName: profile.fullName,
                email: profile.email,
                canTransferAccountLeads: false,
                activeTeamId: profile.activeTeamId ?? null
            };
        } catch (error) {
            console.error("Error getting profile info:", error);
            return null;
        }
    }

    async getProfileById(profileId: string): Promise<ProfileInfo | null> {
        try {
            if (!profileId) {
                return null;
            }

            const profile = await this.repo.findById(profileId);
            
            if (!profile) {
                return null;
            }

            return {
                id: profile.id,
                role: profile.role as 'manager' | 'backoffice' | 'operator',
                managerId: profile.managerId,
                isMaster: profile.isMaster,
                fullName: profile.fullName,
                email: profile.email,
                canTransferAccountLeads: false,
                activeTeamId: profile.activeTeamId ?? null
            };
        } catch (error) {
            console.error("Error getting profile by id:", error);
            return null;
        }
    }

    async updateProfile(
        supabaseId: string, 
        updates: { 
            fullName?: string; 
            phone?: string; 
            email?: string; 
            password?: string;
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
    ): Promise<Output> {
        try {
            if (!supabaseId) {
                return new Output(false, [], ["Supabase ID is required"], null);
            }

            if (!updates || Object.keys(updates).length === 0) {
                return new Output(false, [], ["No updates provided"], null);
            }

            // Validar senha se fornecida
            if (updates.password) {
                const passwordValidation = this.validatePassword(updates.password);
                if (!passwordValidation.isValid) {
                    return new Output(false, [], passwordValidation.errors, null);
                }
            }

            // Check if profile exists
            const existingProfile = await this.repo.findBySupabaseId(supabaseId);
            if (!existingProfile) {
                return new Output(false, [], ["Profile not found"], null);
            }

            // Check if email or phone already exists for other users
            if (updates.email || updates.phone) {
                const emailToCheck = updates.email?.trim() || "";
                const phoneToCheck = updates.phone?.trim() || "";

                const alreadyExists = await this.repo.existingByEmailOrPhone(
                    emailToCheck,
                    phoneToCheck,
                    existingProfile.id
                );
                if (alreadyExists) {
                    return new Output(
                        false,
                        [],
                        ["E-mail ou telefone já cadastrado em outra conta"],
                        null
                    );
                }
            }

            if (updates.functions !== undefined && !existingProfile.isMaster) {
                return new Output(false, [], ["Apenas o usuário master pode atualizar funções"], null);
            }

            // Atualizar perfil
            const updatedProfile = await this.repo.updateProfile(supabaseId, {
                fullName: updates.fullName,
                phone: updates.phone,
                email: updates.email,
                cpfCnpj: updates.cpfCnpj,
                postalCode: updates.postalCode,
                address: updates.address,
                addressNumber: updates.addressNumber,
                neighborhood: updates.neighborhood,
                complement: updates.complement,
                city: updates.city,
                state: updates.state,
                functions: updates.functions,
            });

            if (!updatedProfile) {
                return new Output(false, [], ["Failed to update profile"], null);
            }

            // Atualizar senha se fornecida
            if (updates.password) {
                const passwordUpdated = await this.repo.updatePassword(supabaseId, updates.password);
                if (!passwordUpdated) {
                    return new Output(false, [], ["Failed to update password"], null);
                }
            }

            await auditLogService.logAudit({
                entityType: "PROFILE",
                entityId: existingProfile.id,
                action: updates.functions !== undefined ? "ROLE_CHANGE" : "UPDATE",
                actorProfileId: existingProfile.id,
                before: {
                    fullName: existingProfile.fullName,
                    phone: existingProfile.phone,
                    email: existingProfile.email,
                    functions: existingProfile.functions,
                },
                after: {
                    fullName: updatedProfile.fullName,
                    phone: updatedProfile.phone,
                    email: updatedProfile.email,
                    functions: updatedProfile.functions,
                },
                metadata: null,
            });

            // Usar o novo DTO que retorna apenas email, fullName e phone
            return createProfileUpdateOutput(updatedProfile);
        } catch (error) {
            console.error("Error updating profile:", error);
            return new Output(false, [], ["Failed to update profile"], null);
        }
    }

    private validatePassword(password: string): { isValid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Verificar se é string válida
        if (!password || typeof password !== 'string') {
            return { isValid: false, errors: ["Password is required"] };
        }

        // Verificar comprimento mínimo
        if (password.length < 6) {
            errors.push("Password must be at least 6 characters long");
        }

        // Verificar comprimento máximo
        if (password.length > 50) {
            errors.push("Password must be at most 50 characters long");
        }

        // Verificar letra maiúscula
        if (!/[A-Z]/.test(password)) {
            errors.push("Password must contain at least one uppercase letter");
        }

        // Verificar letra minúscula
        if (!/[a-z]/.test(password)) {
            errors.push("Password must contain at least one lowercase letter");
        }

        // Verificar número
        if (!/\d/.test(password)) {
            errors.push("Password must contain at least one number");
        }

        // Verificar caractere especial
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push("Password must contain at least one special character");
        }

        return { isValid: errors.length === 0, errors };
    }

    async updatePassword(supabaseId: string, newPassword: string): Promise<Output> {
        try {
            if (!supabaseId) {
                return new Output(false, [], ["Supabase ID is required"], null);
            }

            // Usar a função de validação centralizada
            const passwordValidation = this.validatePassword(newPassword);
            if (!passwordValidation.isValid) {
                return new Output(false, [], passwordValidation.errors, null);
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

    async updateProfileIcon(supabaseId: string, profileIconId: string | null, profileIconUrl?: string | null): Promise<Output> {
        try {
            if (!supabaseId) {
                return new Output(false, [], ["Supabase ID is required"], null);
            }

            // Check if profile exists
            const existingProfile = await this.repo.findBySupabaseId(supabaseId);
            if (!existingProfile) {
                return new Output(false, [], ["Profile not found"], null);
            }

            // Update profile icon
            const updatedProfile = await this.repo.updateProfileIcon(supabaseId, profileIconId, profileIconUrl || null);

            if (!updatedProfile) {
                return new Output(false, [], ["Failed to update profile icon"], null);
            }

            return new Output(true, ["Profile icon updated successfully"], [], {
                profileIconId: updatedProfile.profileIconId,
                profileIconUrl: updatedProfile.profileIconUrl
            });
        } catch (error) {
            console.error("Error updating profile icon:", error);
            return new Output(false, [], ["Failed to update profile icon"], null);
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

            await auditLogService.logAudit({
                entityType: "PROFILE",
                entityId: existingProfile.id,
                action: "DELETE",
                // O profile ja foi excluido acima; usar seu proprio id como
                // actorProfileId violaria a FK para corretor_studio_profiles.
                actorProfileId: null,
                before: {
                    id: existingProfile.id,
                    email: existingProfile.email,
                    fullName: existingProfile.fullName,
                    role: existingProfile.role,
                },
                after: null,
                metadata: { selfDeletedProfileId: existingProfile.id },
            });

            return new Output(true, ["Profile and authentication deleted successfully"], [], { deletedProfile: deletedProfile.id });
        } catch (error) {
            console.error("Error deleting profile:", error);
            return new Output(false, [], ["Failed to delete profile"], null);
        }
    }

    async checkEmailExists(email: string): Promise<Output> {
        try {
            const profile = await this.repo.findByEmail(email);
            if (!profile) {
                return new Output(false, [], ["Profile nao encontrado"], null);
            }
            return new Output(true, ["Profile encontrado"], [], { exists: true });
        } catch (error) {
            console.error("[ProfileUseCase] checkEmailExists error:", error);
            return new Output(false, [], ["Erro ao verificar e-mail"], null);
        }
    }
}

export class RegisterExistingUserProfile implements IProfileUseCase {
    constructor(private readonly repo: IProfileRepository = profileRepository) {}

    async registerUserProfile(input: RequestToRegisterUserProfileOAuth): Promise<Output> {
        try {
            if (!input || !input.fullname || !input.email || !input.phone) {
                return new Output(false, [], ["Dados inválidos"], {
                    fullName: !input?.fullname ? "Nome completo é obrigatório" : undefined,
                    email: !input?.email ? "E-mail é obrigatório" : undefined,
                    phone: !input?.phone ? "Telefone é obrigatório" : undefined,
                });
            }

            const alreadyExists = await this.repo.existingByEmailOrPhone(input.email, input.phone);
            if (alreadyExists) {
                return new Output(false, [], ["Usuário já cadastrado com este e-mail ou telefone"], null);
            }

            const supabaseId = (input as any).supabaseId;
            if (!supabaseId) {
                return new Output(false, [], ["Supabase ID é obrigatório"], null);
            }

            const result = await this.repo.createProfileWithSupabaseId(
                supabaseId,
                input.fullname,
                input.phone,
                input.email,
                input.role || UserRole.manager,
                input.asaasCustomerId,
                input.subscriptionId,
                input.cpfCnpj,
                input.subscriptionStatus,
                input.subscriptionPlan,
                input.operatorCount,
                input.subscriptionStartDate,
                input.trialEndDate,
                input.postalCode,
                input.address,
                input.addressNumber,
                input.neighborhood,
                input.complement,
                input.city,
                input.state
            );

            if (!result) {
                return new Output(false, [], ["Falha ao criar perfil do usuário"], null);
            }

            await auditLogService.logAudit({
                entityType: "PROFILE",
                entityId: result.profileId,
                action: "CREATE",
                actorProfileId: result.profileId,
                before: null,
                after: { profileId: result.profileId, email: input.email, role: input.role || UserRole.manager },
                metadata: { flow: "oauth" },
            });

            return new Output(true, ["Perfil de usuário registrado com sucesso"], [], {
                profileId: result.profileId,
                supabaseId: result.supabaseId
            });
        } catch (error: any) {
            console.error("Erro ao registrar perfil OAuth:", error);
            const errorMessage = error.message || "Falha ao registrar perfil do usuário";
            return new Output(false, [], [errorMessage], null);
        }
    }

    async getProfileBySupabaseId(supabaseId: string): Promise<Output> {
        const base = new RegisterNewUserProfile(this.repo);
        return base.getProfileBySupabaseId(supabaseId);
    }

    async getProfileInfoBySupabaseId(supabaseId: string): Promise<ProfileInfo | null> {
        const base = new RegisterNewUserProfile(this.repo);
        return base.getProfileInfoBySupabaseId(supabaseId);
    }

    async getProfileById(profileId: string): Promise<ProfileInfo | null> {
        const base = new RegisterNewUserProfile(this.repo);
        return base.getProfileById(profileId);
    }

    async updateProfile(
        supabaseId: string, 
        updates: { 
            fullName?: string; 
            phone?: string; 
            email?: string; 
            password?: string;
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
    ): Promise<Output> {
        const base = new RegisterNewUserProfile(this.repo);
        return base.updateProfile(supabaseId, updates);
    }

    async updatePassword(supabaseId: string, newPassword: string): Promise<Output> {
        const base = new RegisterNewUserProfile(this.repo);
        return base.updatePassword(supabaseId, newPassword);
    }

    async updateProfileIcon(supabaseId: string, profileIconId: string | null, profileIconUrl?: string | null): Promise<Output> {
        const base = new RegisterNewUserProfile(this.repo);
        return base.updateProfileIcon(supabaseId, profileIconId, profileIconUrl);
    }

    async deleteProfile(supabaseId: string): Promise<Output> {
        const base = new RegisterNewUserProfile(this.repo);
        return base.deleteProfile(supabaseId);
    }

    async checkEmailExists(email: string): Promise<Output> {
        const base = new RegisterNewUserProfile(this.repo);
        return base.checkEmailExists(email);
    }
}
