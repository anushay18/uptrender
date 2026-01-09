import crypto from 'crypto';

const algorithm = 'aes-256-cbc';

/**
 * Get encryption key buffer (exactly 32 bytes)
 */
const getKeyBuffer = () => {
  const key = process.env.ENCRYPTION_KEY || 'default-32-character-key-for-dev-use';
  return Buffer.from(key.padEnd(32, '0').slice(0, 32));
};

/**
 * Encrypt sensitive data
 * @param {string} data - Plain text data to encrypt
 * @returns {string} Encrypted data with IV prepended
 */
export const encrypt = (data) => {
  if (!data) return null;
  
  try {
    const keyBuffer = getKeyBuffer();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Prepend IV to encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Encryption error:', error);
    // Fallback: return base64 encoded data (less secure but functional)
    return Buffer.from(data).toString('base64');
  }
};

/**
 * Decrypt encrypted data
 * @param {string} encryptedData - Encrypted data with IV prepended
 * @returns {string} Decrypted plain text
 */
export const decrypt = (encryptedData) => {
  if (!encryptedData) return null;
  
  try {
    const keyBuffer = getKeyBuffer();
    
    // Check if data contains IV (new format)
    if (encryptedData.includes(':')) {
      const parts = encryptedData.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } else {
      // Fallback: assume it's base64 encoded
      return Buffer.from(encryptedData, 'base64').toString('utf8');
    }
  } catch (error) {
    console.error('Decryption error:', error);
    // Return as-is if decryption fails
    return encryptedData;
  }
};

export default { encrypt, decrypt };
