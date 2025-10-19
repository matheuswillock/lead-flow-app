import { GalleryVerticalEnd } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
// import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { UseFormReturn } from "react-hook-form"
import { loginFormData } from "@/lib/validations/validationForms"

interface SignInFormProps {
  form: UseFormReturn<loginFormData>;
  errors: Record<string, string>;
  onSubmit: (data: loginFormData) => void | Promise<void>;
  fromSubscribe?: boolean;
}

export function SignInForm({
  className,
  form,
  errors,
  onSubmit,
  fromSubscribe = false,
  ...divProps
}: Omit<React.ComponentProps<"form">, "onSubmit"> & SignInFormProps) {

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
            {fromSubscribe && (
              <>
                <Badge variant="outline" className="mt-1 border-primary/30 text-primary">Assinatura</Badge>
                {/* <TooltipProvider>
                  <div className="mt-1 flex items-start gap-2 p-2 rounded-md border border-primary/20 bg-primary/5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button type="button" className="pt-0.5 text-primary" aria-label="Mais detalhes">
                          <Info className="h-4 w-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Você será redirecionado para a página de assinatura após entrar.
                      </TooltipContent>
                    </Tooltip>
                    <p className="text-sm text-muted-foreground">
                      Fluxo de assinatura ativo.
                    </p>
                  </div>
                </TooltipProvider> */}
              </>
            )}
            <h1 className="text-xl font-bold">Welcome to Lead Flow.</h1>
            {fromSubscribe && (
              <p className="text-center text-sm text-muted-foreground max-w-sm">
                Para assinar a plataforma, entre com sua conta. Se ainda não tiver uma, crie seu cadastro para seguir para a assinatura.
              </p>
            )}
            <div className="text-center text-sm">
              Don&apos;t have an account?{" "}
              {/* TODO: Add sign up link */}
              <Link href={fromSubscribe ? "/sign-up?from=subscribe" : "/sign-up"} className="underline underline-offset-4">
                Sign up
              </Link>
            </div>
          </div>
          <div className="flex flex-col gap-6">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="grid gap-2">
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="email@exemplo.com" {...field} className="border-2 border-gray-300 rounded-md p-2"/>
                  </FormControl>
                  <FormMessage className="text-red-500">{errors.email}</FormMessage>
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
                    <Input type="password" {...field} className="border-2 border-gray-300 rounded-md p-2" />
                  </FormControl>
                  <FormMessage className="text-red-500">{errors.password || errors.apiError}</FormMessage>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full cursor-pointer text-lg font-medium"
              disabled={!form.formState.isValid || form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? "Entrando..." : "Entrar"}
            </Button>
          </div>
          <div className="flex items-center gap-4">
            <Separator className="flex-1 shrink w-auto h-px bg-[var(--border)] opacity-60" />
            <span className="text-xs text-muted-foreground">Ou continue com</span>
            <Separator className="flex-1 shrink w-auto h-px bg-[var(--border)] opacity-60" />
          </div>
          <div className="grid gap-4">
            <Button variant="outline" className="w-full flex justify-center items-center gap-2 cursor-pointer text-sm font-medium">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="h-4 w-4">
              <path
                d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
                fill="currentColor"
              />
              </svg>
              Continue with Google
            </Button>
          </div>
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
