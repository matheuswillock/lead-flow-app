import prisma, { withPrismaRetry } from "@/app/api/infra/data/prisma";
import type { UserRole, Profile, Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js"
import type { IProfileRepository } from "./IProfileRepository";
import { isManagerLikeRole } from "@/lib/roles";

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
    private async ensureDefaultTeamForMaster(
        tx: Prisma.TransactionClient,
        profile: Profile
    ): Promise<{ teamId: string | null }> {
        if (!profile.isMaster) {
            return { teamId: null };
        }

        const existingDefaultTeam = await tx.team.findFirst({
            where: { masterId: profile.id, isDefault: true },
            orderBy: { createdAt: "asc" }
        });

        const team =
            existingDefaultTeam ??
            (await tx.team.create({
                data: {
                    name: "Meu Time",
                    masterId: profile.id,
                    isDefault: true
                }
            }));

        await tx.teamMember.upsert({
            where: {
                teamId_profileId: {
                    teamId: team.id,
                    profileId: profile.id
                }
            },
            create: {
                teamId: team.id,
                profileId: profile.id,
                role: "manager",
                functions: profile.functions ?? []
            },
            update: {
                role: "manager",
                functions: profile.functions ?? []
            }
        });

        if (!profile.activeTeamId) {
            await tx.profile.update({
                where: { id: profile.id },
                data: { activeTeamId: team.id }
            });
        }

        return { teamId: team.id };
    }

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
            return profile ?? null;
        } catch (error) {
            console.error("Error fetching profile:", error);
            return null;
        }
    }

    async findBySupabaseIdWithRelations(supabaseId: string): Promise<Profile | null> {
        try {
            const profile = await withPrismaRetry(async () => {
                const found = await prisma.profile.findUnique({ 
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

                if (!found) {
                    return null;
                }

                // Se o usuário é um manager não-master, buscar todos os usuários do master
                if (isManagerLikeRole(found.role) && !found.isMaster && found.managerId) {
                    // Buscar todos os usuários associados ao master (incluindo o próprio master)
                    const allTeamMembers = await prisma.profile.findMany({
                        where: {
                            OR: [
                                { id: found.managerId }, // O master
                                { managerId: found.managerId }, // Todos os usuários do master
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
                    (found as any).operators = allTeamMembers;
                }

                return found;
            }, { label: "ProfileRepository.findBySupabaseIdWithRelations" });

            return profile ?? null;
        } catch (error) {
            console.error("Error fetching profile with relations:", error);
            return null;
        }
    }

    async findFirstTeamIdByProfileId(profileId: string): Promise<string | null> {
        try {
            const teamMember = await prisma.teamMember.findFirst({
                where: { profileId },
                select: { teamId: true },
                orderBy: { createdAt: "asc" },
            });

            return teamMember?.teamId ?? null;
        } catch (error) {
            console.error("Error fetching first teamId by profileId:", error);
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

    async findByGoogleEmail(googleEmail: string): Promise<Profile | null> {
        try {
            const profile = await prisma.profile.findFirst({
                where: { googleEmail },
            });
            return profile ?? null;
        } catch (error) {
            console.error("Error fetching profile by google email:", error);
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
          email_confirm: true,
          app_metadata: {
            provider: "email"
          }
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
        profileData.isMaster
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

        const profile = await prisma.$transaction(async (tx) => {
          const createdProfile = await tx.profile.create({
            data: profileData
          });

          await this.ensureDefaultTeamForMaster(tx, createdProfile);

          return createdProfile;
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

  async createProfileWithSupabaseId(
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
  ): Promise<{ profileId: string; supabaseId: string } | null> {
    try {
      if (!supabaseId) {
        throw new Error("Supabase ID é obrigatório");
      }

      const existingProfile = await prisma.profile.findUnique({ where: { supabaseId } });
      if (existingProfile) {
        throw new Error("Perfil já existe para este usuário");
      }

      const profileData: any = {
        supabaseId,
        fullName,
        phone,
        email,
        role,
        isMaster: !managerId,
      };

      if (
        profileData.isMaster &&
        (subscriptionId || asaasCustomerId || subscriptionPlan)
      ) {
        profileData.functions = ["SDR", "CLOSER"];
      }

      if (managerId) {
        profileData.managerId = managerId;
      }

      if (cpfCnpj) {
        profileData.cpfCnpj = cpfCnpj;
      }
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

      if (postalCode !== undefined) profileData.postalCode = postalCode;
      if (address !== undefined) profileData.address = address;
      if (addressNumber !== undefined) profileData.addressNumber = addressNumber;
      if (neighborhood !== undefined) profileData.neighborhood = neighborhood;
      if (complement !== undefined) profileData.complement = complement;
      if (city !== undefined) profileData.city = city;
      if (state !== undefined) profileData.state = state;

      const profile = await prisma.$transaction(async (tx) => {
        const createdProfile = await tx.profile.create({ data: profileData });

        await this.ensureDefaultTeamForMaster(tx, createdProfile);

        return createdProfile;
      });

      return { profileId: profile.id, supabaseId };
    } catch (error: any) {
      console.error("❌ [ProfileRepository] Erro ao criar profile OAuth:", error);

      if (error.message.includes('Unique constraint failed on the fields: (`email`)')) {
        throw new Error("Este e-mail já está cadastrado");
      }
      if (error.message.includes('Unique constraint failed on the fields: (`phone`)')) {
        throw new Error("Este telefone já está cadastrado");
      }
      if (error.message && error.message.includes('já está cadastrado')) {
        throw error;
      }

      throw new Error("Erro ao criar conta. Tente novamente em alguns instantes.");
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
        updates: {
            fullName?: string;
            phone?: string;
            email?: string;
            role?: string;
            functions?: ("SDR" | "CLOSER")[];
            canCreateAccountUsers?: boolean;
            canManageAccountTeams?: boolean;
        }
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

            if (updates.canCreateAccountUsers !== undefined) {
                updateData.canCreateAccountUsers = updates.canCreateAccountUsers;
                console.info(
                    "🔐 [updateProfileById] Atualizando canCreateAccountUsers:",
                    updates.canCreateAccountUsers
                );
            }

            if (updates.canManageAccountTeams !== undefined) {
                updateData.canManageAccountTeams = updates.canManageAccountTeams;
                console.info(
                    "🔐 [updateProfileById] Atualizando canManageAccountTeams:",
                    updates.canManageAccountTeams
                );
            }

            const profile = await prisma.profile.update({
                where: { id: profileId },
                data: updateData,
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
                    googleAccessToken:
                        updates.accessToken === undefined ? undefined : updates.accessToken,
                    googleRefreshToken:
                        updates.refreshToken === undefined ? undefined : updates.refreshToken,
                    googleTokenExpiresAt:
                        updates.expiresAt === undefined ? undefined : updates.expiresAt,
                    googleEmail: updates.email === undefined ? undefined : updates.email,
                    googleCalendarConnected:
                        updates.connected === undefined ? undefined : updates.connected,
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

    async createBackofficeProfile(
        supabaseId: string,
        email: string,
        fullName: string
    ): Promise<{ profileId: string }> {
        const profile = await prisma.profile.create({
            data: {
                supabaseId,
                email,
                fullName,
                role: "backoffice",
                isMaster: false,
            },
        })
        console.info("[ProfileRepository] BackofficeProfile criado:", profile.id)
        return { profileId: profile.id }
    }
}

export const profileRepository: IProfileRepository = new PrismaProfileRepository();
export type { IProfileRepository };
