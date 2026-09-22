import { prisma } from './db.js';
import { config } from './config.js';
import { ensureCustomer, createPixPayment, getPixQrCode } from './asaas.js';
import { bot, createVipInvite, removeFromVip, sendMessage } from './telegram.js';

const addDays = (date, days) => new Date(date.getTime() + days*86400000);
const dateOnly = d => d.toISOString().slice(0,10);

export async function getOrCreateUser(tg) {
  return prisma.user.upsert({
    where:{telegramId:String(tg.id)},
    create:{telegramId:String(tg.id), username:tg.username, firstName:tg.first_name},
    update:{username:tg.username, firstName:tg.first_name}
  });
}

export async function createPixForUser(user) {
  const customerId = await ensureCustomer(user);
  if (!user.asaasCustomerId) await prisma.user.update({where:{id:user.id},data:{asaasCustomerId:customerId}});

  let sub = await prisma.subscription.findFirst({where:{userId:user.id, status:{in:['ACTIVE','PENDING','PAST_DUE']}, orderBy:{createdAt:'desc'}}});
  if (!sub) sub = await prisma.subscription.create({data:{userId:user.id,status:'PENDING'}});

  const due = new Date(Date.now() + config.pixDueHours*3600000);
  const payment = await createPixPayment({
    customerId, value:config.planPrice, dueDate:dateOnly(due),
    externalReference:`vip:${user.id}:${sub.id}:${Date.now()}`
  });
  const qr = await getPixQrCode(payment.id);
  await prisma.payment.create({data:{
    userId:user.id, subscriptionId:sub.id, asaasPaymentId:payment.id,
    status:payment.status, value:payment.value, dueDate:new Date(payment.dueDate), pixPayload:qr.payload
  }});
  return { payment, qr, sub };
}

export async function activateFromPayment(asaasPaymentId) {
  const p = await prisma.payment.findUnique({where:{asaasPaymentId}, include:{user:true, subscription:true}});
  if (!p) return;
  if (p.status === 'RECEIVED' && p.paidAt) return;

  const now = new Date();
  const currentExpiry = p.subscription.expiresAt && p.subscription.expiresAt > now ? p.subscription.expiresAt : now;
  const expiresAt = addDays(currentExpiry, config.planDays);

  await prisma.$transaction([
    prisma.payment.update({where:{id:p.id},data:{status:'RECEIVED',paidAt:now}}),
    prisma.subscription.update({where:{id:p.subscriptionId},data:{status:'ACTIVE',startedAt:p.subscription.startedAt || now,expiresAt,lastPaymentId:asaasPaymentId,reminderSentAt:null}})
  ]);

  const invite = await createVipInvite();
  await sendMessage(p.user.telegramId,
    `✅ <b>Pagamento confirmado!</b>\n\nSeu acesso ao VIP está liberado.\n\n🔞 Conteúdo exclusivo para maiores de 18 anos.\n\nEntre pelo link abaixo:\n${invite.invite_link}\n\n📅 Seu acesso vence em <b>${expiresAt.toLocaleDateString('pt-BR')}</b>.`);
}

export async function sendPix(userId) {
  const user = await prisma.user.findUnique({where:{id:userId}});
  const {payment,qr} = await createPixForUser(user);
  const img = Buffer.from(qr.encodedImage,'base64');
  await bot.telegram.sendPhoto(user.telegramId,{source:img},{caption:`💰 <b>PIX do VIP</b>\n\nValor: R$ ${Number(payment.value).toFixed(2).replace('.',',')}\n\nCopie e cole:\n<code>${qr.payload}</code>\n\nApós pagar, aguarde a confirmação automática.`,parse_mode:'HTML'});
}

export async function processRemindersAndExpirations() {
  const now = new Date();
  const reminderLimit = new Date(now.getTime() + config.reminderDays*86400000);
  const active = await prisma.subscription.findMany({where:{status:'ACTIVE'},include:{user:true}});

  for (const sub of active) {
    if (!sub.expiresAt) continue;
    if (sub.expiresAt <= now) {
      await prisma.subscription.update({where:{id:sub.id},data:{status:'EXPIRED'}});
      await removeFromVip(Number(sub.user.telegramId));
      await sendMessage(sub.user.telegramId,'⚠️ <b>Seu acesso ao VIP expirou.</b>\n\nPara renovar, envie /start e gere um novo PIX.');
      continue;
    }
    if (sub.expiresAt <= reminderLimit && !sub.reminderSentAt) {
      await prisma.subscription.update({where:{id:sub.id},data:{reminderSentAt:now}});
      await sendMessage(sub.user.telegramId,`⏰ <b>Seu VIP vence em breve.</b>\n\nVencimento: ${sub.expiresAt.toLocaleDateString('pt-BR')}\n\nUse /renovar para gerar seu PIX.`);
    }
  }
}

export async function sendPendingRecovery() {
  const cutoff = new Date(Date.now()-6*3600000);
  const pending = await prisma.payment.findMany({where:{status:'PENDING',createdAt:{lte:cutoff}},include:{user:true}});
  for (const p of pending) {
    await sendMessage(p.user.telegramId,'🔔 <b>Seu PIX ainda não foi identificado.</b>\n\nSe ainda quiser entrar/renovar o VIP, use /renovar para gerar uma nova cobrança.');
    await prisma.payment.update({where:{id:p.id},data:{status:'RECOVERY_SENT'}});
  }
}
