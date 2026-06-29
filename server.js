const path = require('path');
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const cron = require('node-cron');
require('dotenv').config();

// Database imports
const db = require('./models');
const DatabaseService = require('./services/DatabaseService');
const PriceFeedService = require('./services/PriceFeedService');
const BridgeSignatureService = require('./services/BridgeSignatureService');
const BridgeReplayStore = require('./services/BridgeReplayStore');
const HTLCService = require('./services/HTLCService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

app.use(compression());
app.use(cors({
  origin: process.env.CLIENT_URL || "http://localhost:3000",
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize database
let dbInitialized = false;
const devNoDb = process.env.POWDEX_DEV_NO_DB === '1';

async function initializeDatabase() {
  if (devNoDb) {
    console.warn('⚠️ POWDEX_DEV_NO_DB=1 — running without PostgreSQL (bridge + static only)');
    return;
  }
  try {
    await DatabaseService.initialize();
    await db.sequelize.sync({ alter: true });
    dbInitialized = true;
    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

// Initialize database on startup
initializeDatabase();

// Supported cryptocurrencies
const SUPPORTED_COINS = ['BTC', 'LTC', 'TLS', 'USDT', 'USDC'];

const MARKET_PAIRS = [
  { pair: 'BTC/TLS', settlement: 'pre-settlement', label: 'BTC/TLS (foundation)' },
  { pair: 'BTC/USDT', settlement: 'price-only', label: 'BTC/USDT (oracle)' },
  { pair: 'BTC/USDC', settlement: 'price-only', label: 'BTC/USDC (oracle)' },
  { pair: 'LTC/USDT', settlement: 'price-only', label: 'LTC/USDT (oracle)' },
  { pair: 'LTC/USDC', settlement: 'price-only', label: 'LTC/USDC (oracle)' },
  { pair: 'TLS/USDT', settlement: 'price-only', label: 'TLS/USDT (oracle)' },
  { pair: 'TLS/USDC', settlement: 'price-only', label: 'TLS/USDC (oracle)' },
  { pair: 'BTC/LTC', settlement: 'price-only', label: 'BTC/LTC (oracle)' },
  { pair: 'LTC/TLS', settlement: 'price-only', label: 'LTC/TLS (oracle)' }
];

const ORDER_MATCH_PAIRS = [
  'BTC/TLS',
  'BTC/USDT',
  'BTC/USDC',
  'LTC/USDT',
  'LTC/USDC',
  'TLS/USDT',
  'TLS/USDC'
];

// Mock price data (will be replaced with real price feeds)
let currentPrices = {
  'BTC/USDT': 45000,
  'BTC/USDC': 45000,
  'LTC/USDT': 120,
  'LTC/USDC': 120,
  'TLS/USDT': 0.85,
  'TLS/USDC': 0.85,
  'BTC/LTC': 375,
  'BTC/TLS': 52941,
  'LTC/TLS': 141
};

// Security utilities
class SecurityManager {
  static generateNonce() {
    return crypto.randomBytes(32).toString('hex');
  }

  static hashMessage(message, nonce) {
    return crypto.createHash('sha256').update(message + nonce).digest('hex');
  }

  static verifySignature(message, signature, publicKey) {
    // In production, use proper cryptographic verification
    return true; // Simplified for demo
  }
}

// Wallet connector service
class WalletConnector {
  constructor() {
    this.connections = new Map();
    this.pendingConnections = new Map();
  }

  generateConnectionRequest(userId) {
    const connectionId = uuidv4();
    const nonce = SecurityManager.generateNonce();
    const timestamp = Date.now();
    
    const connectionRequest = {
      connectionId,
      userId,
      nonce,
      timestamp,
      message: `Connect to PowDEX - ${userId} - ${timestamp}`
    };
    
    this.pendingConnections.set(connectionId, connectionRequest);
    
    // Clean up old pending connections (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    for (const [id, request] of this.pendingConnections.entries()) {
      if (request.timestamp < fiveMinutesAgo) {
        this.pendingConnections.delete(id);
      }
    }
    
    return connectionRequest;
  }

  async verifyConnection(connectionId, signature, publicKeys) {
    const connectionRequest = this.pendingConnections.get(connectionId);
    if (!connectionRequest) {
      return { success: false, error: 'Invalid or expired connection request' };
    }

    const { userId, nonce, message } = connectionRequest;
    
    // Verify signature (simplified for demo)
    if (!SecurityManager.verifySignature(message, signature, publicKeys)) {
      return { success: false, error: 'Invalid signature' };
    }

    // Create or find user in database
    let user;
    try {
      user = await DatabaseService.findUserByUserId(userId);
      if (!user) {
        user = await DatabaseService.createUser({
          userId,
          publicKeys,
          isActive: true
        });
      } else {
        await DatabaseService.updateUserLastLogin(user.id);
      }
    } catch (error) {
      console.error('Error creating/finding user:', error);
      return { success: false, error: 'Database error' };
    }

    // Store connection
    this.connections.set(connectionId, {
      userId: user.id,
      publicKeys,
      connectedAt: Date.now()
    });

    // Clean up pending connection
    this.pendingConnections.delete(connectionId);

    return { success: true, user };
  }

  async getUserAddresses(connectionId) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return null;
    }

    try {
      const wallets = await DatabaseService.findWalletsByUserId(connection.userId);
      return wallets;
    } catch (error) {
      console.error('Error getting user addresses:', error);
      return null;
    }
  }

  async signTransaction(connectionId, transactionData) {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      return { success: false, error: 'Not connected' };
    }

    // In production, this would interface with the actual wallet
    // For now, return a mock signed transaction
    return {
      success: true,
      signedTransaction: {
        ...transactionData,
        signature: crypto.randomBytes(64).toString('hex'),
        timestamp: Date.now()
      }
    };
  }
}

// Order manager service
class OrderManager {
  constructor() {
    this.orderBook = new Map();
  }

  async createOrder(userId, pair, side, type, amount, price = null) {
    try {
      const orderData = {
        userId,
        pair,
        side,
        type,
        amount: parseFloat(amount),
        price: price ? parseFloat(price) : null,
        status: 'pending',
        remainingAmount: parseFloat(amount)
      };

      if (devNoDb) {
        const order = { id: uuidv4(), ...orderData, createdAt: Date.now() };
        await this.addToOrderBook(order);
        io.emit('orderBookUpdate', { pair });
        return { success: true, order };
      }

      const order = await DatabaseService.createOrder(orderData);
      
      // Add to order book
      await this.addToOrderBook(order);
      
      return { success: true, order };
    } catch (error) {
      console.error('Error creating order:', error);
      return { success: false, error: error.message };
    }
  }

  async addToOrderBook(order) {
    const { pair, side, price, remainingAmount } = order;
    
    if (!this.orderBook.has(pair)) {
      this.orderBook.set(pair, { buys: [], sells: [] });
    }
    
    const orderBook = this.orderBook.get(pair);
    const orders = side === 'buy' ? orderBook.buys : orderBook.sells;
    
    // Insert order in correct position (price-time priority)
    const insertIndex = orders.findIndex(o => 
      side === 'buy' ? o.price < price : o.price > price
    );
    
    if (insertIndex === -1) {
      orders.push(order);
    } else {
      orders.splice(insertIndex, 0, order);
    }
  }

  async cancelOrder(orderId, userId) {
    try {
      const cancelled = await DatabaseService.cancelOrder(orderId, userId);
      if (cancelled) {
        // Remove from order book
        await this.removeFromOrderBook(orderId);
        return { success: true };
      } else {
        return { success: false, error: 'Order not found or not authorized' };
      }
    } catch (error) {
      console.error('Error cancelling order:', error);
      return { success: false, error: error.message };
    }
  }

  async removeFromOrderBook(orderId) {
    for (const [pair, orderBook] of this.orderBook.entries()) {
      orderBook.buys = orderBook.buys.filter(order => order.id !== orderId);
      orderBook.sells = orderBook.sells.filter(order => order.id !== orderId);
    }
  }

  async getOrderBook(pair) {
    if (devNoDb) {
      const book = this.orderBook.get(pair) || { buys: [], sells: [] };
      return { buyOrders: book.buys, sellOrders: book.sells };
    }
    try {
      return await DatabaseService.getOrderBook(pair);
    } catch (error) {
      console.error('Error getting order book:', error);
      return { buyOrders: [], sellOrders: [] };
    }
  }

  async getUserOrders(userId) {
    try {
      return await DatabaseService.findOrdersByUserId(userId);
    } catch (error) {
      console.error('Error getting user orders:', error);
      return [];
    }
  }
}

// Atomic swap manager service
class AtomicSwapManager {
  constructor() {
    this.activeSwaps = new Map();
  }

  async createSwap(buyOrder, sellOrder, amount, price) {
    try {
      const swapData = {
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        amount: parseFloat(amount),
        price: parseFloat(price),
        status: 'pending'
      };

      const swap = await DatabaseService.createAtomicSwap(swapData);
      this.activeSwaps.set(swap.id, swap);
      
      return swap;
    } catch (error) {
      console.error('Error creating swap:', error);
      throw error;
    }
  }

  generateEscrowAddresses(swapId) {
    // In production, this would generate actual multi-signature addresses
    return {
      buyEscrow: `escrow_buy_${swapId}`,
      sellEscrow: `escrow_sell_${swapId}`
    };
  }

  async executeSwap(swapId) {
    try {
      const swap = this.activeSwaps.get(swapId);
      if (!swap) {
        throw new Error('Swap not found');
      }

      // Update swap status
      await DatabaseService.updateSwapStatus(swapId, 'completed', new Date());
      
      // Update order statuses
      await DatabaseService.updateOrderStatus(swap.buyOrderId, 'filled', swap.amount, swap.price);
      await DatabaseService.updateOrderStatus(swap.sellOrderId, 'filled', swap.amount, swap.price);
      
      // Remove from active swaps
      this.activeSwaps.delete(swapId);
      
      return { success: true, swap };
    } catch (error) {
      console.error('Error executing swap:', error);
      return { success: false, error: error.message };
    }
  }

  async getSwap(swapId) {
    try {
      return this.activeSwaps.get(swapId) || await DatabaseService.findSwapById(swapId);
    } catch (error) {
      console.error('Error getting swap:', error);
      return null;
    }
  }

  async getUserSwaps(userId) {
    try {
      return await DatabaseService.findSwapsByUserId(userId);
    } catch (error) {
      console.error('Error getting user swaps:', error);
      return [];
    }
  }
}

// Initialize services
const walletConnector = new WalletConnector();
const orderManager = new OrderManager();
const swapManager = new AtomicSwapManager();

// Bridge session + sign request stores (Path A foundation)
const bridgeSessions = new Map();
const usedBridgeNonces = new Set();
const bridgeSignRequests = new Map();
const pendingAuthConnections = new Map();

function purgeExpiredAuthConnections() {
  const now = Math.floor(Date.now() / 1000);
  for (const [id, conn] of pendingAuthConnections.entries()) {
    if (conn.expiresAt < now) {
      pendingAuthConnections.delete(id);
    }
  }
}

class BridgeSessionManager {
  verifyAndCreateSession(payload) {
    const {
      tlsAddress,
      sessionToken,
      nonce,
      timestamp,
      expiresAt,
      permissions,
      signature,
      zeroaPubKey
    } = payload;

    if (!tlsAddress || !sessionToken || !nonce || !signature || !zeroaPubKey) {
      return { success: false, error: 'Missing required fields' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (expiresAt && now > expiresAt) {
      return { success: false, error: 'Session envelope expired' };
    }

    if (!BridgeReplayStore.consumeNonce(sessionToken, nonce)) {
      return { success: false, error: 'Replay detected' };
    }

    const verification = BridgeSignatureService.verifyAuthEnvelope(payload);
    if (!verification.valid) {
      return { success: false, error: verification.error || 'Invalid signature' };
    }

    const bridgeSessionId = uuidv4();
    const bridgeJwt = jwtSignBridgeSession({ bridgeSessionId, tlsAddress, permissions, expiresAt });
    const session = {
      bridgeSessionId,
      tlsAddress,
      sessionToken,
      permissions: permissions || [],
      expiresAt,
      zeroaPubKey,
      createdAt: now
    };
    bridgeSessions.set(bridgeSessionId, session);

    return {
      success: true,
      bridgeSessionId,
      jwt: bridgeJwt,
      expiresAt,
      permissions: session.permissions,
      warning: verification.warning || null
    };
  }
}

function jwtSignBridgeSession({ bridgeSessionId, tlsAddress, permissions, expiresAt }) {
  return jwt.sign(
    { bridgeSessionId, tlsAddress, permissions },
    process.env.JWT_SECRET || 'powdex-dev-secret',
    { expiresIn: expiresAt ? Math.max(expiresAt - Math.floor(Date.now() / 1000), 60) : '1h' }
  );
}

const bridgeSessionManager = new BridgeSessionManager();

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: dbInitialized ? 'connected' : 'disconnected',
    version: '1.0.0',
    bridgeVersion: 'powdex-bridge-v1'
  });
});

