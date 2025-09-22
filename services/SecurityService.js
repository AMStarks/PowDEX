const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validationResult } = require('express-validator');

class SecurityService {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '24h';
    this.saltRounds = 12;
  }

  // JWT Authentication
  generateToken(userId, userData = {}) {
    const payload = {
      userId,
      ...userData,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };

    return jwt.sign(payload, this.jwtSecret, { expiresIn: this.jwtExpiresIn });
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return { valid: true, payload: decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Password hashing
  async hashPassword(password) {
    return await bcrypt.hash(password, this.saltRounds);
  }

  async comparePassword(password, hash) {
    return await bcrypt.compare(password, hash);
  }

  // Input validation
  validateInput(data, rules) {
    const errors = validationResult(data);
    if (!errors.isEmpty()) {
      return {
        valid: false,
        errors: errors.array()
      };
    }
    return { valid: true };
  }

  // Address validation
  validateAddress(address, coinType) {
    const patterns = {
      'BTC': /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/,
      'LTC': /^[LM3][a-km-zA-HJ-NP-Z1-9]{25,34}$|^ltc1[a-z0-9]{39,59}$/,
      'TLS': /^[Tt][a-km-zA-HJ-NP-Z1-9]{25,34}$/,
      'USDT': /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/,
      'USDC': /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/
    };

    const pattern = patterns[coinType.toUpperCase()];
    if (!pattern) {
      return false;
    }

    return pattern.test(address);
  }

  // Rate limiting
  createRateLimiter(windowMs = 15 * 60 * 1000, max = 100) {
    const requests = new Map();
    
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // Clean old entries
      if (requests.has(ip)) {
        requests.set(ip, requests.get(ip).filter(time => time > windowStart));
      } else {
        requests.set(ip, []);
      }
      
      const userRequests = requests.get(ip);
      
      if (userRequests.length >= max) {
        return res.status(429).json({
          error: 'Too many requests',
          retryAfter: Math.ceil(windowMs / 1000)
        });
      }
      
      userRequests.push(now);
      next();
    };
  }

  // CSRF protection
  generateCSRFToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  validateCSRFToken(token, storedToken) {
    return token === storedToken;
  }

  // SQL injection prevention
  sanitizeInput(input) {
    if (typeof input !== 'string') {
      return input;
    }
    
    // Remove potentially dangerous characters
    return input
      .replace(/[<>\"'\\]/g, '')
      .trim();
  }

  // XSS prevention
  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  // Audit logging
  logSecurityEvent(event, userId, details = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      event,
      userId,
      ip: details.ip || 'unknown',
      userAgent: details.userAgent || 'unknown',
      details
    };
    
    console.log(`[SECURITY] ${JSON.stringify(logEntry)}`);
    // In production, this would be sent to a logging service
  }

  // Session management
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  // API key validation
  validateAPIKey(apiKey) {
    // In production, this would validate against stored API keys
    const validKeys = process.env.VALID_API_KEYS?.split(',') || [];
    return validKeys.includes(apiKey);
  }

  // Request validation middleware
  validateRequest(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors.array()
      });
    }
    next();
  }

  // Authentication middleware
  authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const result = this.verifyToken(token);
    if (!result.valid) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    req.user = result.payload;
    next();
  }

  // Role-based access control
  requireRole(role) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      if (!req.user.roles || !req.user.roles.includes(role)) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    };
  }

  // Request sanitization middleware
  sanitizeRequest(req, res, next) {
    // Sanitize body
    if (req.body) {
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          req.body[key] = this.sanitizeInput(req.body[key]);
        }
      });
    }

    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          req.query[key] = this.sanitizeInput(req.query[key]);
        }
      });
    }

    next();
  }

  // Security headers middleware
  setSecurityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    next();
  }

  // Input validation rules
  getValidationRules() {
    return {
      userId: {
        notEmpty: true,
        isLength: { min: 3, max: 50 },
        matches: /^[a-zA-Z0-9_-]+$/
      },
      amount: {
        isFloat: { min: 0.00000001 },
        toFloat: true
      },
      price: {
        isFloat: { min: 0.00000001 },
        toFloat: true
      },
      pair: {
        isIn: [['BTC/USDT', 'BTC/USDC', 'LTC/USDT', 'LTC/USDC', 'TLS/USDT', 'TLS/USDC', 'BTC/LTC', 'BTC/TLS', 'LTC/TLS']]
      },
      side: {
        isIn: [['buy', 'sell']]
      },
      type: {
        isIn: [['market', 'limit']]
      }
    };
  }
}

module.exports = new SecurityService(); 