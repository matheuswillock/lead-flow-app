# 🤖 Prompts para IA/Copilot - Lead Flow

> Prompts otimizados para implementações consistentes na arquitetura Lead Flow

## 🎯 Prompt Principal para Novas Features

```
Implemente uma nova feature seguindo a arquitetura do Lead Flow App:

ARQUITETURA OBRIGATÓRIA:
- Route → UseCase → [Service opcional] → Prisma
- UseCase SEMPRE retorna Output (from @/lib/output)
- Routes fazem apenas HTTP handling
- Validações nos UseCases
- Usar interfaces para contratos

ESTRUTURA DE ARQUIVOS:
1. app/api/useCases/[feature]/I[Feature]UseCase.ts (interface)
2. app/api/useCases/[feature]/[Feature]UseCase.ts (implementação)
3. app/api/services/[Feature]Service.ts (opcional, para lógica complexa)
4. app/api/v1/[feature]/route.ts (HTTP endpoints)

PADRÃO OUTPUT OBRIGATÓRIO:
```typescript
return new Output(
  true,  // isValid: boolean
  ['Mensagem de sucesso'],  // successMessages: string[]
  [],  // errorMessages: string[]
  data  // result: any
);
```

EXEMPLO DE USECASE:
```typescript
export class [Feature]UseCase implements I[Feature]UseCase {
  async create[Feature](data: any): Promise<Output> {
    try {
      // Validações
      if (!data.required) {
        return new Output(false, [], ['Campo obrigatório'], null);
      }
      
      // Lógica (Service ou Prisma direto)
      const result = await prisma.[feature].create({ data });
      
      return new Output(true, ['Criado com sucesso'], [], result);
    } catch (error) {
      console.error('Erro:', error);
      return new Output(false, [], ['Erro interno'], null);
    }
  }
}
```

FEATURE SOLICITADA: [DESCREVER AQUI]
```

## 🎯 Prompts Específicos por Tipo

### 1. Feature CRUD Simples
```
Crie uma API CRUD completa para [ENTITY] seguindo a arquitetura Lead Flow:

REQUISITOS:
- Interface I[Entity]UseCase com métodos: create, getById, update, delete, list
- UseCase implementando a interface
- Routes GET, POST, PUT, DELETE
- Validações básicas
- Filtros para listagem
- Output pattern obrigatório

CAMPOS DA ENTIDADE:
[LISTAR CAMPOS]

VALIDAÇÕES NECESSÁRIAS:
[LISTAR VALIDAÇÕES]
```

### 2. Feature com Service Complexo
```
Implemente [FEATURE] com lógica complexa seguindo arquitetura Lead Flow:

ARQUITETURA:
Route → UseCase → Service → Prisma

RESPONSABILIDADES:
- Service: Cálculos complexos, transformações, agregações
- UseCase: Orquestração, validações, Output
- Route: HTTP handling apenas

LÓGICA COMPLEXA NECESSÁRIA:
[DESCREVER LÓGICA]

DADOS DE ENTRADA:
[DESCREVER INPUTS]

DADOS DE SAÍDA:
[DESCREVER OUTPUTS]
```

### 3. Feature de Relatórios/Analytics
```
Crie API de relatórios/analytics para [DOMAIN] seguindo Lead Flow:

ARQUITETURA OBRIGATÓRIA:
Route → UseCase → Service → Prisma (com agregações)

MÉTRICAS NECESSÁRIAS:
[LISTAR MÉTRICAS]

FILTROS:
[LISTAR FILTROS]

PERÍODO DE DADOS:
[DEFINIR PERÍODOS]

USAR COMO REFERÊNCIA:
/app/api/useCases/metrics/ (implementação existente)
```

## 🔧 Prompts para Correções

### 1. Migrar de Service Direto para UseCase
```
PROBLEMA: Esta route está chamando Service diretamente
SOLUÇÃO: Migrar para arquitetura correta Route → UseCase → Service

ARQUIVO ATUAL: [PATH]

REQUISITOS DA MIGRAÇÃO:
1. Criar I[Feature]UseCase interface
2. Criar [Feature]UseCase implementação
3. UseCase deve retornar Output
4. Route deve chamar UseCase
5. Manter lógica do Service intacta

MANTER COMPATIBILIDADE com responses existentes
```

