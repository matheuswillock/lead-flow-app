import { IManagerUserRepository } from "./IManagerUserRepository";
import { prisma } from "../../prisma";
import { UserRole } from "@prisma/client";

export class ManagerUserRepository implements IManagerUserRepository {
    async associateOperatorToManager(managerId: string, operatorId: string): Promise<void> {
        await prisma.profile.update({
            where: { id: operatorId },
            data: { 
                managerId: managerId,
                role: UserRole.operator
            }
        });
    }

    async dissociateOperatorFromManager(managerId: string, operatorId: string): Promise<void> {
        // Verifica se o operator realmente pertence ao manager
        const operator = await prisma.profile.findFirst({
            where: { 
                id: operatorId, 
                managerId: managerId 
            }
        });

        if (!operator) {
            throw new Error("Operator não encontrado ou não pertence ao manager especificado");
        }

        await prisma.profile.update({
            where: { id: operatorId },
            data: { managerId: null }
        });
    }

    async getOperatorsByManager(managerId: string): Promise<any[]> {
        console.info('🔍 [getOperatorsByManager] Buscando operadores para managerId:', managerId);
        
        const operators = await prisma.profile.findMany({
            where: { 
                managerId: managerId,
                role: UserRole.operator
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                profileIconUrl: true,
                managerId: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        leadsAsAssignee: true  // Conta leads atribuídos ao operador
                    }
                }
            },
            orderBy: {
                fullName: 'asc'
            }
        });

        console.info('📊 [getOperatorsByManager] Operadores encontrados:', operators.length);
        console.info('👥 [getOperatorsByManager] Detalhes RAW do Prisma:', JSON.stringify(operators, null, 2));
        console.info('👥 [getOperatorsByManager] Detalhes simplificados:', operators.map(op => ({
            id: op.id,
            name: op.fullName,
            email: op.email,
            managerId: op.managerId,
            leadsCount: op._count?.leadsAsAssignee ?? 0,
            _countObject: op._count
        })));

        return operators.map(op => ({
            id: op.id,
            name: op.fullName || 'Operator',
            email: op.email,
            role: 'operator' as const,
            profileIconUrl: op.profileIconUrl,
            managerId: op.managerId,
            leadsCount: op._count?.leadsAsAssignee ?? 0, // Usar 0 como fallback
            createdAt: op.createdAt,
            updatedAt: op.updatedAt
        }));
    }

    async createManager(data: { fullName: string; email: string; }): Promise<{ id: string; fullName: string; email: string; }> {
        const manager = await prisma.profile.create({
            data: {
                fullName: data.fullName,
                email: data.email,
                role: UserRole.manager
            },
            select: {
                id: true,
                fullName: true,
                email: true
            }
        });

        return {
            id: manager.id,
            fullName: manager.fullName || '',
            email: manager.email
        };
    }

    async createOperator(data: { fullName: string; email: string; managerId: string; }): Promise<{ id: string; fullName: string; email: string; managerId: string; }> {
        // Verifica se o manager existe
        const manager = await prisma.profile.findUnique({
            where: { id: data.managerId }
        });

        if (!manager || manager.role !== UserRole.manager) {
            throw new Error("Manager não encontrado ou não é um manager válido");
        }

        const operator = await prisma.profile.create({
            data: {
                fullName: data.fullName,
                email: data.email,
                role: UserRole.operator,
                managerId: data.managerId
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                managerId: true
            }
        });

        return {
            id: operator.id,
            fullName: operator.fullName || '',
            email: operator.email,
            managerId: operator.managerId || ''
        };
    }

    async deleteManager(managerId: string): Promise<void> {
        // Verifica se o manager tem operators associados
        const operatorsCount = await prisma.profile.count({
            where: { managerId: managerId }
        });

        if (operatorsCount > 0) {
            throw new Error("Não é possível excluir um manager que possui operators associados");
        }

        // Verifica se o manager tem leads associados
        const leadsCount = await prisma.lead.count({
            where: { managerId: managerId }
        });

        if (leadsCount > 0) {
            throw new Error("Não é possível excluir um manager que possui leads associados");
        }

        await prisma.profile.delete({
            where: { id: managerId }
        });
    }

    async deleteOperator(operatorId: string): Promise<void> {
        // Verifica se o operator tem leads atribuídos
        const leadsCount = await prisma.lead.count({
            where: { assignedTo: operatorId }
        });

        if (leadsCount > 0) {
            throw new Error("Não é possível excluir um operator que possui leads atribuídos");
        }

        await prisma.profile.delete({
            where: { id: operatorId }
        });
    }

    async getManagerStats(managerId: string): Promise<{
        totalOperators: number;
        totalManagers: number;
        totalUsers: number;
    }> {
        // Contar operators relacionados ao manager
        const operatorsCount = await prisma.profile.count({
            where: { 
                managerId: managerId,
                role: UserRole.operator
            }
        });

        // Por enquanto, considerar apenas 1 manager (o próprio logado)
        // Futuramente pode ser expandido para managers hierárquicos
        const managersCount = 1;

        return {
            totalOperators: operatorsCount,
            totalManagers: managersCount,
            totalUsers: operatorsCount + managersCount
        };
    }
}