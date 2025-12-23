import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;

// In production, use a proper key management system
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(KEY_LENGTH).toString('hex');

function getKey(): Buffer {
  return Buffer.from(ENCRYPTION_KEY.slice(0, KEY_LENGTH * 2), 'hex');
}

/**
 * Encrypt private key before storing
 */
export function encryptPrivateKey(privateKey: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(privateKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypt private key
 */
export function decryptPrivateKey(encryptedKey: string): string {
  try {
    const key = getKey();
    const parts = encryptedKey.split(':');
    
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted key format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    if (error.code === 'ERR_OSSL_BAD_DECRYPT') {
      throw new Error(
        'Failed to decrypt private key. This usually means the encryption key has changed. ' +
        'Please regenerate your wallet or ensure ENCRYPTION_KEY in .env matches the one used when the wallet was created.'
      );
    }
    throw error;
  }
}

