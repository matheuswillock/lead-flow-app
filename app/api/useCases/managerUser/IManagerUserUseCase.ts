import { Output } from "@/lib/output";

export interface IManagerUserUseCase {
    associateOperatorToManager(managerId: string, operatorId: string): Promise<Output>;
    dissociateOperatorFromManager(managerId: string, operatorId: string): Promise<Output>;
    getOperatorsByManager(managerId: string): Promise<Output>;
    createManager(data: { fullName: string; email: string; hasPermanentSubscription?: boolean; managerId?: string; functions?: ("SDR" | "CLOSER")[] }): Promise<Output>;
    createOperator(data: { fullName: string; email: string; managerId: string; hasPermanentSubscription?: boolean; functions?: ("SDR" | "CLOSER")[] }): Promise<Output>;
    updateOperator(userId: string, data: { fullName?: string; email?: string; role?: string; functions?: ("SDR" | "CLOSER")[] }): Promise<Output>;
    updateManagerSupabaseId(managerId: string, supabaseId: string): Promise<Output>;
    updateOperatorSupabaseId(operatorId: string, supabaseId: string): Promise<Output>;
    deleteManager(managerId: string): Promise<Output>;
    deleteOperator(operatorId: string): Promise<Output>;
    deleteOperatorWithSubscriptionUpdate(operatorId: string): Promise<Output>;
}
