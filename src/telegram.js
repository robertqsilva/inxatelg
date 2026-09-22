import { Telegraf } from 'telegraf';
import { config } from './config.js';

export const bot = new Telegraf(config.botToken);

export async function sendMessage(telegramId, text, extra={}) {
  return bot.telegram.sendMessage(telegramId, text, { parse_mode:'HTML', ...extra });
}

export async function createVipInvite() {
  // User joins through a one-use invite. The bot can approve the join request.
  return bot.telegram.createChatInviteLink(config.chatId, {
    name: 'VIP payment',
    member_limit: 1,
    expire_date: Math.floor(Date.now()/1000) + 3600,
    creates_join_request: true
  });
}

export async function approveJoin(userId) {
  return bot.telegram.approveChatJoinRequest(config.chatId, userId);
}

export async function removeFromVip(userId) {
  try {
    await bot.telegram.banChatMember(config.chatId, userId);
    // Unban so the user can rejoin later through a new valid payment.
    await bot.telegram.unbanChatMember(config.chatId, userId, { only_if_banned: true });
  } catch (e) {
    console.error('removeFromVip', e.response?.description || e.message);
  }
}
