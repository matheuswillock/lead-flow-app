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
            email: body.email,
            fullname: body.fullname,
            phone: body.phone,
            cpfCnpj: body.cpfCnpj,
            postalCode: body.postalCode,
            address: body.address,
            addressNumber: body.addressNumber,
            neighborhood: body.neighborhood,
            complement: body.complement,
            city: body.city,
            state: body.state,
            hasSubscriptionId: !!body.subscriptionId,
            hasAsaasCustomerId: !!body.asaasCustomerId,
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
                neighborhood: body.neighborhood,
                complement: body.complement,
                city: body.city,
                state: body.state,
            };
            
            console.info('✅ [RegisterProfile Route] Dados validados:', {
                hasAddress: !!validatedData.address,
                hasNeighborhood: !!validatedData.neighborhood,
                postalCode: validatedData.postalCode,
                address: validatedData.address,
                neighborhood: validatedData.neighborhood,
                hasSubscriptionId: !!validatedData.subscriptionId,
                hasAsaasCustomerId: !!validatedData.asaasCustomerId,
            });
        } catch (validationError) {
            console.error('❌ [RegisterProfile Route] Erro de validação:', validationError);
            const output = new Output(false, [], ["Dados inválidos. Verifique os campos e tente novamente."], null);
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
        console.error("Erro ao criar perfil do usuário:", error);
        const output = new Output(false, [], ["Falha ao criar perfil do usuário"], null);
        return NextResponse.json(output, { status: 500 });
    }
}