### 2. Adicionar Validações Missing
```
PROBLEMA: UseCase sem validações adequadas
ARQUIVO: [PATH]

ADICIONAR VALIDAÇÕES:
1. Campos obrigatórios
2. Formatos de dados
3. Regras de negócio
4. Retornar Output com errorMessages apropriados

USAR PADRÃO:
```typescript
if (!data.field) {
  return new Output(false, [], ['Campo obrigatório'], null);
}
```
```

### 3. Corrigir Output Pattern
```
PROBLEMA: UseCase não retorna Output ou retorna formato incorreto
ARQUIVO: [PATH]

CORREÇÃO OBRIGATÓRIA:
- TODOS os métodos devem retornar Promise<Output>
- Usar: new Output(isValid, successMessages, errorMessages, result)
- Import: from "@/lib/output"

EXEMPLOS:
- Sucesso: new Output(true, ['Sucesso'], [], data)
- Erro: new Output(false, [], ['Erro'], null)
```

## 📝 Prompts para Documentação

### 1. Documentar Nova API
```
Crie documentação completa para a API [FEATURE] seguindo padrão Lead Flow:

INCLUIR:
1. Endpoints disponíveis
2. Parâmetros de entrada
3. Formato de resposta (Output pattern)
4. Exemplos de uso
5. Códigos de status HTTP
6. Possíveis erros

FORMATO: README.md na pasta da feature
REFERÊNCIA: /app/api/useCases/metrics/README.md
```

### 2. Atualizar Postman Collection
```
Atualize a collection Postman para incluir novos endpoints da feature [FEATURE]:

ENDPOINTS:
[LISTAR ENDPOINTS]

INCLUIR:
- Headers necessários
- Body examples
- Environment variables
- Tests básicos para status codes

ARQUIVO: /postman/[Feature]-API-Collection.json
```

## 🧪 Prompts para Testes

### 1. Criar Testes Unitários
```
Crie testes unitários para [FEATURE] UseCase seguindo padrões:

TESTAR:
1. Validações de entrada (casos inválidos)
2. Fluxo de sucesso
3. Tratamento de erros
4. Retorno de Output correto

STRUCTURE:
- Arrange: Setup data
- Act: Call UseCase method
- Assert: Verify Output format

MOCK: Services e Prisma calls
```

### 2. Testes de Integração API
```
Crie testes de integração para endpoints [FEATURE]:

TESTAR:
1. HTTP methods (GET, POST, PUT, DELETE)
2. Status codes corretos
3. Formato de resposta Output
4. Headers apropriados
5. Validação de parâmetros

USAR: Vitest ou Jest
MOCK: Database calls quando necessário
```

## 🎯 Prompt para Review de Code

```
Revise o código implementado para [FEATURE] verificando:

ARQUITETURA ✅:
- [ ] Route → UseCase → [Service] → Prisma
- [ ] Interface definida para UseCase
- [ ] UseCase retorna Output sempre
- [ ] Route faz apenas HTTP handling

PADRÕES ✅:
- [ ] Nomenclatura: I[Feature]UseCase, [Feature]UseCase
- [ ] Validações nos UseCases
- [ ] console.error para logs
- [ ] Status codes baseados em Output.isValid

QUALIDADE ✅:
- [ ] Types TypeScript corretos
- [ ] Tratamento de erros adequado
- [ ] Separação de responsabilidades
- [ ] Consistência com código existente

SUGERIR MELHORIAS se necessário
```

## 📋 Checklist de Prompt

Antes de usar qualquer prompt, certifique-se de:

- [ ] Definir claramente a feature desejada
- [ ] Especificar se precisa de Service ou não
- [ ] Listar campos/validações necessárias
- [ ] Mencionar referências no código existente
- [ ] Incluir exemplos específicos quando necessário

---

💡 **Dica**: Combine prompts quando necessário. Por exemplo: "Prompt Principal" + "Feature CRUD" para APIs completas.