import { Output } from "@/lib/output";
import { IManagerUserUseCase } from "./IManagerUserUseCase";
import { IManagerUserRepository } from "../../infra/data/repositories/managerUser/IManagerUserRepository";
import { ILeadRepository } from "../../infra/data/repositories/lead/ILeadRepository";
import { IProfileRepository } from "../../infra/data/repositories/profile/IProfileRepository";

export class ManagerUserUseCase implements IManagerUserUseCase {
    constructor(
        private managerUserRepository: IManagerUserRepository,
        private leadRepository: ILeadRepository,
        private profileRepository: IProfileRepository
    ) {}

    async associateOperatorToManager(managerId: string, operatorId: string): Promise<Output> {
        try {
            await this.managerUserRepository.associateOperatorToManager(managerId, operatorId);
            return new Output(
                true,
                ["Operator associado ao manager com sucesso"],
                [],
                null
            );
        } catch (error) {
            console.error("Erro ao associar operator ao manager:", error);
            return new Output(
                false,
                [],
                [error instanceof Error ? error.message : "Erro interno do servidor"],
                null
            );
        }
    }

    async dissociateOperatorFromManager(managerId: string, operatorId: string): Promise<Output> {
        try {
            await this.managerUserRepository.dissociateOperatorFromManager(managerId, operatorId);
            return new Output(
                true,
                ["Operator desassociado do manager com sucesso"],
                [],
                null
            );
        } catch (error) {
            console.error("Erro ao desassociar operator do manager:", error);
            return new Output(
                false,
                [],
                [error instanceof Error ? error.message : "Erro interno do servidor"],
                null
            );
        }
    }

    async updateOperator(userId: string, data: { fullName?: string; email?: string; role?: string; functions?: ("SDR" | "CLOSER")[] }): Promise<Output> {
        try {
            console.info("🔄 [ManagerUserUseCase.updateOperator] Iniciando atualização");
            console.info("📦 [ManagerUserUseCase.updateOperator] Dados recebidos:", {
                userId,
                fullName: data.fullName,
                email: data.email,
                role: data.role,
                functions: data.functions
            });

            // Validações
            if (data.fullName && data.fullName.trim().length < 2) {
                return new Output(
                    false,
                    [],
                    ["Nome completo deve ter pelo menos 2 caracteres"],
                    null
                );
            }

            if (data.email && !this.isValidEmail(data.email)) {
                return new Output(
                    false,
                    [],
                    ["Email inválido"],
                    null
                );
            }

            // Atualizar usuário via ProfileRepository (por ID, não supabaseId)
            const updateData: any = {};
            if (data.fullName) updateData.fullName = data.fullName;
            if (data.email) updateData.email = data.email;
            if (data.role) updateData.role = data.role;
            if (data.functions !== undefined) updateData.functions = data.functions;

            console.info("🚀 [ManagerUserUseCase.updateOperator] Chamando ProfileRepository.updateProfileById com:", updateData);

            const updatedUser = await this.profileRepository.updateProfileById(userId, updateData);

            if (!updatedUser) {
                return new Output(
                    false,
                    [],
                    ["Falha ao atualizar usuário"],
                    null
                );
            }

            console.info("✅ [ManagerUserUseCase.updateOperator] Usuário atualizado:", {
                id: updatedUser.id,
                fullName: updatedUser.fullName,
                email: updatedUser.email,
                role: updatedUser.role,
                functions: (updatedUser as any).functions
            });

            return new Output(
                true,
                ["Usuário atualizado com sucesso"],
                [],
                updatedUser
            );
        } catch (error) {
            console.error("❌ [ManagerUserUseCase.updateOperator] Erro ao atualizar usuário:", error);
            return new Output(
                false,
                [],
                [error instanceof Error ? error.message : "Erro interno do servidor"],
                null
            );
        }
    }

