// Import shared bot setup
import { bot } from './bot-setup';

// Export bot instance for webhook usage (Vercel)
export { bot };

// Start bot only if not in Vercel environment
if (process.env.VERCEL !== '1' && !process.env.WEBHOOK_MODE) {
  bot.launch().then(() => {
    console.log('🤖 Bot is running in polling mode...');
  });

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
} else {
  console.log('🤖 Bot initialized for webhook mode (Vercel)');
}
