import { Context } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/types';
import prisma from '../utils/database';
import { swapTokens } from '../utils/solana';
import { decryptPrivateKey } from '../utils/encryption';
import axios from 'axios';

const SOL_MINT = 'So11111111111111111111111111111111111111112';

/**
 * Get holdings from Jupiter Ultra Swap API
 */
async function getHoldings(address: string) {
  const jupiterApiUrl = process.env.JUPITER_API_URL || 'https://api.jup.ag/ultra/v1';
  const apiKey = process.env.JUPITER_API_KEY || '';
  
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  const response = await axios.get(`${jupiterApiUrl}/holdings/${address}`, {
    headers,
    timeout: 15000,
  });

  return response.data;
}

/**
 * Get token prices from Jupiter Price API V3
 */
async function getTokenPrices(mints: string[]): Promise<Record<string, any>> {
  const apiKey = process.env.JUPITER_API_KEY || '';
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['x-api-key'] = apiKey;
  }

  // Limit to 50 mints per request
  const mintsToQuery = mints.slice(0, 50);
  const ids = mintsToQuery.join(',');

  try {
    const response = await axios.get(`https://api.jup.ag/price/v3?ids=${ids}`, {
      headers,
      timeout: 10000,
    });
    return response.data || {};
  } catch (error) {
    console.error('Error fetching prices:', error);
    return {};
  }
}

/**
 * Show sell menu with token buttons
 */
