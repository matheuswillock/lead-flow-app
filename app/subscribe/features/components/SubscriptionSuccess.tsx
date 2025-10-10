'use client';

// app/subscribe/features/components/SubscriptionSuccess.tsx
import { CheckCircle2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PixPayment } from './PixPayment';

interface SubscriptionSuccessProps {
  subscriptionId: string;
  paymentUrl?: string;
  paymentId?: string;
  pix?: { encodedImage: string; payload: string; expirationDate: string };
  boleto?: { bankSlipUrl: string; identificationField: string; barCode: string; dueDate: string };
}

export function SubscriptionSuccess({ subscriptionId, paymentUrl, paymentId, pix, boleto }: SubscriptionSuccessProps) {
  // Debug log
  console.info('🎨 [SubscriptionSuccess] Props recebidas:', {
    subscriptionId,
    hasPaymentUrl: !!paymentUrl,
    hasPaymentId: !!paymentId,
    hasPix: !!pix,
    hasBoleto: !!boleto,
    pixKeys: pix ? Object.keys(pix) : [],
    boletoKeys: boleto ? Object.keys(boleto) : []
  });

  // Se for pagamento PIX com QR Code
  if (pix && paymentId) {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">
            Assinatura Criada com Sucesso!
          </h2>
          <p className="text-muted-foreground mb-6">
            Complete o pagamento via PIX para ativar sua assinatura
          </p>
        </div>

        <PixPayment
          encodedImage={pix.encodedImage}
          payload={pix.payload}
          expirationDate={pix.expirationDate}
          paymentId={paymentId}
          onPaymentConfirmed={() => {
            window.location.href = '/sign-in';
          }}
        />

        <div className="text-center space-y-2 pt-4">
          <p className="text-sm text-muted-foreground">
            ID da Assinatura: <span className="font-mono">{subscriptionId}</span>
          </p>
        </div>
      </div>
    );
  }

  // Pagamento com Cartão de Crédito ou Boleto
  // Pagamento com Cartão de Crédito ou Boleto
  return (
    <div className="rounded-lg border bg-card p-8">
      <div className="text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
        </div>
        
        <h2 className="text-2xl font-bold mb-2">
          Assinatura Criada com Sucesso!
        </h2>
        
        <p className="text-muted-foreground mb-6">
          Sua assinatura foi criada. Você receberá um email com as instruções de acesso.
        </p>

        {paymentUrl && (
          <div className="mb-6 p-4 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium mb-2">
              Complete o pagamento para ativar sua assinatura
            </p>
            <Button asChild variant="outline" size="sm">
              <a href={paymentUrl} target="_blank" rel="noopener noreferrer">
                Ir para pagamento
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            ID da Assinatura: <span className="font-mono">{subscriptionId}</span>
          </p>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Button asChild variant="default" size="lg">
            <Link href="/sign-in">
              Fazer Login
            </Link>
          </Button>
          
          <Button asChild variant="outline" size="lg">
            <Link href="/">
              Voltar para Home
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
