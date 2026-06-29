const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');

/**
 * Testnet-only HTLC orchestration scaffold.
 * Does not broadcast or move mainnet funds.
 */
class HTLCService {
  constructor() {
    this.swaps = new Map();
    this.enabled = process.env.POWDEX_HTLC_ENABLED !== '0';
    this.testnetOnly = process.env.POWDEX_MAINNET_HTLC !== '1';
  }

  isEnabled() {
    return this.enabled;
  }

  createSwap({ bridgeSessionId, pair, side, amount, price, tlsAddress }) {
    if (!this.enabled) {
      return { success: false, error: 'HTLC disabled' };
    }
    if (pair !== 'BTC/TLS') {
      return { success: false, error: 'Only BTC/TLS supported in v1' };
    }
    if (!bridgeSessionId || !amount || !side) {
      return { success: false, error: 'Missing required fields' };
    }

    const swapId = uuidv4();
    const secret = crypto.randomBytes(32).toString('hex');
    const secretHash = crypto.createHash('sha256').update(Buffer.from(secret, 'hex')).digest('hex');
    const locktime = Math.floor(Date.now() / 1000) + 3600;

    const swap = {
      swapId,
      bridgeSessionId,
      pair,
      side,
      amount: parseFloat(amount),
      price: price ? parseFloat(price) : null,
      tlsAddress: tlsAddress || null,
      status: 'awaiting_signatures',
      testnet: this.testnetOnly,
      secretHash,
      locktime,
      btcUnsignedTx: this._mockUnsignedTx('btc', swapId, secretHash),
      tlsUnsignedTx: this._mockUnsignedTx('tls', swapId, secretHash),
      createdAt: new Date().toISOString()
    };

    this.swaps.set(swapId, swap);
    return { success: true, swap };
  }

  getSwap(swapId) {
    return this.swaps.get(swapId) || null;
  }

  updateSwap(swapId, patch) {
    const swap = this.swaps.get(swapId);
    if (!swap) return null;
    Object.assign(swap, patch);
    this.swaps.set(swapId, swap);
    return swap;
  }

  submitSignedLeg(swapId, chain, signedTx, txid) {
    const swap = this.swaps.get(swapId);
    if (!swap) {
      return { success: false, error: 'Swap not found' };
    }

    if (chain === 'BTC') {
      swap.btcSignedTx = signedTx;
      swap.btcTxid = txid || null;
    } else if (chain === 'TLS') {
      swap.tlsSignedTx = signedTx;
      swap.tlsTxid = txid || null;
    } else {
      return { success: false, error: 'Unsupported chain' };
    }

    if (swap.btcSignedTx && swap.tlsSignedTx) {
      swap.status = 'signed_ready_for_broadcast';
    } else {
      swap.status = 'partially_signed';
    }

    this.swaps.set(swapId, swap);
    return { success: true, swap };
  }

  _mockUnsignedTx(chain, swapId, secretHash) {
    const prefix = chain === 'btc' ? '0200000001' : 'tls_unsigned_';
    return `${prefix}${swapId.replace(/-/g, '')}${secretHash.slice(0, 16)}`;
  }
}

module.exports = new HTLCService();
