# 🧪 Guia Rápido de Testes - Tratamento de Erros Específicos

## 🎯 Objetivo do Teste

Validar que o sistema exibe mensagens de erro específicas e acionáveis quando o usuário tenta criar um lead duplicado ou com dados inválidos.

---

## 📋 Checklist de Testes

### ✅ Teste 1: Lead Duplicado (Unique Constraint)

**Objetivo:** Verificar detecção de telefone duplicado

**Passos:**

1. Acesse o Board de Leads
2. Clique em "Criar Lead"
3. Preencha o formulário:
   - Nome: João Silva
   - Telefone: (11) 98370-9746
   - Email: joao@teste.com
4. Clique em "Salvar"
5. ✅ **Aguarde toast de sucesso** → "Lead "João Silva" criado com sucesso!"
6. Clique novamente em "Criar Lead"
7. Preencha o formulário com **MESMO TELEFONE**:
   - Nome: Maria Santos (nome diferente)
   - Telefone: (11) 98370-9746 ← **MESMO TELEFONE**
   - Email: maria@teste.com
8. Clique em "Salvar"

**Resultado Esperado:**

```
🔄 Loading Toast: "Criando lead "Maria Santos"..."
❌ Dialog fecha (optimistic update)
⚠️ Error Toast: "Já existe um lead com este telefone: (11) 98370-9746"
   Descrição: "Por favor, verifique se o lead já está cadastrado ou use outro telefone."
🔄 Dialog REABRE automaticamente
✅ Dados preservados no formulário (Nome: Maria Santos, Email: maria@teste.com)
```

**Critérios de Aceitação:**

- [ ] Toast de loading aparece com nome do lead
- [ ] Dialog fecha instantaneamente
- [ ] Toast de erro mostra TELEFONE ESPECÍFICO
- [ ] Toast de erro tem ícone ⚠️
- [ ] Descrição explica como resolver
- [ ] Dialog reabre automaticamente
- [ ] Dados do formulário são preservados
- [ ] Duração do toast: 5 segundos

---

### ✅ Teste 2: Lead Válido (Sucesso)

**Objetivo:** Verificar criação bem-sucedida

**Passos:**

1. Acesse o Board de Leads
2. Clique em "Criar Lead"
3. Preencha o formulário com dados ÚNICOS:
   - Nome: Carlos Oliveira
   - Telefone: (21) 99999-8888 ← **TELEFONE ÚNICO**
   - Email: carlos@teste.com
4. Clique em "Salvar"

**Resultado Esperado:**

```
🔄 Loading Toast: "Criando lead "Carlos Oliveira"..."
❌ Dialog fecha instantaneamente (0ms)
✅ Success Toast: "Lead "Carlos Oliveira" criado com sucesso!"
📊 Lead aparece no board na coluna "Nova Oportunidade"
```

**Critérios de Aceitação:**

- [ ] Toast de loading aparece
- [ ] Dialog fecha em menos de 50ms (percepção de instantâneo)
- [ ] Toast de sucesso substitui loading
- [ ] Lead aparece no board
- [ ] Lead está na coluna correta
- [ ] Duração do toast: 3 segundos

---

### ✅ Teste 3: Validação de Dados (Opcional)

**Objetivo:** Verificar validação de campos

**Passos:**

1. Acesse o Board de Leads
2. Clique em "Criar Lead"
3. Preencha o formulário com email INVÁLIDO:
   - Nome: Pedro Santos
   - Telefone: (31) 98888-7777
   - Email: email-invalido ← **SEM @**
4. Clique em "Salvar"

**Resultado Esperado:**

```
⚠️ Error Toast: "Dados inválidos: [mensagem de validação]"
   Descrição: "Por favor, verifique os campos e tente novamente."
🔄 Dialog REABRE automaticamente
✅ Dados preservados no formulário
```

**Critérios de Aceitação:**

- [ ] Toast de erro aparece
- [ ] Mensagem menciona "inválido"
- [ ] Dialog reabre automaticamente
- [ ] Dados preservados

---

### ✅ Teste 4: Erro de Rede (Opcional)

**Objetivo:** Verificar comportamento com servidor indisponível

