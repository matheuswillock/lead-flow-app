'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle2, Loader2, UserPlus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface PendingOperatorData {
  id: string;
  name: string;
  email: string;
  paymentId: string;
  paymentStatus: string;
  operatorCreated: boolean;
  managerId: string;
}

function OperatorConfirmedContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pendingOperatorId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [operatorData, setOperatorData] = useState<PendingOperatorData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOperatorData = async () => {
      if (!pendingOperatorId) {
        setError('ID do operador não fornecido');
        setLoading(false);
        return;
      }

      try {
        console.info('🔍 [OperatorConfirmed] Buscando dados do operador:', pendingOperatorId);
        
        const response = await fetch(`/api/v1/operators/pending/${pendingOperatorId}`);
        const result = await response.json();

        if (result.isValid && result.result) {
          setOperatorData(result.result);
          console.info('✅ [OperatorConfirmed] Dados carregados:', result.result);
        } else {
          setError(result.errorMessages?.join(', ') || 'Erro ao carregar dados');
        }
      } catch (err) {
        console.error('❌ [OperatorConfirmed] Erro:', err);
        setError('Erro ao buscar informações do operador');
      } finally {
        setLoading(false);
      }
    };

    fetchOperatorData();
  }, [pendingOperatorId]);

  const handleGoToDashboard = () => {
    if (operatorData?.managerId) {
      router.push(`/${operatorData.managerId}/manager-users`);
    } else {
      router.push('/sign-in');
    }
  };

  const getStatusDisplay = () => {
    if (loading) {
      return {
        icon: <Loader2 className="h-20 w-20 text-primary animate-spin" />,
        title: 'Carregando...',
        description: 'Buscando informações do operador...',
        color: 'text-primary',
        bgColor: 'bg-primary/5'
      };
    }

    if (error) {
      return {
        icon: <AlertCircle className="h-20 w-20 text-red-500" />,
        title: 'Erro',
        description: error,
        color: 'text-red-600',
        bgColor: 'bg-red-50 dark:bg-red-950'
      };
    }

    if (!operatorData) {
      return {
        icon: <AlertCircle className="h-20 w-20 text-yellow-500" />,
        title: 'Operador não encontrado',
        description: 'Não foi possível encontrar as informações do operador.',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50 dark:bg-yellow-950'
      };
    }

    if (operatorData.operatorCreated) {
      return {
        icon: <CheckCircle2 className="h-20 w-20 text-green-500" />,
        title: 'Operador Adicionado com Sucesso!',
        description: 'O novo operador foi criado e receberá um email com as credenciais de acesso.',
        color: 'text-green-600',
        bgColor: 'bg-green-50 dark:bg-green-950'
      };
    }

    if (operatorData.paymentStatus === 'CONFIRMED') {
      return {
        icon: <CheckCircle2 className="h-20 w-20 text-green-500" />,
        title: 'Pagamento Confirmado!',
        description: 'Estamos criando o operador. Aguarde alguns instantes...',
        color: 'text-green-600',
        bgColor: 'bg-green-50 dark:bg-green-950'
      };
    }

    if (operatorData.paymentStatus === 'PENDING') {
      return {
        icon: <Loader2 className="h-20 w-20 text-yellow-500 animate-spin" />,
        title: 'Aguardando Confirmação',
        description: 'O pagamento está sendo processado. O operador será criado assim que confirmarmos o pagamento.',
        color: 'text-yellow-600',
        bgColor: 'bg-yellow-50 dark:bg-yellow-950'
      };
    }

    return {
      icon: <AlertCircle className="h-20 w-20 text-red-500" />,
      title: 'Pagamento Não Confirmado',
      description: 'Não foi possível confirmar o pagamento. Por favor, tente novamente ou entre em contato com o suporte.',
      color: 'text-red-600',
      bgColor: 'bg-red-50 dark:bg-red-950'
    };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto">
            {statusDisplay.icon}
          </div>
          <div className="space-y-2">
            <CardTitle className="text-2xl font-bold">{statusDisplay.title}</CardTitle>
            <CardDescription className="text-base">
              {statusDisplay.description}
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Informações do operador */}
          {operatorData && (
            <div className={`p-4 rounded-lg space-y-3 ${statusDisplay.bgColor}`}>
              <h3 className="font-semibold flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Detalhes do Operador
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Nome:</span>
                  <span className="font-medium">{operatorData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{operatorData.email}</span>
                </div>
              </div>
            </div>
          )}

          {/* Informações do pagamento */}
          {operatorData?.paymentId && (
            <div className="border rounded-lg p-4 space-y-2 text-sm">
              <h4 className="font-semibold text-xs text-muted-foreground uppercase">Referência do Pagamento</h4>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">ID do Pagamento:</span>
                <code className="text-xs bg-muted px-2 py-1 rounded">
                  {operatorData.paymentId.substring(0, 20)}...
                </code>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status:</span>
                <span className={`text-xs font-medium ${
                  operatorData.paymentStatus === 'CONFIRMED' ? 'text-green-600' :
                  operatorData.paymentStatus === 'PENDING' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>
                  {operatorData.paymentStatus}
                </span>
              </div>
            </div>
          )}

          {/* Próximos passos */}
          {operatorData?.operatorCreated && (
            <div className="border-t pt-6 space-y-4">
              <h4 className="font-semibold">Próximos Passos:</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>O operador receberá um email com as credenciais de acesso</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Ele poderá fazer login e começar a trabalhar imediatamente</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">✓</span>
                  <span>Você pode gerenciar todos os operadores na página de gerenciamento</span>
                </li>
              </ul>
            </div>
          )}

          {operatorData?.paymentStatus === 'PENDING' && !operatorData.operatorCreated && (
            <div className="border-t pt-6 text-center space-y-2">
              <p className="text-sm text-muted-foreground">
                Aguarde alguns instantes. Esta página será atualizada automaticamente quando o pagamento for confirmado.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Verificando status do pagamento...</span>
              </div>
            </div>
          )}

          {/* Botões de ação */}
          {!loading && operatorData && (
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Button 
                onClick={handleGoToDashboard}
                className="flex-1"
                size="lg"
              >
                {operatorData.operatorCreated ? 'Ir para Gerenciar Usuários' : 'Voltar ao Dashboard'}
              </Button>
              
              {operatorData.paymentStatus === 'FAILED' && (
                <Button 
                  onClick={() => router.back()}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  Tentar Novamente
                </Button>
              )}
            </div>
          )}

          {/* Informação adicional */}
          <div className="text-center text-xs text-muted-foreground border-t pt-4">
            {operatorData?.operatorCreated && (
              <p>Dúvidas? Entre em contato com nosso suporte.</p>
            )}
            {operatorData?.paymentStatus === 'PENDING' && (
              <p>O processo pode levar alguns minutos. Não feche esta página.</p>
            )}
            {operatorData?.paymentStatus === 'FAILED' && (
              <p>Se o problema persistir, entre em contato com nosso suporte.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function OperatorConfirmedPage() {
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
      <OperatorConfirmedContent />
    </Suspense>
  );
}
