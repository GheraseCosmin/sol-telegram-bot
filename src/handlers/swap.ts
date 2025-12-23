import { Context } from 'telegraf';
import prisma from '../utils/database';
import { swapTokens, getTokenPrice } from '../utils/solana';
import { decryptPrivateKey } from '../utils/encryption';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Buy token (swap SOL for token)
 */
export async function handleBuy(
  ctx: Context,
  tokenMint: string,
  solAmount: string,
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

    const amount = parseFloat(solAmount);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('❌ Invalid amount. Please provide a positive number.');
    }

    const slippageBps = slippage ? Math.floor(parseFloat(slippage) * 100) : 50;

    await ctx.reply('⏳ Processing swap... Please wait.');

    const privateKey = decryptPrivateKey(user.privateKey);
    const signature = await swapTokens(
      privateKey,
      SOL_MINT,
      tokenMint,
      amount,
      slippageBps
    );

    const tokenPrice = await getTokenPrice(tokenMint);

    await ctx.reply(
      '✅ *Buy Order Executed!*\n\n' +
      `🪙 *Token:* \`${tokenMint}\`\n` +
      `💰 *SOL Spent:* ${amount} SOL\n` +
      `💵 *Token Price:* $${tokenPrice.toFixed(6)}\n` +
      `📊 *Slippage:* ${slippageBps / 100}%\n` +
      `🔗 *Transaction:* [View on Explorer](https://solscan.io/tx/${signature})\n\n` +
      `Signature: \`${signature}\``,
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    console.error('Error buying token:', error);
    ctx.reply(`❌ Buy failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Sell token (swap token for SOL)
 */
export async function handleSell(
  ctx: Context,
  tokenMint: string,
  tokenAmount: string,
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

    const amount = parseFloat(tokenAmount);
    if (isNaN(amount) || amount <= 0) {
      return ctx.reply('❌ Invalid amount. Please provide a positive number.');
    }

    const slippageBps = slippage ? Math.floor(parseFloat(slippage) * 100) : 50;

    await ctx.reply('⏳ Processing swap... Please wait.');

    const privateKey = decryptPrivateKey(user.privateKey);
    const signature = await swapTokens(
      privateKey,
      tokenMint,
      SOL_MINT,
      amount,
      slippageBps
    );

    await ctx.reply(
      '✅ *Sell Order Executed!*\n\n' +
      `🪙 *Token:* \`${tokenMint}\`\n` +
      `💰 *Amount Sold:* ${amount}\n` +
      `📊 *Slippage:* ${slippageBps / 100}%\n` +
      `🔗 *Transaction:* [View on Explorer](https://solscan.io/tx/${signature})\n\n` +
      `Signature: \`${signature}\``,
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    console.error('Error selling token:', error);
    ctx.reply(`❌ Sell failed: ${error.message || 'Unknown error'}`);
  }
}

