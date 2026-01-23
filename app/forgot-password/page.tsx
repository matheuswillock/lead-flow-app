'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import Link from 'next/link'
import { HeartPulse } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validação básica
    if (!email) {
      setError('Por favor, informe seu e-mail')
      return
    }

    if (!validateEmail(email)) {
      setError('Por favor, informe um e-mail válido')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const result = await response.json()

      if (result.isValid) {
        setSuccess(true)
        setEmail('')
      } else {
        setError(result.errorMessages?.[0] || 'Erro ao enviar e-mail de recuperação')
      }
    } catch (err) {
      console.error('Erro ao solicitar reset de senha:', err)
      setError('Erro ao processar solicitação. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
        <div className="w-full max-w-md">
          <Card className="border-2">
            <CardHeader className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 border-2 border-green-500">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl">E-mail Enviado!</CardTitle>
                <CardDescription className="mt-2">
                  Verifique sua caixa de entrada
                </CardDescription>
              </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
              <Alert className="bg-green-50 border-green-200">
                <Mail className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  Enviamos um link de recuperação de senha para seu e-mail.
                </AlertDescription>
              </Alert>

              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="font-medium">O que fazer agora:</p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Verifique sua caixa de entrada</li>
                  <li>Clique no link que enviamos</li>
                  <li>Defina sua nova senha</li>
                  <li>Faça login com a nova senha</li>
                </ul>
              </div>

              <div className="pt-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-md border">
                <p className="font-medium mb-1">💡 Dica:</p>
                <p className="text-xs">
                  Não recebeu o e-mail? Verifique sua pasta de spam ou lixo eletrônico. 
                  O e-mail pode levar alguns minutos para chegar.
                </p>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSuccess(false)}
              >
                Enviar novamente
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                asChild
              >
                <Link href="/sign-in" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para login
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card className="border-2">
          <CardHeader className="text-center space-y-3">
            <div className="flex justify-center">
              <Link href="/" className="flex h-12 w-12 items-center justify-center rounded-md bg-primary">
                <HeartPulse className="h-6 w-6 text-primary-foreground" />
              </Link>
            </div>
            <div>
              <CardTitle className="text-2xl">Esqueceu sua senha?</CardTitle>
              <CardDescription className="mt-2">
                Sem problemas! Digite seu e-mail e enviaremos instruções para redefinir sua senha.
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
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 border-2"
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
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !email}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Enviar link de recuperação
                  </>
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                asChild
                disabled={isLoading}
              >
                <Link href="/sign-in" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para login
                </Link>
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Ao solicitar a recuperação, você receberá um e-mail com instruções para redefinir sua senha.
        </p>
      </div>
    </main>
  )
}
