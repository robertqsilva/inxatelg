# Telegram VIP + PIX — Node.js

Bot de assinatura de grupo VIP 18+ com pagamento exclusivamente via PIX, usando Telegram + Asaas + Prisma.

## O que já está implementado
- confirmação 18+
- planos/preço configuráveis por `.env`
- cadastro do usuário
- criação de cliente no Asaas
- cobrança PIX
- QR Code + copia e cola
- webhook de pagamento
- idempotência de webhook
- liberação por convite de uso único
- aprovação automática de join request quando a assinatura está ativa
- vencimento automático
- remoção automática do grupo
- lembrete antes do vencimento
- recuperação de PIX pendente
- renovação manual via novo PIX
- SQLite via Prisma para desenvolvimento

## 1. Instalação

```bash
npm install
cp .env.example .env
```

Preencha `.env`.

Crie o banco:

```bash
npx prisma generate
npx prisma migrate dev --name init
```

## 2. Telegram

Crie o bot no BotFather e coloque o token no `.env`.

Adicione o bot como administrador do grupo VIP e permita:
- convidar usuários
- aprovar solicitações de entrada
- banir/remover usuários

O grupo deve ser configurado para que o fluxo de entrada por link/solicitação funcione.

## 3. Asaas

Comece pelo Sandbox:

`ASAAS_BASE_URL=https://api-sandbox.asaas.com/v3`

Configure um webhook público apontando para:

`POST https://SEU_DOMINIO/webhooks/asaas`

No webhook, use o mesmo valor de `WEBHOOK_TOKEN` como token de autenticação.

Para produção, altere `ASAAS_BASE_URL` para:

`https://api.asaas.com/v3`

## 4. HTTPS

O endpoint do webhook precisa estar publicamente acessível. Em produção use HTTPS e um domínio/reverse proxy.

## 5. Rodar

```bash
npm start
```

## Observação importante sobre Pix

Este projeto usa PIX convencional: a renovação gera uma nova cobrança e o assinante precisa pagar o novo PIX. O sistema não debita dinheiro automaticamente de uma conta apenas por existir uma assinatura.

Se a conta Asaas estiver elegível para Pix Automático, a arquitetura pode ser adaptada para autorização recorrente. A documentação atual do Asaas descreve esse fluxo separadamente.

## Segurança

Nunca publique:
- BOT_TOKEN
- ASAAS_API_KEY
- WEBHOOK_TOKEN

Use `.env` e HTTPS.
