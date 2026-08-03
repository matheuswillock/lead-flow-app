"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  CreateManagerUserSchema,
  UpdateManagerUserSchema,
  CreateManagerUserFormData,
  UpdateManagerUserFormData,
  ManagerUser,
  ManagerUserTeamSummary,
} from "../types";
import { useTeamContext } from "@/app/context/TeamContext";
import { useUserContext } from "@/app/context/UserContext";
import { ManagerUsersService } from "../services/ManagerUsersService";
import { notifyManagerUsersError } from "../utils/managerUsersErrors";
import { isManagerLikeRole } from "@/lib/roles";
import { API_CLIENT_BASE } from "@/lib/route-map";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>; // Simplificado para aceitar ambos os tipos
  user?: ManagerUser | null;
  loading?: boolean;
  supabaseId?: string;
  currentProfileId?: string;
  hasAvailableUserSlot?: boolean;
}

export function UserFormDialog({
  open,
  onOpenChange,
  onSubmit,
  user = null,
  loading = false,
  supabaseId,
  currentProfileId,
  hasAvailableUserSlot = false,
}: UserFormDialogProps) {
  const { activeTeamId } = useTeamContext();
  const { user: currentUser } = useUserContext();
  const isEditing = !!user;
  const schema = isEditing ? UpdateManagerUserSchema : CreateManagerUserSchema;
  const [otherTeams, setOtherTeams] = React.useState<ManagerUserTeamSummary[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = React.useState(false);
  const [teamsError, setTeamsError] = React.useState<string | null>(null);
  const errorContext = React.useMemo(() => ({
    supabaseId,
    teamId: activeTeamId ?? undefined,
    userId: currentProfileId,
  }), [supabaseId, activeTeamId, currentProfileId]);

  const managerUsersService = React.useMemo(() => {
    if (!supabaseId) return null;
    return new ManagerUsersService(supabaseId, activeTeamId ?? null);
  }, [supabaseId, activeTeamId]);
  
  const form = useForm<CreateManagerUserFormData | UpdateManagerUserFormData>({
    resolver: zodResolver(schema),
    defaultValues: isEditing
      ? {
          name: user?.name || "",
          email: user?.email || "",
          role: user?.role || "operator",
          functions: user?.functions || [],
          canCreateAccountUsers: user?.canCreateAccountUsers ?? false,
          canManageAccountTeams: user?.canManageAccountTeams ?? false,
          canTransferAccountLeads: user?.canTransferAccountLeads ?? false,
          canViewAllTeams: user?.canViewAllTeams ?? false,
        }
      : {
          name: "",
          email: "",
          role: "operator",
          functions: [],
          billingType: "PIX",
          canCreateAccountUsers: false,
          canManageAccountTeams: false,
          canTransferAccountLeads: false,
          canViewAllTeams: false,
        },
  });

  // Reset form quando o dialog abre/fecha ou user muda
  React.useEffect(() => {
    if (open) {
      if (isEditing && user) {
        form.reset({
          name: user.name,
          email: user.email,
          role: user.role,
          functions: user.functions || [],
          canCreateAccountUsers: user.canCreateAccountUsers ?? false,
          canManageAccountTeams: user.canManageAccountTeams ?? false,
          canTransferAccountLeads: user.canTransferAccountLeads ?? false,
          canViewAllTeams: user.canViewAllTeams ?? false,
        });
      } else {
        form.reset({
          name: "",
          email: "",
          role: "operator",
          functions: [],
          billingType: "PIX",
          canCreateAccountUsers: false,
          canManageAccountTeams: false,
          canTransferAccountLeads: false,
          canViewAllTeams: false,
        });
      }
    }
  }, [open, isEditing, user, form]);

  React.useEffect(() => {
    let isActive = true;

    const loadOtherTeams = async () => {
      if (!open || !isEditing || !user?.id) {
        if (isActive) {
          setOtherTeams([]);
          setTeamsError(null);
          setIsLoadingTeams(false);
        }
        return;
      }

      if (!managerUsersService || !activeTeamId) {
        if (isActive) {
          const message = notifyManagerUsersError({
            operation: "loadUserTeams",
            errorMessages: ["Selecione um time para visualizar os outros times do usuário."],
            context: errorContext,
          });
          setOtherTeams([]);
          setTeamsError(message);
          setIsLoadingTeams(false);
        }
        return;
      }

      setIsLoadingTeams(true);
      setTeamsError(null);

      try {
        const response = await managerUsersService.getUserTeams(user.id);
        if (!isActive) return;

        if (response.isValid && response.result) {
          setOtherTeams(response.result.teams || []);
        } else {
          const message = notifyManagerUsersError({
            operation: "loadUserTeams",
            errorMessages: response.errorMessages,
            context: errorContext,
          });
          setOtherTeams([]);
          setTeamsError(message);
        }
      } catch (error) {
        if (!isActive) return;
        console.error("Erro ao carregar times do usuário:", error);
        const message = notifyManagerUsersError({
          operation: "loadUserTeams",
          error,
          context: errorContext,
        });
        setOtherTeams([]);
        setTeamsError(message);
      } finally {
        if (isActive) {
          setIsLoadingTeams(false);
        }
      }
    };

    loadOtherTeams();
    return () => {
      isActive = false;
    };
  }, [open, isEditing, user?.id, managerUsersService, activeTeamId]);

  const handleSubmit = async (data: CreateManagerUserFormData | UpdateManagerUserFormData) => {
    try {
      const nextEmail = (data as { email?: string }).email?.trim() || "";
      const currentEmail = user?.email?.trim() || "";
      const shouldValidateEmail = !!nextEmail && supabaseId && (!isEditing || nextEmail.toLowerCase() !== currentEmail.toLowerCase());

      if (shouldValidateEmail) {
        const response = await fetch(
          `${API_CLIENT_BASE}/manager/${supabaseId}/users?email=${encodeURIComponent(nextEmail)}`,
          {
            headers: activeTeamId ? { "x-team-id": activeTeamId } : undefined,
          }
        );
        const payload = await response.json().catch(() => null);
        const isAvailable = response.ok && payload?.isValid && payload?.result?.available === true;
        if (!isAvailable) {
          notifyManagerUsersError({
            operation: "checkEmail",
            errorMessages: payload?.errorMessages?.length ? payload.errorMessages : ["E-mail já está em uso"],
            context: errorContext,
          });
          return;
        }
      }

      const selectedRole = (data as { role?: string }).role ?? user?.role ?? "operator";
      const nextData = {
        ...data,
        canCreateAccountUsers:
          currentUser?.isMaster && selectedRole === "manager"
            ? (data as CreateManagerUserFormData | UpdateManagerUserFormData).canCreateAccountUsers === true
            : undefined,
        canManageAccountTeams:
          currentUser?.isMaster && selectedRole === "manager"
            ? (data as CreateManagerUserFormData | UpdateManagerUserFormData).canManageAccountTeams === true
            : undefined,
        canTransferAccountLeads:
          currentUser?.isMaster && (selectedRole === "manager" || selectedRole === "backoffice")
            ? (data as CreateManagerUserFormData | UpdateManagerUserFormData).canTransferAccountLeads === true
            : undefined,
        canViewAllTeams:
          currentUser?.isMaster && (selectedRole === "manager" || selectedRole === "backoffice")
            ? (data as CreateManagerUserFormData | UpdateManagerUserFormData).canViewAllTeams === true
            : undefined,
      };

      await onSubmit(nextData);
      form.reset();
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
      notifyManagerUsersError({
        operation: isEditing ? "updateUser" : "createUser",
        error,
        context: errorContext,
      });
    }
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  // Verificar se é o próprio usuário editando seu nível de acesso
  const isOwnProfile = isEditing && user?.id === currentProfileId;
  const isManagerLike = isManagerLikeRole(user?.role);
  const canEditRole = !isOwnProfile || !isManagerLike;
  const selectedRole = form.watch("role");
  const showDelegatedPermissions =
    currentUser?.isMaster && (selectedRole === "manager" || selectedRole === "backoffice");
  const canEditDelegatedPermissions = showDelegatedPermissions && !isOwnProfile;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-130 max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Editar Usuário" : "Criar Novo Usuário"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as informações do usuário abaixo."
              : "Preencha os dados para criar um novo usuário."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col flex-1 min-h-0">
            <div className="overflow-y-auto flex-1 space-y-4 pr-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Digite o nome completo"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormDescription>
                    O nome como será exibido na aplicação.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="usuario@exemplo.com"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormDescription>
                    E-mail usado para login e comunicações.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nível de acesso</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      {([
                        { label: "Manager", value: "manager" as const },
                        { label: "Backoffice", value: "backoffice" as const },
                        { label: "Operator", value: "operator" as const },
                      ]).map((item) => {
                        const isChecked = field.value === item.value;
                        return (
                          <div
                            key={item.value}
                            className="flex items-center justify-between rounded-md border border-input px-3 py-2"
                          >
                            <div className="space-y-1">
                              <span className="text-sm font-medium">{item.label}</span>
                              <p className="text-xs text-muted-foreground">
                                {item.value === "manager"
                                  ? "Gerencia usuários e configurações do time."
                                  : item.value === "backoffice"
                                  ? "Acesso de gestão equivalente ao Manager (sem privilégios de master)."
                                  : "Acesso operacional aos leads e atividades do time."}
                              </p>
                            </div>
                            <Switch
                              checked={isChecked}
                              onCheckedChange={() => field.onChange(item.value)}
                              disabled={loading || !canEditRole}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </FormControl>
                    <FormDescription>
                      {!canEditRole 
                      ? "Usuários de gestão não podem alterar o próprio nível de acesso."
                      : "Define o nível de acesso do usuário na aplicação."
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!isEditing && !hasAvailableUserSlot ? (
              <FormField
                control={form.control}
                name="billingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Forma de pagamento</FormLabel>
                    <FormControl>
                      <RadioGroup
                        value={field.value ?? "PIX"}
                        onValueChange={field.onChange}
                        className="grid gap-3 rounded-md border border-input p-3 sm:grid-cols-2"
                        disabled={loading}
                      >
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="PIX" id="manager-user-billing-pix" />
                          <FormLabel htmlFor="manager-user-billing-pix">PIX</FormLabel>
                        </div>
                        <div className="flex items-center gap-2">
                          <RadioGroupItem value="CREDIT_CARD" id="manager-user-billing-card" />
                          <FormLabel htmlFor="manager-user-billing-card">Cartão de crédito</FormLabel>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormDescription>
                      Se houver cobrança adicional, o checkout será gerado no modo selecionado.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}

            <FormField
              control={form.control}
              name="functions"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Funções</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      {([
                        { label: "SDR", value: "SDR" as const },
                        { label: "Closer", value: "CLOSER" as const },
                      ]).map((item) => {
                        const current = field.value ?? [];
                        const isChecked = current.includes(item.value);
                        return (
                          <div
                            key={item.value}
                            className="flex items-center justify-between rounded-md border border-input px-3 py-2"
                          >
                            <div className="space-y-1">
                              <span className="text-sm font-medium">{item.label}</span>
                              <p className="text-xs text-muted-foreground">
                                {item.value === "SDR"
                                  ? "Pode visualizar, editar e agendar os leads."
                                  : "Mesmo acesso do SDR nos leads, mas só ele pode fechar contratos."}
                              </p>
                            </div>
                            <Switch
                              checked={isChecked}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange(Array.from(new Set([...current, item.value])));
                                } else {
                                  field.onChange(current.filter((value) => value !== item.value));
                                }
                              }}
                              disabled={loading}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </FormControl>
                  <FormDescription>
                    Selecione SDR, Closer ou ambos.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {showDelegatedPermissions ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">Permissões delegadas</p>
                  <p className="text-xs text-muted-foreground">
                    Essas permissões adicionais só podem ser atribuídas pelo master da conta.
                  </p>
                </div>

                {selectedRole === "manager" ? (
                  <>
                    <FormField
                      control={form.control}
                      name="canCreateAccountUsers"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border border-input px-3 py-3">
                          <div className="space-y-1">
                            <FormLabel className="m-0">Pode cadastrar novos usuários</FormLabel>
                            <FormDescription className="m-0">
                              Permite solicitar novos usuários da conta sujeitos à cobrança incremental.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value === true}
                              onCheckedChange={field.onChange}
                              disabled={loading || !canEditDelegatedPermissions}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="canManageAccountTeams"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-md border border-input px-3 py-3">
                          <div className="space-y-1">
                            <FormLabel className="m-0">Pode gerenciar times</FormLabel>
                            <FormDescription className="m-0">
                              Permite criar, editar e deletar times da conta, sem transferir ownership.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value === true}
                              onCheckedChange={field.onChange}
                              disabled={loading || !canEditDelegatedPermissions}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </>
                ) : null}

                <FormField
                  control={form.control}
                  name="canTransferAccountLeads"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border border-input px-3 py-3">
                      <div className="space-y-1">
                        <FormLabel className="m-0">Pode transferir leads entre times</FormLabel>
                        <FormDescription className="m-0">
                          Permite repassar leads para outro time da mesma conta e concluir a transferência com pré-agendamento.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === true}
                          onCheckedChange={field.onChange}
                          disabled={loading || !canEditDelegatedPermissions}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="canViewAllTeams"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-md border border-input px-3 py-3">
                      <div className="space-y-1">
                        <FormLabel className="m-0">Pode visualizar todos os times</FormLabel>
                        <FormDescription className="m-0">
                          Permite ver métricas do Dashboard e Performance de todos os times da conta. Válido somente para este time.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === true}
                          onCheckedChange={field.onChange}
                          disabled={loading || !canEditDelegatedPermissions}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {!canEditDelegatedPermissions ? (
                  <p className="text-xs text-muted-foreground">
                    Você não pode alterar as próprias permissões delegadas.
                  </p>
                ) : null}
              </div>
            ) : null}

            {isEditing && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Times do usuário</h4>
                  <p className="text-xs text-muted-foreground">
                    Times em que o usuário participa, com leads sob responsabilidade e reuniões realizadas.
                  </p>
                </div>
                <div className="rounded-md border border-input">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-center">Time</TableHead>
                        <TableHead className="text-center">Leads</TableHead>
                        <TableHead className="text-center">Agendados</TableHead>
                        <TableHead className="text-center">Reuniões realizadas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingTeams ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Carregando times...
                          </TableCell>
                        </TableRow>
                      ) : teamsError ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            {teamsError}
                          </TableCell>
                        </TableRow>
                      ) : otherTeams.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">
                            Usuário não participa de nenhum time.
                          </TableCell>
                        </TableRow>
                      ) : (
                        otherTeams.map((team) => (
                          <TableRow key={team.id}>
                            <TableCell className="font-medium text-center">{team.name}</TableCell>
                            <TableCell className="text-center">{team.leadsCount ?? 0}</TableCell>
                            <TableCell className="text-center">{team.scheduledLeadsCount ?? 0}</TableCell>
                            <TableCell className="text-center">{team.meetingsCount ?? 0}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
            </div>

            <DialogFooter className="gap-2 pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                    disabled={loading}
                    className="cursor-pointer font-medium"
                >
                    Cancelar
                </Button>
                <Button 
                    type="submit" 
                    disabled={loading} 
                    className="cursor-pointer font-medium"
                >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isEditing ? "Atualizar" : "Criar"} Usuário
                </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
