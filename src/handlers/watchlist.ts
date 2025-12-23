import { Context } from 'telegraf';
import prisma from '../utils/database';
import { getTokenPrice } from '../utils/solana';

/**
 * Add token to watchlist
 */
export async function handleAddWatchlist(ctx: Context, tokenMint: string) {
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

    await prisma.watchlistItem.upsert({
      where: {
        userId_tokenMint: {
          userId: user.id,
          tokenMint,
        },
      },
      update: {},
      create: {
        userId: user.id,
        tokenMint,
      },
    });

    const price = await getTokenPrice(tokenMint);

    await ctx.reply(
      '✅ *Token Added to Watchlist!*\n\n' +
      `🪙 *Token:* \`${tokenMint}\`\n` +
      `💵 *Current Price:* $${price.toFixed(6)}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error: any) {
    console.error('Error adding to watchlist:', error);
    ctx.reply(`❌ Failed to add to watchlist: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Get watchlist
 */
export async function handleWatchlist(ctx: Context) {
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return ctx.reply('❌ Unable to identify user');
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: { watchlist: true },
    });

    if (!user) {
      return ctx.reply('❌ No wallet found. Use /generatewallet first.');
    }

    if (user.watchlist.length === 0) {
      return ctx.reply('⭐ *Your Watchlist*\n\nNo tokens in watchlist.', {
        parse_mode: 'Markdown',
      });
    }

    let message = '⭐ *Your Watchlist*\n\n';
    for (const item of user.watchlist) {
      const price = await getTokenPrice(item.tokenMint);
      message += `🪙 *${item.tokenSymbol || item.tokenMint.slice(0, 8)}...*\n`;
      message += `   Mint: \`${item.tokenMint}\`\n`;
      message += `   Price: $${price.toFixed(6)}\n\n`;
    }

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error: any) {
    console.error('Error getting watchlist:', error);
    ctx.reply(`❌ Failed to get watchlist: ${error.message || 'Unknown error'}`);
  }
}

