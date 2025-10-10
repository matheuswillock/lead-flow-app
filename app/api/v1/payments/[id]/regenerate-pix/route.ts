// app/api/v1/payments/[id]/regenerate-pix/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { asaasFetch, asaasApi } from '@/lib/asaas';

/**
 * POST /api/v1/payments/[id]/regenerate-pix
 * Regenera o QR Code PIX para um pagamento existente
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        {
          isValid: false,
          errorMessages: ['ID do pagamento é obrigatório'],
          result: null,
        },
        { status: 400 }
      );
    }

    console.info('🔄 [RegeneratePixQrCode] Regenerando QR Code para pagamento:', id);

    // Busca o novo QR Code do Asaas
    const qrCodeData = await asaasFetch(`${asaasApi.pixQrCode(id)}`);

    console.info('✅ [RegeneratePixQrCode] QR Code regenerado com sucesso');

    return NextResponse.json({
      isValid: true,
      successMessages: ['QR Code regenerado com sucesso'],
      errorMessages: [],
      result: {
        encodedImage: qrCodeData.encodedImage,
        payload: qrCodeData.payload,
        expirationDate: qrCodeData.expirationDate,
      },
    });
  } catch (error: any) {
    console.error('❌ [RegeneratePixQrCode] Erro ao regenerar QR Code:', error);

    return NextResponse.json(
      {
        isValid: false,
        errorMessages: [error.message || 'Erro ao regenerar QR Code'],
        result: null,
      },
      { status: 500 }
    );
  }
}
