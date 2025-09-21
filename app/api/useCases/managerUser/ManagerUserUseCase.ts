import { Output } from "@/lib/output";
import { IManagerUserUseCase } from "./IManagerUserUseCase";
import { IManagerUserRepository } from "../../infra/data/repositories/managerUser/IManagerUserRepository";

export class ManagerUserUseCase implements IManagerUserUseCase {
    constructor(
        private managerUserRepository: IManagerUserRepository
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

            await this.managerUserRepository.deleteOperator(operatorId);
            return new Output(
                true,
                ["Operator excluído com sucesso"],
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