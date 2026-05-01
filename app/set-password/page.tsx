'use client'

import { useState, useEffect, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseBrowser } from '@/lib/supabase/browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Eye, EyeOff, Lock, Mail, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react'

function SetPasswordContent() {
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
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null)
  const [isTokenError, setIsTokenError] = useState(false)
  const verifiedTokenRef = useRef<string | null>(null)

  const calculatePasswordStrength = (pwd: string): 'weak' | 'medium' | 'strong' => {
    let strength = 0
    if (pwd.length >= 8) strength++
    if (pwd.length >= 12) strength++
    if (/[A-Z]/.test(pwd)) strength++
    if (/[a-z]/.test(pwd)) strength++
    if (/[0-9]/.test(pwd)) strength++
    if (/[^A-Za-z0-9]/.test(pwd)) strength++ // caracteres especiais

    if (strength <= 2) return 'weak'
    if (strength <= 4) return 'medium'
    return 'strong'
  }

  useEffect(() => {
    // Verificar e estabelecer sessão com o token da URL
    const initializeSession = async () => {
      if (typeof window === 'undefined') return;

      const supabase = createSupabaseBrowser()

      if (!supabase) {
        setError('Erro ao conectar com o sistema de autenticação')
        setIsTokenError(true)
        setIsInitializing(false)
        return
      }

      const resumeExistingSession = async (): Promise<boolean> => {
        const { data, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          console.info('❌ Erro ao recuperar sessão existente:', sessionError.message)
          return false
        }

        if (!data.session) {
          return false
        }

        setEmail(data.session.user?.email ?? null)
        setError(null)
        setIsTokenError(false)
        setIsInitializing(false)

        if (window.location.search || window.location.hash) {
          window.history.replaceState(null, '', '/set-password')
        }

        return true
      }

      const tokenHash = searchParams.get('token_hash')
      const queryType = searchParams.get('type')

      if (tokenHash && (queryType === 'invite' || queryType === 'recovery')) {
        if (verifiedTokenRef.current === tokenHash) return
        verifiedTokenRef.current = tokenHash

        try {
          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: queryType as EmailOtpType,
          })

          if (verifyError || !data.session) {
            console.error('❌ Erro ao validar token do e-mail:', verifyError)

            if (await resumeExistingSession()) {
              return
            }

            setError('Este link já foi usado ou expirou. Solicite um novo link de acesso.')
            setIsTokenError(true)
            setIsInitializing(false)
            return
          }

          setEmail(data.session.user?.email ?? null)
          window.history.replaceState(null, '', '/set-password')
          setIsInitializing(false)
        } catch (err) {
          console.error('❌ Erro ao validar token do e-mail:', err)
          setError('Erro inesperado ao processar o link. Tente novamente.')
          setIsTokenError(true)
          setIsInitializing(false)
        }
        return
      }
      
      const hash = window.location.hash;
      console.info('🔍 Hash completo:', hash);
      
      if (!hash) {
        if (await resumeExistingSession()) {
          return
        }

        console.info('❌ Sem hash na URL, redirecionando para login');
        router.push('/sign-in');
        return;
      }

      const hashParams = new URLSearchParams(hash.substring(1));
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');
      const type = hashParams.get('type');
      const hashError = hashParams.get('error');
      const hashErrorCode = hashParams.get('error_code');
      const hashErrorDescription = hashParams.get('error_description');

      if (hashError) {
        console.info('❌ Erro retornado pelo provedor de autenticação:', {
          error: hashError,
          code: hashErrorCode,
        });

        if (await resumeExistingSession()) {
          return
        }

        setError(
          hashErrorCode === 'otp_expired'
            ? 'Este link já foi usado ou expirou. Solicite um novo link de acesso.'
            : hashErrorDescription?.replace(/\+/g, ' ') || 'Link inválido. Solicite um novo link.'
        );
        setIsTokenError(true);
        setIsInitializing(false);
        return;
      }
      
      console.info('🔐 Token encontrado:', { accessToken: !!accessToken, type });

      if (!accessToken || (type !== 'invite' && type !== 'recovery')) {
        if (await resumeExistingSession()) {
          return
        }

        console.info('❌ Token inválido ou tipo incorreto, redirecionando para login');
        router.push('/sign-in');
        return;
      }

      try {
        // Estabelecer a sessão usando o access token
        console.info('🔄 Estabelecendo sessão com o token...');
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });

        if (sessionError) {
          console.error('❌ Erro ao estabelecer sessão:', sessionError);
          setError('Token inválido ou expirado. Solicite um novo link.');
          setIsTokenError(true);
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
          setIsTokenError(true);
          setIsInitializing(false);
        }
      } catch (err) {
        console.error('❌ Erro ao inicializar sessão:', err);
        setError('Erro inesperado ao processar o link. Tente novamente.');
        setIsTokenError(true);
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

  const translateSupabaseError = (errorMessage: string): string => {
    const errorMap: Record<string, string> = {
      'New password should be different from the old password.': 
        '⚠️ A nova senha deve ser diferente da senha anterior.\n\n💡 Dica: Tente adicionar números, símbolos ou modificar a estrutura da senha.',
      'Password should be at least 6 characters': 
        'A senha deve ter pelo menos 8 caracteres.',
      'Invalid token': 
        'Link inválido ou expirado. Solicite um novo link de redefinição.',
      'Token has expired': 
        'Este link expirou. Por favor, solicite um novo link de redefinição de senha.',
      'Unable to validate email address: invalid format': 
        'Formato de e-mail inválido.',
      'User not found': 
        'Usuário não encontrado.',
      'Invalid login credentials': 
        'Credenciais inválidas.',
    }

    // Tentar encontrar correspondência exata
    if (errorMap[errorMessage]) {
      return errorMap[errorMessage]
    }

    // Tentar correspondência parcial
    for (const [key, value] of Object.entries(errorMap)) {
      if (errorMessage.toLowerCase().includes(key.toLowerCase())) {
        return value
      }
    }

    // Retornar mensagem genérica se não encontrar correspondência
    return 'Erro ao processar sua solicitação. Tente novamente ou solicite um novo link.'
  }

  const generateStrongPassword = (): string => {
    const length = 12
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    const lowercase = 'abcdefghijklmnopqrstuvwxyz'
    const numbers = '0123456789'
    const symbols = '!@#$%&*'
    
    const allChars = uppercase + lowercase + numbers + symbols
    let password = ''
    
    // Garantir que tenha pelo menos um de cada tipo
    password += uppercase[Math.floor(Math.random() * uppercase.length)]
    password += lowercase[Math.floor(Math.random() * lowercase.length)]
    password += numbers[Math.floor(Math.random() * numbers.length)]
    password += symbols[Math.floor(Math.random() * symbols.length)]
    
    // Preencher o resto aleatoriamente
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)]
    }
    
    // Embaralhar
    return password.split('').sort(() => Math.random() - 0.5).join('')
  }

  const handleGeneratePassword = () => {
    const newPassword = generateStrongPassword()
    setPassword(newPassword)
    setConfirmPassword(newPassword)
    setPasswordStrength('strong')
    setShowPassword(true)
    setShowConfirmPassword(true)
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
        const friendlyMessage = translateSupabaseError(updateError.message)
        setError(friendlyMessage)
        setIsLoading(false)
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

  // Mostrar erro de token com opção de voltar
  if (isTokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-6 h-6 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Link Inválido ou Expirado</CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-col gap-3">
            <Button 
              onClick={() => router.push('/sign-in')}
              className="w-full"
            >
              Voltar para Login
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              Solicite um novo link de redefinição de senha ao seu administrador.
            </p>
          </CardFooter>
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
              <Alert variant="destructive" className="border-destructive/50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="ml-2">
                  <div className="space-y-1">
                    {error.split('\n').map((line, index) => (
                      line.trim() && (
                        <p key={index} className={index === 0 ? 'font-medium' : 'text-sm'}>
                          {line}
                        </p>
                      )
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Nova Senha</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleGeneratePassword}
                  className="h-auto py-1 px-2 text-xs"
                >
                  Gerar senha forte
                </Button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (e.target.value) {
                      setPasswordStrength(calculatePasswordStrength(e.target.value))
                    } else {
                      setPasswordStrength(null)
                    }
                  }}
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
              
              {/* Indicador de força da senha */}
              {passwordStrength && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    <div className={`h-1 flex-1 rounded ${
                      passwordStrength === 'weak' ? 'bg-red-500' :
                      passwordStrength === 'medium' ? 'bg-yellow-500' :
                      'bg-green-500'
                    }`} />
                    <div className={`h-1 flex-1 rounded ${
                      passwordStrength === 'medium' || passwordStrength === 'strong' ? 
                      (passwordStrength === 'medium' ? 'bg-yellow-500' : 'bg-green-500') : 
                      'bg-muted'
                    }`} />
                    <div className={`h-1 flex-1 rounded ${
                      passwordStrength === 'strong' ? 'bg-green-500' : 'bg-muted'
                    }`} />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className={`h-3 w-3 ${
                      passwordStrength === 'weak' ? 'text-red-500' :
                      passwordStrength === 'medium' ? 'text-yellow-500' :
                      'text-green-500'
                    }`} />
                    <p className={`text-xs font-medium ${
                      passwordStrength === 'weak' ? 'text-red-500' :
                      passwordStrength === 'medium' ? 'text-yellow-500' :
                      'text-green-500'
                    }`}>
                      {passwordStrength === 'weak' ? 'Senha fraca' :
                       passwordStrength === 'medium' ? 'Senha média' :
                       'Senha forte'}
                    </p>
                  </div>
                </div>
              )}
              
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
              className="w-full mt-4 cursor-pointer" 
              disabled={isLoading || !password || !confirmPassword}
            >
              {isLoading ? 'Definindo senha...' : 'Gerar senha'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Carregando...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <SetPasswordContent />
    </Suspense>
  )
}
