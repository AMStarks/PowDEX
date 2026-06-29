const crypto = require('crypto');

let secp256k1;
try {
  secp256k1 = require('secp256k1');
} catch (_) {
  secp256k1 = null;
}

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Decode(input) {
  if (!input || typeof input !== 'string') return null;
  const bytes = [0];
  for (const char of input) {
    const value = BASE58_ALPHABET.indexOf(char);
    if (value < 0) return null;
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (const char of input) {
    if (char !== '1') break;
    bytes.push(0);
  }
  return Buffer.from(bytes.reverse());
}

function decodeSignature(signature) {
  if (!signature) return null;
  if (/^[0-9a-fA-F]+$/.test(signature) && signature.length >= 128) {
    return Buffer.from(signature.slice(0, 128), 'hex');
  }
  const decoded = base58Decode(signature);
  if (decoded && decoded.length === 64) return decoded;
  try {
    const b64 = Buffer.from(signature, 'base64');
    if (b64.length === 64) return b64;
  } catch (_) { /* ignore */ }
  return null;
}

function decodePublicKey(pubKey) {
  if (!pubKey) return null;
  if (/^[0-9a-fA-F]+$/.test(pubKey)) {
    const buf = Buffer.from(pubKey, 'hex');
    if (buf.length === 33 || buf.length === 65) return buf;
  }
  return null;
}

class BridgeSignatureService {
  buildAuthMessage({ tlsAddress, sessionToken, nonce, expiresAt }) {
    return `POWDEX_AUTH:${tlsAddress}:${sessionToken}:${nonce}:${expiresAt}`;
  }

  verifyAuthEnvelope(payload) {
    const {
      tlsAddress,
      sessionToken,
      nonce,
      expiresAt,
      signature,
      zeroaPubKey
    } = payload;

    if (!tlsAddress || !sessionToken || !nonce || !signature || !zeroaPubKey) {
      return { valid: false, error: 'Missing required fields' };
    }

    if (process.env.POWDEX_DEV_SKIP_SIG_VERIFY === '1') {
      return { valid: true, warning: 'POWDEX_DEV_SKIP_SIG_VERIFY=1' };
    }

    const message = this.buildAuthMessage({ tlsAddress, sessionToken, nonce, expiresAt });
    const digest = crypto.createHash('sha256').update(message, 'utf8').digest();
    const sig = decodeSignature(signature);
    const pub = decodePublicKey(zeroaPubKey);

    if (!sig) {
      return { valid: false, error: 'Invalid signature encoding' };
    }
    if (!pub) {
      return { valid: false, error: 'Invalid public key encoding' };
    }

    if (!secp256k1) {
      // Dev fallback when native module unavailable
      return { valid: true, warning: 'secp256k1 unavailable; dev verify skipped' };
    }

    try {
      const ok = secp256k1.ecdsaVerify(sig, digest, pub);
      return ok ? { valid: true } : { valid: false, error: 'Signature verification failed' };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}

module.exports = new BridgeSignatureService();