export async function handleSellMenu(ctx: Context) {
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

    await ctx.reply('⏳ Loading your holdings...');

    // Get holdings
    const holdings = await getHoldings(user.walletAddress);
    
    if (!holdings || !holdings.tokens) {
      return ctx.reply('❌ Failed to load holdings or no tokens found.');
    }

    // Get all token mints
    const tokenMints = Object.keys(holdings.tokens);
    
    if (tokenMints.length === 0) {
      return ctx.reply('📭 No tokens found in your wallet. You only have SOL.');
    }

    // Get prices for all tokens
    const prices = await getTokenPrices(tokenMints);

    // Build buttons for each token
    const buttons: any[] = [];
    let message = '💰 <b>Select Token to Sell</b>\n\n';

    for (const mint of tokenMints) {
      const tokenAccounts = holdings.tokens[mint];
      if (!tokenAccounts || tokenAccounts.length === 0) continue;

      // Sum up all token accounts for this mint
      let totalAmount = 0;
      for (const account of tokenAccounts) {
        totalAmount += parseFloat(account.uiAmount || account.uiAmountString || '0');
      }

      if (totalAmount <= 0) continue;

      const priceInfo = prices[mint];
      const price = priceInfo?.usdPrice || 0;
      const usdValue = totalAmount * price;
      const mintShort = mint.slice(0, 8) + '...' + mint.slice(-8);

      message += `🪙 <b>${mintShort}</b>\n`;
      message += `   Amount: ${totalAmount.toFixed(4)}\n`;
      if (price > 0) {
        message += `   Price: $${price.toFixed(6)}\n`;
        message += `   Value: $${usdValue.toFixed(2)}\n`;
      }
      message += '\n';

      // Add button for this token
      buttons.push([
        {
          text: `${mintShort} (${totalAmount.toFixed(2)})`,
          callback_data: `sell_token:${mint}`,
        },
      ]);
    }

    if (buttons.length === 0) {
      return ctx.reply('📭 No tokens with balance found in your wallet.');
    }

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: buttons,
    };

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });
  } catch (error: any) {
    console.error('Error showing sell menu:', error);
    ctx.reply(`❌ Failed to load holdings: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Show percentage selection for selling
 */
export async function handleSellPercentage(ctx: Context, tokenMint: string) {
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return ctx.answerCbQuery('❌ Unable to identify user');
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return ctx.answerCbQuery('❌ No wallet found');
    }

    // Get holdings to show current balance
    const holdings = await getHoldings(user.walletAddress);
    const tokenAccounts = holdings?.tokens?.[tokenMint] || [];
    
    let totalAmount = 0;
    for (const account of tokenAccounts) {
      totalAmount += parseFloat(account.uiAmount || account.uiAmountString || '0');
    }

    if (totalAmount <= 0) {
      return ctx.answerCbQuery('❌ No balance for this token');
    }

    // Get price
    const prices = await getTokenPrices([tokenMint]);
    const priceInfo = prices[tokenMint];
    const price = priceInfo?.usdPrice || 0;

    const mintShort = tokenMint.slice(0, 8) + '...' + tokenMint.slice(-8);

    let message = `💸 <b>Sell Token</b>\n\n`;
    message += `🪙 <b>Token:</b> <code>${tokenMint}</code>\n`;
    message += `💰 <b>Balance:</b> ${totalAmount.toFixed(4)}\n`;
    if (price > 0) {
      message += `💵 <b>Price:</b> $${price.toFixed(6)}\n`;
      message += `💲 <b>Total Value:</b> $${(totalAmount * price).toFixed(2)}\n`;
    }
    message += `\n📊 <b>Select amount to sell:</b>`;

    const keyboard: InlineKeyboardMarkup = {
      inline_keyboard: [
        [
          { text: '10%', callback_data: `sell_percent:${tokenMint}:10` },
          { text: '25%', callback_data: `sell_percent:${tokenMint}:25` },
        ],
        [
          { text: '50%', callback_data: `sell_percent:${tokenMint}:50` },
          { text: '100%', callback_data: `sell_percent:${tokenMint}:100` },
        ],
        [
          { text: 'Custom Amount', callback_data: `sell_custom:${tokenMint}` },
        ],
        [
          { text: '← Back', callback_data: 'sell_menu' },
        ],
      ],
    };

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: keyboard,
    });

    await ctx.answerCbQuery();
  } catch (error: any) {
    console.error('Error showing sell percentage:', error);
    ctx.answerCbQuery(`❌ Error: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Execute sell with percentage
 */
export async function handleSellPercentageExecute(
  ctx: Context,
  tokenMint: string,
  percentage: number
) {
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return ctx.answerCbQuery('❌ Unable to identify user');
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return ctx.answerCbQuery('❌ No wallet found');
    }

    // Get holdings
    const holdings = await getHoldings(user.walletAddress);
    const tokenAccounts = holdings?.tokens?.[tokenMint] || [];
    
    let totalAmountUI = 0; // UI amount for display
    let totalAmountNative = 0; // Native amount for precise calculation
    let tokenDecimals = 9; // Default decimals
    for (const account of tokenAccounts) {
      totalAmountUI += parseFloat(account.uiAmount || account.uiAmountString || '0');
      // Use native amount for precise calculation
      totalAmountNative += parseFloat(account.amount || '0');
      // Get decimals from first account (all should have same decimals for same mint)
      if (account.decimals !== undefined) {
        tokenDecimals = account.decimals;
      }
    }

    if (totalAmountUI <= 0 || totalAmountNative <= 0) {
      return ctx.answerCbQuery('❌ No balance for this token');
    }

    // Calculate amount to sell
    // For 100%, use exact native amount to avoid rounding issues
    // For other percentages, calculate from native amount and convert back to UI
    let amountToSellNative: number;
    let amountToSellUI: number;
    
    if (percentage === 100) {
      // Use exact native amount for 100%
      amountToSellNative = totalAmountNative;
      amountToSellUI = totalAmountUI;
    } else {
      // Calculate percentage from native amount for precision
      amountToSellNative = Math.floor((totalAmountNative * percentage) / 100);
      amountToSellUI = (totalAmountUI * percentage) / 100;
    }

    await ctx.editMessageText('⏳ Processing sell order... Please wait.');

    const privateKey = decryptPrivateKey(user.privateKey);
    
    // Convert native amount to UI amount for swapTokens function
    const amountToSell = amountToSellNative / Math.pow(10, tokenDecimals);
    
    const signature = await swapTokens(
      privateKey,
      tokenMint,
      SOL_MINT,
      amountToSell,
      50, // 0.5% slippage
      tokenDecimals // Pass decimals to swapTokens
    );

    await ctx.editMessageText(
      `✅ <b>Sell Order Executed!</b>\n\n` +
      `🪙 <b>Token:</b> <code>${tokenMint}</code>\n` +
      `💰 <b>Amount Sold:</b> ${amountToSellUI.toFixed(4)} (${percentage}%)\n` +
      `🔗 <b>Transaction:</b> <a href="https://solscan.io/tx/${signature}">View on Explorer</a>\n\n` +
      `Signature: <code>${signature}</code>`,
      { parse_mode: 'HTML' }
    );

    await ctx.answerCbQuery('✅ Sell executed successfully!');
  } catch (error: any) {
    console.error('Error executing sell:', error);
    await ctx.editMessageText(
      `❌ <b>Sell Failed</b>\n\n${error.message || 'Unknown error'}`,
      { parse_mode: 'HTML' }
    );
    await ctx.answerCbQuery('❌ Sell failed');
  }
}

