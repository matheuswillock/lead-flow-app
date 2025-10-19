import { Output } from "@/lib/output";
import { NextRequest, NextResponse } from "next/server";
import { RequestToRegisterUserProfile, validateRegisterProfileRequest } from "../DTO/requestToRegisterUserProfile";
import { RegisterNewUserProfile } from "@/app/api/useCases/profiles/ProfileUseCase";
import type { IProfileUseCase } from "@/app/api/useCases/profiles/IProfileUseCase";

const useCase: IProfileUseCase = new RegisterNewUserProfile();

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        
        console.info('📥 [RegisterProfile Route] Body recebido:', {
            hasSubscriptionId: !!body.subscriptionId,
            hasAsaasCustomerId: !!body.asaasCustomerId,
            hasSubscriptionPlan: !!body.subscriptionPlan,
            hasOperatorCount: body.operatorCount !== undefined,
            subscriptionId: body.subscriptionId,
            asaasCustomerId: body.asaasCustomerId,
            subscriptionPlan: body.subscriptionPlan,
            operatorCount: body.operatorCount,
            subscriptionStatus: body.subscriptionStatus,
            role: body.role
        });
        
        let validatedData: RequestToRegisterUserProfile;
        try {
            // Valida campos obrigatórios (email, password, fullname, phone)
            const basicData = validateRegisterProfileRequest(body);
            // Preserva campos opcionais relacionados à assinatura e endereço
            validatedData = {
                ...basicData,
                asaasCustomerId: body.asaasCustomerId,
                subscriptionId: body.subscriptionId,
                cpfCnpj: body.cpfCnpj,
                subscriptionStatus: body.subscriptionStatus,
                subscriptionPlan: body.subscriptionPlan,
                role: body.role,
                operatorCount: body.operatorCount,
                subscriptionStartDate: body.subscriptionStartDate ? new Date(body.subscriptionStartDate) : undefined,
                trialEndDate: body.trialEndDate ? new Date(body.trialEndDate) : undefined,
                postalCode: body.postalCode,
                address: body.address,
                addressNumber: body.addressNumber,
                complement: body.complement,
                city: body.city,
                state: body.state,
            };
            
            console.info('✅ [RegisterProfile Route] Dados validados:', {
                hasSubscriptionId: !!validatedData.subscriptionId,
                hasAsaasCustomerId: !!validatedData.asaasCustomerId,
                subscriptionPlan: validatedData.subscriptionPlan,
                operatorCount: validatedData.operatorCount
            });
        } catch (validationError) {
            console.error('❌ [RegisterProfile Route] Erro de validação:', validationError);
            const output = new Output(false, [], [(validationError as Error).message], null);
            return NextResponse.json(output, { status: 400 });
        }

        const output = await useCase.registerUserProfile(validatedData);
        const status = output.isValid ? 201 : 400;
        
        console.info('📤 [RegisterProfile Route] Output:', {
            isValid: output.isValid,
            hasResult: !!output.result
        });
        
        return NextResponse.json(output, { status });
    } catch (error) {
        console.error("Error creating user profile:", error);
        const output = new Output(false, [], ["Failed to create user profile"], null);
        return NextResponse.json(output, { status: 500 });
    }
}