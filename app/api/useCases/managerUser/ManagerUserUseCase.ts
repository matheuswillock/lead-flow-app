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

    async updateOperator(userId: string, data: { fullName?: string; email?: string; role?: string }): Promise<Output> {
        try {
            console.info("🔄 [ManagerUserUseCase.updateOperator] Iniciando atualização");
            console.info("📦 [ManagerUserUseCase.updateOperator] Dados recebidos:", {
                userId,
                fullName: data.fullName,
                email: data.email,
                role: data.role
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
                role: updatedUser.role
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

    async createManager(data: { fullName: string; email: string; }): Promise<Output> {
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

            const manager = await this.managerUserRepository.createManager(data);
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

    async createOperator(data: { fullName: string; email: string; managerId: string; }): Promise<Output> {
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

            const operator = await this.managerUserRepository.createOperator(data);
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

            await this.managerUserRepository.deleteManager(managerId);
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

            // Deletar o usuário
            await this.managerUserRepository.deleteOperator(operatorId);
            
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