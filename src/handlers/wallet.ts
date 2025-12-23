import { Context } from 'telegraf';
import prisma from '../utils/database';
import {
  generateNewWallet,
  importWalletFromPrivateKey,
  getWalletBalance,
} from '../utils/solana';
import { encryptPrivateKey, decryptPrivateKey } from '../utils/encryption';
import bs58 from 'bs58';

/**
 * Generate a new wallet for user
 */
export async function handleGenerateWallet(ctx: Context) {
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return ctx.reply('❌ Unable to identify user');
    }

    // Check if user already has a wallet
    const existingUser = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (existingUser) {
      return ctx.reply(
        '⚠️ You already have a wallet!\n\n' +
        `Address: \`${existingUser.walletAddress}\`\n\n` +
        'Use /importwallet to import a different wallet.',
        { parse_mode: 'Markdown' }
      );
    }

    const { keypair } = generateNewWallet();
    const address = keypair.publicKey.toString();
    const privateKey = bs58.encode(keypair.secretKey);
    const encryptedPrivateKey = encryptPrivateKey(privateKey);

    // Store wallet in database
    await prisma.user.create({
      data: {
        telegramId,
        username: ctx.from?.username || null,
        walletAddress: address,
        privateKey: encryptedPrivateKey,
      },
    });

    const balance = await getWalletBalance(address);

    await ctx.reply(
      '✅ *Wallet Generated Successfully!*\n\n' +
      `📍 *Address:*\n\`${address}\`\n\n` +
      `💰 *Balance:* ${balance.balance.toFixed(4)} SOL ($${balance.balanceUSD.toFixed(2)})\n\n` +
      `🔑 *Private Key:*\n\`${privateKey}\`\n\n` +
      '⚠️ *IMPORTANT:* Save your private key securely! Never share it with anyone.',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error generating wallet:', error);
    ctx.reply('❌ Failed to generate wallet. Please try again.');
  }
}

/**
 * Import existing wallet
 */
export async function handleImportWallet(ctx: Context, privateKey: string) {
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return ctx.reply('❌ Unable to identify user');
    }

    // Import as private key
    const keypair = importWalletFromPrivateKey(privateKey);
    const address = keypair.publicKey.toString();

    const privateKeyEncoded = bs58.encode(keypair.secretKey);
    const encryptedPrivateKey = encryptPrivateKey(privateKeyEncoded);

    // Check if wallet already exists
    const existingWallet = await prisma.user.findUnique({
      where: { walletAddress: address },
    });

    if (existingWallet && existingWallet.telegramId !== telegramId) {
      return ctx.reply('❌ This wallet is already imported by another user.');
    }

    // Update or create user
    await prisma.user.upsert({
      where: { telegramId },
      update: {
        walletAddress: address,
        privateKey: encryptedPrivateKey,
        username: ctx.from?.username || undefined,
      },
      create: {
        telegramId,
        username: ctx.from?.username || null,
        walletAddress: address,
        privateKey: encryptedPrivateKey,
      },
    });

    const balance = await getWalletBalance(address);

    await ctx.reply(
      '✅ *Wallet Imported Successfully!*\n\n' +
      `📍 *Address:*\n\`${address}\`\n\n` +
      `💰 *Balance:* ${balance.balance.toFixed(4)} SOL ($${balance.balanceUSD.toFixed(2)})`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error importing wallet:', error);
    ctx.reply('❌ Failed to import wallet. Please check your private key.');
  }
}

/**
 * Reset/Delete wallet (useful when encryption key changes)
 */
export async function handleResetWallet(ctx: Context) {
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return ctx.reply('❌ Unable to identify user');
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return ctx.reply('❌ No wallet found. Nothing to reset.');
    }

    // Delete user and all related data (cascade will handle related records)
    await prisma.user.delete({
      where: { telegramId },
    });

    await ctx.reply(
      '✅ *Wallet Reset Successfully!*\n\n' +
      'Your wallet and all associated data have been deleted.\n\n' +
      'You can now create a new wallet with /generatewallet or import an existing one with /importwallet.',
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error resetting wallet:', error);
    ctx.reply('❌ Failed to reset wallet. Please try again.');
  }
}

/**
 * Get wallet balance
 */
export async function handleRefreshBalance(ctx: Context) {
  try {
    const telegramId = ctx.from?.id.toString();
    if (!telegramId) {
      return ctx.reply('❌ Unable to identify user');
    }

    const user = await prisma.user.findUnique({
      where: { telegramId },
    });

    if (!user) {
      return ctx.reply(
        '❌ No wallet found. Use /generatewallet to create one or /importwallet to import existing.'
      );
    }

    const balance = await getWalletBalance(user.walletAddress);

    await ctx.reply(
      '💰 *Wallet Balance*\n\n' +
      `📍 *Address:*\n\`${user.walletAddress}\`\n\n` +
      `💵 *Balance:* ${balance.balance.toFixed(4)} SOL\n` +
      `💲 *USD Value:* $${balance.balanceUSD.toFixed(2)}`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Error refreshing balance:', error);
    ctx.reply('❌ Failed to refresh balance. Please try again.');
  }
}