app.get('/api/markets', (req, res) => {
  res.json({
    markets: MARKET_PAIRS,
    supportedCoins: SUPPORTED_COINS
  });
});

// Bridge session verification (Path A)
app.post('/api/bridge/session/verify', (req, res) => {
  try {
    const result = bridgeSessionManager.verifyAndCreateSession(req.body);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error verifying bridge session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Web bridge auth relay (browser cannot access iOS App Groups)
app.post('/api/bridge/auth/init', (req, res) => {
  purgeExpiredAuthConnections();
  const connectionId = uuidv4();
  const nonce = SecurityManager.generateNonce();
  const expiresAt = Math.floor(Date.now() / 1000) + 300;
  const permissions = req.body?.permissions || ['dex.read', 'dex.trade', 'dex.sign.swap'];

  pendingAuthConnections.set(connectionId, {
    status: 'pending',
    nonce,
    permissions,
    expiresAt,
    createdAt: Date.now()
  });

  res.json({ connectionId, nonce, expiresAt, permissions });
});

app.get('/api/bridge/auth/request/:connectionId', (req, res) => {
  purgeExpiredAuthConnections();
  const conn = pendingAuthConnections.get(req.params.connectionId);
  if (!conn) {
    return res.status(404).json({ error: 'Connection not found' });
  }
  const now = Math.floor(Date.now() / 1000);
  if (conn.expiresAt < now) {
    conn.status = 'expired';
    return res.status(410).json({ error: 'Connection expired' });
  }
  res.json({
    connectionId: req.params.connectionId,
    nonce: conn.nonce,
    permissions: conn.permissions,
    expiresAt: conn.expiresAt
  });
});

app.get('/api/bridge/auth/status/:connectionId', (req, res) => {
  purgeExpiredAuthConnections();
  const conn = pendingAuthConnections.get(req.params.connectionId);
  if (!conn) {
    return res.status(404).json({ error: 'Connection not found' });
  }
  const now = Math.floor(Date.now() / 1000);
  if (conn.expiresAt < now && conn.status === 'pending') {
    conn.status = 'expired';
  }
  res.json({
    status: conn.status,
    session: conn.session || null
  });
});

app.post('/api/bridge/auth/complete', (req, res) => {
  try {
    const { connectionId, ...sessionPayload } = req.body;
    if (!connectionId) {
      return res.status(400).json({ error: 'connectionId required' });
    }
    const conn = pendingAuthConnections.get(connectionId);
    if (!conn) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    if (conn.nonce && sessionPayload.nonce !== conn.nonce) {
      return res.status(400).json({ error: 'Nonce mismatch' });
    }

    const result = bridgeSessionManager.verifyAndCreateSession(sessionPayload);
    if (!result.success) {
      return res.status(400).json(result);
    }

    conn.status = 'completed';
    conn.session = {
      bridgeSessionId: result.bridgeSessionId,
      jwt: result.jwt,
      tlsAddress: sessionPayload.tlsAddress,
      expiresAt: result.expiresAt,
      permissions: result.permissions
    };

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error completing bridge auth:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Bridge sign requests (Path A foundation — no broadcast)
app.post('/api/bridge/sign-requests', (req, res) => {
  try {
    const { bridgeSessionId, pair, chain, intent, unsignedTx, txMeta } = req.body;
    if (!bridgeSessionId || !chain || !intent || !unsignedTx) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const session = bridgeSessions.get(bridgeSessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid bridge session' });
    }

    const requestId = uuidv4();
    const expiresAt = Math.floor(Date.now() / 1000) + 120;
    const record = {
      requestId,
      bridgeSessionId,
      sessionToken: session.sessionToken,
      pair: pair || 'BTC/TLS',
      chain,
      intent,
      unsignedTx,
      txMeta: txMeta || {},
      status: 'pending',
      nonce: requestId,
      timestamp: Math.floor(Date.now() / 1000),
      expiresAt,
      createdAt: Date.now()
    };
    bridgeSignRequests.set(requestId, record);
    io.emit('bridgeSignRequestCreated', {
      requestId,
      pair: record.pair,
      chain,
      intent,
      expiresAt
    });
    res.json({ requestId, expiresAt, status: 'pending' });
  } catch (error) {
    console.error('Error creating bridge sign request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/bridge/sign-requests/:requestId/submit', (req, res) => {
  try {
    const { requestId } = req.params;
    const { signedTx, signature, txid, timestamp } = req.body;
    const record = bridgeSignRequests.get(requestId);
    if (!record) {
      return res.status(404).json({ error: 'Sign request not found' });
    }

    record.status = 'submitted';
    record.signedTx = signedTx;
    record.signature = signature;
    record.txid = txid || null;
    record.submittedAt = timestamp || Date.now();
    bridgeSignRequests.set(requestId, record);

    io.emit('bridgeSignRequestUpdated', {
      requestId,
      status: record.status,
      txid: record.txid
    });

    res.json({ success: true, requestId, status: record.status });
  } catch (error) {
    console.error('Error submitting bridge sign request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/bridge/sign-requests/:requestId', (req, res) => {
  const record = bridgeSignRequests.get(req.params.requestId);
  if (!record) {
    return res.status(404).json({ error: 'Sign request not found' });
  }
  res.json({
    requestId: record.requestId,
    status: record.status,
    error: record.error || null,
    sessionToken: record.sessionToken || null,
    chain: record.chain,
    intent: record.intent,
    pair: record.pair,
    unsignedTx: record.unsignedTx,
    txMeta: record.txMeta || {},
    nonce: record.nonce || record.requestId,
    timestamp: record.timestamp || null,
    expiresAt: record.expiresAt
  });
});

// HTLC testnet swap orchestration (feature-flagged)
app.post('/api/htlc/swaps', (req, res) => {
  try {
    const { bridgeSessionId, pair, side, amount, price } = req.body;
    const session = bridgeSessions.get(bridgeSessionId);
    if (!session) {
      return res.status(401).json({ error: 'Invalid bridge session' });
    }
    const result = HTLCService.createSwap({
      bridgeSessionId,
      pair: pair || 'BTC/TLS',
      side,
      amount,
      price,
      tlsAddress: session.tlsAddress
    });
    if (!result.success) {
      return res.status(400).json(result);
    }

    const swap = result.swap;
    const attachSignRequest = (chain, unsignedTx, intent) => {
      const requestId = uuidv4();
      const expiresAt = Math.floor(Date.now() / 1000) + 300;
      bridgeSignRequests.set(requestId, {
        requestId,
        bridgeSessionId,
        sessionToken: session.sessionToken,
        pair: swap.pair,
        chain,
        intent,
        unsignedTx,
        txMeta: { swapId: swap.swapId },
        status: 'pending',
        nonce: requestId,
        timestamp: Math.floor(Date.now() / 1000),
        expiresAt,
        createdAt: Date.now()
      });
      return requestId;
    };

    const enriched = HTLCService.updateSwap(swap.swapId, {
      btcSignRequestId: attachSignRequest('BTC', swap.btcUnsignedTx, 'swap_funding'),
      tlsSignRequestId: attachSignRequest('TLS', swap.tlsUnsignedTx, 'swap_funding')
    });

    res.json(enriched || swap);
  } catch (error) {
    console.error('Error creating HTLC swap:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/htlc/swaps/:swapId', (req, res) => {
  const swap = HTLCService.getSwap(req.params.swapId);
  if (!swap) {
    return res.status(404).json({ error: 'Swap not found' });
  }
  res.json(swap);
});

app.post('/api/htlc/swaps/:swapId/submit', (req, res) => {
  try {
    const { chain, signedTx, txid } = req.body;
    const result = HTLCService.submitSignedLeg(req.params.swapId, chain, signedTx, txid);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result.swap);
  } catch (error) {
    console.error('Error submitting HTLC leg:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/htlc/status', (req, res) => {
  res.json({
    enabled: HTLCService.isEnabled(),
    testnetOnly: process.env.POWDEX_MAINNET_HTLC !== '1',
    broadcastEnabled: process.env.POWDEX_BROADCAST_ENABLED === '1'
  });
});

// Wallet connection routes
app.post('/api/wallet/connect', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const connectionRequest = walletConnector.generateConnectionRequest(userId);
    res.json(connectionRequest);
  } catch (error) {
    console.error('Error generating connection request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/wallet/verify', async (req, res) => {
  try {
    const { connectionId, signature, publicKeys } = req.body;
    if (!connectionId || !signature || !publicKeys) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await walletConnector.verifyConnection(connectionId, signature, publicKeys);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error verifying connection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Order routes
app.post('/api/orders', async (req, res) => {
  try {
    const { userId, pair, side, type, amount, price } = req.body;
    if (!userId || !pair || !side || !type || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await orderManager.createOrder(userId, pair, side, type, amount, price);
    if (result.success) {
      res.json(result.order);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/orders/:pair', async (req, res) => {
  try {
    const { pair } = req.params;
    const orderBook = await orderManager.getOrderBook(pair);
    res.json(orderBook);
  } catch (error) {
    console.error('Error getting order book:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/orders/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await orderManager.getUserOrders(userId);
    res.json(orders);
  } catch (error) {
    console.error('Error getting user orders:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/orders/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }

    const result = await orderManager.cancelOrder(orderId, userId);
    if (result.success) {
      res.json({ message: 'Order cancelled successfully' });
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Price routes
app.get('/api/prices', async (req, res) => {
  try {
    const prices = await PriceFeedService.getAllPrices();
    res.json(prices);
  } catch (error) {
    console.error('Error fetching prices:', error);
    res.json(currentPrices); // Fallback to cached prices
  }
});

app.get('/api/prices/:pair', async (req, res) => {
  try {
    const { pair } = req.params;
    const price = await PriceFeedService.getPrice(pair);
    res.json({ pair, price });
  } catch (error) {
    console.error(`Error fetching price for ${req.params.pair}:`, error);
    res.json({ pair: req.params.pair, price: currentPrices[req.params.pair] || 0 });
  }
});

app.get('/api/prices/:pair/history', async (req, res) => {
  try {
    const { pair } = req.params;
    const { days = 7 } = req.query;
    const history = await PriceFeedService.getPriceHistory(pair, parseInt(days));
    res.json(history);
  } catch (error) {
    console.error(`Error fetching price history for ${req.params.pair}:`, error);
    res.status(500).json({ error: 'Failed to fetch price history' });
  }
});

app.get('/api/prices/:pair/stats', async (req, res) => {
  try {
    const { pair } = req.params;
    const stats = await PriceFeedService.getMarketStats(pair);
    if (stats) {
      res.json(stats);
    } else {
      res.status(404).json({ error: 'Market stats not available' });
    }
  } catch (error) {
    console.error(`Error fetching market stats for ${req.params.pair}:`, error);
    res.status(500).json({ error: 'Failed to fetch market stats' });
  }
});

// Swap routes
app.get('/api/swaps/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const swaps = await swapManager.getUserSwaps(userId);
    res.json(swaps);
  } catch (error) {
    console.error('Error getting user swaps:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });

  socket.on('joinOrderBook', (pair) => {
    socket.join(`orderbook_${pair}`);
  });

  socket.on('leaveOrderBook', (pair) => {
    socket.leave(`orderbook_${pair}`);
  });
});

// Cron jobs for price updates and order matching
cron.schedule('*/30 * * * * *', async () => {
  // Update prices every 30 seconds
  try {
    const newPrices = await PriceFeedService.getAllPrices();
    currentPrices = { ...currentPrices, ...newPrices };
    io.emit('priceUpdate', currentPrices);
  } catch (error) {
    console.error('Error updating prices:', error);
    // Continue using cached prices
    io.emit('priceUpdate', currentPrices);
  }
});

cron.schedule('*/10 * * * * *', async () => {
  // Process order matching every 10 seconds
  if (!dbInitialized) return;

  try {
    const pairs = ORDER_MATCH_PAIRS;
    
    for (const pair of pairs) {
      const orderBook = await orderManager.getOrderBook(pair);
      const { buyOrders, sellOrders } = orderBook;

      while (buyOrders.length > 0 && sellOrders.length > 0) {
        const buyOrder = buyOrders[0];
        const sellOrder = sellOrders[0];

        if (buyOrder.price >= sellOrder.price) {
          // Match found
          const matchAmount = Math.min(buyOrder.remainingAmount, sellOrder.remainingAmount);
          const matchPrice = sellOrder.price; // Price-time priority

          // Create atomic swap
          const swap = await swapManager.createSwap(buyOrder, sellOrder, matchAmount, matchPrice);
          
          // Update order remaining amounts
          await DatabaseService.updateOrderStatus(buyOrder.id, 'partial', matchAmount, matchPrice);
          await DatabaseService.updateOrderStatus(sellOrder.id, 'partial', matchAmount, matchPrice);

          // Emit match event
          io.emit('orderMatch', { swap, pair });
        } else {
          break;
        }
      }
    }
  } catch (error) {
    console.error('Error in order matching cron job:', error);
  }
});

const PORT = process.env.PORT || 5050;

// Static web client (after API routes)
const clientDir = path.join(__dirname, 'web-client');
app.get('/', (req, res) => {
  res.sendFile(path.join(clientDir, 'index.html'));
});
app.use(express.static(clientDir));

server.listen(PORT, () => {
  console.log(`🚀 PowDEX server running on port ${PORT}`);
  console.log(`📊 Database: ${dbInitialized ? 'Connected' : 'Connecting...'}`);
  console.log(`🔗 WebSocket: ws://localhost:${PORT}`);
  console.log(`🌐 API: http://localhost:${PORT}/api`);
}); 