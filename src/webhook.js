import express from 'express';
import { prisma } from './db.js';
import { config } from './config.js';
import { activateFromPayment } from './service.js';

export const webhookRouter = express.Router();
webhookRouter.post('/asaas', async (req,res)=>{
  if (req.headers['asaas-access-token'] !== config.webhookToken) return res.sendStatus(401);
  const body=req.body;
  if (!body?.id) return res.sendStatus(400);
  try {
    await prisma.webhookEvent.create({data:{id:body.id,event:body.event || 'UNKNOWN'}});
  } catch {
    return res.sendStatus(200); // duplicate event: idempotent
  }
  res.sendStatus(200);
  if (['PAYMENT_RECEIVED','PAYMENT_CONFIRMED'].includes(body.event) && body.payment?.id) {
    await activateFromPayment(body.payment.id);
  }
});
