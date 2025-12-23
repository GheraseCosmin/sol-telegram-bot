import { Context } from 'telegraf';
import axios from 'axios';

/**
 * Get popular devnet tokens for testing
 */
export async function handleDevnetTokens(ctx: Context) {
  try {
    // Popular devnet tokens (these are commonly available on devnet)
    const devnetTokens = [
      {
        symbol: 'USDC',
        mint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // USDC on devnet
        description: 'USD Coin (Devnet)',
      },
      {
        symbol: 'USDT',
        mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT on devnet
        description: 'Tether USD (Devnet)',
      },
      {
        symbol: 'BONK',
        mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // BONK on devnet (if available)
        description: 'Bonk Token (Devnet)',
      },
    ];

    let message = '🪙 <b>Popular Devnet Tokens for Testing</b>\n\n';
    message += 'These tokens are commonly available on Solana Devnet:\n\n';

    devnetTokens.forEach((token, index) => {
      message += `${index + 1}. <b>${token.symbol}</b>\n`;
      message += `   Mint: <code>${token.mint}</code>\n`;
      message += `   ${token.description}\n\n`;
    });

    message += '💡 <b>How to get SOL on Devnet:</b>\n';
    message += '1. Visit: <a href="https://faucet.solana.com">https://faucet.solana.com</a>\n';
    message += '2. Enter your wallet address\n';
    message += '3. Request SOL (you can request multiple times)\n\n';
    message += '💡 <b>How to test buy/sell:</b>\n';
    message += '1. Get SOL from faucet\n';
    message += '2. Use /buy with one of the token mints above\n';
    message += '3. Use /sell to sell tokens back\n\n';
    message += 'Example: <code>/buy 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU 0.1</code>';

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error: any) {
    console.error('Error getting devnet tokens:', error);
    ctx.reply('❌ Failed to get devnet tokens info.');
  }
}

/**
 * Get token info from Jupiter
 */
export async function handleTokenInfo(ctx: Context, tokenMint: string) {
  try {
    const jupiterApiUrl = process.env.JUPITER_API_URL || 'https://api.jup.ag/ultra/v1';
    const apiKey = process.env.JUPITER_API_KEY || '';
    const SOL_MINT = 'So11111111111111111111111111111111111111112';

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    // Try to get an order to see if token exists
    try {
      const orderParams = new URLSearchParams({
        inputMint: SOL_MINT,
        outputMint: tokenMint,
        amount: '1000000000', // 1 SOL
        // taker is optional for price estimation
      });

      const response = await axios.get(`${jupiterApiUrl}/order?${orderParams.toString()}`, {
        headers,
        timeout: 10000,
      });

      if (response.data) {
        const order = response.data;
        const outputAmount = parseFloat(order.outputAmount || '0');
        const outputDecimals = order.outputDecimals || 9;
        const outAmount = outputAmount / Math.pow(10, outputDecimals);
        const price = 1 / outAmount;

        await ctx.reply(
          `✅ <b>Token Found!</b>\n\n` +
          `🪙 <b>Mint:</b> <code>${tokenMint}</code>\n` +
          `💵 <b>Price:</b> $${price.toFixed(6)} per token\n` +
          `📊 <b>Estimated Output:</b> ${outAmount.toFixed(4)} tokens for 1 SOL\n` +
          `🔄 <b>Swap Type:</b> ${order.swapType || 'N/A'}\n\n` +
          `You can use this token for buy/sell testing!`,
          { parse_mode: 'HTML' }
        );
      }
    } catch (error: any) {
      if (error.response?.status === 400 || error.response?.status === 404) {
        await ctx.reply(
          `❌ Token not found or no liquidity available.\n\n` +
          `Mint: <code>${tokenMint}</code>\n\n` +
          `💡 Try using /devnettokens to see available tokens.`,
          { parse_mode: 'HTML' }
        );
      } else {
        throw error;
      }
    }
  } catch (error: any) {
    console.error('Error getting token info:', error);
    ctx.reply(`❌ Failed to get token info: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Search for tokens on Jupiter
 */
export async function handleSearchToken(ctx: Context, searchQuery: string) {
  try {
    // Note: Jupiter API doesn't have a direct search endpoint
    // This is a placeholder - you might need to use a different API or maintain a token list
    await ctx.reply(
      '🔍 <b>Token Search</b>\n\n' +
      'Jupiter API doesn\'t provide a direct search endpoint.\n\n' +
      '💡 <b>Alternatives:</b>\n' +
      '1. Use /devnettokens to see popular devnet tokens\n' +
      '2. Use /tokeninfo &lt;mint&gt; to check if a token exists\n' +
      '3. Check Solana Explorer: <a href="https://explorer.solana.com/?cluster=devnet">Solana Explorer Devnet</a>\n' +
      '4. Use Birdeye API or other token discovery services',
      { parse_mode: 'HTML' }
    );
  } catch (error: any) {
    console.error('Error searching token:', error);
    ctx.reply('❌ Failed to search token.');
  }
}

