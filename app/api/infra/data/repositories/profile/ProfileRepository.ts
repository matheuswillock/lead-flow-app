import prisma from "@/app/api/infra/data/prisma";
import type { UserRole, Profile } from "@prisma/client";
import { createClient } from "@supabase/supabase-js"
import type { IProfileRepository } from "./IProfileRepository";
import { randomUUID } from "crypto";

// Função para criar cliente Supabase de forma segura
function createSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !serviceKey) {
        if (process.env.NODE_ENV === 'development') {
            console.warn("Supabase URL or Service Key is not defined in environment variables.");
        }
        return null;
    }

    return createClient(url, serviceKey);
}

class PrismaProfileRepository implements IProfileRepository {
    async findBySupabaseId(supabaseId: string): Promise<Profile | null> {
        try {
            const profile = await prisma.profile.findUnique({ where: { supabaseId } });
            console.info("Fetched profile:", profile);
            return profile ?? null;
        } catch (error) {
            console.error("Error fetching profile:", error);
            return null;
        }
    }

    async findBySupabaseIdWithRelations(supabaseId: string): Promise<Profile | null> {
        try {
            const profile = await prisma.profile.findUnique({ 
                where: { supabaseId },
                include: {
                    operators: {
                        select: {
                            id: true,
                            fullName: true,
                            profileIconUrl: true,
                            email: true,
                            role: true
                        }
                    },
                    manager: {
                        select: {
                            id: true,
                            fullName: true,
                            profileIconUrl: true,
                            email: true,
                            role: true
                        }
                    }
                }
            });
            console.info("Fetched profile with relations:", profile);
            return profile ?? null;
        } catch (error) {
            console.error("Error fetching profile with relations:", error);
            return null;
        }
    }

    async existingByEmailOrPhone(email: string, phone: string): Promise<boolean> {
        try {
            const profile = await prisma.profile.findFirst({
                where: { OR: [{ email }, { phone }] },
            });
            return !!profile;
        } catch (error) {
            console.error("Error checking existing profile:", error);
            return false;
        }
    }

    async findByConfirmationToken(token: string): Promise<Profile | null> {
        try {
            const profile = await prisma.profile.findUnique({
                where: { confirmationToken: token },
            });
            return profile;
        } catch (error) {
            console.error("Error finding profile by confirmation token:", error);
            return null;
        }
    }

    async createPendingProfile(
        fullName: string,
        email: string,
        role: UserRole,
        managerId?: string
    ): Promise<{ profileId: string; confirmationToken: string } | null> {
        try {
            // Gerar token único
            const confirmationToken = randomUUID() + '-' + Date.now();
            
            // Expiração em 24 horas
            const confirmationTokenExp = new Date();
            confirmationTokenExp.setHours(confirmationTokenExp.getHours() + 24);

            // Criar profile pendente (sem supabaseId ainda)
            const profile = await prisma.profile.create({
                data: {
                    fullName,
                    email,
                    role,
                    managerId,
                    confirmationToken,
                    confirmationTokenExp,
                    isConfirmed: false
                }
            });

            return { profileId: profile.id, confirmationToken };
        } catch (error) {
            console.error("Error creating pending profile:", error);
            return null;
        }
    }

    async confirmAccount(
        profileId: string,
        data: { password: string; fullName?: string; phone?: string }
    ): Promise<boolean> {
        try {
            const supabase = createSupabaseClient();
            if (!supabase) {
                console.error("Failed to initialize Supabase client");
                return false;
            }

            // Buscar o profile pendente
            const profile = await prisma.profile.findUnique({
                where: { id: profileId }
            });

            if (!profile) {
                console.error("Profile not found");
                return false;
            }

            // Criar usuário no Supabase Auth
            const { data: user, error: authError } = await supabase.auth.admin.createUser({
                email: profile.email,
                password: data.password,
                email_confirm: true
            });

            if (authError || !user.user) {
                console.error("Erro ao criar usuário no Supabase:", authError);
                return false;
            }

            const supabaseId = user.user.id;

            // Atualizar profile com supabaseId e marcar como confirmado
            await prisma.profile.update({
                where: { id: profileId },
                data: {
                    supabaseId,
                    fullName: data.fullName || profile.fullName,
                    phone: data.phone,
                    isConfirmed: true,
                    confirmationToken: null,
                    confirmationTokenExp: null
                }
            });

            return true;
        } catch (error) {
            console.error("Error confirming account:", error);
            return false;
        }
    }

