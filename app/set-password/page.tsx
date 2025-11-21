'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Lock, Mail, CheckCircle2 } from 'lucide-react'

export default function SetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    // Verificar e estabelecer sessão com o token da URL
    const initializeSession = async () => {
      if (typeof window === 'undefined') return;
      
      const hash = window.location.hash;
      console.info('🔍 Hash completo:', hash);
      
      if (!hash) {
        console.info('❌ Sem hash na URL, redirecionando para login');
        router.push('/sign-in');
        return;
      }

      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      
      console.info('🔐 Token encontrado:', { accessToken: !!accessToken, type });

      if (!accessToken || (type !== 'invite' && type !== 'recovery')) {
        console.info('❌ Token inválido ou tipo incorreto, redirecionando para login');
        router.push('/sign-in');
        return;
      }

      try {
        const supabase = createSupabaseBrowser();
        
        if (!supabase) {
          setError('Erro ao conectar com o sistema de autenticação');
          setIsInitializing(false);
          return;
        }

        // Estabelecer a sessão usando o access token
        console.info('🔄 Estabelecendo sessão com o token...');
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });

        if (sessionError) {
          console.error('❌ Erro ao estabelecer sessão:', sessionError);
          setError('Token inválido ou expirado. Solicite um novo link.');
          setIsInitializing(false);
          return;
        }

        if (data.session) {
          console.info('✅ Sessão estabelecida com sucesso');
          
          // Extrair email do usuário
          if (data.session.user?.email) {
            setEmail(data.session.user.email);
          }
          
          setIsInitializing(false);
        } else {
          console.error('❌ Sessão não estabelecida');
          setError('Não foi possível estabelecer a sessão. Solicite um novo link.');
          setIsInitializing(false);
        }
      } catch (err) {
        console.error('❌ Erro ao inicializar sessão:', err);
        setError('Erro inesperado ao processar o link. Tente novamente.');
        setIsInitializing(false);
      }
    };

    initializeSession();
  }, [router, searchParams]);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) {
      return 'A senha deve ter pelo menos 8 caracteres'
    }
    if (!/[A-Z]/.test(pwd)) {
      return 'A senha deve conter pelo menos uma letra maiúscula'
    }
    if (!/[a-z]/.test(pwd)) {
      return 'A senha deve conter pelo menos uma letra minúscula'
    }
    if (!/[0-9]/.test(pwd)) {
      return 'A senha deve conter pelo menos um número'
    }
    return null
  }

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validações
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    setIsLoading(true)

    try {
      const supabase = createSupabaseBrowser()
      
      if (!supabase) {
        setError('Erro ao conectar com o sistema de autenticação')
        return
      }

      // Atualizar senha do usuário
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        console.error('Erro ao definir senha:', updateError)
        setError(updateError.message || 'Erro ao definir senha')
        return
      }

      // Buscar perfil do usuário para redirecionar corretamente
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Buscar perfil no banco
        const profileResponse = await fetch(`/api/v1/profiles/${user.id}`)
        const profileData = await profileResponse.json()

        if (profileData.isValid && profileData.result) {
          setSuccess(true)
          
          // Redirecionar para dashboard após 2 segundos
          setTimeout(() => {
            router.push(`/${user.id}/dashboard`)
          }, 2000)
        } else {
          setError('Erro ao carregar perfil do usuário')
        }
      }
    } catch (err) {
      console.error('Erro ao definir senha:', err)
      setError('Erro inesperado ao definir senha')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-2xl">Senha Definida com Sucesso!</CardTitle>
            <CardDescription>
              Você será redirecionado para o dashboard em instantes...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  // Mostrar loading enquanto inicializa a sessão
  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-primary animate-pulse" />
            </div>
            <CardTitle className="text-2xl">Verificando link...</CardTitle>
            <CardDescription>
              Aguarde enquanto validamos seu acesso.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Defina sua Senha</CardTitle>
          <CardDescription>
            Bem-vindo ao Corretor Studio! Crie uma senha segura para acessar a plataforma.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSetPassword}>
          <CardContent className="space-y-4">
            {email && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{email}</span>
              </div>
            )}

            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Mínimo 8 caracteres, com letras maiúsculas, minúsculas e números
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme sua senha"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter>
            <Button 
              type="submit" 
              className="w-full mt-4" 
              disabled={isLoading || !password || !confirmPassword}
            >
              {isLoading ? 'Definindo senha...' : 'Definir Senha e Acessar'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
