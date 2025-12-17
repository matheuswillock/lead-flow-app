"use client";

import { UseFormReturn } from "react-hook-form";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "@/lib/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form";
import { Eye, EyeOff } from "lucide-react";
import { useState, useEffect } from "react";
import { updateAccountFormData } from "@/lib/validations/validationForms";
import { maskPhone, maskCPFOrCNPJ, maskCEP, unmask } from "@/lib/masks";

interface AccountFormProps {
  form: UseFormReturn<updateAccountFormData>;
  onSubmit: (data: updateAccountFormData) => void | Promise<void>;
  isLoading?: boolean;
  isUpdating?: boolean;
  onCancel?: () => void;
  className?: string;
  initialData?: updateAccountFormData;
  showPasswordField?: boolean;
}

export function AccountForm({
  className,
  form,
  onSubmit,
  isLoading = false,
  isUpdating = false,
  onCancel,
  initialData,
  showPasswordField = false,
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
      watchedValues.cpfCnpj !== initialData.cpfCnpj ||
      watchedValues.postalCode !== initialData.postalCode ||
      watchedValues.address !== initialData.address ||
      watchedValues.addressNumber !== initialData.addressNumber ||
      watchedValues.complement !== initialData.complement ||
      watchedValues.city !== initialData.city ||
      watchedValues.state !== initialData.state ||
      (showPasswordField && Boolean(watchedValues.password && watchedValues.password.length > 0));

    setHasChanges(hasFormChanges);
  }, [watchedValues, initialData, showPasswordField]);

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
        </div>

        <FormField
          control={form.control}
          name="cpfCnpj"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <FormLabel>CPF/CNPJ (opcional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="000.000.000-00 ou 00.000.000/0000-00"
                  className="h-11"
                  disabled={isLoading || isUpdating}
                  {...field}
                  value={maskCPFOrCNPJ(field.value || "")}
                  onChange={(e) => {
                    const masked = maskCPFOrCNPJ(e.target.value);
                    const unmasked = unmask(masked);
                    field.onChange(unmasked);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Endereço (opcional)</h3>
          
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>CEP</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="00000-000"
                      className="h-11"
                      disabled={isLoading || isUpdating}
                      {...field}
                      value={maskCEP(field.value || "")}
                      onChange={(e) => {
                        const masked = maskCEP(e.target.value);
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
              name="city"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Cidade</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Sua cidade"
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
            name="address"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel>Endereço</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Rua, avenida, etc"
                    className="h-11"
                    disabled={isLoading || isUpdating}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-6 sm:grid-cols-3">
            <FormField
              control={form.control}
              name="addressNumber"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Número</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="123"
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
              name="complement"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Complemento</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Apto, sala, etc"
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
              name="state"
              render={({ field }) => (
                <FormItem className="space-y-2">
                  <FormLabel>Estado</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="SP"
                      className="h-11"
                      maxLength={2}
                      disabled={isLoading || isUpdating}
                      {...field}
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {showPasswordField && (
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
        )}

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