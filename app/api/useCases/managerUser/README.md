# ManagerUser Use Case e Repository

## Visão Geral

Os métodos implementados permitem gerenciar a relação entre managers e operators no sistema.

## Funcionalidades Implementadas

### Repository (ManagerUserRepository)

1. **associateOperatorToManager(managerId, operatorId)**: Associa um operator a um manager
2. **dissociateOperatorFromManager(managerId, operatorId)**: Remove a associação entre operator e manager
3. **getOperatorsByManager(managerId)**: Lista todos os operators de um manager
4. **createManager(data)**: Cria um novo manager
5. **createOperator(data)**: Cria um novo operator associado a um manager
6. **deleteManager(managerId)**: Exclui um manager (apenas se não tiver operators ou leads)
7. **deleteOperator(operatorId)**: Exclui um operator (apenas se não tiver leads atribuídos)

### Use Case (ManagerUserUseCase)

Todas as operações incluem:
- Validação de dados de entrada
- Tratamento de erros
- Retorno padronizado usando a classe `Output`
- Logs de erro para debugging

## Validações Implementadas

### Para Managers e Operators:
- Nome completo deve ter pelo menos 2 caracteres
- Email deve ter formato válido
- Email deve ser único no sistema

### Para Operações:
- IDs devem ser UUIDs válidos
- Manager deve existir e ter role 'manager'
- Operator deve pertencer ao manager para desassociação
- Verificação de dependências antes de exclusão

## Regras de Negócio

1. **Exclusão de Manager**: Só pode ser excluído se não tiver operators associados nem leads
2. **Exclusão de Operator**: Só pode ser excluído se não tiver leads atribuídos
3. **Associação**: Operator automaticamente recebe role 'operator' ao ser associado
4. **Desassociação**: Operator mantém role mas perde a referência ao manager

## Exemplo de Uso

```typescript
// Instanciar as classes
const repository = new ManagerUserRepository();
const useCase = new ManagerUserUseCase(repository);

// Criar um manager
const managerResult = await useCase.createManager({
    fullName: "João Silva",
    email: "joao@empresa.com"
});

// Criar um operator
const operatorResult = await useCase.createOperator({
    fullName: "Maria Santos",
    email: "maria@empresa.com",
    managerId: managerResult.result.id
});

// Listar operators do manager
const operatorsResult = await useCase.getOperatorsByManager(managerResult.result.id);
```

## Tratamento de Erros

Todos os métodos retornam um objeto `Output` com:
- `isValid`: boolean indicando sucesso/falha
- `successMessages`: array de mensagens de sucesso
- `errorMessages`: array de mensagens de erro
- `result`: dados retornados (quando aplicável)