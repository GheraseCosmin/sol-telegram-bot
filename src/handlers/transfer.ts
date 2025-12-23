import { Context } from 'telegraf';
import prisma from '../utils/database';
import { transferSOL, transferSPLToken } from '../utils/solana';
import { decryptPrivateKey } from '../utils/encryption';
import bs58 from 'bs58';

/**
 * Transfer SOL
 */
export async function handleTransferSOL(
  ctx: Context,
  toAddress: string,
  amount: string
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

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return ctx.reply('❌ Invalid amount. Please provide a positive number.');
    }

    const privateKey = decryptPrivateKey(user.privateKey);
    const signature = await transferSOL(privateKey, toAddress, amountNum);

    await ctx.reply(
      '✅ *Transfer Successful!*\n\n' +
      `📤 *To:* \`${toAddress}\`\n` +
      `💰 *Amount:* ${amountNum} SOL\n` +
      `🔗 *Transaction:* [View on Explorer](https://solscan.io/tx/${signature})\n\n` +
      `Signature: \`${signature}\``,
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    console.error('Error transferring SOL:', error);
    ctx.reply(`❌ Transfer failed: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Transfer SPL Token
 */
export async function handleTransferToken(
  ctx: Context,
  tokenMint: string,
  toAddress: string,
  amount: string
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

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      return ctx.reply('❌ Invalid amount. Please provide a positive number.');
    }

    const privateKey = decryptPrivateKey(user.privateKey);
    const signature = await transferSPLToken(
      privateKey,
      toAddress,
      tokenMint,
      amountNum
    );

    await ctx.reply(
      '✅ *Token Transfer Successful!*\n\n' +
      `📤 *To:* \`${toAddress}\`\n` +
      `🪙 *Token:* \`${tokenMint}\`\n` +
      `💰 *Amount:* ${amountNum}\n` +
      `🔗 *Transaction:* [View on Explorer](https://solscan.io/tx/${signature})\n\n` +
      `Signature: \`${signature}\``,
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    console.error('Error transferring token:', error);
    ctx.reply(`❌ Token transfer failed: ${error.message || 'Unknown error'}`);
  }
}

