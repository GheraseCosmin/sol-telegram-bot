import {
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import axios from "axios";
import * as bip39 from "bip39";
import bs58 from "bs58";
import { derivePath } from "ed25519-hd-key";

// Use devnet if SOLANA_NETWORK=devnet, otherwise use mainnet
const getRpcUrl = () => {
  if (process.env.SOLANA_NETWORK === "devnet") {
    return process.env.SOLANA_RPC_URL_DEVNET || "https://api.devnet.solana.com";
  }
  return process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
};

// Get Jupiter Ultra Swap API URL
const getJupiterApiUrl = () => {
  // Jupiter Ultra Swap API endpoint
  const defaultUrl = "https://api.jup.ag/ultra/v1";
  return process.env.JUPITER_API_URL || defaultUrl;
};

// Get Jupiter API Key
const getJupiterApiKey = () => {
  return process.env.JUPITER_API_KEY || "";
};

const connection = new Connection(getRpcUrl(), "confirmed");

export interface WalletInfo {
  address: string;
  balance: number;
  balanceUSD: number;
}

/**
 * Generate a new Solana wallet from mnemonic
 */
export function generateWalletFromMnemonic(mnemonic: string): Keypair {
  const seed = bip39.mnemonicToSeedSync(mnemonic);
  const derivedSeed = derivePath("m/44'/501'/0'/0'", seed.toString("hex")).key;
  return Keypair.fromSeed(derivedSeed);
}

/**
 * Generate a new random wallet
 */
export function generateNewWallet(): { keypair: Keypair; mnemonic: string } {
  const mnemonic = bip39.generateMnemonic();
  const keypair = generateWalletFromMnemonic(mnemonic);
  return { keypair, mnemonic };
}

/**
 * Import wallet from private key (base58)
 */
export function importWalletFromPrivateKey(privateKey: string): Keypair {
  const secretKey = bs58.decode(privateKey);
  return Keypair.fromSecretKey(secretKey);
}

/**
 * Get wallet balance
 */
export async function getWalletBalance(address: string): Promise<WalletInfo> {
  try {
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    const solBalance = balance / LAMPORTS_PER_SOL;

    // Get SOL price (simplified - you might want to use a real API)
    const solPrice = await getSOLPrice();
    const balanceUSD = solBalance * solPrice;

    return {
      address,
      balance: solBalance,
      balanceUSD,
    };
  } catch (error) {
    throw new Error(`Failed to get wallet balance: ${error}`);
  }
}

/**
 * Transfer SOL
 */
export async function transferSOL(
  fromPrivateKey: string,
  toAddress: string,
  amount: number
): Promise<string> {
  try {
    const fromKeypair = importWalletFromPrivateKey(fromPrivateKey);
    const toPublicKey = new PublicKey(toAddress);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: fromKeypair.publicKey,
        toPubkey: toPublicKey,
        lamports: amount * LAMPORTS_PER_SOL,
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [
      fromKeypair,
    ]);

    return signature;
  } catch (error) {
    throw new Error(`Transfer failed: ${error}`);
  }
}

/**
 * Transfer SPL Token
 */
export async function transferSPLToken(
  fromPrivateKey: string,
  toAddress: string,
  tokenMint: string,
  amount: number,
  decimals: number = 9
): Promise<string> {
  try {
    const fromKeypair = importWalletFromPrivateKey(fromPrivateKey);
    const toPublicKey = new PublicKey(toAddress);
    const mintPublicKey = new PublicKey(tokenMint);

    const fromTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      fromKeypair.publicKey
    );

    const toTokenAccount = await getAssociatedTokenAddress(
      mintPublicKey,
      toPublicKey
    );

    const transaction = new Transaction().add(
      createTransferInstruction(
        fromTokenAccount,
        toTokenAccount,
        fromKeypair.publicKey,
        BigInt(amount * Math.pow(10, decimals)),
        [],
        TOKEN_PROGRAM_ID
      )
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [
      fromKeypair,
    ]);

    return signature;
  } catch (error) {
    throw new Error(`Token transfer failed: ${error}`);
  }
}

/**
 * Get SOL price in USD
 */
