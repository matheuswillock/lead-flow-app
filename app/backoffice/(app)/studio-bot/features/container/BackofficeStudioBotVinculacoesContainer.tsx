"use client"

import { useEffect } from "react"
import { Loader2, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useTimezone } from "@/app/context/TimezoneContext"
import { formatIntimezone } from "@/lib/dates/formatters"
import { maskPhone } from "@/lib/masks"
import { useBackofficeStudioBot } from "../context/BackofficeStudioBotHook"

export function BackofficeStudioBotVinculacoesContainer() {
  const { tz } = useTimezone()
  const {
    userLinks,
    isLoadingUserLinks,
    isRevokingLink,
    canManage,
    loadUserLinks,
    revokeUserLink,
    userLinksPagination,
    setUserLinksPage,
  } = useBackofficeStudioBot()

  useEffect(() => {
    void loadUserLinks()
  }, [loadUserLinks])

  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col gap-4 p-4">
      <div>
        <h1 className="text-2xl font-semibold">Vinculações</h1>
        <p className="text-sm text-muted-foreground">
          Usuários do produto com número WhatsApp vinculado à Bethânia.
        </p>
      </div>

      <div className="rounded-lg border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Vinculado em</TableHead>
              <TableHead className="w-24">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingUserLinks ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              ))
            ) : userLinks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                  Nenhum vínculo ativo
                </TableCell>
              </TableRow>
            ) : (
              userLinks.map((link) => {
                const name = link.profile.fullName ?? "—"
                const initials = name
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0] ?? "")
                  .join("")
                  .toUpperCase()
                return (
                  <TableRow key={link.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-8">
                          {link.profile.profileIconUrl ? (
                            <AvatarImage src={link.profile.profileIconUrl} alt={name} />
                          ) : null}
                          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{name}</span>
                          <span className="text-xs text-muted-foreground">
                            {link.profile.email ?? "—"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{maskPhone(link.normalizedPhone)}</TableCell>
                    <TableCell className="text-sm">{link.linkedBy}</TableCell>
                    <TableCell className="text-sm">
                      {formatIntimezone(new Date(link.linkedAt), "dd/MM/yyyy HH:mm", tz)}
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isRevokingLink}
                            >
                              <Trash2 />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revogar vínculo?</AlertDialogTitle>
                              <AlertDialogDescription>
                                O usuário precisará vincular novamente para conversar com a
                                Bethânia.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => void revokeUserLink(link.id)}
                              >
                                {isRevokingLink ? (
                                  <Loader2 className="animate-spin" data-icon="inline-start" />
                                ) : null}
                                Revogar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      {userLinksPagination.totalPages > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!userLinksPagination.hasPreviousPage}
            onClick={() => setUserLinksPage(userLinksPagination.page - 1)}
          >
            Anterior
          </Button>
          <span className="text-sm text-muted-foreground">
            Página {userLinksPagination.page} de {userLinksPagination.totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!userLinksPagination.hasNextPage}
            onClick={() => setUserLinksPage(userLinksPagination.page + 1)}
          >
            Próxima
          </Button>
        </div>
      ) : null}
    </div>
  )
}
