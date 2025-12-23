// Shared bot setup that can be used by both index.ts and api/webhook.ts
import { Telegraf, Markup } from 'telegraf';
import dotenv from 'dotenv';
import { handleGenerateWallet, handleImportWallet, handleRefreshBalance, handleResetWallet } from './handlers/wallet';
import { handleTransferSOL, handleTransferToken } from './handlers/transfer';
import { handleBuy, handleSell } from './handlers/swap';
import { handleSnipe, handleSnipeSetup } from './handlers/snipe';
import { handlePositions } from './handlers/positions';
import { handleAddWatchlist, handleWatchlist } from './handlers/watchlist';
import { handleDevnetTokens, handleTokenInfo, handleSearchToken } from './handlers/devnet';
import {
  handleSellMenu,
  handleSellPercentage,
  handleSellPercentageExecute,
  handleSellCustom,
  handleSellCustomExecute,
  hasPendingCustomSell,
  clearPendingCustomSell,
} from './handlers/sell-interactive';
import prisma from './utils/database';
import { getWalletBalance } from './utils/solana';

dotenv.config();

if (!process.env.TELEGRAM_BOT_TOKEN) {
  throw new Error('TELEGRAM_BOT_TOKEN is required');
}

export const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Start command
bot.command('start', async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) {
    return ctx.reply('❌ Unable to identify user');
  }

  let user = await prisma.user.findUnique({
    where: { telegramId },
  });

  let walletAddress = 'Not set';
  let balance = { balance: 0, balanceUSD: 0 };

  if (user) {
    walletAddress = user.walletAddress;
    balance = await getWalletBalance(user.walletAddress);
  }

  const network = process.env.SOLANA_NETWORK === 'devnet' ? '🔷 DEVNET' : '🌐 MAINNET';
  
  const message =
    '👋 <b>Welcome to Solana Trading Bot!</b>\n\n' +
    `📡 <b>Network:</b> ${network}\n\n` +
    `📍 <b>Solana Wallet:</b>\n<code>${walletAddress}</code>\n\n` +
    `💰 <b>Balance:</b> ${balance.balance.toFixed(4)} SOL ($${balance.balanceUSD.toFixed(2)})\n\n` +
    'Click on the Refresh button to update your current balance.\n\n' +
    '📱 <b>Commands:</b>\n' +
    '/generatewallet - Generate new wallet\n' +
    '/importwallet &lt;private_key&gt; - Import existing wallet\n' +
    '/resetwallet - Reset current wallet\n' +
    '/refresh - Refresh balance\n' +
    '/transfer - Transfer SOL\n' +
    '/buy - Buy token\n' +
    '/sell - Sell token\n' +
    '/snipe - Snipe token\n' +
    '/positions - View positions\n' +
    '/watchlist - Manage watchlist\n' +
    '/devnettokens - Show devnet tokens for testing\n' +
    '/help - Show help\n\n' +
    '⚠️ <b>Disclaimer:</b> We have no control over ads shown by Telegram. Do not be scammed by fake airdrops or login pages.';

  const keyboard = Markup.keyboard([
    ['Buy', 'Sell'],
    ['Positions', 'Limit Orders', 'DCA Orders'],
    ['Copy Trade', 'Sniper'],
    ['Watchlist ⭐', 'Rewards 💰'],
    ['Withdraw', 'Settings'],
    ['Help', 'Refresh 🔄'],
  ])
    .resize()
    .persistent();

  await ctx.reply(message, { parse_mode: 'HTML', ...keyboard });
});

// Wallet commands
bot.command('generatewallet', handleGenerateWallet);
bot.command('importwallet', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length === 0) {
    return ctx.reply('❌ Please provide a private key.\n\nUsage: /importwallet <private_key>\n\nExample: /importwallet 2WPvQXXK5sLq52jjSoS38mFgAaxESCkBtUfLDAN1Br2iWkLVQyJZYhZhT91jg7gwGYTJnCNoHcQYtCDAr6EeyqEG');
  }
  await handleImportWallet(ctx, args.join(' '));
});
bot.command('resetwallet', handleResetWallet);
bot.command('refresh', handleRefreshBalance);

// Transfer commands
bot.command('transfer', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return ctx.reply('❌ Usage: /transfer <address> <amount>\n\nExample: /transfer 26ngoBBTtxc1YRF4qGs2AzrZxzfoFi37v81Sn6b5C9df 0.1');
  }
  await handleTransferSOL(ctx, args[0], args[1]);
});

bot.command('transfertoken', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 3) {
    return ctx.reply('❌ Usage: /transfertoken <token_mint> <address> <amount>');
  }
  await handleTransferToken(ctx, args[0], args[1], args[2]);
});

// Swap commands
bot.command('buy', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return ctx.reply('❌ Usage: /buy <token_mint> <sol_amount> [slippage%]\n\nExample: /buy EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 0.1 1');
  }
  await handleBuy(ctx, args[0], args[1], args[2]);
});

// Interactive sell menu
bot.command('sell', handleSellMenu);

// Legacy sell command (still available)
bot.command('selllegacy', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return ctx.reply('❌ Usage: /selllegacy <token_mint> <token_amount> [slippage%]\n\nExample: /selllegacy EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 100 1');
  }
  await handleSell(ctx, args[0], args[1], args[2]);
});

