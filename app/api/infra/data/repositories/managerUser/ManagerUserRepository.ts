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
                // Buscar todos os usuários gerenciados, independente do role
                // Tanto operators quanto managers podem ser gerenciados por um master
            },
            select: {
                id: true,
                fullName: true,
                email: true,
                role: true,
                functions: true,
                profileIconUrl: true,
                managerId: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        leadsAsAssignee: {
                            where: {
                                managerId: managerId  // Filtrar leads do próprio manager
                            }
                        },
                        leadsAsCloser: {
                            where: {
                                managerId: managerId,
                                status: 'scheduled'
                            }
                        }
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
            role: op.role,
            functions: op.functions,
            managerId: op.managerId,
            leadsCount: op._count?.leadsAsAssignee ?? 0,
            meetingsCount: op._count?.leadsAsCloser ?? 0,
            _countObject: op._count
        })));

        return operators.map(op => ({
            id: op.id,
            name: op.fullName || 'Usuário',
            email: op.email,
            role: op.role.toLowerCase() as 'operator' | 'manager',
            functions: op.functions,
            profileIconUrl: op.profileIconUrl,
            managerId: op.managerId,
            leadsCount: op._count?.leadsAsAssignee ?? 0, // Usar 0 como fallback
            meetingsCount: op._count?.leadsAsCloser ?? 0,
            createdAt: op.createdAt,
            updatedAt: op.updatedAt
        }));
    }

    async createManager(data: { fullName: string; email: string; hasPermanentSubscription?: boolean; managerId?: string; functions?: ("SDR" | "CLOSER")[] }): Promise<{ id: string; fullName: string; email: string; }> {
        const manager = await prisma.profile.create({
            data: {
                fullName: data.fullName,
                email: data.email,
                role: UserRole.manager,
                functions: data.functions ?? [],
                hasPermanentSubscription: data.hasPermanentSubscription || false,
                managerId: data.managerId || null
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

    async createOperator(data: { fullName: string; email: string; managerId: string; hasPermanentSubscription?: boolean; functions?: ("SDR" | "CLOSER")[] }): Promise<{ id: string; fullName: string; email: string; managerId: string; }> {
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
                functions: data.functions ?? [],
                managerId: data.managerId,
                hasPermanentSubscription: data.hasPermanentSubscription || false
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

    async updateManagerSupabaseId(managerId: string, supabaseId: string): Promise<void> {
        await prisma.profile.update({
            where: { id: managerId },
            data: { supabaseId }
        });
    }

    async updateOperatorSupabaseId(operatorId: string, supabaseId: string): Promise<void> {
        await prisma.profile.update({
            where: { id: operatorId },
            data: { supabaseId }
        });
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

    async deleteOperatorHard(operatorId: string): Promise<void> {
        // Hard delete - deleta sem verificações de leads
        // Os leads devem ter sido transferidos antes desta chamada
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

        // Contar sub-managers relacionados ao manager
        const subManagersCount = await prisma.profile.count({
            where: { 
                managerId: managerId,
                role: UserRole.manager
            }
        });

        // Total de managers = sub-managers + o próprio manager logado
        const totalManagers = subManagersCount + 1;

        // Total de usuários = operators + sub-managers + manager logado
        const totalUsers = operatorsCount + subManagersCount + 1;

        return {
            totalOperators: operatorsCount,
            totalManagers: totalManagers,
            totalUsers: totalUsers
        };
    }
}
