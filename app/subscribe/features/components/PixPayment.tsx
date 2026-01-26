'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, QrCode, RefreshCw, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

interface PixPaymentProps {
  encodedImage: string; // Base64 do QR Code
  payload: string; // Código copia e cola
  expirationDate: string; // Data de expiração do QR Code
  paymentId: string; // ID do pagamento para regenerar
  onPaymentConfirmed?: () => void;
  onQrCodeExpired?: () => void;
}

export function PixPayment({
  encodedImage,
  payload,
  expirationDate,
  paymentId,
  onPaymentConfirmed,
  onQrCodeExpired,
}: PixPaymentProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [currentQrCode, setCurrentQrCode] = useState(encodedImage);
  const [currentPayload, setCurrentPayload] = useState(payload);
  const [currentExpiration, setCurrentExpiration] = useState(expirationDate);
  const [isChecking, setIsChecking] = useState(false);

  // Calcula tempo restante
  useEffect(() => {
    const calculateTimeRemaining = () => {
      const now = new Date().getTime();
      const expiration = new Date(currentExpiration).getTime();
      const diff = expiration - now;

      if (diff <= 0) {
        setIsExpired(true);
        setTimeRemaining(0);
        onQrCodeExpired?.();
        return;
      }

      setTimeRemaining(Math.floor(diff / 1000)); // em segundos
    };

    calculateTimeRemaining();
    const interval = setInterval(calculateTimeRemaining, 1000);

    return () => clearInterval(interval);
  }, [currentExpiration, onQrCodeExpired]);

  // Formata tempo restante em MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Copia código Pix
  const handleCopyPayload = async () => {
    try {
      await navigator.clipboard.writeText(currentPayload);
      toast.success('Código Pix copiado!', {
        description: 'Cole no seu aplicativo de pagamento',
      });
    } catch (_error) {
      toast.error('Erro ao copiar código');
    }
  };

  // Regenera QR Code
  const handleRegenerateQrCode = async () => {
    setIsRegenerating(true);
    
    try {
      const response = await fetch(`/api/v1/payments/${paymentId}/regenerate-pix`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Erro ao regenerar QR Code');
      }

      const data = await response.json();
      
      if (data.result) {
        setCurrentQrCode(data.result.encodedImage);
        setCurrentPayload(data.result.payload);
        setCurrentExpiration(data.result.expirationDate);
        setIsExpired(false);
        
        toast.success('QR Code regenerado!', {
          description: 'Um novo código foi gerado para você',
        });
      }
    } catch (_error) {
      toast.error('Erro ao regenerar QR Code', {
        description: 'Tente novamente em alguns instantes',
      });
    } finally {
      setIsRegenerating(false);
    }
  };

  // Verifica status do pagamento
  const checkPaymentStatus = async () => {
    setIsChecking(true);
    
    try {
      const response = await fetch('/api/v1/payments/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ paymentId }),
      });
      
      if (!response.ok) {
        throw new Error('Erro ao verificar pagamento');
      }

      const data = await response.json();
      
      if (data.isPaid) {
        toast.success('Pagamento confirmado!', {
          description: 'Seu pagamento foi processado com sucesso',
        });
        onPaymentConfirmed?.();
      } else {
        toast.info('Pagamento pendente', {
          description: 'Aguardando confirmação do pagamento',
        });
      }
    } catch (_error) {
      toast.error('Erro ao verificar pagamento');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          Pagamento via PIX
        </CardTitle>
        <CardDescription>
          Escaneie o QR Code ou copie o código para pagar
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Timer */}
        <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-muted">
          <Timer className={`h-5 w-5 ${isExpired ? 'text-destructive' : 'text-primary'}`} />
          <span className={`text-lg font-mono font-semibold ${isExpired ? 'text-destructive' : 'text-primary'}`}>
            {isExpired ? 'Expirado' : formatTime(timeRemaining)}
          </span>
        </div>

        {/* QR Code */}
        {!isExpired ? (
          <div className="flex flex-col items-center gap-4">
            <div className="relative p-4 bg-white rounded-lg shadow-md">
              <img
                src={`data:image/png;base64,${currentQrCode}`}
                alt="QR Code PIX"
                className="w-64 h-64"
              />
            </div>

            {/* Código Copia e Cola */}
            <div className="w-full space-y-2">
              <label className="text-sm font-medium">Código Pix (Copia e Cola)</label>
              <div className="flex gap-2">
                <div className="flex-1 p-3 bg-muted rounded-lg overflow-x-auto">
                  <code className="text-xs break-all">{currentPayload}</code>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyPayload}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Verificar Pagamento */}
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              onClick={checkPaymentStatus}
              disabled={isChecking}
            >
              {isChecking ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Verificar Pagamento
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="p-4 rounded-full bg-destructive/10">
              <Timer className="h-12 w-12 text-destructive" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">QR Code Expirado</h3>
              <p className="text-sm text-muted-foreground">
                O código Pix expirou. Clique no botão abaixo para gerar um novo.
              </p>
            </div>
            <Button
              type="button"
              onClick={handleRegenerateQrCode}
              disabled={isRegenerating}
              className="w-full"
            >
              {isRegenerating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Gerando novo código...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Gerar Novo QR Code
                </>
              )}
            </Button>
          </div>
        )}

        {/* Instruções */}
        <div className="space-y-2 text-sm text-muted-foreground border-t pt-4">
          <h4 className="font-semibold text-foreground">Como pagar:</h4>
          <ol className="list-decimal list-inside space-y-1">
            <li>Abra o app do seu banco</li>
            <li>Escolha pagar com Pix</li>
            <li>Escaneie o QR Code ou cole o código</li>
            <li>Confirme o pagamento</li>
          </ol>
          <p className="text-xs pt-2">
            ⚡ O pagamento é confirmado em segundos!
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
