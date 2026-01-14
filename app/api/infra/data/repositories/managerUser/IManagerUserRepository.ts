export interface IManagerUserRepository {
    associateOperatorToManager(managerId: string, operatorId: string): Promise<void>;
    dissociateOperatorFromManager(managerId: string, operatorId: string): Promise<void>;
    getOperatorsByManager(managerId: string): Promise<{ id: string; fullName: string; email: string }[]>;
    createManager(data: { fullName: string; email: string; hasPermanentSubscription?: boolean; managerId?: string }): Promise<{ id: string; fullName: string; email: string }>;
    createOperator(data: { fullName: string; email: string; managerId: string; hasPermanentSubscription?: boolean }): Promise<{ id: string; fullName: string; email: string; managerId: string }>;
    updateManagerSupabaseId(managerId: string, supabaseId: string): Promise<void>;
    updateOperatorSupabaseId(operatorId: string, supabaseId: string): Promise<void>;
    deleteManager(managerId: string): Promise<void>;
    deleteOperator(operatorId: string): Promise<void>;
    deleteOperatorHard(operatorId: string): Promise<void>;
    getManagerStats(managerId: string): Promise<{
        totalOperators: number;
        totalManagers: number;
        totalUsers: number;
    }>;
}