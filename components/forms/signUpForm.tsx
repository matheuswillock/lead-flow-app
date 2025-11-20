import { GalleryVerticalEnd, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import type { UseFormReturn } from "react-hook-form"
import { signUpFormData } from "@/lib/validations/validationForms"
import { maskPhone, maskCPFOrCNPJ, unmask } from "@/lib/masks"
import { useState } from "react"

interface SignUpFormProps {
  form: UseFormReturn<signUpFormData>;
  errors: Record<string, string>;
  onSubmit: (data: signUpFormData) => void | Promise<void>;
  isLoading?: boolean;
  readonly?: boolean;
}

export function SignupForm({
  className,
  form,
  errors,
  onSubmit,
  isLoading = false,
  readonly = false,
  ...divProps
}: Omit<React.ComponentProps<"form">, "onSubmit"> & SignUpFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
              <div className="flex h-8 w-8 items-center justify-center rounded-md">
                <GalleryVerticalEnd className="size-6" />
              </div>
              <span className="sr-only">Lead Flow</span>
            </Link>
            <h1 className="text-xl font-bold">Criar conta</h1>
            <p className="text-center text-sm text-muted-foreground max-w-sm">
              Crie sua conta para começar a usar o Lead Flow
            </p>
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
                  <FormLabel>Nome completo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Seu nome"
                      {...field}
                      className="border-2 border-gray-300 rounded-md p-2"
                      disabled={readonly}
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="email@exemplo.com" 
                      {...field} 
                      className="border-2 border-gray-300 rounded-md p-2"
                      disabled={readonly}
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
                  <FormLabel>Telefone</FormLabel>
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
                  <FormLabel>CPF ou CNPJ</FormLabel>
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

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        {...field} 
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
                  <div className="text-xs text-muted-foreground border border-muted rounded-md p-3 bg-muted/30 space-y-1">
                    <p className="font-medium text-foreground mb-1">A senha deve conter:</p>
                    <ul className="space-y-0.5 ml-1">
                      <li>• Mínimo de 6 caracteres</li>
                      <li>• Pelo menos uma letra maiúscula</li>
                      <li>• Pelo menos uma letra minúscula</li>
                      <li>• Pelo menos um número</li>
                      <li>• Pelo menos um caractere especial (@, #, $, etc.)</li>
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
                  <FormLabel>Confirmar Senha</FormLabel>
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

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={!form.formState.isValid || form.formState.isSubmitting || isLoading}
            >
              {form.formState.isSubmitting || isLoading ? "Cadastrando..." : "Criar conta"}
            </Button>
          </div>
          {/* <div className="flex items-center gap-4">
            <Separator className="flex-1 shrink w-auto h-px bg-[var(--border)] opacity-60" />
            <span className="text-xs text-muted-foreground">Ou continue com</span>
            <Separator className="flex-1 shrink w-auto h-px bg-[var(--border)] opacity-60" />
          </div>
          <div className="grid gap-4">
            <Button variant="outline" className="w-full flex justify-center items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
              </svg>
              Continuar com Google
            </Button>
          </div> */}
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
