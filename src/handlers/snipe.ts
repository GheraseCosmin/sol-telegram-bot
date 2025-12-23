import { Context } from 'telegraf';
import prisma from '../utils/database';
import { snipeToken } from '../utils/solana';
import { decryptPrivateKey } from '../utils/encryption';

/**
 * Set up snipe configuration
 */
export async function handleSnipeSetup(
  ctx: Context,
  tokenMint: string,
  maxBuy: string,
  slippage?: string
) {
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return ctx.reply('❌ Unable to identify user');
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return ctx.reply('❌ No wallet found. Use /generatewallet first.');
    }

    const maxBuyAmount = parseFloat(maxBuy);
    if (isNaN(maxBuyAmount) || maxBuyAmount <= 0) {
      return ctx.reply('❌ Invalid max buy amount.');
    }

    const slippageBps = slippage ? parseFloat(slippage) : 5.0;

    await prisma.snipeConfig.create({
      data: {
        userId: user.id,
        tokenMint,
        maxBuy: maxBuyAmount.toString(),
        slippage: slippageBps,
        status: 'active',
      },
    });

    await ctx.reply(
      '✅ *Snipe Configuration Created!*\n\n' +
      `🪙 *Token:* \`${tokenMint}\`\n` +
      `💰 *Max Buy:* ${maxBuyAmount} SOL\n` +
      `📊 *Slippage:* ${slippageBps}%\n\n` +
      'The bot will automatically buy when the token is detected.',
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    console.error('Error setting up snipe:', error);
    ctx.reply(`❌ Failed to setup snipe: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Execute snipe manually
 */
export async function handleSnipe(
  ctx: Context,
  tokenMint: string,
  maxBuy: string,
  slippage?: string
) {
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return ctx.reply('❌ Unable to identify user');
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return ctx.reply('❌ No wallet found. Use /generatewallet first.');
    }

    const maxBuyAmount = parseFloat(maxBuy);
    if (isNaN(maxBuyAmount) || maxBuyAmount <= 0) {
      return ctx.reply('❌ Invalid max buy amount.');
    }

    const slippageBps = slippage ? Math.floor(parseFloat(slippage) * 100) : 500;

    await ctx.reply('🎯 Sniping token... Please wait.');

    const privateKey = decryptPrivateKey(user.privateKey);
    const signature = await snipeToken(
      privateKey,
      tokenMint,
      maxBuyAmount,
      slippageBps
    );

    await ctx.reply(
      '✅ *Snipe Executed!*\n\n' +
      `🪙 *Token:* \`${tokenMint}\`\n` +
      `💰 *Max Buy:* ${maxBuyAmount} SOL\n` +
      `📊 *Slippage:* ${slippageBps / 100}%\n` +
      `🔗 *Transaction:* [View on Explorer](https://solscan.io/tx/${signature})\n\n` +
      `Signature: \`${signature}\``,
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    console.error('Error sniping token:', error);
    ctx.reply(`❌ Snipe failed: ${error.message || 'Unknown error'}`);
  }
}

