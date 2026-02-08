"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

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
import { ManagerUsersService } from "../services/ManagerUsersService";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>; // Simplificado para aceitar ambos os tipos
  user?: ManagerUser | null;
  loading?: boolean;
  supabaseId?: string;
  currentProfileId?: string;
}

export function UserFormDialog({
  open,
  onOpenChange,
  onSubmit,
  user = null,
  loading = false,
  supabaseId,
  currentProfileId,
}: UserFormDialogProps) {
  const { activeTeamId } = useTeamContext();
  const isEditing = !!user;
  const schema = isEditing ? UpdateManagerUserSchema : CreateManagerUserSchema;
  const [otherTeams, setOtherTeams] = React.useState<ManagerUserTeamSummary[]>([]);
  const [isLoadingTeams, setIsLoadingTeams] = React.useState(false);
  const [teamsError, setTeamsError] = React.useState<string | null>(null);

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
        }
      : {
          name: "",
          email: "",
          role: "operator",
          functions: [],
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
        });
      } else {
        form.reset({
          name: "",
          email: "",
          role: "operator",
          functions: [],
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
          setOtherTeams([]);
          setTeamsError("Selecione um time para visualizar os outros times do usuário.");
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
          setOtherTeams([]);
          setTeamsError(response.errorMessages?.join(", ") || "Erro ao carregar times.");
        }
      } catch (error) {
        if (!isActive) return;
        console.error("Erro ao carregar times do usuário:", error);
        setOtherTeams([]);
        setTeamsError("Erro ao carregar times.");
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
          `/api/v1/manager/${supabaseId}/users?email=${encodeURIComponent(nextEmail)}`,
          {
            headers: activeTeamId ? { "x-team-id": activeTeamId } : undefined,
          }
        );
        const payload = await response.json().catch(() => null);
        const isAvailable = response.ok && payload?.isValid && payload?.result?.available === true;
        if (!isAvailable) {
          toast.error(payload?.errorMessages?.join(", ") || "Email já está em uso");
          return;
        }
      }

      await onSubmit(data);
      form.reset();
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
      toast.error("Erro ao salvar usuário");
    }
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  // Verificar se é o próprio usuário editando seu papel
  const isOwnProfile = isEditing && user?.id === currentProfileId;
  const isManager = user?.role === "manager";
  const canEditRole = !isOwnProfile || !isManager;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
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
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email"
                      placeholder="usuario@exemplo.com"
                      {...field}
                      disabled={loading}
                    />
                  </FormControl>
                  <FormDescription>
                    Email usado para login e comunicações.
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
                  <FormLabel>Papel</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      {([
                        { label: "Manager", value: "manager" as const },
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
                      ? "Managers não podem alterar seu próprio papel."
                      : "Define as permissões do usuário na aplicação."
                    }
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                        <TableHead className="text-center">Reuniões realizadas</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoadingTeams ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            Carregando times...
                          </TableCell>
                        </TableRow>
                      ) : teamsError ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            {teamsError}
                          </TableCell>
                        </TableRow>
                      ) : otherTeams.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground">
                            Usuário não participa de outros times.
                          </TableCell>
                        </TableRow>
                      ) : (
                        otherTeams.map((team) => (
                          <TableRow key={team.id}>
                            <TableCell className="font-medium text-center">{team.name}</TableCell>
                            <TableCell className="text-center">{team.leadsCount ?? 0}</TableCell>
                            <TableCell className="text-center">{team.meetingsCount ?? 0}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <DialogFooter className="gap-2">
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
