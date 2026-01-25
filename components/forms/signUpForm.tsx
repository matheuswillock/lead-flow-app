import { HeartPulse, Eye, EyeOff, ShieldCheck, Check, X, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import Link from "next/link"
import type { UseFormReturn } from "react-hook-form"
import { signUpFormData, signUpOAuthFormData } from "@/lib/validations/validationForms"
import { maskPhone, maskCPFOrCNPJ, unmask } from "@/lib/masks"
import { useState } from "react"
import { CepService } from "@/lib/services/CepService"
import { toast } from "sonner"
import { createSupabaseBrowser } from "@/lib/supabase/browser"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"

interface SignUpFormProps {
  form: UseFormReturn<signUpFormData | signUpOAuthFormData>;
  errors: Record<string, string>;
  onSubmit: (data: signUpFormData | signUpOAuthFormData) => void | Promise<void>;
  isLoading?: boolean;
  readonly?: boolean;
  isOAuth?: boolean;
}

export function SignupForm({
  className,
  form,
  errors,
  onSubmit,
  isLoading = false,
  readonly = false,
  isOAuth = false,
  ...divProps
}: Omit<React.ComponentProps<"form">, "onSubmit"> & SignUpFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [isSearchingCep, setIsSearchingCep] = useState(false);

  const handleGoogleSignIn = async () => {
    const supabase = createSupabaseBrowser();
    if (!supabase) return;

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "https://www.googleapis.com/auth/calendar.events",
        redirectTo: `${window.location.origin}/auth/callback?next=/board`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  };

  // Validações individuais da senha
  const passwordValidations = {
      minLength: currentPassword.length >= 8,
    hasUppercase: /[A-Z]/.test(currentPassword),
    hasLowercase: /[a-z]/.test(currentPassword),
    hasNumber: /[0-9]/.test(currentPassword),
    hasSpecialChar: /[^A-Za-z0-9]/.test(currentPassword),
  };

  const handleSearchCep = async () => {
    const cep = form.getValues('postalCode');
    
    if (!cep || cep.replace(/\D/g, '').length !== 8) {
      toast.error('CEP inválido', {
        description: 'Digite um CEP válido com 8 dígitos',
      });
      return;
    }

    setIsSearchingCep(true);
    
    try {
      const cepData = await CepService.consultarCep(cep);
      
      if (cepData) {
        const formData = CepService.formatarParaFormulario(cepData);
        
        form.setValue('address', formData.address);
        form.setValue('neighborhood', formData.neighborhood);
        form.setValue('city', formData.city);
        form.setValue('state', formData.state);
        if (formData.complement) {
          form.setValue('complement', formData.complement);
        }
        
        toast.success('CEP encontrado', {
          description: `Endereço preenchido: ${formData.address}, ${formData.neighborhood} - ${formData.city}/${formData.state}`,
        });
        
        // Focar no campo de número após preencher
        setTimeout(() => {
          const numberInput = document.querySelector('input[name="addressNumber"]') as HTMLInputElement;
          numberInput?.focus();
        }, 100);
      } else {
        toast.error('CEP não encontrado', {
          description: 'Verifique o CEP digitado e tente novamente',
        });
      }
    } catch (error) {
      console.error('Erro ao buscar CEP:', error);
      toast.error('Erro ao buscar CEP', {
        description: 'Tente novamente ou preencha manualmente',
      });
    } finally {
      setIsSearchingCep(false);
    }
  };

  const calculatePasswordStrength = (pwd: string): 'weak' | 'medium' | 'strong' => {
    let strength = 0;
    if (pwd.length >= 6) strength++;
    if (pwd.length >= 10) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++; // caracteres especiais

    if (strength <= 2) return 'weak';
    if (strength <= 4) return 'medium';
    return 'strong';
  };

  const generateStrongPassword = (): string => {
    const length = 12;
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%&*';
    
    const allChars = uppercase + lowercase + numbers + symbols;
    let password = '';
    
    // Garantir que tenha pelo menos um de cada tipo
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    
    // Preencher o resto aleatoriamente
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }
    
    // Embaralhar
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleGeneratePassword = () => {
    const newPassword = generateStrongPassword();
    form.setValue('password', newPassword);
    form.setValue('confirmPassword', newPassword);
    setPasswordStrength('strong');
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("flex flex-col gap-6", className)} 
        {...divProps}
      >
        <div className="flex flex-col gap-6">
          <div className="flex flex-col items-center gap-2">
            <Link
              href="/"
              className="flex flex-col items-center gap-2 font-medium"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
                <HeartPulse className="h-6 w-6 text-primary-foreground" />
              </div>
              <span className="sr-only">Corretor Studio</span>
            </Link>
            <h1 className="text-xl font-bold">
              {isOAuth ? "Completar cadastro" : "Criar conta"}
            </h1>
            <p className="text-center text-sm text-muted-foreground max-w-sm">
              {isOAuth
                ? "Preencha os dados restantes para seguir para a assinatura."
                : "Crie sua conta para começar a usar o Corretor Studio"}
            </p>
            {isOAuth && (
              <Badge variant="outline" className="mt-1 border-primary/30 text-primary">
                Cadastro via Google
              </Badge>
            )}
            <div className="text-center text-sm">
              Já tem uma conta? 
              {' '}
              <Link href="/sign-in" className="underline underline-offset-4 text-lg">
                Entrar
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            {/* {fromSubscribe && (form.getValues("fullName") || form.getValues("email") || form.getValues("phone")) && (
              <TooltipProvider>
                <div className="flex items-start gap-2 p-2 rounded-md border border-primary/20 bg-primary/5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="pt-0.5 text-primary" aria-label="Mais detalhes">
                        <Info className="h-4 w-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Dados pré-preenchidos a partir da intenção de assinatura.
                    </TooltipContent>
                  </Tooltip>
                  <p className="text-sm text-muted-foreground">
                    Seus dados foram importados; revise e crie sua senha.
                  </p>
                </div>
              </TooltipProvider>
            )} */}
            
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>
                    Nome completo <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Seu nome"
                      {...field}
                      className="border-2 border-gray-300 rounded-md p-2"
                      disabled={readonly || (isOAuth && !!field.value)}
                    />
                  </FormControl>
                  <FormMessage className="text-red-500">{errors.fullName}</FormMessage>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>
                    Email <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="email@exemplo.com" 
                      {...field} 
                      className="border-2 border-gray-300 rounded-md p-2"
                      disabled={readonly || (isOAuth && !!field.value)}
                    />
                  </FormControl>
                  <FormMessage className="text-red-500">{errors.email}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>
                    Telefone <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="(11) 99999-9999" 
                      {...field}
                      value={maskPhone(field.value)}
                      onChange={(e) => {
                        const masked = maskPhone(e.target.value);
                        const unmasked = unmask(masked);
                        field.onChange(unmasked);
                      }}
                      className="border-2 border-gray-300 rounded-md p-2"
                      disabled={readonly}
                    />
                  </FormControl>
                  <FormMessage className="text-red-500">{errors.phone}</FormMessage>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="cpfCnpj"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>
                    CPF ou CNPJ <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="000.000.000-00 ou 00.000.000/0000-00" 
                      {...field}
                      value={maskCPFOrCNPJ(field.value || '')}
                      onChange={(e) => {
                        const masked = maskCPFOrCNPJ(e.target.value);
                        const unmasked = unmask(masked);
                        field.onChange(unmasked);
                      }}
                      className="border-2 border-gray-300 rounded-md p-2"
                      disabled={readonly}
                    />
                  </FormControl>
                  <FormMessage className="text-red-500">{errors.cpfCnpj}</FormMessage>
                </FormItem>
              )}
            />

            {/* CEP com botão de busca */}
            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>
                    CEP <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input 
                        placeholder="00000-000" 
                        {...field}
                        value={field.value?.replace(/(\d{5})(\d{3})/, '$1-$2') || ''}
                        onChange={(e) => {
                          const value = e.target.value.replace(/\D/g, '');
                          field.onChange(value);
                        }}
                        onBlur={(e) => {
                          // Busca automática ao sair do campo se CEP estiver completo
                          const cep = e.target.value.replace(/\D/g, '');
                          if (cep.length === 8 && !readonly) {
                            handleSearchCep();
                          }
                        }}
                        maxLength={9}
                        className="border-2 border-gray-300 rounded-md p-2"
                        disabled={readonly}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleSearchCep}
                        disabled={readonly || isSearchingCep}
                        className="flex-shrink-0"
                        title="Buscar endereço pelo CEP"
                      >
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage className="text-red-500">{errors.postalCode}</FormMessage>
                </FormItem>
              )}
            />

            {/* Endereço */}
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>
                    Endereço <span className="text-red-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Rua, Avenida, etc." 
                      {...field}
                      className="border-2 border-gray-300 rounded-md p-2"
                      disabled={readonly}
                    />
                  </FormControl>
                  <FormMessage className="text-red-500">{errors.address}</FormMessage>
                </FormItem>
              )}
            />

            {/* Número e Bairro na mesma linha */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="addressNumber"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>
                      Número <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="123" 
                        {...field}
                        className="border-2 border-gray-300 rounded-md p-2"
                        disabled={readonly}
                      />
                    </FormControl>
                    <FormMessage className="text-red-500">{errors.addressNumber}</FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="neighborhood"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>
                      Bairro <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Centro, Jardins, etc." 
                        {...field}
                        className="border-2 border-gray-300 rounded-md p-2"
                        disabled={readonly}
                      />
                    </FormControl>
                    <FormMessage className="text-red-500">{errors.neighborhood}</FormMessage>
                  </FormItem>
                )}
              />
            </div>

            {/* Complemento */}
            <FormField
              control={form.control}
              name="complement"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Complemento (opcional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Apto, Bloco, etc." 
                      {...field}
                      className="border-2 border-gray-300 rounded-md p-2"
                      disabled={readonly}
                    />
                  </FormControl>
                  <FormMessage className="text-red-500">{errors.complement}</FormMessage>
                </FormItem>
              )}
            />

            {/* Cidade e Estado na mesma linha */}
            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="city"
                render={({ field }) => (
                  <FormItem className="grid gap-2 col-span-2">
                    <FormLabel>
                      Cidade <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="São Paulo" 
                        {...field}
                        className="border-2 border-gray-300 rounded-md p-2"
                        disabled={readonly}
                      />
                    </FormControl>
                    <FormMessage className="text-red-500">{errors.city}</FormMessage>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="state"
                render={({ field }) => (
                  <FormItem className="grid gap-2">
                    <FormLabel>
                      UF <span className="text-red-500">*</span>
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="SP" 
                        {...field}
                        maxLength={2}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        className="border-2 border-gray-300 rounded-md p-2"
                        disabled={readonly}
                      />
                    </FormControl>
                    <FormMessage className="text-red-500">{errors.state}</FormMessage>
                  </FormItem>
                )}
              />
            </div>

            {!isOAuth && (
              <>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <div className="flex items-center justify-between">
                        <FormLabel>
                          Senha <span className="text-red-500">*</span>
                        </FormLabel>
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
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showPassword ? "text" : "password"} 
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              setCurrentPassword(e.target.value);
                              if (e.target.value) {
                                setPasswordStrength(calculatePasswordStrength(e.target.value));
                              } else {
                                setPasswordStrength(null);
                              }
                            }}
                            className="border-2 border-gray-300 rounded-md p-2 pr-10" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      
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
                      
                      {/* Regras de validação com feedback visual dinâmico */}
                      <div className="border border-muted rounded-md p-3 bg-muted/30 space-y-2">
                        <p className="font-medium text-foreground text-sm">A senha deve conter:</p>
                        <ul className="space-y-1.5">
                          <li className={cn(
                            "flex items-center gap-2 text-sm transition-colors",
                            currentPassword.length === 0 ? "text-muted-foreground" :
                            passwordValidations.minLength ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {currentPassword.length === 0 ? (
                              <span className="w-4 h-4 flex items-center justify-center">•</span>
                            ) : passwordValidations.minLength ? (
                              <Check className="w-4 h-4 flex-shrink-0" />
                            ) : (
                              <X className="w-4 h-4 flex-shrink-0" />
                            )}
                            <span>Mínimo de 8 caracteres</span>
                          </li>
                          
                          <li className={cn(
                            "flex items-center gap-2 text-sm transition-colors",
                            currentPassword.length === 0 ? "text-muted-foreground" :
                            passwordValidations.hasUppercase ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {currentPassword.length === 0 ? (
                              <span className="w-4 h-4 flex items-center justify-center">•</span>
                            ) : passwordValidations.hasUppercase ? (
                              <Check className="w-4 h-4 flex-shrink-0" />
                            ) : (
                              <X className="w-4 h-4 flex-shrink-0" />
                            )}
                            <span>Pelo menos uma letra maiúscula</span>
                          </li>
                          
                          <li className={cn(
                            "flex items-center gap-2 text-sm transition-colors",
                            currentPassword.length === 0 ? "text-muted-foreground" :
                            passwordValidations.hasLowercase ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {currentPassword.length === 0 ? (
                              <span className="w-4 h-4 flex items-center justify-center">•</span>
                            ) : passwordValidations.hasLowercase ? (
                              <Check className="w-4 h-4 flex-shrink-0" />
                            ) : (
                              <X className="w-4 h-4 flex-shrink-0" />
                            )}
                            <span>Pelo menos uma letra minúscula</span>
                          </li>
                          
                          <li className={cn(
                            "flex items-center gap-2 text-sm transition-colors",
                            currentPassword.length === 0 ? "text-muted-foreground" :
                            passwordValidations.hasNumber ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {currentPassword.length === 0 ? (
                              <span className="w-4 h-4 flex items-center justify-center">•</span>
                            ) : passwordValidations.hasNumber ? (
                              <Check className="w-4 h-4 flex-shrink-0" />
                            ) : (
                              <X className="w-4 h-4 flex-shrink-0" />
                            )}
                            <span>Pelo menos um número</span>
                          </li>
                          
                          <li className={cn(
                            "flex items-center gap-2 text-sm transition-colors",
                            currentPassword.length === 0 ? "text-muted-foreground" :
                            passwordValidations.hasSpecialChar ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                          )}>
                            {currentPassword.length === 0 ? (
                              <span className="w-4 h-4 flex items-center justify-center">•</span>
                            ) : passwordValidations.hasSpecialChar ? (
                              <Check className="w-4 h-4 flex-shrink-0" />
                            ) : (
                              <X className="w-4 h-4 flex-shrink-0" />
                            )}
                            <span>Pelo menos um caractere especial (@, #, $, etc.)</span>
                          </li>
                        </ul>
                      </div>
                      <FormMessage className="text-red-500">{errors.password}</FormMessage>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className="grid gap-2">
                      <FormLabel>
                        Confirmar Senha <span className="text-red-500">*</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input 
                            type={showConfirmPassword ? "text" : "password"} 
                            {...field} 
                            className="border-2 border-gray-300 rounded-md p-2 pr-10" 
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage className="text-red-500">{errors.confirmPassword || errors.apiError}</FormMessage>
                    </FormItem>
                  )}
                />
              </>
            )}

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={!form.formState.isValid || form.formState.isSubmitting || isLoading}
            >
              {form.formState.isSubmitting || isLoading ? "Cadastrando..." : "Criar conta"}
            </Button>
          </div>
          {!isOAuth && (
            <>
              <div className="flex items-center gap-4">
                <Separator className="flex-1 shrink w-auto h-px bg-[var(--border)] opacity-60" />
                <span className="text-xs text-muted-foreground">Ou continue com</span>
                <Separator className="flex-1 shrink w-auto h-px bg-[var(--border)] opacity-60" />
              </div>
              <div className="grid gap-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGoogleSignIn}
                  className="w-full flex justify-center items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
                  <path
                    d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                    fill="currentColor"
                  />
                  </svg>
                  Continuar com Google
                </Button>
              </div>
            </>
          )}
        </div>
      </form>
    </Form>

    // TODO: Criar os links de Terms of Service e Privacy Policy
    // <div className="text-balance text-center text-xs text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 hover:[&_a]:text-primary  ">
    //   By clicking continue, you agree to our <a href="#">Terms of Service</a>{" "}
    //   and <a href="#">Privacy Policy</a>.
    // </div>
  )
}
