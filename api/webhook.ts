// Vercel serverless function for Telegram webhook
import { bot } from '../dist/index';

export default async function handler(req: any, res: any) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Handle webhook update from Telegram
    await bot.handleUpdate(req.body);
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error('Error handling webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
