'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { saveEncryptedData } from '@/lib/crypto';
import type { PendingSignUpData } from '@/types/subscription';

export default function PixConfirmedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [countdown, setCountdown] = useState(5);

  // Extrair dados da URL
  const fullName = searchParams.get('fullName') || '';
  const email = searchParams.get('email') || '';
  const cpfCnpj = searchParams.get('cpfCnpj') || '';
  const phone = searchParams.get('phone') || '';
  const asaasCustomerId = searchParams.get('asaasCustomerId') || '';
  const subscriptionId = searchParams.get('subscriptionId') || '';
  const postalCode = (searchParams.get('postalCode') || '').replace(/\D/g, '');
  const address = searchParams.get('address') || '';
  const addressNumber = searchParams.get('addressNumber') || '';
  const complement = searchParams.get('complement') || '';
  const city = searchParams.get('city') || '';
  const state = searchParams.get('state') || '';

  useEffect(() => {
    if (countdown === 0) {
      // Montar payload criptografado para o sign-up
      const payload: PendingSignUpData = {
        fullName,
        email,
        cpfCnpj: cpfCnpj.replace(/\D/g, ''),
        phone: phone.replace(/\D/g, ''),
        postalCode,
        address,
        addressNumber,
        complement: complement || undefined,
        city,
        state,
        subscriptionId,
        customerId: asaasCustomerId,
        subscriptionConfirmed: true,
        timestamp: new Date().toISOString(),
      };

      try {
        saveEncryptedData('pendingSignUp', payload);
      } catch (e) {
        console.error('❌ Falha ao salvar dados criptografados:', e);
      }

      // Redirecionar para sign-up com marcador de origem
      const params = new URLSearchParams({ from: 'subscription' });
      router.push(`/sign-up?${params.toString()}`);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown, router, fullName, email, cpfCnpj, phone, asaasCustomerId, subscriptionId]);

  const handleContinueNow = () => {
    const payload: PendingSignUpData = {
      fullName,
      email,
      cpfCnpj: cpfCnpj.replace(/\D/g, ''),
      phone: phone.replace(/\D/g, ''),
      postalCode,
      address,
      addressNumber,
      complement: complement || undefined,
      city,
      state,
      subscriptionId,
      customerId: asaasCustomerId,
      subscriptionConfirmed: true,
      timestamp: new Date().toISOString(),
    };

    try {
      saveEncryptedData('pendingSignUp', payload);
    } catch (e) {
      console.error('❌ Falha ao salvar dados criptografados:', e);
    }

    const params = new URLSearchParams({ from: 'subscription' });
    router.push(`/sign-up?${params.toString()}`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-green-700 dark:text-green-400">
            Pagamento Confirmado!
          </CardTitle>
          <CardDescription className="text-base">
            Seu pagamento PIX foi processado com sucesso
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Informações */}
          <div className="space-y-2 text-center">
            <p className="text-sm text-muted-foreground">
              Parabéns! Sua assinatura foi ativada.
            </p>
            <p className="text-sm text-muted-foreground">
              Agora vamos criar sua conta de acesso à plataforma.
            </p>
          </div>

          {/* Countdown */}
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="text-center space-y-2">
              <p className="text-sm font-medium">
                Redirecionando em:
              </p>
              <div className="text-5xl font-bold text-primary">
                {countdown}
              </div>
            </div>
            
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>

          {/* Botão para continuar agora */}
          <Button
            onClick={handleContinueNow}
            className="w-full"
            size="lg"
          >
            Continuar Agora
          </Button>

          {/* Nota */}
          <div className="text-xs text-center text-muted-foreground border-t pt-4">
            <p>
              ✨ Vamos pré-preencher seus dados para facilitar o cadastro
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
