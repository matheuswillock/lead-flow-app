import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Filter, ScrollText, User, Plus } from "lucide-react";
import useBoardContext from "../context/BoardHook";

export default function BoardHeader() {
    const { 
        query, 
        setQuery, 
        periodStart, 
        setPeriodStart, 
        periodEnd, 
        setPeriodEnd, 
        assignedUser, 
        setAssignedUser, 
        taskOwners: responsaveis,
        user,
        userLoading,
        data,
        isLoading,
        openNewLeadDialog
    } = useBoardContext();

    // Calcular total de leads
    const totalLeads = Object.values(data).flat().length;

    return (
      <div className="flex flex-wrap items-center gap-2">
        <ScrollText className="size-5" />
        <h1 className="text-xl font-semibold">Kanban de Leads</h1>
        
        {/* Informações do usuário e status */}
        {userLoading ? (
          <div className="ml-2 text-sm text-muted-foreground">Carregando usuário...</div>
        ) : user ? (
          <div className="ml-2 flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <User className="size-4" />
              <span>{user.email} ({user.role})</span>
            </div>
            <div className="flex items-center gap-2">
              <span>•</span>
              <span>{isLoading ? 'Carregando...' : `${totalLeads} leads`}</span>
            </div>
          </div>
        ) : null}
        
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2 top-2.5 size-4 opacity-70" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou data (dd/mm/aaaa)"
              className="pl-8 w-96"
            />
          </div>

          {/* Filtro por período */}
          <div className="flex items-center gap-2">
            <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="w-40" />
            <span className="text-sm text-muted-foreground">até</span>
            <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="w-40" />
          </div>

          {/* Filtro por responsável */}
          <Select value={assignedUser} onValueChange={setAssignedUser}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              {responsaveis.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="size-6">
                      <AvatarImage src={r.avatarUrl || undefined} alt={r.name} />
                      <AvatarFallback className="text-xs">
                        {r.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{r.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button 
            onClick={openNewLeadDialog}
            className="ml-2 cursor-pointer"
          >
            <Plus className="mr-2 size-4" />
            Adicionar novo lead
          </Button>
        </div>
      </div>
    );
}
