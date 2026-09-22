import axios from 'axios';
import { config } from './config.js';

const api = axios.create({
  baseURL: config.asaasBaseUrl,
  headers: { access_token: config.asaasApiKey, 'Content-Type':'application/json' },
  timeout: 15000
});

export async function createCustomer({ name, telegramId }) {
  const { data } = await api.post('/customers', {
    name: name || `Telegram ${telegramId}`,
    externalReference: `telegram:${telegramId}`
  });
  return data;
}

export async function ensureCustomer(user) {
  if (user.asaasCustomerId) return user.asaasCustomerId;
  const customer = await createCustomer({ name:user.firstName, telegramId:user.telegramId });
  return customer.id;
}

export async function createPixPayment({ customerId, value, dueDate, externalReference }) {
  const { data } = await api.post('/payments', {
    customer: customerId,
    billingType: 'PIX',
    value,
    dueDate,
    externalReference
  });
  return data;
}

export async function getPixQrCode(paymentId) {
  const { data } = await api.get(`/payments/${paymentId}/pixQrCode`);
  return data;
}

export async function getPayment(paymentId) {
  const { data } = await api.get(`/payments/${paymentId}`);
  return data;
}