    async getOperatorsByManager(managerId: string): Promise<Output> {
        try {
            const operators = await this.managerUserRepository.getOperatorsByManager(managerId);
            return new Output(
                true,
                [],
                [],
                operators
            );
        } catch (error) {
            console.error("Erro ao buscar operators do manager:", error);
            return new Output(
                false,
                [],
                ["Erro interno do servidor ao buscar operators"],
                null
            );
        }
    }

    async createManager(data: { fullName: string; email: string; hasPermanentSubscription?: boolean; managerId?: string; functions?: ("SDR" | "CLOSER")[] }): Promise<Output> {
        try {
            // Validações básicas
            if (!data.fullName || data.fullName.trim().length < 2) {
                return new Output(
                    false,
                    [],
                    ["Nome completo deve ter pelo menos 2 caracteres"],
                    null
                );
            }

            if (!data.email || !this.isValidEmail(data.email)) {
                return new Output(
                    false,
                    [],
                    ["Email inválido"],
                    null
                );
            }

            const manager = await this.managerUserRepository.createManager({
                fullName: data.fullName,
                email: data.email,
                hasPermanentSubscription: data.hasPermanentSubscription || false,
                managerId: data.managerId,
                functions: data.functions
            });
            return new Output(
                true,
                ["Manager criado com sucesso"],
                [],
                manager
            );
        } catch (error) {
            console.error("Erro ao criar manager:", error);
            
            // Verifica se é erro de email duplicado
            if (error instanceof Error && error.message.includes("Unique constraint")) {
                return new Output(
                    false,
                    [],
                    ["Email já está em uso"],
                    null
                );
            }

            return new Output(
                false,
                [],
                ["Erro interno do servidor ao criar manager"],
                null
            );
        }
    }

    async createOperator(data: { fullName: string; email: string; managerId: string; hasPermanentSubscription?: boolean; functions?: ("SDR" | "CLOSER")[] }): Promise<Output> {
        try {
            // Validações básicas
            if (!data.fullName || data.fullName.trim().length < 2) {
                return new Output(
                    false,
                    [],
                    ["Nome completo deve ter pelo menos 2 caracteres"],
                    null
                );
            }

            if (!data.email || !this.isValidEmail(data.email)) {
                return new Output(
                    false,
                    [],
                    ["Email inválido"],
                    null
                );
            }

            if (!data.managerId || !this.isValidUUID(data.managerId)) {
                return new Output(
                    false,
                    [],
                    ["ID do manager inválido"],
                    null
                );
            }

            const operator = await this.managerUserRepository.createOperator({
                fullName: data.fullName,
                email: data.email,
                managerId: data.managerId,
                hasPermanentSubscription: data.hasPermanentSubscription || false,
                functions: data.functions
            });
            return new Output(
                true,
                ["Operator criado com sucesso"],
                [],
                operator
            );
        } catch (error) {
            console.error("Erro ao criar operator:", error);
            
            // Verifica se é erro de email duplicado
            if (error instanceof Error && error.message.includes("Unique constraint")) {
                return new Output(
                    false,
                    [],
                    ["Email já está em uso"],
                    null
                );
            }

            return new Output(
                false,
                [],
                [error instanceof Error ? error.message : "Erro interno do servidor"],
                null
            );
        }
    }

    async updateManagerSupabaseId(managerId: string, supabaseId: string): Promise<Output> {
        try {
            if (!managerId || !this.isValidUUID(managerId)) {
                return new Output(false, [], ["ID do manager inválido"], null);
            }

            if (!supabaseId) {
                return new Output(false, [], ["supabaseId inválido"], null);
            }

            await this.managerUserRepository.updateManagerSupabaseId(managerId, supabaseId);
            
            return new Output(true, ["supabaseId atualizado com sucesso"], [], null);
        } catch (error) {
            console.error("Erro ao atualizar supabaseId do manager:", error);
            return new Output(false, [], ["Erro ao atualizar supabaseId"], null);
        }
    }

