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
import { DateTimePicker } from "../ui/date-time-picker";
import { UserAssociated } from "@/app/api/v1/profiles/DTO/profileResponseDTO";
import { maskPhone, maskCNPJ, unmask } from "@/lib/masks";
import { AttachmentList } from "../ui/attachment-list";

const formatCurrency = (value: string): string => {
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue === '') return '';
    
    const numberValue = parseInt(cleanValue) / 100;
    return `R$ ${numberValue.toLocaleString('pt-BR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    })}`;
};

export interface ILeadFormProps {
    form: UseFormReturn<leadFormData>;
    onSubmit: (data: leadFormData) => void | Promise<void>;
    isLoading?: boolean;
    isUpdating?: boolean;
    onCancel: () => void;
    className?: string;
    initialData?: leadFormData;
    usersToAssign: UserAssociated[];
    leadId?: string; // ID do lead para exibir attachments (apenas em modo de edição)
}

export function LeadForm({
    form,
    onSubmit,
    isLoading,
    isUpdating,
    onCancel,
    className,
    initialData,
    usersToAssign,
    leadId
}: ILeadFormProps) {
    const [hasChanges, setHasChanges] = useState(false);

    const watchedValues = form.watch();
    const isFormValid = form.formState.isValid;
    const isSubmitDisabled = !hasChanges || !isFormValid || isLoading || isUpdating;

    useEffect(() => {
        if (!initialData) {
            const hasAnyData = 
                (watchedValues.name && watchedValues.name.trim() !== '') ||
                (watchedValues.email && watchedValues.email.trim() !== '') ||
                (watchedValues.phone && watchedValues.phone.trim() !== '') ||
                (watchedValues.cnpj && watchedValues.cnpj.trim() !== '') ||
                (watchedValues.age && watchedValues.age.length > 0) ||
                (watchedValues.currentHealthPlan && watchedValues.currentHealthPlan.trim() !== '') ||
                (watchedValues.currentValue && watchedValues.currentValue.trim() !== '') ||
                (watchedValues.referenceHospital && watchedValues.referenceHospital.trim() !== '') ||
                (watchedValues.ongoingTreatment && watchedValues.ongoingTreatment.trim() !== '') ||
                (watchedValues.additionalNotes && watchedValues.additionalNotes.trim() !== '') ||
                (watchedValues.meetingDate && watchedValues.meetingDate.trim() !== '') ||
                (watchedValues.responsible && watchedValues.responsible.trim() !== '');

            setHasChanges(!!hasAnyData);
            return;
        }

        // Modo de edição - verificar se há mudanças em relação aos dados iniciais
        const hasFormChanges = 
            watchedValues.name !== initialData.name ||
            watchedValues.email !== initialData.email ||
            watchedValues.phone !== initialData.phone ||
            watchedValues.cnpj !== initialData.cnpj ||
            watchedValues.age !== initialData.age ||
            watchedValues.currentHealthPlan !== initialData.currentHealthPlan ||
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
                                value={maskPhone(field.value || '')}
                                onChange={(e) => {
                                    const masked = maskPhone(e.target.value);
                                    const unmasked = unmask(masked);
                                    field.onChange(unmasked);
                                }}
                                type="tel"
                                placeholder="(11) 91234-1234"
                                required
                                disabled={isLoading || isUpdating}
                                maxLength={15}
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
                                value={maskCNPJ(field.value || '')}
                                onChange={(e) => {
                                    const masked = maskCNPJ(e.target.value);
                                    const unmasked = unmask(masked);
                                    field.onChange(unmasked);
                                }}
                                type="text"
                                placeholder="00.000.000/0000-00"
                                disabled={isLoading || isUpdating}
                                maxLength={18}
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
                            <div className="space-y-2">
                                <Input
                                    value={field.value || ""}
                                    onChange={(e) => {
                                        let value = e.target.value;
                                        
                                        // Remove caracteres que não são números, vírgulas ou espaços
                                        value = value.replace(/[^0-9,\s]/g, '');
                                        
                                        // Remove vírgulas e espaços para processar
                                        const cleanValue = value.replace(/[,\s]/g, '');
                                        
                                        // Divide em grupos de idades
                                        const groups: string[] = [];
                                        let currentGroup = '';
                                        
                                        for (let i = 0; i < cleanValue.length; i++) {
                                            const char = cleanValue[i];
                                            currentGroup += char;
                                            
                                            // Se o primeiro dígito é 1, permite até 3 dígitos (100-120)
                                            if (currentGroup[0] === '1') {
                                                if (currentGroup.length === 3) {
                                                    // Valida se não ultrapassa 120
                                                    const age = parseInt(currentGroup);
                                                    if (age > 120) {
                                                        currentGroup = '120';
                                                    }
                                                    groups.push(currentGroup);
                                                    currentGroup = '';
                                                }
                                            } else {
                                                // Para outros números, aceita apenas 2 dígitos
                                                if (currentGroup.length === 2) {
                                                    groups.push(currentGroup);
                                                    currentGroup = '';
                                                }
                                            }
                                        }
                                        
                                        // Adiciona o último grupo se existir
                                        if (currentGroup) {
                                            groups.push(currentGroup);
                                        }
                                        
                                        // Junta os grupos com vírgula e espaço
                                        const formattedValue = groups.join(', ');
                                        
                                        field.onChange(formattedValue);
                                    }}
                                    placeholder="Ex: 36, 32, 13"
                                    disabled={isLoading || isUpdating}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Exemplo: 36, 32, 13, 100, 120 (idades até 120 anos, separadas automaticamente)
                                </p>
                            </div>
                        </FormControl>
                    </FormItem>
                )}
            />

            <div className="sm:col-span-2">
                <FormField
                    control={form.control}
                    name="currentHealthPlan"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="block text-sm font-medium mb-1">
                                Qual o plano de saúde?*
                            </FormLabel>
                            <FormControl>
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={isLoading || isUpdating}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecione o plano atual ou 'Nova Adesão' se não possui" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="NOVA_ADESAO">Nova Adesão</SelectItem>
                                        <SelectItem value="AMIL">Amil</SelectItem>
                                        <SelectItem value="BRADESCO">Bradesco</SelectItem>
                                        <SelectItem value="HAPVIDA">Hapvida</SelectItem>
                                        <SelectItem value="MEDSENIOR">MedSênior</SelectItem>
                                        <SelectItem value="GNDI">NotreDame Intermédica (GNDI)</SelectItem>
                                        <SelectItem value="OMINT">Omint</SelectItem>
                                        <SelectItem value="PLENA">Plena</SelectItem>
                                        <SelectItem value="PORTO_SEGURO">Porto Seguro</SelectItem>
                                        <SelectItem value="PREVENT_SENIOR">Prevent Senior</SelectItem>
                                        <SelectItem value="SULAMERICA">SulAmérica</SelectItem>
                                        <SelectItem value="UNIMED">Unimed</SelectItem>
                                        <SelectItem value="OUTROS">Outros</SelectItem>
                                    </SelectContent>
                                </Select>
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
                                value={field.value || ''}
                                onChange={(e) => {
                                    const formatted = formatCurrency(e.target.value);
                                    field.onChange(formatted);
                                }}
                                type="text"
                                placeholder="R$ 10,00"
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
                        <FormLabel className="block text-sm font-medium mb-1">Observações Adicionais</FormLabel>
                        <FormControl>
                            <Input
                                {...field}
                                placeholder="Observações relevantes"
                                disabled={isLoading || isUpdating}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />

            {/* Data, Horário e Responsável em uma linha no desktop */}
            <div className="sm:col-span-2 flex flex-col sm:flex-row gap-4">
                <FormField
                    control={form.control}
                    name="meetingDate"
                    render={({ field }) => (
                        <FormItem className="sm:flex-shrink-0">
                            <FormControl>
                                <DateTimePicker
                                    date={field.value ? new Date(field.value) : undefined}
                                    onDateChange={(date) => {
                                        field.onChange(date ? date.toISOString() : '');
                                    }}
                                    label="Data e Horário da Reunião"
                                    disabled={isLoading || isUpdating}
                                    disablePastDates={true}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="responsible"
                    render={({ field }) => {
                        const selectedValue = field.value || (usersToAssign?.[0]?.id ?? "");
                        const selectedUser = usersToAssign?.find(user => user.id === selectedValue);
                        const isOnlyOneUser = usersToAssign?.length === 1;
                        useEffect(() => {
                            if (!field.value && usersToAssign?.length > 0) {
                                field.onChange(usersToAssign[0].id);
                            }
                        }, [usersToAssign, field.value, field.onChange]);

                        return (
                            <FormItem className="flex flex-col sm:flex-1">
                                <FormLabel className="text-sm font-medium">
                                    Responsável{isOnlyOneUser && " (único disponível)"}
                                </FormLabel>
                                <FormControl>
                                    <Select
                                        value={selectedValue}
                                        onValueChange={field.onChange}
                                        disabled={isLoading || isUpdating}
                                    >
                                        <SelectTrigger className="h-9">
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
            </div>

            {/* Seção de Attachments - exibir apenas em modo de edição */}
            {leadId && (
                <div className="sm:col-span-2 pt-4 border-t">
                    <AttachmentList leadId={leadId} />
                </div>
            )}

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