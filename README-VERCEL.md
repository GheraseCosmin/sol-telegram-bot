# Deploy pe Vercel - Ghid Complet

## Problema

Vercel este o platformă serverless care nu poate rula aplicații long-running. Bot-ul Telegram folosește polling (`bot.launch()`) care necesită un proces continuu. Pentru Vercel, trebuie să folosim **webhooks**.

## Pași pentru Deploy

### 1. Configurează Environment Variables în Vercel

În Vercel Dashboard → Project Settings → Environment Variables, adaugă toate variabilele din `.env`:

- `TELEGRAM_BOT_TOKEN`
- `SOLANA_RPC_URL`
- `SOLANA_RPC_URL_DEVNET`
- `SOLANA_NETWORK` (opțional)
- `DATABASE_URL`
- `ENCRYPTION_KEY`
- `JUPITER_API_URL`
- `JUPITER_API_KEY`

### 2. Deploy pe Vercel

După deploy, obține URL-ul aplicației (ex: `https://your-app.vercel.app`)

### 3. Configurează Webhook-ul Telegram

După deploy, rulează scriptul pentru a configura webhook-ul:

```bash
# Setează WEBHOOK_URL în .env
WEBHOOK_URL=https://your-app.vercel.app/api/webhook

# Rulează scriptul
pnpm setup-webhook
```

Sau manual, folosind curl:

```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://your-app.vercel.app/api/webhook",
    "allowed_updates": ["message", "callback_query"]
  }'
```

### 4. Verifică Webhook-ul

Verifică dacă webhook-ul este setat corect:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

Ar trebui să vezi URL-ul tău Vercel în răspuns.

## Structura Proiectului

- `api/webhook.ts` - Endpoint serverless pentru webhook-uri Telegram
- `src/index.ts` - Bot setup (exportă instanța bot-ului)
- `vercel.json` - Configurație Vercel

## Testare

După ce ai configurat webhook-ul, trimite `/start` botului în Telegram. Ar trebui să primești răspuns.

## Troubleshooting

### Bot-ul nu răspunde

1. Verifică că webhook-ul este setat corect:
   ```bash
   curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
   ```

2. Verifică logs în Vercel Dashboard → Deployments → View Function Logs

3. Verifică că toate environment variables sunt setate corect

### Eroare 500 la webhook

- Verifică logs în Vercel
- Asigură-te că `DATABASE_URL` este accesibil (PostgreSQL trebuie să fie public sau folosește Prisma Accelerate)
- Verifică că toate dependențele sunt instalate corect

## Alternative la Vercel

Pentru un bot care rulează continuu, recomand:
- **Railway** - Suport excelent pentru Node.js apps
- **Render** - Similar cu Heroku
- **DigitalOcean App Platform**
- **VPS** (AWS EC2, DigitalOcean Droplet)