**Passos:**

1. **Desligue o servidor backend** (stop npm run dev)
2. Acesse o Board de Leads
3. Clique em "Criar Lead"
4. Preencha o formulário
5. Clique em "Salvar"

**Resultado Esperado:**

```
🔄 Loading Toast: "Criando lead "Nome"..."
❌ Dialog fecha
❌ Error Toast: "Erro ao criar lead" ou "Network error"
🔄 Dialog REABRE automaticamente
✅ Dados preservados
```

**Critérios de Aceitação:**

- [ ] Erro genérico aparece (não trava o sistema)
- [ ] Dialog reabre para retry
- [ ] Dados preservados

---

## 🎨 Exemplos Visuais

### Exemplo 1: Telefone Duplicado ❌

```
┌──────────────────────────────────────────┐
│  ⚠️ Já existe um lead com este telefone: │
│     (11) 98370-9746                      │
│                                          │
│  Por favor, verifique se o lead já está │
│  cadastrado ou use outro telefone.       │
└──────────────────────────────────────────┘
       ↓
  Dialog Reabre
       ↓
┌──────────────────────────────────────────┐
│  Criar Lead                    [X]       │
├──────────────────────────────────────────┤
│  Nome: Maria Santos            ✓         │
│  Telefone: (11) 98370-9746     ← ERRO    │
│  Email: maria@teste.com        ✓         │
│                                          │
│  [Cancelar]  [Salvar]                    │
└──────────────────────────────────────────┘
```

### Exemplo 2: Lead Criado com Sucesso ✅

```
┌──────────────────────────────────────────┐
│  ✅ Lead "Carlos Oliveira" criado com    │
│     sucesso!                             │
└──────────────────────────────────────────┘
       ↓
  Dialog Fecha (0ms)
       ↓
┌──────────────────────────────────────────┐
│  BOARD - Nova Oportunidade               │
├──────────────────────────────────────────┤
│  ┌────────────────────┐                  │
│  │ Carlos Oliveira    │ ← NOVO LEAD      │
│  │ (21) 99999-8888    │                  │
│  └────────────────────┘                  │
└──────────────────────────────────────────┘
```

---

## 📊 Planilha de Testes

### Teste de Telefone Duplicado

| Item | Esperado | Status | Observação |
|------|----------|--------|------------|
| Loading Toast | "Criando lead "Nome"..." | ⬜ |  |
| Dialog Fecha | Instantâneo (0ms) | ⬜ |  |
| Error Toast | "⚠️ Já existe um lead com este telefone: (XX) XXXXX-XXXX" | ⬜ |  |
| Telefone Específico | Mostra telefone duplicado | ⬜ |  |
| Descrição | Instruções de como resolver | ⬜ |  |
| Dialog Reabre | Automático após erro | ⬜ |  |
| Dados Preservados | Todos os campos mantidos | ⬜ |  |
| Duração Toast | 5 segundos | ⬜ |  |

### Teste de Lead Válido

| Item | Esperado | Status | Observação |
|------|----------|--------|------------|
| Loading Toast | "Criando lead "Nome"..." | ⬜ |  |
| Dialog Fecha | < 50ms | ⬜ |  |
| Success Toast | "Lead "Nome" criado com sucesso!" | ⬜ |  |
| Lead no Board | Aparece na coluna correta | ⬜ |  |
| Duração Toast | 3 segundos | ⬜ |  |

---

## 🐛 Problemas Conhecidos & Soluções

### Problema 1: Toast Não Aparece

**Sintoma:** Nenhum toast é exibido após criar lead

**Possíveis Causas:**
- Sonner não está instalado
- Toast provider não está no layout

**Solução:**
```bash
# Verificar instalação
npm list sonner

# Verificar provider em app/layout.tsx
# Deve ter <Toaster /> no layout
```

### Problema 2: Dialog Não Reabre

**Sintoma:** Dialog não reabre após erro

**Possível Causa:**
- `setOpen(true)` não está sendo chamado no catch

**Solução:**
```typescript
// Em BoardDialog.tsx, no catch do createLead:
catch (createError) {
  // ... toast error ...
  setOpen(true); // ← CRUCIAL
  throw createError;
}
```