async function getSOLPrice(): Promise<number> {
  try {
    const response = await axios.get(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    return response.data.solana.usd || 0;
  } catch (error) {
    // Fallback price if API fails
    return 100;
  }
}

/**
 * Get token price from Jupiter Ultra Swap API
 */
export async function getTokenPrice(tokenMint: string): Promise<number> {
  try {
    const jupiterApiUrl = getJupiterApiUrl();
    const apiKey = getJupiterApiKey();
    const SOL_MINT = "So11111111111111111111111111111111111111112";

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    // Get order for 1 SOL to estimate price
    const orderParams = new URLSearchParams({
      inputMint: SOL_MINT,
      outputMint: tokenMint,
      amount: "1000000000", // 1 SOL in lamports
      // Note: taker is optional for price estimation
    });

    const response = await axios.get(
      `${jupiterApiUrl}/order?${orderParams.toString()}`,
      {
        headers,
        timeout: 10000,
      }
    );

    if (response.data && response.data.outputAmount) {
      const outputAmount = parseFloat(response.data.outputAmount);
      const outputDecimals = response.data.outputDecimals || 9;
      const outputInNativeUnits = outputAmount / Math.pow(10, outputDecimals);
      // Price per token = 1 SOL / output tokens
      return 1 / outputInNativeUnits;
    }

    return 0;
  } catch (error) {
    return 0;
  }
}

/**
 * Get token decimals from Jupiter API or use default
 */
async function getTokenDecimals(tokenMint: string): Promise<number> {
  try {
    // Try to get token info from Jupiter Price API which includes decimals
    const apiKey = getJupiterApiKey();
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    const response = await axios.get(
      `https://api.jup.ag/price/v3?ids=${tokenMint}`,
      { headers, timeout: 5000 }
    );

    if (response.data && response.data[tokenMint]?.decimals) {
      return response.data[tokenMint].decimals;
    }
  } catch (error) {
    // Fallback to default
  }

  // Default decimals: 9 for SOL, 6 for most stablecoins, 9 for most tokens
  // We'll use 9 as default and let the API handle it
  return 9;
}

/**
 * Swap tokens using Jupiter Ultra Swap API
 * Reference: https://dev.jup.ag/docs/ultra/get-started
 */
export async function swapTokens(
  privateKey: string,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50,
  inputDecimals?: number // Optional: if not provided, will fetch from API
): Promise<string> {
  try {
    const keypair = importWalletFromPrivateKey(privateKey);
    const jupiterApiUrl = getJupiterApiUrl();
    const apiKey = getJupiterApiKey();
    const taker = keypair.publicKey.toString();

    // Prepare headers
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["x-api-key"] = apiKey;
    }

    // Step 1: Get Order (quote + transaction)
    // Amount should be in native token units (before decimals)
    // Get decimals for input token
    const decimals =
      inputDecimals !== undefined
        ? inputDecimals
        : await getTokenDecimals(inputMint);

    // Convert UI amount to native units
    // Use Math.floor to avoid exceeding available balance
    // But for very precise amounts, we might need to handle rounding differently
    const amountInNativeUnits = Math.floor(amount * Math.pow(10, decimals));

    // Ensure we don't send 0 amount
    if (amountInNativeUnits <= 0) {
      throw new Error(
        `Invalid amount: ${amount} (converted to ${amountInNativeUnits} native units)`
      );
    }

    const orderParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amountInNativeUnits.toString(),
      taker,
    });

    const orderResponse = await axios.get(
      `${jupiterApiUrl}/order?${orderParams.toString()}`,
      {
        headers,
        timeout: 30000,
      }
    );

    if (!orderResponse.data || !orderResponse.data.transaction) {
      throw new Error("Failed to get order from Jupiter Ultra Swap API");
    }

    const { transaction: transactionBase64, requestId } = orderResponse.data;

    // Step 2: Deserialize and sign transaction
    // Jupiter Ultra Swap API returns VersionedTransaction
    const transactionBuffer = Buffer.from(transactionBase64, "base64");
    let transaction: Transaction | VersionedTransaction;

    try {
      // Try to deserialize as VersionedTransaction first (most common)
      transaction = VersionedTransaction.deserialize(transactionBuffer);
      // Sign versioned transaction
      transaction.sign([keypair]);
    } catch (error) {
      // Fallback to regular Transaction if it's not versioned
      transaction = Transaction.from(transactionBuffer);
      transaction.partialSign(keypair);
    }

    // Step 3: Execute Order
    // Serialize transaction based on type
    let serializedTransaction: Buffer;
    if (transaction instanceof VersionedTransaction) {
      serializedTransaction = Buffer.from(transaction.serialize());
    } else {
      serializedTransaction = transaction.serialize();
    }

    const executeResponse = await axios.post(
      `${jupiterApiUrl}/execute`,
      {
        requestId,
        signedTransaction: serializedTransaction.toString("base64"),
      },
      {
        headers,
        timeout: 30000,
      }
    );

    if (!executeResponse.data || !executeResponse.data.signature) {
      throw new Error("Failed to execute order");
    }

    const signature = executeResponse.data.signature;

    // Wait for confirmation
    await connection.confirmTransaction(signature, "confirmed");

    return signature;
  } catch (error: any) {
    if (error.code === "ENOTFOUND" || error.code === "ECONNREFUSED") {
      throw new Error(
        `Cannot connect to Jupiter API. Please check your internet connection and try again. Error: ${error.message}`
      );
    }
    if (error.response) {
      const errorMessage =
        error.response.data?.message ||
        error.response.data?.error ||
        error.response.statusText;
      throw new Error(
        `Jupiter Ultra Swap API error: ${error.response.status} - ${errorMessage}`
      );
    }
    throw new Error(`Swap failed: ${error.message || error}`);
  }
}

/**
 * Snipe a token (buy immediately when detected)
 */
export async function snipeToken(
  privateKey: string,
  tokenMint: string,
  maxBuyAmount: number,
  slippageBps: number = 500 // 5% slippage for sniping
): Promise<string> {
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  return swapTokens(privateKey, SOL_MINT, tokenMint, maxBuyAmount, slippageBps);
}

export { connection };
