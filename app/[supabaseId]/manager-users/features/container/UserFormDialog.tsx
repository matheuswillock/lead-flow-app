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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  CreateManagerUserSchema,
  UpdateManagerUserSchema,
  CreateManagerUserFormData,
  UpdateManagerUserFormData,
  ManagerUser,
} from "../types";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => Promise<void>; // Simplificado para aceitar ambos os tipos
  user?: ManagerUser | null;
  loading?: boolean;
  currentUserId?: string;
}

export function UserFormDialog({
  open,
  onOpenChange,
  onSubmit,
  user = null,
  loading = false,
  currentUserId,
}: UserFormDialogProps) {
  const isEditing = !!user;
  const schema = isEditing ? UpdateManagerUserSchema : CreateManagerUserSchema;
  
  const form = useForm<CreateManagerUserFormData | UpdateManagerUserFormData>({
    resolver: zodResolver(schema),
    defaultValues: isEditing
      ? {
          name: user?.name || "",
          email: user?.email || "",
          role: user?.role || "operator",
        }
      : {
          name: "",
          email: "",
          role: "operator",
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
        });
      } else {
        form.reset({
          name: "",
          email: "",
          role: "operator",
        });
      }
    }
  }, [open, isEditing, user, form]);

  const handleSubmit = async (data: CreateManagerUserFormData | UpdateManagerUserFormData) => {
    try {
      await onSubmit(data);
      form.reset();
    } catch (error) {
      console.error("Erro ao salvar usuário:", error);
    }
  };

  const handleCancel = () => {
    form.reset();
    onOpenChange(false);
  };

  // Verificar se é o próprio usuário editando seu papel
  const isOwnProfile = isEditing && user?.id === currentUserId;
  const isManager = user?.role === "manager";
  const canEditRole = !isOwnProfile || !isManager;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
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
                  <Select 
                    onValueChange={field.onChange} 
                    defaultValue={field.value}
                    disabled={loading || !canEditRole}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o papel" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="operator">Operator</SelectItem>
                    </SelectContent>
                  </Select>
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