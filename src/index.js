import express from 'express';
import cron from 'node-cron';
import { bot } from './telegram.js';
import { config } from './config.js';
import { webhookRouter } from './webhook.js';
import { prisma } from './db.js';
import { getOrCreateUser, sendPix, processRemindersAndExpirations, sendPendingRecovery } from './service.js';

const app=express();
app.use(express.json());
app.get('/health',(req,res)=>res.json({ok:true}));
app.use('/webhooks',webhookRouter);
app.listen(config.port,()=>console.log(`HTTP listening on :${config.port}`));

bot.start(async ctx=>{
  const user=await getOrCreateUser(ctx.from);
  if(!user.ageConfirmed){
    return ctx.reply('🔞 <b>VIP 18+</b>\n\nEste bot é destinado exclusivamente a maiores de 18 anos.\nAo continuar, você confirma que tem 18 anos ou mais.',{parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:'Tenho 18 anos ou mais',callback_data:'AGE_YES'}]]}});
  }
  return ctx.reply(`🔥 <b>${config.planName}</b>\n\nAcesso exclusivo por ${config.planDays} dias.\n💰 R$ ${config.planPrice.toFixed(2).replace('.',',')}\n\nPagamento somente via PIX.`,{parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:'💳 Assinar com PIX',callback_data:'BUY'}],[{text:'🔄 Renovar',callback_data:'RENEW'}]]}});
});

bot.action('AGE_YES',async ctx=>{
  await ctx.answerCbQuery();
  const user=await getOrCreateUser(ctx.from);
  await prisma.user.update({where:{id:user.id},data:{ageConfirmed:true}});
  await ctx.reply(`🔞 Confirmação registrada.\n\n🔥 <b>${config.planName}</b>\n💰 R$ ${config.planPrice.toFixed(2).replace('.',',')}\n\nClique abaixo para gerar o PIX.`,{parse_mode:'HTML',reply_markup:{inline_keyboard:[[{text:'💰 Gerar PIX',callback_data:'BUY'}]]}});
});

async function buy(ctx){
  await ctx.answerCbQuery();
  const user=await getOrCreateUser(ctx.from);
  if(!user.ageConfirmed) return ctx.reply('Confirme primeiro que você tem 18 anos ou mais com /start.');
  await ctx.reply('⏳ Gerando seu PIX...');
  try { await sendPix(user.id); } catch(e){ console.error(e.response?.data||e); await ctx.reply('❌ Não consegui gerar a cobrança agora. Tente novamente em alguns segundos.'); }
}
bot.action('BUY',buy);
bot.action('RENEW',buy);
bot.command('renovar',buy);

bot.on('chat_join_request',async ctx=>{
  const user=await prisma.user.findUnique({where:{telegramId:String(ctx.from.id)},include:{subscriptions:true}});
  const active=user?.subscriptions.some(s=>s.status==='ACTIVE' && s.expiresAt && s.expiresAt>new Date());
  if(active){
    try { await ctx.approveChatJoinRequest(); } catch(e){ console.error('approve join',e.message); }
  } else {
    try { await ctx.declineChatJoinRequest(); } catch(e){ console.error('decline join',e.message); }
  }
});

cron.schedule('*/5 * * * *', async()=>{try{await processRemindersAndExpirations();}catch(e){console.error('jobs',e)}});
cron.schedule('0 * * * *', async()=>{try{await sendPendingRecovery();}catch(e){console.error('recovery',e)}});

bot.catch((err,ctx)=>console.error('Telegram error',ctx.updateType,err));
bot.launch();
process.once('SIGINT',()=>bot.stop('SIGINT'));
process.once('SIGTERM',()=>bot.stop('SIGTERM'));
