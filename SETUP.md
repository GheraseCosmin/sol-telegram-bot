# Ghid de Setup

## Pași de instalare rapidă

### 1. Instalează Node.js și pnpm

- Node.js v18 sau mai nou
- pnpm: `npm install -g pnpm`

### 2. Clonează și instalează dependențele

```bash
cd portfolio-sol-tg-bot
pnpm install
```

### 3. Configurează variabilele de mediu

Creează fișierul `.env`:

```bash
cp .env.example .env
```

Editează `.env` cu următoarele informații:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
DATABASE_URL=file:./data.db
```

**Obține Token Bot Telegram:**

1. Deschide Telegram și caută [@BotFather](https://t.me/botfather)
2. Trimite `/newbot`
3. Urmează instrucțiunile și copiază token-ul
4. Adaugă token-ul în `.env`

**RPC Endpoint (Recomandat pentru producție):**

- [Helius](https://www.helius.dev/) - Free tier disponibil
- [QuickNode](https://www.quicknode.com/) - Free tier disponibil
- [Alchemy](https://www.alchemy.com/) - Free tier disponibil

### 4. Inițializează baza de date

```bash
pnpm db:push
pnpm db:generate
```

### 5. Pornește botul

Development:

```bash
pnpm dev
```

Production:

```bash
pnpm build
pnpm start
```

## Testare

1. Deschide Telegram și caută botul tău
2. Trimite `/start`
3. Testează `/generatewallet`
4. Verifică balanța cu `/refresh`

## Troubleshooting

### Eroare: "TELEGRAM_BOT_TOKEN is required"

- Verifică că ai creat fișierul `.env`
- Verifică că token-ul este corect

### Eroare: "Failed to get quote" la swap

- Verifică că RPC endpoint-ul funcționează
- Verifică că token-ul există pe blockchain
- Verifică că ai suficiente SOL pentru fees

### Eroare la baza de date

- Șterge `data.db` și rulează din nou `pnpm db:push`
- Verifică că ai permisiuni de scriere în director

## Securitate

⚠️ **IMPORTANT:**

- Nu partaja niciodată fișierul `.env`
- Nu commit `.env` în git (este deja în `.gitignore`)
- Folosește un RPC endpoint sigur
- Testează întâi pe devnet

## Suport

Pentru probleme sau întrebări, verifică:

- [Solana Documentation](https://docs.solana.com/)
- [Jupiter API Docs](https://docs.jup.ag/)
- [Telegraf Documentation](https://telegraf.js.org/)
