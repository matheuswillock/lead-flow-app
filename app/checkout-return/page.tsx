'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Loader2 } from 'lucide-react';

function CheckoutReturnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Capturar subscription ID se houver
    const subscriptionId = searchParams.get('subscriptionId') || searchParams.get('subscription');
    
    console.info('✅ [CheckoutReturn] Pagamento realizado com sucesso!');
    if (subscriptionId) {
      console.info('📋 [CheckoutReturn] Subscription ID:', subscriptionId);
    }
    
    // Redirecionar para login após 2 segundos com mensagem de sucesso
    const timer = setTimeout(() => {
      console.info('🔄 [CheckoutReturn] Redirecionando para login...');
      router.push('/sign-in?from=checkout&success=true');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router, searchParams]);



  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            <CheckCircle2 className="h-20 w-20 text-green-500 animate-pulse" />
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">Pagamento Iniciado!</CardTitle>
            <CardDescription className="text-base">
              Estamos processando seu pagamento. Você receberá uma confirmação por email em breve.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Redirecionando para o login...</span>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function CheckoutReturnPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              <Loader2 className="h-16 w-16 animate-spin text-primary" />
            </div>
            <CardTitle className="text-2xl">Carregando...</CardTitle>
          </CardHeader>
        </Card>
      </main>
    }>
      <CheckoutReturnContent />
    </Suspense>
  );
}