// Store pending custom sell requests (in production, use Redis or database)
const pendingCustomSells = new Map<string, string>();

/**
 * Handle custom amount input
 */
export async function handleSellCustom(ctx: Context, tokenMint: string) {
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return ctx.answerCbQuery('❌ Unable to identify user');
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return ctx.answerCbQuery('❌ No wallet found');
    }

    // Get holdings
    const holdings = await getHoldings(user.walletAddress);
    const tokenAccounts = holdings?.tokens?.[tokenMint] || [];
    
    let totalAmount = 0;
    for (const account of tokenAccounts) {
      totalAmount += parseFloat(account.uiAmount || account.uiAmountString || '0');
    }

    const mintShort = tokenMint.slice(0, 8) + '...' + tokenMint.slice(-8);

    const message = `💸 <b>Custom Sell Amount</b>\n\n` +
      `🪙 <b>Token:</b> <code>${tokenMint}</code>\n` +
      `💰 <b>Available:</b> ${totalAmount.toFixed(4)}\n\n` +
      `Please reply with the amount you want to sell.\n` +
      `Example: <code>100</code> or <code>0.5</code>\n\n` +
      `Use /cancel to cancel.`;

    // Store pending custom sell
    pendingCustomSells.set(telegramId, tokenMint);

    await ctx.editMessageText(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '← Back', callback_data: `sell_token:${tokenMint}` }],
        ],
      },
    });

    await ctx.answerCbQuery('Please reply with the amount to sell');
  } catch (error: any) {
    console.error('Error handling custom sell:', error);
    ctx.answerCbQuery(`❌ Error: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Check if user has pending custom sell and process it
 */
export function hasPendingCustomSell(telegramId: string): string | null {
  return pendingCustomSells.get(telegramId) || null;
}

/**
 * Clear pending custom sell
 */
export function clearPendingCustomSell(telegramId: string) {
  pendingCustomSells.delete(telegramId);
}

/**
 * Execute sell with custom amount
 */
export async function handleSellCustomExecute(
  ctx: Context,
  tokenMint: string,
  amount: number
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

    // Get holdings to validate amount
    const holdings = await getHoldings(user.walletAddress);
    const tokenAccounts = holdings?.tokens?.[tokenMint] || [];
    
    let totalAmount = 0;
    let tokenDecimals = 9; // Default decimals
    for (const account of tokenAccounts) {
      totalAmount += parseFloat(account.uiAmount || account.uiAmountString || '0');
      // Get decimals from first account (all should have same decimals for same mint)
      if (account.decimals !== undefined) {
        tokenDecimals = account.decimals;
      }
    }

    if (amount > totalAmount) {
      return ctx.reply(`❌ Insufficient balance. You have ${totalAmount.toFixed(4)} tokens.`);
    }

    if (amount <= 0) {
      return ctx.reply('❌ Invalid amount. Please provide a positive number.');
    }

    await ctx.reply('⏳ Processing sell order... Please wait.');

    const privateKey = decryptPrivateKey(user.privateKey);
    const signature = await swapTokens(
      privateKey,
      tokenMint,
      SOL_MINT,
      amount,
      50, // 0.5% slippage
      tokenDecimals // Pass decimals to swapTokens
    );

    await ctx.reply(
      `✅ <b>Sell Order Executed!</b>\n\n` +
      `🪙 <b>Token:</b> <code>${tokenMint}</code>\n` +
      `💰 <b>Amount Sold:</b> ${amount.toFixed(4)}\n` +
      `🔗 <b>Transaction:</b> <a href="https://solscan.io/tx/${signature}">View on Explorer</a>\n\n` +
      `Signature: <code>${signature}</code>`,
      { parse_mode: 'HTML' }
    );
  } catch (error: any) {
    console.error('Error executing custom sell:', error);
    ctx.reply(`❌ Sell failed: ${error.message || 'Unknown error'}`);
  }
}

