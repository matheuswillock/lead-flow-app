'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useForgotPasswordContext } from '../context/ForgotPasswordContext';

const SUCCESS_MESSAGE = 'Link enviado com sucesso para seu e-mail.';

export function ForgotPasswordContainer() {
  const {
    email,
    isLoading,
    error,
    success,
    setEmail,
    submit,
    clearError,
    resetSuccess,
  } = useForgotPasswordContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await submit();
  };

  if (success) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
        <div className="w-full max-w-md">
          <Card className="border-2">
            <CardHeader className="space-y-4 text-center">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-green-500 bg-green-100">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl">Link enviado</CardTitle>
                <CardDescription className="mt-2">
                  Verifique sua caixa de entrada
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              <Alert className="border-green-200 bg-green-50">
                <Mail className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {SUCCESS_MESSAGE}
                </AlertDescription>
              </Alert>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium">O que fazer agora:</p>
                <ul className="ml-2 list-inside list-disc space-y-1">
                  <li>Verifique sua caixa de entrada</li>
                  <li>Clique no link que enviamos</li>
                  <li>Defina sua nova senha</li>
                  <li>Faça login com a nova senha</li>
                </ul>
              </div>

              <div className="rounded-md border bg-muted/50 p-3 text-sm text-muted-foreground">
                <p className="mb-1 font-medium">Dica:</p>
                <p className="text-xs">
                  Não recebeu o e-mail? Verifique sua pasta de spam ou lixo
                  eletrônico. O e-mail pode levar alguns minutos para chegar.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2">
              <Button variant="outline" className="w-full" onClick={resetSuccess}>
                Enviar novamente
              </Button>
              <Button variant="ghost" className="w-full" asChild>
                <Link href="/sign-in" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para login
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card className="border-2">
          <CardHeader className="space-y-3 text-center">
            <div className="flex justify-center">
              <Link href="/" className="flex h-12 w-12 items-center justify-center">
                <Image
                  src="/corretor-studio-icon.svg"
                  alt="Corretor Studio"
                  width={80}
                  height={80}
                  className="h-20 w-20"
                  priority
                />
              </Link>
            </div>
            <div>
              <CardTitle className="text-2xl">Esqueceu sua senha?</CardTitle>
              <CardDescription className="mt-2">
                Sem problemas! Digite seu e-mail e enviaremos instrucoes para
                redefinir sua senha.
              </CardDescription>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-2 pl-10"
                    disabled={isLoading}
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Digite o e-mail cadastrado em sua conta
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={isLoading || !email}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar link de recuperacao
                  </>
                )}
              </Button>

              <Button type="button" variant="ghost" className="w-full" asChild disabled={isLoading}>
                <Link href="/sign-in" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para login
                </Link>
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ao solicitar a recuperação, você receberá um e-mail com instruções para
          redefinir sua senha.
        </p>
      </div>
    </main>
  );
}
