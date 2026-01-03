# 🌐 Configuração de Domínio no Asaas

## ❌ Erro Comum

```
Não há nenhum domínio configurado em sua conta. 
Cadastre um site em Minha Conta na aba Informações.
```

## 🎯 Por que esse erro acontece?

O Asaas exige que você configure um **domínio autorizado** para criar checkouts com URLs de callback (`successUrl`, `autoRedirect`). Isso é uma medida de segurança para evitar redirecionamentos maliciosos.

## ✅ Como Resolver

### 1. Acesse o Dashboard do Asaas

**Sandbox (Desenvolvimento)**:
- URL: https://sandbox.asaas.com
- Login com suas credenciais de sandbox

**Produção**:
- URL: https://www.asaas.com
- Login com suas credenciais de produção

### 2. Configure o Domínio

1. **Navegue até**: Menu → **Minha Conta** → Aba **Informações**

2. **Localize a seção**: "Site/Domínio da sua aplicação"

3. **Cadastre o domínio**:

   **Para Desenvolvimento (com Ngrok)**:
   ```
   https://[SEU-NGROK-DOMAIN].ngrok-free.dev
   ```
   
   **Exemplo**:
   ```
   https://nonzero-rodrick-mentholated.ngrok-free.dev
   ```

   **Para Produção**:
   ```
   https://seu-dominio.com.br
   ```

4. **Salve as configurações**

### 3. Teste Novamente

Após configurar o domínio, tente criar o checkout novamente. O erro não deve mais aparecer.

## 🔄 Múltiplos Domínios

Se você precisa testar em múltiplos ambientes:

- **Sandbox**: Configure o domínio do ngrok (ou localhost para testes locais sem callback)
- **Produção**: Configure seu domínio de produção

**Nota**: Você pode precisar adicionar múltiplos domínios separados por vírgula, dependendo da versão do Asaas.

## 🛡️ Rollback Implementado

O sistema possui dois níveis de rollback automático:

### 🔴 Rollback Completo (Primeira Tentativa)

Quando um novo usuário está se registrando pela primeira vez:

- ✅ Se QUALQUER erro ocorrer durante o checkout
- 🗑️ O usuário é **completamente removido** do sistema:
  - Profile deletado do banco de dados
  - Usuário deletado do Supabase Auth
  - Cliente Asaas não fica vinculado
- ✅ Evita usuários órfãos no sistema
- 📝 Usuário recebe mensagem clara: "Tente criar sua conta novamente"

**Critério**: Primeira tentativa = `asaasCustomerId` e `subscriptionId` são null

### 🟡 Rollback Parcial (Tentativas Subsequentes)

Quando um usuário já existente tenta criar checkout novamente:

- ✅ Se o cliente Asaas for criado mas o checkout falhar
- 🔄 O `asaasCustomerId` é removido do profile
- ✅ Usuário permanece no sistema e pode tentar novamente
- 📝 Mensagem de erro específica sobre o problema

**Critério**: Já possui `asaasCustomerId` ou `subscriptionId`

## 📝 Mensagens de Erro Traduzidas

O sistema detecta automaticamente o erro de domínio e mostra:

```
Configure um domínio na sua conta Asaas para criar checkouts. 
Acesse: Minha Conta → Informações
```

## 🔗 Links Úteis

- [Documentação Asaas - Checkouts](https://docs.asaas.com/reference/checkout)
- [Dashboard Sandbox](https://sandbox.asaas.com)
- [Dashboard Produção](https://www.asaas.com)
- [Ngrok - Secure Tunnels](https://ngrok.com)

## ⚠️ Importante

- O domínio configurado deve corresponder exatamente ao `NEXT_PUBLIC_APP_URL` do seu `.env`
- Para desenvolvimento com ngrok, atualize o domínio sempre que o ngrok gerar uma nova URL
- Em produção, configure seu domínio definitivo apenas uma vez
