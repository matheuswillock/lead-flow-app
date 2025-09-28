# 📋 Guia Rápido: Novos Componentes Frontend

> Referência rápida para implementar componentes seguindo arquitetura Lead Flow

## 🎯 Comando para IA/Copilot

```
Crie um componente frontend completo para [FEATURE] seguindo a arquitetura Lead Flow:

ESTRUTURA OBRIGATÓRIA:
app/[supabaseId]/[feature]/
├── page.tsx (Provider + Layout)
└── features/
    ├── container/ (Componentes apresentação)
    ├── context/ (Context SOLID: Types → Hook → Context)  
    ├── services/ (Interface + Service)
    └── hooks/ (opcional)

IMPLEMENTAR:
1. [Feature]Types.ts - Interfaces (State, Actions, Context)
2. [Feature]Hook.ts - Lógica com useCallback
3. [Feature]Context.tsx - Provider com useParams  
4. I[Feature]Service.ts + [Feature]Service.ts - API calls
5. [Feature]Container.tsx - Componente principal
6. page.tsx - Página com Provider

PADRÕES:
- Context SOLID (separação de responsabilidades)
- useParams para supabaseId automático
- Service com tratamento Output
- Loading/error states
- TypeScript completo
- Shadcn/ui components

REFERÊNCIAS:
- /app/[supabaseId]/dashboard/ (Context SOLID)
- /app/[supabaseId]/board/ (Container patterns)

FUNCIONALIDADE: [DESCREVER AQUI]
```

## 🏗️ Estrutura de Arquivos

```
app/[supabaseId]/[feature]/
├── page.tsx                     # ✅ Provider + Layout
└── features/
    ├── container/               # ✅ Componentes UI
    │   ├── [Feature]Container.tsx   # Principal
    │   ├── [Feature]Header.tsx      # Cabeçalho
    │   ├── [Feature]Dialog.tsx      # Modal
    │   └── [Feature]List.tsx        # Lista
    ├── context/                 # ✅ Context SOLID
    │   ├── [Feature]Types.ts        # Interfaces
    │   ├── [Feature]Hook.ts         # Lógica
    │   └── [Feature]Context.tsx     # Provider
    ├── services/                # ✅ Service Layer
    │   ├── I[Feature]Service.ts     # Interface
    │   └── [Feature]Service.ts      # Implementação
    └── hooks/                   # ⚪ Opcional
        └── use[Feature].ts
```

## ⚡ Templates Rápidos

### Context Types
```typescript
export interface I[Feature]State {
  items: [Feature][];
  isLoading: boolean;
  error: string | null;
}

export interface I[Feature]Actions {
  fetchItems: () => Promise<void>;
  createItem: (data: any) => Promise<void>;
}

export interface I[Feature]Context extends I[Feature]State, I[Feature]Actions {}
```

### Hook Pattern
```typescript
export function use[Feature]Hook({ supabaseId, service }: Props) {
  const [state, setState] = useState(initialState);
  
  const fetchItems = useCallback(async () => {
    // lógica com service
  }, [service]);
  
  return { ...state, fetchItems };
}
```

### Context Provider
```typescript
export const [Feature]Provider: React.FC<Props> = ({ children }) => {
  const params = useParams();
  const supabaseId = params.supabaseId as string;
  
  const contextState = use[Feature]Hook({ supabaseId, service });
  
  return (
    <[Feature]Context.Provider value={contextState}>
      {children}
    </[Feature]Context.Provider>
  );
};
```

### Service Implementation
```typescript
export class [Feature]Service implements I[Feature]Service {
  private baseUrl = '/api/v1/[feature]';
  
  async getItems(): Promise<Item[]> {
    const response = await fetch(this.baseUrl);
    const result = await response.json();
    
    if (!result.isValid) {
      throw new Error(result.errorMessages.join(', '));
    }
    
    return result.result;
  }
}

export const [feature]Service = new [Feature]Service();
```

### Container Component
```typescript
export function [Feature]Container() {
  const { items, isLoading, error, fetchItems } = use[Feature]Context();

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorComponent error={error} onRetry={fetchItems} />;

  return (
    <div className="space-y-6">
      <[Feature]Header />
      <[Feature]List items={items} />
    </div>
  );
}
```

### Page Setup
```typescript
export default function [Feature]Page() {
  return (
    <[Feature]Provider>
      <div className="container mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold">[Feature Title]</h1>
        <[Feature]Container />
      </div>
    </[Feature]Provider>
  );
}
```

## ✅ Checklist Rápido

### Context SOLID
- [ ] Types.ts com interfaces separadas
- [ ] Hook.ts com useCallback
- [ ] Context.tsx com useParams
- [ ] Hook consumidor

### Service Pattern  
- [ ] Interface definida
- [ ] Implementação com fetch
- [ ] Tratamento Output
- [ ] Instância singleton

### Components
- [ ] Container principal
- [ ] Loading states
- [ ] Error handling
- [ ] Responsivo

### Integration
- [ ] Provider na página
- [ ] Context consumido
- [ ] Service integrado
- [ ] TypeScript OK

## 🚀 Próximos Passos

1. ✅ Implementar estrutura
2. ⚪ Criar API backend
3. ⚪ Adicionar testes
4. ⚪ Documentar

---

📚 **Referências:**
- [Exemplo Completo](./FRONTEND_IMPLEMENTATION_EXAMPLE.md)
- [AI Prompts](./AI_PROMPTS.md)
- [Architecture Guide](./ARCHITECTURE_GUIDE.md)