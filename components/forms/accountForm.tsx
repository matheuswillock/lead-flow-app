"use client";

import { UseFormReturn } from "react-hook-form";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { updateAccountFormData } from "@/lib/validations/validationForms";
import { maskPhone, unmask } from "@/lib/masks";

interface AccountFormProps {
  form: UseFormReturn<updateAccountFormData>;
  onSubmit: (data: updateAccountFormData) => void | Promise<void>;
  isLoading?: boolean;
  isUpdating?: boolean;
  onCancel?: () => void;
  className?: string;
  initialData?: updateAccountFormData;
}

export function AccountForm({
  className,
  form,
  onSubmit,
  isLoading = false,
  isUpdating = false,
  onCancel,
  initialData,
}: AccountFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const watchedValues = form.watch();

  useEffect(() => {
    if (!initialData) return;

    const hasFormChanges = 
      watchedValues.fullName !== initialData.fullName ||
      watchedValues.email !== initialData.email ||
      watchedValues.phone !== initialData.phone ||
      Boolean(watchedValues.password && watchedValues.password.length > 0);

    setHasChanges(hasFormChanges);
  }, [watchedValues, initialData]);

  const isFormValid = form.formState.isValid;
  
  const isSubmitDisabled = !hasChanges || !isFormValid || isLoading || isUpdating;

  return (
    <Form {...form}>
      <form 
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn("space-y-6", className)}
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="fullName"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Seu nome completo"
                    autoComplete="name"
                    className="h-11"
                    disabled={isLoading || isUpdating}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="johndoe@email.com"
                    autoComplete="email"
                    className="h-11"
                    disabled={isLoading || isUpdating}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />                    
        </div>

        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>Telefone</FormLabel>
              <FormControl>
                <Input
                  type="tel"
                  placeholder="(11) 99999-9999"
                  autoComplete="tel"
                  className="h-11"
                  disabled={isLoading || isUpdating}
                  {...field}
                  value={maskPhone(field.value)}
                  onChange={(e) => {
                    const masked = maskPhone(e.target.value);
                    const unmasked = unmask(masked);
                    field.onChange(unmasked);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>Nova Senha (opcional)</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="h-11 pr-12"
                    disabled={isLoading || isUpdating}
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
                </div>
              </FormControl>
              <FormMessage />
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
            className="h-11 cursor-pointer"
            onClick={onCancel}
            disabled={isLoading || isUpdating}
          >
            Cancelar
          </Button>
          <Button 
            type="submit" 
            className="h-11 px-6"
            disabled={isSubmitDisabled}
          >
            {isUpdating ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </form>
    </Form>
  );
}