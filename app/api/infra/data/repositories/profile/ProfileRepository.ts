import prisma from "@/app/api/infra/data/prisma";
import type { UserRole, Profile } from "@prisma/client";
import { createClient } from "@supabase/supabase-js"
import type { IProfileRepository } from "./IProfileRepository";

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
    async findById(id: string): Promise<Profile | null> {
        try {
            const profile = await prisma.profile.findUnique({ where: { id } });
            return profile ?? null;
        } catch (error) {
            console.error("Error fetching profile by id:", error);
            return null;
        }
    }

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

            if (!profile) {
                return null;
            }

            // Se o usuário é um manager não-master, buscar todos os usuários do master
            if (profile.role === 'manager' && !profile.isMaster && profile.managerId) {
                // Buscar todos os usuários associados ao master (incluindo o próprio master)
                const allTeamMembers = await prisma.profile.findMany({
                    where: {
                        OR: [
                            { id: profile.managerId }, // O master
                            { managerId: profile.managerId }, // Todos os usuários do master
                        ]
                    },
                    select: {
                        id: true,
                        fullName: true,
                        profileIconUrl: true,
                        email: true,
                        role: true
                    }
                });

                // Substituir operators pelos membros da equipe completa
                (profile as any).operators = allTeamMembers;
            }

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

    async createProfile(
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
    complement?: string,
    city?: string,
    state?: string,
    managerId?: string
  ): Promise<{ profileId: string; supabaseId: string } | null> {
    try {
      console.info('💾 [ProfileRepository] createProfile iniciado');
      console.info('📦 [ProfileRepository] Parâmetros recebidos:', {
        hasSubscriptionId: !!subscriptionId,
        hasAsaasCustomerId: !!asaasCustomerId,
        hasSubscriptionPlan: !!subscriptionPlan,
        hasOperatorCount: operatorCount !== undefined,
        subscriptionId,
        asaasCustomerId,
        subscriptionPlan,
        operatorCount,
        subscriptionStatus,
        role
      });
      
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

      // Preparar dados do profile
      const profileData: any = {
        supabaseId,
        fullName,
        phone,
        email,
        role,
        // isMaster = true apenas se:
        // 1. É manager/operator E
        // 2. NÃO tem managerId (não foi criado por outro usuário)
        isMaster: !managerId,
      };

      // Se tem managerId, adicionar ao profileData
      if (managerId) {
        profileData.managerId = managerId;
      }

      // Adicionar CPF/CNPJ se fornecido
      if (cpfCnpj) {
        profileData.cpfCnpj = cpfCnpj;
      }

      // Adicionar dados do Asaas se fornecidos
      if (asaasCustomerId) {
        profileData.asaasCustomerId = asaasCustomerId;
      }
      if (subscriptionId) {
        profileData.subscriptionId = subscriptionId;
      }
      if (subscriptionStatus) {
        profileData.subscriptionStatus = subscriptionStatus;
      }
      if (subscriptionPlan) {
        profileData.subscriptionPlan = subscriptionPlan;
      }
      if (operatorCount !== undefined) {
        profileData.operatorCount = operatorCount;
      }
      if (subscriptionStartDate) {
        profileData.subscriptionStartDate = subscriptionStartDate;
      }
      if (trialEndDate) {
        profileData.trialEndDate = trialEndDate;
      }

      // Adicionar endereço se fornecido
      if (postalCode) profileData.postalCode = postalCode;
      if (address) profileData.address = address;
      if (addressNumber) profileData.addressNumber = addressNumber;
      if (complement) profileData.complement = complement;
      if (city) profileData.city = city;
      if (state) profileData.state = state;

      console.info('📝 [ProfileRepository] profileData final:', {
        hasSubscriptionId: !!profileData.subscriptionId,
        hasAsaasCustomerId: !!profileData.asaasCustomerId,
        hasSubscriptionPlan: !!profileData.subscriptionPlan,
        hasOperatorCount: profileData.operatorCount !== undefined,
        subscriptionId: profileData.subscriptionId,
        subscriptionPlan: profileData.subscriptionPlan,
        operatorCount: profileData.operatorCount,
        subscriptionStatus: profileData.subscriptionStatus,
        hasSubscriptionStartDate: !!profileData.subscriptionStartDate,
        subscriptionStartDate: profileData.subscriptionStartDate,
        isMaster: profileData.isMaster,
        hasManagerId: !!profileData.managerId,
        role: profileData.role
      });

      // Criar profile no banco
      const profile = await prisma.profile.create({
        data: profileData
      });

      console.info('✅ [ProfileRepository] Profile criado com sucesso:', {
        profileId: profile.id,
        hasSubscriptionId: !!profile.subscriptionId,
        subscriptionId: profile.subscriptionId,
        subscriptionStatus: profile.subscriptionStatus,
        subscriptionPlan: profile.subscriptionPlan,
        subscriptionStartDate: profile.subscriptionStartDate,
        asaasCustomerId: profile.asaasCustomerId
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