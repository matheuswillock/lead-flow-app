"use client";

import { cn } from "@/lib/utils";
import { leadFormData } from "@/lib/validations/validationForms";
import { useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel } from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";

interface IUsersToAssign {
    id: string; 
    name: string; 
    avatarId: string 
}

interface ILeadFormProps {
    form: UseFormReturn<leadFormData>;
    onSubmit: (data: leadFormData) => void | Promise<void>;
    isLoading?: boolean;
    isUpdating?: boolean;
    onCancel?: () => void;
    className?: string;
    initialData?: leadFormData;
    usersToAssign?: IUsersToAssign[];
}

export function LeadForm({
    form,
    onSubmit,
    isLoading,
    isUpdating,
    onCancel,
    className,
    initialData,
    usersToAssign
}: ILeadFormProps) {
    const [hasChanges, setHasChanges] = useState(false);

    const watchedValues = form.watch();
    const isFormValid = form.formState.isValid;
    const isSubmitDisabled = !hasChanges || !isFormValid || isLoading || isUpdating;

    useEffect(() => {
        if (!initialData) return;

        const hasFormChanges = 
            watchedValues.name !== initialData.name ||
            watchedValues.email !== initialData.email ||
            watchedValues.phone !== initialData.phone ||
            watchedValues.cnpj !== initialData.cnpj ||
            watchedValues.age !== initialData.age ||
            watchedValues.hasPlan !== initialData.hasPlan ||
            watchedValues.currentValue !== initialData.currentValue ||
            watchedValues.referenceHospital !== initialData.referenceHospital ||
            watchedValues.ongoingTreatment !== initialData.ongoingTreatment ||
            watchedValues.additionalNotes !== initialData.additionalNotes ||
            watchedValues.meetingDate !== initialData.meetingDate ||
            watchedValues.responsible !== initialData.responsible;

        setHasChanges(hasFormChanges);
    }, [watchedValues, initialData]);

    return (
      <Form {...form}>
        <form
            onSubmit={form.handleSubmit(onSubmit)}
            className={cn("grid gap-4 grid-cols-1 sm:grid-cols-2", className)}
        >            
            <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel className="block text-sm font-medium mb-1">Nome Completo*</FormLabel>
                    <FormControl>
                        <Input 
                            {...field}
                            required
                            autoComplete="name"
                            placeholder="Ex: Maria da Silva" 
                            disabled={isLoading || isUpdating}
                        />
                    </FormControl>
                  </FormItem>
                )}

            />

            <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="block text-sm font-medium mb-1">Telefone*</FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                type="tel"
                                placeholder="(00) 00000-0000"
                                required
                                disabled={isLoading || isUpdating}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <FormField 
                control={form.control}
                name="email"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="block text-sm font-medium mb-1">Email*</FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                type="email"
                                placeholder="email@exemplo.com"
                                required
                                disabled={isLoading || isUpdating}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <FormField 
                control={form.control}
                name="cnpj"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="block text-sm font-medium mb-1">CNPJ</FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                type="text"
                                placeholder="Digite o CNPJ"
                                disabled={isLoading || isUpdating}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="block text-sm font-medium mb-1">Idades*</FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                type="text"
                                placeholder="Ex: 32, 29, 5"
                                required
                                disabled={isLoading || isUpdating}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <div className="sm:col-span-2">
                <FormField
                    control={form.control}
                    name="hasPlan"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="block text-sm font-medium mb-1">
                                Possui plano atualmente?*
                            </FormLabel>
                            <FormControl>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="radio"
                                            value="sim"
                                            checked={field.value === "sim"}
                                            onChange={() => field.onChange("sim")}
                                            disabled={isLoading || isUpdating}
                                            required
                                            name={field.name}
                                        />
                                        Sim
                                    </label>
                                    <label className="flex items-center gap-2 text-sm">
                                        <input
                                            type="radio"
                                            value="nao"
                                            checked={field.value === "nao"}
                                            onChange={() => field.onChange("nao")}
                                            disabled={isLoading || isUpdating}
                                            name={field.name}
                                        />
                                        Não
                                    </label>
                                </div>
                            </FormControl>
                        </FormItem>
                    )}
                />
            </div>

            <FormField 
                control={form.control}
                name="currentValue"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="block text-sm font-medium mb-1">Valor Atual*</FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                type="text"
                                placeholder="R$ 0,00"
                                required
                                disabled={isLoading || isUpdating}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="referenceHospital"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="block text-sm font-medium mb-1">
                            Hospital Referência (se houver)*
                        </FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                placeholder="Digite o hospital"
                                required
                                disabled={isLoading || isUpdating}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="ongoingTreatment"
                render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                        <FormLabel className="block text-sm font-medium mb-1">
                            Existe algum tratamento em andamento?*
                        </FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                placeholder="Descreva brevemente"
                                required
                                disabled={isLoading || isUpdating}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="additionalNotes"
                render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                        <FormLabel className="block text-sm font-medium mb-1">Observações Adicionais*</FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                placeholder="Observações relevantes"
                                required
                                disabled={isLoading || isUpdating}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="meetingDate"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="block text-sm font-medium mb-1">Data Reunião*</FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                type="date"
                                required
                                disabled={isLoading || isUpdating}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            <FormField
                control={form.control}
                name="responsible"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel className="block text-sm font-medium mb-1">Responsável</FormLabel>
                        <FormControl>
                            <select
                                {...field}
                                className="block w-full border rounded px-3 py-2"
                                disabled={isLoading || isUpdating}
                                required
                            >
                                <option value="">Selecione um responsável</option>
                                {usersToAssign?.map(user => (
                                    <option key={user.id} value={user.id}>
                                        {user.name}
                                    </option>
                                ))}
                            </select>
                        </FormControl>
                    </FormItem>
                )}
            />

            <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <Button 
                    className="cursor-pointer" 
                    type="button" 
                    variant="ghost" 
                    onClick={onCancel}
                    disabled={isLoading || isUpdating}
                >
                    Cancelar
                </Button>

                <Button 
                    type="submit" 
                    className="cursor-pointer" 
                    disabled={isSubmitDisabled}
                >
                    {isUpdating ? "Salvando..." : "Salvar"}
                </Button>
            </div>
        </form>
      </Form>
    );
}