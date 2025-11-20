'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, XCircle, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export default function CheckoutReturnPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'success' | 'pending' | 'error'>('checking');
  const [supabaseId, setSupabaseId] = useState<string | null>(null);

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      try {
        // Pegar supabaseId da sessão do Supabase
        const { createSupabaseBrowser } = await import('@/lib/supabase/browser');
        const supabase = createSupabaseBrowser();
        
        if (!supabase) {
          setStatus('error');
          return;
        }
        
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setStatus('error');
          return;
        }

        setSupabaseId(user.id);

        // Verificar status da assinatura
        const response = await fetch(`/api/v1/profiles/${user.id}`);
        const result = await response.json();

        if (result.isValid && result.result) {
          const profile = result.result;
          
          if (profile.subscriptionStatus === 'active') {
            setStatus('success');
          } else if (profile.subscriptionStatus === 'trial' || profile.subscriptionStatus === 'past_due') {
            setStatus('pending');
          } else {
            setStatus('error');
          }
        } else {
          setStatus('error');
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
        setStatus('error');
      }
    };

    // Aguardar 2 segundos para processar webhook
    setTimeout(checkSubscriptionStatus, 2000);
  }, []);

  const handleContinue = () => {
    if (supabaseId) {
      router.push(`/${supabaseId}/dashboard`);
    } else {
      router.push('/sign-in');
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-4">
        {/* Alerta informativo sobre callback desabilitado */}
        <Alert className="border-blue-500/50 bg-blue-50 dark:bg-blue-950/20">
          <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <AlertTitle className="text-blue-900 dark:text-blue-200">
            Redirecionamento Manual Necessário
          </AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-300">
            Após concluir o pagamento no Asaas, <strong>feche a aba de pagamento</strong> e retorne aqui. 
            Esta página verificará automaticamente o status da sua assinatura.
          </AlertDescription>
        </Alert>

        <Card className="w-full">
          <CardHeader className="text-center">
          {status === 'checking' && (
            <>
              <div className="mx-auto mb-4">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
              </div>
              <CardTitle className="text-2xl">Verificando pagamento</CardTitle>
              <CardDescription>
                Aguarde enquanto confirmamos sua assinatura...
              </CardDescription>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto mb-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
              <CardTitle className="text-2xl">Assinatura confirmada!</CardTitle>
              <CardDescription>
                Seu pagamento foi processado com sucesso. Bem-vindo ao Lead Flow!
              </CardDescription>
            </>
          )}

          {status === 'pending' && (
            <>
              <div className="mx-auto mb-4">
                <Loader2 className="h-16 w-16 animate-spin text-yellow-500" />
              </div>
              <CardTitle className="text-2xl">Pagamento pendente</CardTitle>
              <CardDescription>
                Seu pagamento está sendo processado. Você receberá uma notificação quando for confirmado.
              </CardDescription>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto mb-4">
                <XCircle className="h-16 w-16 text-red-500" />
              </div>
              <CardTitle className="text-2xl">Erro ao verificar pagamento</CardTitle>
              <CardDescription>
                Não foi possível confirmar seu pagamento. Entre em contato com o suporte.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {status !== 'checking' && (
            <>
              <Button
                onClick={handleContinue}
                size="lg"
                className="w-full"
                disabled={status === 'error'}
              >
                {status === 'success' ? 'Ir para Dashboard' : 'Voltar para Login'}
              </Button>

              {status === 'pending' && (
                <p className="text-sm text-center text-muted-foreground">
                  Você pode acessar sua conta e acompanhar o status da assinatura
                </p>
              )}

              {status === 'error' && (
                <Button
                  variant="outline"
                  onClick={() => router.push('/sign-in')}
                  size="lg"
                  className="w-full"
                >
                  Voltar para Login
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>
      </div>
    </main>
  );
}
