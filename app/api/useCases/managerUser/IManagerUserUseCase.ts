import { Output } from "@/lib/output";

export interface IManagerUserUseCase {
    associateOperatorToManager(managerId: string, operatorId: string): Promise<Output>;
    dissociateOperatorFromManager(managerId: string, operatorId: string): Promise<Output>;
    getOperatorsByManager(managerId: string): Promise<Output>;
    createManager(data: { fullName: string; email: string }): Promise<Output>;
    createOperator(data: { fullName: string; email: string; managerId: string }): Promise<Output>;
    updateOperator(userId: string, data: { fullName?: string; email?: string; role?: string }): Promise<Output>;
    deleteManager(managerId: string): Promise<Output>;
    deleteOperator(operatorId: string): Promise<Output>;
}