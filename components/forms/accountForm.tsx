import { Form, UseFormReturn } from "react-hook-form";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { signUpFormData } from "@/lib/types/formTypes";
import { cn } from "@/lib/utils";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface SignUpFormProps {
  form: UseFormReturn<signUpFormData>;
  errors: Record<string, string>;
  onSubmit: (data: signUpFormData) => void | Promise<void>;
  isLoading?: boolean;
  setIsUpdating?: (value: boolean) => void;
  isUpdating?: boolean;
  user?: {
    fullName?: string;
    email?: string;
    phone?: string;
  } | null;
};

export function AccountForm({
  className,
  form,
  errors,
  onSubmit,
  isLoading = false,
  isUpdating = false,
  user,
  ...divProps
}: Omit<React.ComponentProps<"form">, "onSubmit"> & SignUpFormProps) {
    const [showPassword, setShowPassword] = useState(false);

    return(
        <Form>
            <form 
                onSubmit={form.handleSubmit(onSubmit)}
                className={cn("space-y-6", className)} 
                {...divProps}
            >
                <div className="grid gap-6 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="fullName"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel htmlFor="name">Nome</FormLabel>
                            <FormControl>
                                <Input
                                    id="name"
                                    placeholder="Nome"
                                    autoComplete="name"
                                    className="h-11"
                                    disabled={isLoading}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage 
                                className="text-red-500"
                            >
                                {errors.fullName}
                            </FormMessage>
                          </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="space-y-2">
                            <FormLabel htmlFor="email">Email</FormLabel>
                            <FormControl>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="johndoe@email.com"
                                    autoComplete="email"
                                    className="h-11"
                                    disabled={isLoading}
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage 
                                className="text-red-500"
                            >
                                {errors.email}
                            </FormMessage>
                          </FormItem>
                        )}
                    />                    
                </div>

                <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                    <FormItem className="space-y-2">
                        <FormLabel htmlFor="phone">Telefone</FormLabel>
                        <FormControl>
                        <Input
                            id="phone"
                            type="tel"
                            placeholder="(11) 99999-9999"
                            autoComplete="tel"
                            className="h-11"
                            {...field}
                        />
                        </FormControl>
                        <FormMessage className="text-red-500">
                        {errors.phone}
                        </FormMessage>
                    </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                    <FormItem className="space-y-2">
                        <FormLabel htmlFor="password">Nova Senha (opcional)</FormLabel>
                        <FormControl className="relative">
                            <Input
                                id="password"
                                type="password"
                                placeholder="••••••••"
                                autoComplete="new-password"
                                className="h-11"
                                {...field}
                            />
                        <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground hover:text-foreground"
                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                            {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                        </FormControl>
                        <FormMessage className="text-red-500">
                        {errors.password}
                        </FormMessage>
                        <p className="text-xs text-muted-foreground">
                            A senha deve ter pelo menos 6 caracteres, 1 número, 1 caractere especial e 1 maiúsculo.
                        </p>
                    </FormItem>
                    )}
                />

                <div className="flex items-center justify-end gap-3">
                    <Button 
                        type="button" 
                        variant="ghost" 
                        className="h-11"
                        onClick={() => {
                        if (user) {
                            form.reset({
                                fullName: user.fullName || "",
                                email: user.email || "",
                                phone: user.phone || "",
                                password: "",
                            });
                        }
                        }}
                        disabled={isLoading || isUpdating}
                    >
                        Cancelar
                    </Button>
                    <Button 
                        type="submit" 
                        className="h-11 px-6"
                        disabled={isLoading || isUpdating}
                    >
                        {isUpdating ? "Salvando..." : "Salvar alterações"}
                    </Button>
                </div>
            </form>
        </Form>
    )
}