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
                            role: true,
                            functions: true
                        }
                    },
                    manager: {
                        select: {
                            id: true,
                            fullName: true,
                            profileIconUrl: true,
                            email: true,
                            role: true,
                            functions: true
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
                        role: true,
                        functions: true
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

    async findByEmail(email: string): Promise<Profile | null> {
        try {
            const profile = await prisma.profile.findUnique({ where: { email } });
            return profile ?? null;
        } catch (error) {
            console.error("Error fetching profile by email:", error);
            return null;
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
    neighborhood?: string,
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
        throw new Error("Erro ao inicializar serviço de autenticação");
      }

      let supabaseUserId: string | null = null;

      try {
        // Criar usuário no Supabase Auth
        const { data: user, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true
        });

        if (authError || !user.user) {
          console.error("Erro ao criar usuário no Supabase:", authError);
          
          // Traduzir erro para português
          if (authError?.message.includes('already registered')) {
            throw new Error("Este e-mail já está cadastrado");
          }
          throw new Error("Erro ao criar conta de acesso");
        }

        supabaseUserId = user.user.id;
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

      if (
        profileData.isMaster &&
        (subscriptionId || asaasCustomerId || subscriptionPlan)
      ) {
        profileData.functions = ["SDR", "CLOSER"];
      }

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

      // Adicionar endereço se fornecido (undefined check ao invés de truthy)
      console.info('🔍 [ProfileRepository] Valores de endereço ANTES de adicionar:', {
        postalCode, address, addressNumber, neighborhood, complement, city, state
      });
      
      if (postalCode !== undefined) profileData.postalCode = postalCode;
      if (address !== undefined) profileData.address = address;
      if (addressNumber !== undefined) profileData.addressNumber = addressNumber;
      if (neighborhood !== undefined) profileData.neighborhood = neighborhood;
      if (complement !== undefined) profileData.complement = complement;
      if (city !== undefined) profileData.city = city;
      if (state !== undefined) profileData.state = state;

      console.info('📝 [ProfileRepository] profileData APÓS adicionar endereço:', {
        postalCode: profileData.postalCode,
        address: profileData.address,
        addressNumber: profileData.addressNumber,
        neighborhood: profileData.neighborhood,
        complement: profileData.complement,
        city: profileData.city,
        state: profileData.state
      });
      
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
        
      } catch (error: any) {
        console.error("❌ [ProfileRepository] Erro ao criar profile:", error);
        
        // ROLLBACK: Limpar dados criados
        if (supabaseUserId) {
          console.warn('🔄 [ProfileRepository] Iniciando rollback...');
          
          try {
            // 1. Deletar profile do banco se foi criado
            const existingProfile = await prisma.profile.findUnique({
              where: { supabaseId: supabaseUserId }
            });
            
            if (existingProfile) {
              await prisma.profile.delete({
                where: { supabaseId: supabaseUserId }
              });
              console.info('✅ [ProfileRepository] Profile deletado do banco');
            }
            
            // 2. Deletar usuário do Supabase Auth
            await supabase.auth.admin.deleteUser(supabaseUserId);
            console.info('✅ [ProfileRepository] Usuário deletado do Supabase Auth');
            
            console.info('✅ [ProfileRepository] Rollback concluído com sucesso');
          } catch (rollbackError) {
            console.error('❌ [ProfileRepository] Erro durante rollback:', rollbackError);
            // Não lançar erro, apenas logar
          }
        }
        
        // Traduzir erros para português
        if (error.message.includes('Unique constraint failed on the fields: (`email`)')) {
          throw new Error("Este e-mail já está cadastrado");
        }
        if (error.message.includes('Unique constraint failed on the fields: (`phone`)')) {
          throw new Error("Este telefone já está cadastrado");
        }
        if (error.message && error.message.includes('já está cadastrado')) {
          throw error; // Já está traduzido
        }
        
        throw new Error("Erro ao criar conta. Tente novamente em alguns instantes.");
      }
    } catch (outerError: any) {
      console.error("❌ [ProfileRepository] Erro geral ao criar profile:", outerError);
      throw outerError;
    }
  }

    async updateProfile(
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

            if (updates.cpfCnpj !== undefined) {
                updateData.cpfCnpj = updates.cpfCnpj;
            }

            if (updates.postalCode !== undefined) {
                updateData.postalCode = updates.postalCode;
            }

            if (updates.address !== undefined) {
                updateData.address = updates.address;
            }

            if (updates.addressNumber !== undefined) {
                updateData.addressNumber = updates.addressNumber;
            }

            if (updates.neighborhood !== undefined) {
                updateData.neighborhood = updates.neighborhood;
            }

            if (updates.complement !== undefined) {
                updateData.complement = updates.complement;
            }

            if (updates.city !== undefined) {
                updateData.city = updates.city;
            }

            if (updates.state !== undefined) {
                updateData.state = updates.state;
            }

            if (updates.functions !== undefined) {
                updateData.functions = updates.functions;
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

    async updateProfileById(
        profileId: string,
        updates: { fullName?: string; phone?: string; email?: string; role?: string; functions?: ("SDR" | "CLOSER")[] }
    ): Promise<Profile | null> {
        try {
            console.info("🔄 [updateProfileById] Iniciando atualização para profileId:", profileId);
            
            // PASSO 1: Buscar o profile pelo ID para obter o supabaseId
            const existingProfile = await prisma.profile.findUnique({
                where: { id: profileId },
                select: { 
                    supabaseId: true, 
                    email: true,
                    fullName: true,
                    role: true 
                }
            });

            if (!existingProfile) {
                console.error("❌ [updateProfileById] Profile não encontrado:", profileId);
                return null;
            }

            console.info("✅ [updateProfileById] Profile encontrado:", {
                hasSupabaseId: !!existingProfile.supabaseId,
                supabaseId: existingProfile.supabaseId || 'null',
                currentEmail: existingProfile.email,
                currentRole: existingProfile.role
            });

            // PASSO 2: Verificar se deve atualizar o Supabase Auth
            // Só atualiza se:
            // - O email está sendo alterado
            // - O profile TEM um supabaseId válido
            // - O novo email é diferente do atual
            const shouldUpdateAuth = updates.email !== undefined && 
                                    existingProfile.supabaseId !== null && 
                                    updates.email !== existingProfile.email;

            if (shouldUpdateAuth) {
                console.info("🔐 [updateProfileById] Atualizando Supabase Auth...");
                
                try {
                    const supabase = createSupabaseClient();
                    if (!supabase) {
                        console.error("❌ [updateProfileById] Falha ao inicializar Supabase client");
                        console.warn("⚠️ [updateProfileById] Continuando apenas com atualização do banco");
                    } else {
                        const { error: authError } = await supabase.auth.admin.updateUserById(
                            existingProfile.supabaseId!,
                            {
                                email: updates.email,
                                email_confirm: true,
                            }
                        );

                        if (authError) {
                            console.error("❌ [updateProfileById] Erro ao atualizar Supabase Auth:", authError.message);
                            console.warn("⚠️ [updateProfileById] Continuando apenas com atualização do banco");
                        } else {
                            console.info("✅ [updateProfileById] Email atualizado no Supabase Auth");
                        }
                    }
                } catch (authUpdateError) {
                    console.error("❌ [updateProfileById] Exceção ao atualizar Supabase Auth:", authUpdateError);
                    console.warn("⚠️ [updateProfileById] Continuando apenas com atualização do banco");
                }
            } else if (updates.email !== undefined && !existingProfile.supabaseId) {
                console.info("ℹ️ [updateProfileById] Pulando atualização do Auth - usuário sem supabaseId (criado via checkout)");
            } else if (updates.email === existingProfile.email) {
                console.info("ℹ️ [updateProfileById] Email não foi alterado, pulando atualização do Auth");
            }

            // PASSO 3: Atualizar na tabela Profile (banco de dados)
            console.info("💾 [updateProfileById] Atualizando banco de dados...");
            
            const updateData: any = {};
            
            if (updates.fullName !== undefined) {
                updateData.fullName = updates.fullName;
                console.info("📝 [updateProfileById] Atualizando fullName:", updates.fullName);
            }
            
            if (updates.phone !== undefined) {
                updateData.phone = updates.phone;
                console.info("📞 [updateProfileById] Atualizando phone:", updates.phone);
            }
            
            if (updates.email !== undefined) {
                updateData.email = updates.email;
                console.info("📧 [updateProfileById] Atualizando email:", updates.email);
            }

            if (updates.role !== undefined) {
                updateData.role = updates.role;
                console.info("👤 [updateProfileById] Atualizando role:", `${existingProfile.role} → ${updates.role}`);
            }

            if (updates.functions !== undefined) {
                updateData.functions = updates.functions;
                console.info("🧩 [updateProfileById] Atualizando functions:", updates.functions);
            }

            const profile = await prisma.profile.update({
                where: { id: profileId },
                data: updateData,
            });
            
            console.info("✅ [updateProfileById] Profile atualizado com sucesso no banco:", {
                profileId: profile.id,
                newFullName: profile.fullName,
                newEmail: profile.email,
                newRole: profile.role
            });
            
            return profile;
        } catch (error) {
            console.error("❌ [updateProfileById] Erro ao atualizar profile:", error);
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

    async updateGoogleCalendarAuth(
        supabaseId: string,
        updates: {
            accessToken?: string | null;
            refreshToken?: string | null;
            expiresAt?: Date | null;
            email?: string | null;
            connected?: boolean;
        }
    ): Promise<Profile | null> {
        try {
            const profile = await prisma.profile.update({
                where: { supabaseId },
                data: {
                    googleAccessToken: updates.accessToken ?? undefined,
                    googleRefreshToken: updates.refreshToken ?? undefined,
                    googleTokenExpiresAt: updates.expiresAt ?? undefined,
                    googleEmail: updates.email ?? undefined,
                    googleCalendarConnected: updates.connected ?? undefined,
                },
            });

            console.info("Google Calendar auth updated:", profile.id);
            return profile;
        } catch (error) {
            console.error("Error updating Google Calendar auth:", error);
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
