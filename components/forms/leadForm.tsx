"use client";

import { cn } from "@/lib/utils";
import { leadFormData } from "@/lib/validations/validationForms";
import { useEffect, useState } from "react";
import { UseFormReturn } from "react-hook-form";
import { Form, FormControl, FormField, FormItem, FormLabel } from "../ui/form";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

interface IUsersToAssign {
    id: string; 
    name: string; 
    avatarImageUrl: string;
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

    // Auto-select responsible when there's only one user available
    useEffect(() => {
        if (usersToAssign?.length === 1 && !form.getValues('responsible')) {
            form.setValue('responsible', usersToAssign[0].id);
        }
    }, [usersToAssign, form]);

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
                    <FormItem className="sm:col-span-2">
                        <FormLabel className="block text-sm font-medium mb-1">Faixas Etárias*</FormLabel>
                        <FormControl>
                            <div className="space-y-3">
                                {/* Input que mostra as seleções */}
                                <Input
                                    value={field.value?.join(", ") || ""}
                                    placeholder="Selecione as faixas etárias abaixo"
                                    readOnly
                                    disabled={isLoading || isUpdating}
                                    className="bg-gray-50"
                                />
                                
                                {/* Checkboxes para seleção múltipla */}
                                <div className="grid grid-cols-2 gap-2">
                                    {[
                                        { value: "0-18", label: "0-18 anos" },
                                        { value: "19-25", label: "19-25 anos" },
                                        { value: "26-35", label: "26-35 anos" },
                                        { value: "36-45", label: "36-45 anos" },
                                        { value: "46-60", label: "46-60 anos" },
                                        { value: "61+", label: "61+ anos" }
                                    ].map((option) => (
                                        <label key={option.value} className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={field.value?.includes(option.value as any) || false}
                                                onChange={(e) => {
                                                    const currentValues = field.value || [];
                                                    if (e.target.checked) {
                                                        field.onChange([...currentValues, option.value]);
                                                    } else {
                                                        field.onChange(currentValues.filter(v => v !== option.value));
                                                    }
                                                }}
                                                disabled={isLoading || isUpdating}
                                                className="rounded"
                                            />
                                            {option.label}
                                        </label>
                                    ))}
                                </div>
                            </div>
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
                render={({ field }) => {
                    const selectedUser = usersToAssign?.find(user => user.id === field.value);
                    const isOnlyOneUser = usersToAssign?.length === 1;
                    
                    return (
                        <FormItem>
                            <FormLabel className="block text-sm font-medium mb-1">
                                Responsável{isOnlyOneUser && " (único disponível)"}
                            </FormLabel>
                            <FormControl>
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={isLoading || isUpdating || isOnlyOneUser}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione um responsável">
                                            {selectedUser && (
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-5 w-5">
                                                        <AvatarImage 
                                                            src={selectedUser.avatarImageUrl || undefined} 
                                                        />
                                                        <AvatarFallback className="text-xs">
                                                            {selectedUser.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="truncate">{selectedUser.name}</span>
                                                </div>
                                            )}
                                        </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {usersToAssign?.map(user => (
                                            <SelectItem key={user.id} value={user.id}>
                                                <div className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarImage 
                                                            src={user.avatarImageUrl || undefined} 
                                                        />
                                                        <AvatarFallback className="text-xs">
                                                            {user.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span>{user.name}</span>
                                                </div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </FormControl>
                        </FormItem>
                    );
                }}
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