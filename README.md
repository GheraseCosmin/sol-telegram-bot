# Solana Telegram Trading Bot

Un bot Telegram complet pentru trading și managementul portofoliului Solana.

## Funcționalități

- 🔐 **Gestionare Wallet**
  - Generare wallet nou
  - Import wallet existent (private key sau mnemonic)
  - Verificare balanță

- 💸 **Transferuri**
  - Transfer SOL
  - Transfer tokenuri SPL

- 🔄 **Trading**
  - Buy/Sell tokenuri prin Jupiter Aggregator
  - Swap automat cu slippage configurable

- 🎯 **Snipe**
  - Snipe manual tokenuri
  - Configurare auto-snipe

- 📊 **Portofoliu**
  - Vizualizare poziții
  - Watchlist tokenuri
  - Tracking prețuri

## Instalare

1. Clonează repository-ul:
```bash
git clone <repository-url>
cd portfolio-sol-tg-bot
```

2. Instalează dependențele:
```bash
pnpm install
```

3. Configurează variabilele de mediu:
```bash
cp .env.example .env
```

Editează `.env` și adaugă:
- `TELEGRAM_BOT_TOKEN` - Token-ul botului Telegram (obține-l de la [@BotFather](https://t.me/botfather))
- `SOLANA_RPC_URL` - URL-ul RPC pentru Solana (recomandat: Helius, QuickNode sau alte servicii premium)
- `DATABASE_URL` - URL-ul bazei de date (default: `file:./data.db`)

4. Inițializează baza de date:
```bash
pnpm db:push
pnpm db:generate
```

5. Pornește botul:
```bash
pnpm dev
```

Pentru producție:
```bash
pnpm build
pnpm start
```

## Comenzi

### Wallet
- `/generatewallet` - Generează un wallet nou
- `/importwallet <private_key_or_mnemonic>` - Importă wallet existent
- `/refresh` - Actualizează balanța

### Transferuri
- `/transfer <address> <amount>` - Transferă SOL
- `/transfertoken <token_mint> <address> <amount>` - Transferă token

### Trading
- `/buy <token_mint> <sol_amount> [slippage%]` - Cumpără token
- `/sell <token_mint> <token_amount> [slippage%]` - Vinde token

### Snipe
- `/snipe <token_mint> <max_sol_amount> [slippage%]` - Snipe manual
- `/snipesetup <token_mint> <max_sol_amount> [slippage%]` - Configurează auto-snipe

### Portofoliu
- `/positions` - Vezi pozițiile tale
- `/watchlist` - Vezi watchlist-ul
- `/addwatchlist <token_mint>` - Adaugă token la watchlist

### Altele
- `/start` - Mesaj de start cu butoane
- `/help` - Ajutor

## Exemple

### Generare wallet
```
/generatewallet
```

### Import wallet
```
/importwallet your_private_key_here
```

### Buy token
```
/buy EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 0.1 1
```
(USDC, 0.1 SOL, 1% slippage)

### Transfer SOL
```
/transfer 26ngoBBTtxc1YRF4qGs2AzrZxzfoFi37v81Sn6b5C9df 0.5
```

### Snipe token
```
/snipe EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 0.5 5
```

## Securitate

⚠️ **IMPORTANT:**
- Cheile private sunt criptate în baza de date
- Nu partaja niciodată mnemonic-ul sau cheia privată
- Folosește un RPC endpoint sigur și cu rate limits bune
- Testează întâi pe devnet înainte de a folosi mainnet

## Structura Proiectului

```
portfolio-sol-tg-bot/
├── src/
│   ├── handlers/        # Handlers pentru comenzi
│   │   ├── wallet.ts
│   │   ├── transfer.ts
│   │   ├── swap.ts
│   │   ├── snipe.ts
│   │   ├── positions.ts
│   │   └── watchlist.ts
│   ├── utils/           # Utilități
│   │   ├── database.ts
│   │   ├── solana.ts
│   │   └── encryption.ts
│   └── index.ts         # Entry point
├── prisma/
│   └── schema.prisma    # Schema baza de date
├── package.json
├── tsconfig.json
└── README.md
```

## Dependențe Principale

- `telegraf` - Framework Telegram Bot
- `@solana/web3.js` - SDK Solana
- `@solana/spl-token` - Tokenuri SPL
- `prisma` - ORM pentru baza de date
- `jupiter-api` - Pentru swap-uri (prin API)

## Note

- Botul folosește Jupiter Aggregator pentru swap-uri (cel mai bun preț)
- RPC endpoint-ul este important pentru viteza și fiabilitate
- Recomandăm folosirea unui serviciu premium RPC pentru producție
- Baza de date folosește SQLite (poate fi schimbată în PostgreSQL pentru producție)

## Licență

MIT

# sol-telegram-bot
