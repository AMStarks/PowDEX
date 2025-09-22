# Real Price Feeds Integration

## Current State
- Using mock prices (hardcoded values)
- No real-time market data
- Limited price accuracy

## Recommended Price Sources

### Primary Sources
1. **CoinGecko API** - Free tier available
2. **CoinMarketCap API** - Professional grade
3. **Binance API** - Real-time exchange data
4. **Kraken API** - Reliable price feeds

### Implementation Plan

```javascript
// Price feed service
class PriceFeedService {
  constructor() {
    this.sources = {
      coingecko: 'https://api.coingecko.com/api/v3',
      binance: 'https://api.binance.com/api/v3',
      kraken: 'https://api.kraken.com/0/public'
    };
    this.cache = new Map();
    this.cacheTimeout = 30000; // 30 seconds
  }

  async getPrice(pair) {
    const cacheKey = `${pair.base}-${pair.quote}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.price;
    }

    const price = await this.fetchPrice(pair);
    this.cache.set(cacheKey, {
      price,
      timestamp: Date.now()
    });

    return price;
  }

  async fetchPrice(pair) {
    // Implement price fetching logic
    // Fallback to multiple sources
  }
}
```

### Supported Pairs
- BTC/USDT, BTC/USDC
- LTC/USDT, LTC/USDC  
- TLS/USDT, TLS/USDC
- Cross-pairs: BTC/LTC, BTC/TLS, LTC/TLS

### Implementation Steps
1. Set up API keys for price sources
2. Implement price fetching service
3. Add price validation and fallbacks
4. Update frontend to use real prices
5. Add price alerts and notifications 