    async createProfile(
    fullName: string,
    phone: string,
    password: string,
    email: string,
    role: UserRole
  ): Promise<{ profileId: string; supabaseId: string } | null> {
    try {
      const supabase = createSupabaseClient();
      if (!supabase) {
        console.error("Failed to initialize Supabase client");
        return null;
      }

      // Criar usuário no Supabase
      const { data: user, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (authError || !user.user) {
        console.error("Erro ao criar usuário no Supabase:", authError);
        return null;
      }

      const supabaseId = user.user.id;

      // Criar profile no banco
      const profile = await prisma.profile.create({
        data: {
          supabaseId,
          fullName,
          phone,
          email,
          role
        }
      });

      return { profileId: profile.id, supabaseId };
    } catch (error) {
      console.error("Erro ao criar profile:", error);
      return null;
    }
  }

    async updateProfile(
        supabaseId: string,
        updates: { fullName?: string; phone?: string; email?: string }
    ): Promise<Profile | null> {
        try {
            // Primeiro, atualizar no Supabase Auth se o email foi alterado
            if (updates.email !== undefined) {
                const supabase = createSupabaseClient();
                if (!supabase) {
                    console.error("Failed to initialize Supabase client");
                    return null;
                }

                const { error: authError } = await supabase.auth.admin.updateUserById(
                    supabaseId,
                    {
                        email: updates.email,
                        email_confirm: true, // Confirma automaticamente o novo email
                    }
                );

                if (authError) {
                    console.error("Error updating email in Supabase Auth:", authError);
                    throw new Error(`Failed to update email in authentication: ${authError.message}`);
                }
                
                console.info("Email updated successfully in Supabase Auth:", updates.email);
            }

            // Depois, atualizar na tabela Profile
            const updateData: any = {};
            
            if (updates.fullName !== undefined) {
                updateData.fullName = updates.fullName;
            }
            
            if (updates.phone !== undefined) {
                updateData.phone = updates.phone;
            }
            
            if (updates.email !== undefined) {
                updateData.email = updates.email;
            }

            const profile = await prisma.profile.update({
                where: { supabaseId },
                data: updateData,
            });
            
            console.info("Profile updated successfully in database:", profile.id);
            return profile;
        } catch (error) {
            console.error("Error updating profile:", error);
            
            // Em caso de erro após atualizar o Auth, tentar reverter (rollback manual)
            if (updates.email !== undefined && error instanceof Error && error.message.includes('authentication')) {
                // Se o erro foi na atualização do banco após sucesso no Auth,
                // tentar reverter o email no Auth (seria ideal buscar o email anterior)
                console.warn("Rollback may be needed for Supabase Auth email update");
            }
            
            return null;
        }
    }

    async updatePassword(supabaseId: string, newPassword: string): Promise<boolean> {
        try {
            const supabase = createSupabaseClient();
            if (!supabase) {
                console.error("Failed to initialize Supabase client");
                return false;
            }

            // Atualizar senha apenas no Supabase Auth
            const { error: authError } = await supabase.auth.admin.updateUserById(
                supabaseId,
                {
                    password: newPassword
                }
            );

            if (authError) {
                console.error("Error updating password in Supabase Auth:", authError);
                return false;
            }

            console.info("Password updated successfully in Supabase Auth for user:", supabaseId);
            return true;
        } catch (error) {
            console.error("Error updating password:", error);
            return false;
        }
    }

    async updateProfileIcon(supabaseId: string, profileIconId: string | null, profileIconUrl: string | null): Promise<Profile | null> {
        try {
            const profile = await prisma.profile.update({
                where: { supabaseId },
                data: { 
                    profileIconId,
                    profileIconUrl 
                },
            });
            
            console.info("Profile icon updated successfully:", profile.id);
            return profile;
        } catch (error) {
            console.error("Error updating profile icon:", error);
            return null;
        }
    }

    async deleteProfile(supabaseId: string): Promise<Profile | null> {
        try {
            const profile = await prisma.profile.delete({ where: { supabaseId } });
            return profile;
        } catch (error) {
            console.error("Error deleting profile:", error);
            return null;
        }
    }
}

export const profileRepository: IProfileRepository = new PrismaProfileRepository();
export type { IProfileRepository };