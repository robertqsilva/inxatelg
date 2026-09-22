import 'dotenv/config';

const required = ['BOT_TOKEN','TELEGRAM_CHAT_ID','ASAAS_API_KEY','WEBHOOK_TOKEN'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing env: ${key}`);

export const config = {
  botToken: process.env.BOT_TOKEN,
  chatId: process.env.TELEGRAM_CHAT_ID,
  asaasApiKey: process.env.ASAAS_API_KEY,
  asaasBaseUrl: process.env.ASAAS_BASE_URL || 'https://api-sandbox.asaas.com/v3',
  webhookToken: process.env.WEBHOOK_TOKEN,
  port: Number(process.env.PORT || 3000),
  planName: process.env.PLAN_NAME || 'VIP HOT - 30 dias',
  planPrice: Number(process.env.PLAN_PRICE || 29.90),
  planDays: Number(process.env.PLAN_DAYS || 30),
  reminderDays: Number(process.env.REMINDER_DAYS || 3),
  pixDueHours: Number(process.env.PIX_DUE_HOURS || 24)
};
