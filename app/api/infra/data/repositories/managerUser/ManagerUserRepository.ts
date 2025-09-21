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
                updatedAt: true
            },
            orderBy: {
                fullName: 'asc'
            }
        });

        return operators.map(op => ({
            id: op.id,
            name: op.fullName || 'Operator',
            email: op.email,
            role: 'operator' as const,
            profileIconUrl: op.profileIconUrl,
            managerId: op.managerId,
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
}