export interface IManagerUserRepository {
    associateOperatorToManager(managerId: string, operatorId: string): Promise<void>;
    dissociateOperatorFromManager(managerId: string, operatorId: string): Promise<void>;
    getOperatorsByManager(managerId: string): Promise<{ id: string; fullName: string; email: string }[]>;
    createManager(data: { fullName: string; email: string }): Promise<{ id: string; fullName: string; email: string }>;
    createOperator(data: { fullName: string; email: string; managerId: string }): Promise<{ id: string; fullName: string; email: string; managerId: string }>;
    createPendingManager(data: { fullName: string; email: string }): Promise<{ id: string; confirmationToken: string } | null>;
    createPendingOperator(data: { fullName: string; email: string; managerId: string }): Promise<{ id: string; confirmationToken: string } | null>;
    deleteManager(managerId: string): Promise<void>;
    deleteOperator(operatorId: string): Promise<void>;
    getManagerStats(managerId: string): Promise<{
        totalOperators: number;
        totalManagers: number;
        totalUsers: number;
    }>;
}