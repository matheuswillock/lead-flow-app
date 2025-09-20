import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, ScrollText, User, RefreshCw } from "lucide-react";
import useBoardContext from "../context/BoardHook";
import { createBoardService } from "../services/BoardService";

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
        responsaveis,
        user,
        userLoading,
        data,
        isLoading
    } = useBoardContext();

    // Calcular total de leads
    const totalLeads = Object.values(data).flat().length;

    // Função de teste para forçar carregamento
    const handleTestLoad = async () => {
        if (!user?.id) {
            console.warn('🧪 TESTE MANUAL: Usuário não disponível');
            return;
        }
        
        console.info('🧪 TESTE MANUAL: Iniciando carregamento forçado...');
        console.info('🧪 TESTE MANUAL: User ID:', user.id, 'Role:', user.role);

        try {
            const service = createBoardService();
            const result = await service.fetchLeads(user.id ?? "", user.role ?? "");
            console.info('🧪 TESTE MANUAL: Resultado completo:', result);
            
            if (result.isValid && result.result) {
                console.info('🧪 TESTE MANUAL: Dados válidos! Estrutura:', result.result);
                // Force update the data in the context by calling a refresh or similar
            } else {
                console.warn('🧪 TESTE MANUAL: Dados inválidos:', result);
            }
        } catch (error) {
            console.error('🧪 TESTE MANUAL: Erro:', error);
        }
    };

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
            <Button
              onClick={handleTestLoad}
              size="sm"
              variant="outline"
              className="flex items-center gap-1"
            >
              <RefreshCw className="size-3" />
              Teste Load
            </Button>
          </div>
        ) : null}
        
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2 top-2.5 size-4 opacity-70" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nome ou data (dd/mm/aaaa)"
              className="pl-8 w-64"
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
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os responsáveis</SelectItem>
              {responsaveis.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    );
}