// Callback handlers for interactive sell
bot.action('sell_menu', handleSellMenu);

bot.action(/^sell_token:(.+)$/, async (ctx) => {
  const tokenMint = ctx.match[1];
  await handleSellPercentage(ctx, tokenMint);
});

bot.action(/^sell_percent:(.+):(\d+)$/, async (ctx) => {
  const tokenMint = ctx.match[1];
  const percentage = parseInt(ctx.match[2]);
  await handleSellPercentageExecute(ctx, tokenMint, percentage);
});

bot.action(/^sell_custom:(.+)$/, async (ctx) => {
  const tokenMint = ctx.match[1];
  await handleSellCustom(ctx, tokenMint);
});

// Snipe commands
bot.command('snipe', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return ctx.reply('❌ Usage: /snipe <token_mint> <max_sol_amount> [slippage%]\n\nExample: /snipe EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 0.5 5');
  }
  await handleSnipe(ctx, args[0], args[1], args[2]);
});

bot.command('snipesetup', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return ctx.reply('❌ Usage: /snipesetup <token_mint> <max_sol_amount> [slippage%]');
  }
  await handleSnipeSetup(ctx, args[0], args[1], args[2]);
});

// Positions
bot.command('positions', handlePositions);

// Watchlist
bot.command('watchlist', handleWatchlist);
bot.command('addwatchlist', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length === 0) {
    return ctx.reply('❌ Usage: /addwatchlist <token_mint>');
  }
  await handleAddWatchlist(ctx, args[0]);
});

// Button handlers
bot.hears('Buy', async (ctx) => {
  await ctx.reply('💡 Use /buy <token_mint> <sol_amount> [slippage%]\n\nExample: /buy EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 0.1');
});

bot.hears('Sell', handleSellMenu);

bot.hears('Positions', handlePositions);

bot.hears('Watchlist ⭐', handleWatchlist);

bot.hears('Refresh 🔄', handleRefreshBalance);

bot.hears('Sniper', async (ctx) => {
  await ctx.reply('🎯 *Sniper Mode*\n\nUse /snipe <token_mint> <max_sol_amount> [slippage%]\n\nOr setup auto-snipe with /snipesetup', {
    parse_mode: 'Markdown',
  });
});

// Devnet testing commands
bot.command('devnettokens', handleDevnetTokens);
bot.command('tokeninfo', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length === 0) {
    return ctx.reply('❌ Usage: /tokeninfo <token_mint>\n\nExample: /tokeninfo 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');
  }
  await handleTokenInfo(ctx, args[0]);
});
bot.command('searchtoken', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length === 0) {
    return ctx.reply('❌ Usage: /searchtoken <query>');
  }
  await handleSearchToken(ctx, args.join(' '));
});

bot.command('help', async (ctx) => {
  const helpMessage =
    '📖 *Bot Commands*\n\n' +
    '*Wallet:*\n' +
    '/generatewallet - Generate new Solana wallet\n' +
    '/importwallet <key> - Import existing wallet\n' +
    '/refresh - Refresh wallet balance\n\n' +
    '*Trading:*\n' +
    '/buy <token> <sol_amount> [slippage%] - Buy token\n' +
    '/sell <token> <amount> [slippage%] - Sell token\n' +
    '/transfer <address> <amount> - Transfer SOL\n' +
    '/transfertoken <token> <address> <amount> - Transfer token\n\n' +
    '*Snipe:*\n' +
    '/snipe <token> <max_sol> [slippage%] - Snipe token\n' +
    '/snipesetup <token> <max_sol> [slippage%] - Setup auto-snipe\n\n' +
    '*Portfolio:*\n' +
    '/positions - View your positions\n' +
    '/watchlist - View watchlist\n' +
    '/addwatchlist <token> - Add token to watchlist\n\n' +
    '*Devnet Testing:*\n' +
    '/devnettokens - Show popular devnet tokens\n' +
    '/tokeninfo <mint> - Get token information\n' +
    '/searchtoken <query> - Search for tokens\n\n' +
    '💡 Use buttons for quick access!';

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
});

// Handle custom amount input (text message) - must be after all other handlers
bot.on('text', async (ctx) => {
  // Skip if it's a command
  if (ctx.message.text.startsWith('/')) return;
  
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const tokenMint = hasPendingCustomSell(telegramId);
  if (!tokenMint) return; // Not a custom sell input

  const text = ctx.message.text.trim();
  
  // Check for cancel command
  if (text.toLowerCase() === '/cancel' || text.toLowerCase() === 'cancel') {
    clearPendingCustomSell(telegramId);
    return ctx.reply('❌ Custom sell cancelled.');
  }

  const amount = parseFloat(text);
  if (isNaN(amount) || amount <= 0) {
    return ctx.reply('❌ Invalid amount. Please enter a positive number.\n\nExample: 100 or 0.5\n\nUse /cancel to cancel.');
  }

  clearPendingCustomSell(telegramId);
  await handleSellCustomExecute(ctx, tokenMint, amount);
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Error:', err);
  ctx.reply('❌ An error occurred. Please try again.');
});

