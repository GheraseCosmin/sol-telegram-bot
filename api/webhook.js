"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = handler;
// Vercel serverless function for Telegram webhook
// Import bot instance from compiled dist
const index_1 = require("../dist/index");
async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    try {
        // Handle webhook update from Telegram
        await index_1.bot.handleUpdate(req.body);
        return res.status(200).json({ ok: true });
    }
    catch (error) {
        console.error('Error handling webhook:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=webhook.js.map