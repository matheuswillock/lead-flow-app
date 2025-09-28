# 📚 Lead Flow - Documentação Completa

> Central de documentação para desenvolvimento e arquitetura

## 📖 Documentos Disponíveis

### 🏗️ Arquitetura
- **[ARCHITECTURE_GUIDE.md](./ARCHITECTURE_GUIDE.md)** - Guia completo da arquitetura Clean
- **[IMPLEMENTATION_EXAMPLES.md](./IMPLEMENTATION_EXAMPLES.md)** - Exemplos práticos baseados no código
- **[AI_PROMPTS.md](./AI_PROMPTS.md)** - Prompts otimizados para IA/Copilot

### 🔧 Específicos
- **[CI_CD_CONFIG.md](./CI_CD_CONFIG.md)** - Configuração de deploy e CI/CD
- **[RESEND_INTEGRATION.md](./RESEND_INTEGRATION.md)** - Integração com serviço de email

## 🎯 Quick Start para Desenvolvimento

### 1. Nova Feature Simples
```bash
# Usar prompt do AI_PROMPTS.md
# Estrutura: Route → UseCase → Prisma
```

### 2. Nova Feature Complexa
```bash
# Usar prompt do AI_PROMPTS.md
# Estrutura: Route → UseCase → Service → Prisma
```

### 3. Referências no Código
- **Metrics API**: `/app/api/useCases/metrics/` - Exemplo completo
- **Profile API**: `/app/api/useCases/profiles/` - Exemplo com repository
- **Output Class**: `/lib/output/index.ts` - Tipo padrão

## 🏛️ Arquitetura Resumida

```
Route (HTTP) → UseCase (Business + Output) → Service (Logic) → Prisma (Data)
```

### Responsabilidades
- **Route**: Parsing HTTP, status codes
- **UseCase**: Validações, orquestração, **criação do Output**
- **Service**: Lógica complexa, cálculos
- **Prisma**: Acesso aos dados

### Output Padrão
```typescript
new Output(isValid, successMessages, errorMessages, result)
```

## 🔄 Workflows

### Implementação
1. Interface UseCase → Implementação → Service (opcional) → Route
2. Testar endpoints
3. Documentar se necessário
4. Adicionar ao Postman

### Review
1. Verificar arquitetura (ARCHITECTURE_GUIDE.md)
2. Usar prompts de review (AI_PROMPTS.md)
3. Validar exemplos (IMPLEMENTATION_EXAMPLES.md)

## 🚀 Comandos Principais

```bash
bun run dev              # Desenvolvimento
bun run typecheck        # Verificar tipos
bun run lint             # Linting
bun run prisma:studio    # Interface do banco
```

---

💡 **Para desenvolvedores**: Comece pelo [ARCHITECTURE_GUIDE.md](./ARCHITECTURE_GUIDE.md) e use os prompts do [AI_PROMPTS.md](./AI_PROMPTS.md)