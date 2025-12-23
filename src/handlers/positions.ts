import { Context } from 'telegraf';
import prisma from '../utils/database';
import { connection } from '../utils/solana';
import { getAccount, getAssociatedTokenAddress } from '@solana/spl-token';
import { PublicKey } from '@solana/web3.js';
import axios from 'axios';

/**
 * Get token metadata (name and symbol) from Jupiter Tokens API V2
 * Reference: https://dev.jup.ag/docs/tokens/v2/token-information
 */
async function getTokenMetadata(mint: string): Promise<{ name: string; symbol: string } | null> {
  try {
    const apiKey = process.env.JUPITER_API_KEY || '';
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['x-api-key'] = apiKey;
    }

    // Use Jupiter Tokens API V2 search endpoint
    // Can search by symbol, name, or mint address
    // Returns array of tokens matching the query
    const response = await axios.get(
      `https://api.jup.ag/tokens/v2/search?query=${mint}`,
      { headers, timeout: 10000 }
    );

    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      // Find exact match by mint address
      // In Jupiter API V2, the mint address is in the 'id' field
      const token = response.data.find((t: any) => {
        // Check both 'id' and 'mint' fields for compatibility
        const tokenId = t.id || t.mint;
        return tokenId === mint;
      });
      
      if (token) {
        return {
          name: token.name || 'Unknown Token',
          symbol: token.symbol || 'UNKNOWN',
        };
      }
      
      // Debug: log first result to see structure
      if (response.data.length > 0) {
        console.log(`Token search result for ${mint}:`, {
          found: response.data.length,
          firstResult: {
            id: response.data[0].id,
            mint: response.data[0].mint,
            name: response.data[0].name,
            symbol: response.data[0].symbol,
          },
        });
      }
    }

    return null;
  } catch (error: any) {
    // Log error but don't throw - we'll use fallback
    if (error.response) {
      console.error(`Error fetching metadata for ${mint}: ${error.response.status} - ${error.response.statusText}`);
    } else {
      console.error(`Error fetching metadata for ${mint}:`, error.message);
    }
    return null;
  }
}

/**
 * Get user positions
 */
export async function handlePositions(ctx: Context) {
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return ctx.reply('❌ Unable to identify user');
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
      include: { positions: true },
    });

    if (!user) {
      return ctx.reply('❌ No wallet found. Use /generatewallet first.');
    }

    // Get actual token balances from blockchain
    const walletPubkey = new PublicKey(user.walletAddress);
    const positions = [];

    // Check SOL balance
    const solBalance = await connection.getBalance(walletPubkey);
    if (solBalance > 0) {
      positions.push({
        symbol: 'SOL',
        mint: 'So11111111111111111111111111111111111111112',
        amount: solBalance / 1e9,
      });
    }

    // Get token accounts (simplified - you might want to use a more comprehensive method)
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      walletPubkey,
      { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );

    for (const account of tokenAccounts.value) {
      const amount = account.account.data.parsed.info.tokenAmount.uiAmount;
      if (amount > 0) {
        positions.push({
          symbol: account.account.data.parsed.info.mint,
          mint: account.account.data.parsed.info.mint,
          amount,
        });
      }
    }

    if (positions.length === 0) {
      return ctx.reply('📊 *Your Positions*\n\nNo positions found.', {
        parse_mode: 'Markdown',
      });
    }

    // Fetch metadata for all tokens in parallel
    await ctx.reply('⏳ Loading token information...');

    const positionsWithMetadata = await Promise.all(
      positions.map(async (pos) => {
        // SOL doesn't need metadata lookup
        if (pos.mint === 'So11111111111111111111111111111111111111112') {
          return {
            ...pos,
            name: 'Solana',
            symbol: 'SOL',
          };
        }

        const metadata = await getTokenMetadata(pos.mint);
        return {
          ...pos,
          name: metadata?.name || 'Unknown Token',
          symbol: metadata?.symbol || pos.mint.slice(0, 8) + '...',
        };
      })
    );

    let message = '📊 <b>Your Positions</b>\n\n';
    positionsWithMetadata.forEach((pos, index) => {
      message += `${index + 1}. <b>${pos.name}</b> (${pos.symbol})\n`;
      message += `   💰 Amount: ${pos.amount.toFixed(4)}\n`;
      message += `   🔗 Mint: <code>${pos.mint}</code>\n\n`;
    });

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error: any) {
    console.error('Error getting positions:', error);
    ctx.reply(`❌ Failed to get positions: ${error.message || 'Unknown error'}`);
  }
}