### Problema 3: Mensagem Genérica

**Sintoma:** Toast mostra "Erro ao criar lead" ao invés de específico

**Possível Causa:**
- API não está retornando errorMessages array

**Solução:**
```typescript
// Verificar em LeadUseCase.ts:
return new Output(false, [], [`Já existe um lead com o telefone ${data.phone}`], null);
//                      ^^^ errorMessages array
```

---

## 📞 Dados de Teste

### Telefones para Teste

```typescript
// Use estes telefones nos testes:

✅ Válidos (únicos):
- (11) 98765-4321
- (21) 97654-3210
- (31) 96543-2109
- (41) 95432-1098

❌ Duplicado (criar 2x para testar):
- (11) 98370-9746
```

### Emails para Teste

```typescript
✅ Válidos:
- joao@teste.com
- maria@teste.com
- carlos@teste.com

❌ Inválidos (se validação implementada):
- email-sem-arroba
- @sem-usuario.com
- usuario@sem-dominio
```

---

## ✅ Critérios Gerais de Sucesso

### Performance

- [ ] Loading toast aparece em < 100ms
- [ ] Dialog fecha em < 50ms (optimistic)
- [ ] Success toast substitui loading suavemente
- [ ] Sem travamentos ou delays perceptíveis

### UX

- [ ] Mensagens claras e específicas
- [ ] Usuário sabe exatamente qual é o problema
- [ ] Usuário sabe como resolver
- [ ] Dialog reabre automaticamente em erros
- [ ] Dados preservados no formulário
- [ ] Possível tentar novamente sem recomeçar

### Funcionalidade

- [ ] Unique constraint detectado corretamente
- [ ] Telefone específico mostrado na mensagem
- [ ] Validation errors detectados
- [ ] Erros de rede tratados graciosamente
- [ ] Lead criado com sucesso aparece no board
- [ ] Sem erros no console do navegador

---

## 📝 Relatório de Teste

### Template

```
# Relatório de Teste - Tratamento de Erros

**Data:** ___/___/______
**Testador:** _______________
**Ambiente:** [ ] Dev [ ] Staging [ ] Production

## Teste 1: Telefone Duplicado
Status: [ ] ✅ Passou [ ] ❌ Falhou
Observações:
_________________________________________________

## Teste 2: Lead Válido
Status: [ ] ✅ Passou [ ] ❌ Falhou
Observações:
_________________________________________________

## Teste 3: Validação
Status: [ ] ✅ Passou [ ] ❌ Falhou [ ] N/A
Observações:
_________________________________________________

## Teste 4: Erro de Rede
Status: [ ] ✅ Passou [ ] ❌ Falhou [ ] N/A
Observações:
_________________________________________________

## Bugs Encontrados
1. _________________________________________________
2. _________________________________________________
3. _________________________________________________

## Sugestões de Melhoria
1. _________________________________________________
2. _________________________________________________
3. _________________________________________________

## Conclusão Geral
[ ] Aprovado para produção
[ ] Necessita ajustes
[ ] Necessita reteste

Assinatura: _______________
```

---

## 🚀 Próximos Passos Após Testes

### Se Todos os Testes Passarem ✅

1. **Documentar no README**
   - Adicionar seção sobre tratamento de erros

2. **Monitorar em Produção**
   - Usar analytics para rastrear tipos de erro
   - Identificar erros mais comuns

3. **Coletar Feedback**
   - Perguntar aos usuários se mensagens são claras
   - Ajustar textos se necessário

### Se Houver Falhas ❌

1. **Documentar Bug**
   - Passos para reproduzir
   - Comportamento esperado vs. atual
   - Screenshots/vídeos

2. **Priorizar Correção**
   - Crítico: Sistema não funciona
   - Alto: UX muito prejudicada
   - Médio: UX levemente prejudicada
   - Baixo: Melhoria cosmética

3. **Reteste Após Correção**
   - Testar cenário específico que falhou
   - Testar cenários relacionados

---

**Documento criado em:** ${new Date().toLocaleDateString('pt-BR')}
**Versão:** 1.0.0
**Status:** 📋 Pronto para testes