    async updateOperatorSupabaseId(operatorId: string, supabaseId: string): Promise<Output> {
        try {
            if (!operatorId || !this.isValidUUID(operatorId)) {
                return new Output(false, [], ["ID do operator inválido"], null);
            }

            if (!supabaseId) {
                return new Output(false, [], ["supabaseId inválido"], null);
            }

            await this.managerUserRepository.updateOperatorSupabaseId(operatorId, supabaseId);
            
            return new Output(true, ["supabaseId atualizado com sucesso"], [], null);
        } catch (error) {
            console.error("Erro ao atualizar supabaseId do operator:", error);
            return new Output(false, [], ["Erro ao atualizar supabaseId"], null);
        }
    }

    async deleteManager(managerId: string): Promise<Output> {
        try {
            if (!managerId || !this.isValidUUID(managerId)) {
                return new Output(
                    false,
                    [],
                    ["ID do manager inválido"],
                    null
                );
            }

            // Buscar informações do usuário antes de deletar
            const userToDelete = await this.profileRepository.findById(managerId);
            
            if (!userToDelete) {
                return new Output(
                    false,
                    [],
                    ["Manager não encontrado"],
                    null
                );
            }

            // Deletar do banco de dados
            await this.managerUserRepository.deleteManager(managerId);
            
            // Deletar do Supabase Auth
            if (userToDelete.supabaseId) {
                try {
                    const { createSupabaseAdmin } = await import('@/lib/supabase/server');
                    const supabaseAdmin = createSupabaseAdmin();
                    
                    if (!supabaseAdmin) {
                        console.error('❌ [deleteManager] Falha ao criar cliente Supabase Admin');
                    } else {
                        const { error } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.supabaseId);
                        
                        if (error) {
                            console.error(`❌ [deleteManager] Erro ao deletar do Supabase Auth:`, error);
                        } else {
                            console.info(`🔐 [deleteManager] Usuário deletado do Supabase Auth`);
                        }
                    }
                } catch (supabaseError) {
                    console.error(`❌ [deleteManager] Erro ao deletar do Supabase:`, supabaseError);
                    // Não falhar a operação se a deleção do Supabase falhar
                }
            }
            
            return new Output(
                true,
                ["Manager excluído com sucesso"],
                [],
                null
            );
        } catch (error) {
            console.error("Erro ao excluir manager:", error);
            return new Output(
                false,
                [],
                [error instanceof Error ? error.message : "Erro interno do servidor"],
                null
            );
        }
    }

    async deleteOperator(operatorId: string): Promise<Output> {
        try {
            if (!operatorId || !this.isValidUUID(operatorId)) {
                return new Output(
                    false,
                    [],
                    ["ID do operator inválido"],
                    null
                );
            }

            // Buscar informações do usuário que será deletado
            const userToDelete = await this.profileRepository.findById(operatorId);
            
            if (!userToDelete) {
                return new Output(
                    false,
                    [],
                    ["Usuário não encontrado"],
                    null
                );
            }

            // Determinar o masterId
            const masterId = userToDelete.isMaster ? userToDelete.id : userToDelete.managerId;
            
            if (!masterId) {
                return new Output(
                    false,
                    [],
                    ["Não foi possível identificar o master do usuário"],
                    null
                );
            }

            // Se o usuário não é o próprio master, buscar o master
            let finalMasterId = masterId;
            if (!userToDelete.isMaster && userToDelete.managerId) {
                const masterUser = await this.profileRepository.findById(userToDelete.managerId);
                if (masterUser && masterUser.isMaster) {
                    finalMasterId = masterUser.id;
                }
            }

            // Transferir todos os leads do usuário para o master
            const leadsTransferred = await this.leadRepository.reassignLeadsToMaster(operatorId, finalMasterId);
            
            console.info(`Transferidos ${leadsTransferred} leads do usuário ${operatorId} para o master ${finalMasterId}`);

            // Deletar o usuário do banco
            await this.managerUserRepository.deleteOperator(operatorId);
            
            // Deletar do Supabase Auth
            if (userToDelete.supabaseId) {
                try {
                    const { createSupabaseAdmin } = await import('@/lib/supabase/server');
                    const supabaseAdmin = createSupabaseAdmin();
                    
                    if (!supabaseAdmin) {
                        console.error('❌ [deleteOperator] Falha ao criar cliente Supabase Admin');
                    } else {
                        const { error } = await supabaseAdmin.auth.admin.deleteUser(userToDelete.supabaseId);
                        
                        if (error) {
                            console.error(`❌ [deleteOperator] Erro ao deletar do Supabase Auth:`, error);
                        } else {
                            console.info(`🔐 [deleteOperator] Usuário deletado do Supabase Auth`);
                        }
                    }
                } catch (supabaseError) {
                    console.error(`❌ [deleteOperator] Erro ao deletar do Supabase:`, supabaseError);
                    // Não falhar a operação se a deleção do Supabase falhar
                }
            }
            
            return new Output(
                true,
                [`Operator excluído com sucesso. ${leadsTransferred} lead(s) transferido(s) para o master.`],
                [],
                null
            );
        } catch (error) {
            console.error("Erro ao excluir operator:", error);
            return new Output(
                false,
                [],
                [error instanceof Error ? error.message : "Erro interno do servidor"],
                null
            );
        }
    }

    /**
     * Deleta operador com atualização de assinatura, envio de email e hard delete
     */
    async deleteOperatorWithSubscriptionUpdate(operatorId: string): Promise<Output> {
        try {
            if (!operatorId || !this.isValidUUID(operatorId)) {
                return new Output(
                    false,
                    [],
                    ["ID do operator inválido"],
                    null
                );
            }

            console.info(`🗑️ [deleteOperatorWithSubscriptionUpdate] Iniciando deleção do operador ${operatorId}`);

            // 1. Buscar informações do usuário que será deletado
            const userToDelete = await this.profileRepository.findById(operatorId);
            
            if (!userToDelete) {
                return new Output(
                    false,
                    [],
                    ["Usuário não encontrado"],
                    null
                );
            }

            console.info(`👤 [deleteOperatorWithSubscriptionUpdate] Usuário encontrado: ${userToDelete.fullName} (${userToDelete.email})`);

            // 2. Buscar o usuário master
            if (!userToDelete.managerId) {
                return new Output(
                    false,
                    [],
                    ["Operador não possui um manager associado"],
                    null
                );
            }

            const masterUser = await this.profileRepository.findById(userToDelete.managerId);
            
            if (!masterUser || !masterUser.isMaster) {
                return new Output(
                    false,
                    [],
                    ["Master user não encontrado"],
                    null
                );
            }

            console.info(`👑 [deleteOperatorWithSubscriptionUpdate] Master encontrado: ${masterUser.fullName}`);

            // 3. Atualizar assinatura do master (remover R$ 19,90). DA2/DA5 de
            // [[20 — Assinaturas — Backend]] E6 (C23): roteia pela conta do
            // master e a falha deixa de ser engolida — vira registro
            // observável (console.error estruturado + flag no resultado).
            // A remoção do operador prossegue (decisão de produto
            // preservada: o acesso já foi revogado), mas o Output nunca mais
            // afirma "assinatura atualizada" quando ela não foi.
            let subscriptionUpdateFailed = false;
            if (masterUser.asaasSubscriptionId) {
                try {
                    const { AsaasSubscriptionService } = await import('../../services/AsaasSubscription/AsaasSubscriptionService');
                    const subscriptionAccount = masterUser.asaasSubscriptionAccount ?? 'primary';

                    // Buscar assinatura atual
                    const currentSubscription = await AsaasSubscriptionService.getSubscription(
                        masterUser.asaasSubscriptionId,
                        subscriptionAccount,
                    );

                    const newValue = Math.max(59.90, currentSubscription.value - 19.90);

                    console.info(`💰 [deleteOperatorWithSubscriptionUpdate] Atualizando assinatura de R$ ${currentSubscription.value} para R$ ${newValue}`);

                    await AsaasSubscriptionService.updateSubscription(
                        masterUser.asaasSubscriptionId,
                        { value: newValue },
                        subscriptionAccount,
                    );

                    console.info(`✅ [deleteOperatorWithSubscriptionUpdate] Assinatura atualizada com sucesso`);
                } catch (subscriptionError) {
                    subscriptionUpdateFailed = true;
                    console.error(
                        `[C23][doubleBillingRisk][observable] deleteOperatorWithSubscriptionUpdate: falha ao reduzir recorrência do master`,
                        {
                            masterId: masterUser.id,
                            operatorId,
                            asaasSubscriptionId: masterUser.asaasSubscriptionId,
                            expectedReduction: 19.90,
                            error: subscriptionError,
                        },
                    );
                    // Não falha a operação — o operador já teve o acesso
                    // revogado e isso não deve ser desfeito por um erro de
                    // billing — mas a pendência fica visível (flag no
                    // Output) em vez de sumir num console.error perdido.
                }
            } else {
                console.warn(`⚠️ [deleteOperatorWithSubscriptionUpdate] Master não possui assinatura Asaas`);
            }

            // 4. Enviar email de cancelamento para o operador
            try {
                const { emailService } = await import('@/lib/services/EmailService');
                
                await emailService.sendOperatorAccessRemovedEmail({
                    operatorName: userToDelete.fullName || userToDelete.email,
                    operatorEmail: userToDelete.email,
                    managerName: masterUser.fullName || masterUser.email,
                });

                console.info(`📧 [deleteOperatorWithSubscriptionUpdate] Email de cancelamento enviado para ${userToDelete.email}`);
            } catch (emailError) {
                console.error(`❌ [deleteOperatorWithSubscriptionUpdate] Erro ao enviar email:`, emailError);
                // Não falhar a operação se o email falhar
            }

            // 5. Transferir leads do operador para o master
            const leadsTransferred = await this.leadRepository.reassignLeadsToMaster(operatorId, masterUser.id);
            console.info(`📊 [deleteOperatorWithSubscriptionUpdate] ${leadsTransferred} leads transferidos para o master`);

            // 6. Hard delete do Profile no banco
            await this.managerUserRepository.deleteOperatorHard(operatorId);
            console.info(`🗃️ [deleteOperatorWithSubscriptionUpdate] Profile deletado do banco`);

            // 7. Deletar do Supabase Auth
            if (userToDelete.supabaseId) {
                try {
                    const { createSupabaseAdmin } = await import('@/lib/supabase/server');
                    const supabase = createSupabaseAdmin();
                    
                    if (supabase) {
                        const { error } = await supabase.auth.admin.deleteUser(userToDelete.supabaseId);
                        
                        if (error) {
                            console.error(`❌ [deleteOperatorWithSubscriptionUpdate] Erro ao deletar do Supabase Auth:`, error);
                        } else {
                            console.info(`🔐 [deleteOperatorWithSubscriptionUpdate] Usuário deletado do Supabase Auth`);
                        }
                    }
                } catch (supabaseError) {
                    console.error(`❌ [deleteOperatorWithSubscriptionUpdate] Erro ao deletar do Supabase:`, supabaseError);
                    // Não falhar a operação se a deleção do Supabase falhar
                }
            }

            return new Output(
                true,
                [
                    `Operador removido com sucesso.`,
                    subscriptionUpdateFailed
                        ? `Não foi possível reduzir a assinatura automaticamente — acompanhamento necessário.`
                        : `Assinatura atualizada (R$ 19,90 removidos).`,
                    `${leadsTransferred} lead(s) transferido(s) para o master.`,
                    `Email de notificação enviado para ${userToDelete.email}.`
                ],
                [],
                { subscriptionUpdateFailed }
            );
        } catch (error) {
            console.error("❌ [deleteOperatorWithSubscriptionUpdate] Erro geral:", error);
            return new Output(
                false,
                [],
                [error instanceof Error ? error.message : "Erro interno do servidor"],
                null
            );
        }
    }

    // Métodos utilitários privados
    private isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    private isValidUUID(uuid: string): boolean {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
    }
}
