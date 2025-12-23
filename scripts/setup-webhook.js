// Script to setup Telegram webhook
// Run this after deploying to Vercel: node scripts/setup-webhook.js

const axios = require('axios');
require('dotenv').config();

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_URL = process.env.VERCEL_URL 
  ? `https://${process.env.VERCEL_URL}/api/webhook`
  : process.env.WEBHOOK_URL;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

if (!WEBHOOK_URL) {
  console.error('❌ WEBHOOK_URL or VERCEL_URL is required');
  console.log('💡 Set WEBHOOK_URL in .env to your Vercel deployment URL');
  process.exit(1);
}

async function setupWebhook() {
  try {
    console.log('🔗 Setting up webhook...');
    console.log(`📍 Webhook URL: ${WEBHOOK_URL}`);
    
    const response = await axios.post(
      `https://api.telegram.org/bot${BOT_TOKEN}/setWebhook`,
      {
        url: WEBHOOK_URL,
        allowed_updates: ['message', 'callback_query'],
      }
    );

    if (response.data.ok) {
      console.log('✅ Webhook set successfully!');
      console.log(`📋 Webhook info:`, response.data);
    } else {
      console.error('❌ Failed to set webhook:', response.data);
    }
  } catch (error) {
    console.error('❌ Error setting webhook:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

setupWebhook();

