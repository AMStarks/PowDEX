const axios = require('axios');
const NodeCache = require('node-cache');

class PriceFeedService {
  constructor() {
    this.cache = new NodeCache({ stdTTL: 30 }); // 30 seconds cache
    this.sources = {
      coingecko: {
        baseUrl: 'https://api.coingecko.com/api/v3',
        apiKey: process.env.COINGECKO_API_KEY
      },
      binance: {
        baseUrl: 'https://api.binance.com/api/v3',
        apiKey: process.env.BINANCE_API_KEY
      },
      kraken: {
        baseUrl: 'https://api.kraken.com/0/public',
        apiKey: process.env.KRAKEN_API_KEY
      }
    };
    
    this.supportedPairs = [
      'BTC/USDT', 'BTC/USDC', 'LTC/USDT', 'LTC/USDC', 
      'TLS/USDT', 'TLS/USDC', 'BTC/LTC', 'BTC/TLS', 'LTC/TLS'
    ];
  }

  async getPrice(pair) {
    const cacheKey = `price_${pair}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    try {
      const price = await this.fetchPrice(pair);
      if (price && price > 0) {
        this.cache.set(cacheKey, price);
        return price;
      }
    } catch (error) {
      console.error(`Error fetching price for ${pair}:`, error.message);
    }

    // Return fallback price if all sources fail
    return this.getFallbackPrice(pair);
  }

  async fetchPrice(pair) {
    const [base, quote] = pair.split('/');
    
    // Try multiple sources in order of preference
    const sources = [
      () => this.fetchFromCoinGecko(base, quote),
      () => this.fetchFromBinance(base, quote),
      () => this.fetchFromKraken(base, quote)
    ];

    for (const source of sources) {
      try {
        const price = await source();
        if (price && price > 0) {
          return price;
        }
      } catch (error) {
        console.warn(`Price source failed for ${pair}:`, error.message);
        continue;
      }
    }

    throw new Error(`All price sources failed for ${pair}`);
  }

  async fetchFromCoinGecko(base, quote) {
    try {
      const baseId = this.getCoinGeckoId(base);
      const quoteId = this.getCoinGeckoId(quote);
      
      if (!baseId || !quoteId) {
        throw new Error('Unsupported coin pair');
      }

      const url = `${this.sources.coingecko.baseUrl}/simple/price`;
      const params = {
        ids: baseId,
        vs_currencies: quoteId
      };

      const response = await axios.get(url, { params, timeout: 5000 });
      const price = response.data[baseId]?.[quoteId];
      
      return price || null;
    } catch (error) {
      throw new Error(`CoinGecko API error: ${error.message}`);
    }
  }

  async fetchFromBinance(base, quote) {
    try {
      const symbol = `${base}${quote}`;
      const url = `${this.sources.binance.baseUrl}/ticker/price`;
      const params = { symbol };

      const response = await axios.get(url, { params, timeout: 5000 });
      const price = parseFloat(response.data.price);
      
      return price || null;
    } catch (error) {
      throw new Error(`Binance API error: ${error.message}`);
    }
  }

  async fetchFromKraken(base, quote) {
    try {
      const pair = `${base}${quote}`;
      const url = `${this.sources.kraken.baseUrl}/Ticker`;
      const params = { pair };

      const response = await axios.get(url, { params, timeout: 5000 });
      const result = response.data.result;
      const pairData = result[pair];
      
      if (pairData) {
        const price = parseFloat(pairData.c[0]); // Current price
        return price || null;
      }
      
      return null;
    } catch (error) {
      throw new Error(`Kraken API error: ${error.message}`);
    }
  }

  getCoinGeckoId(symbol) {
    const mapping = {
      'BTC': 'bitcoin',
      'LTC': 'litecoin',
      'TLS': 'telestai',
      'USDT': 'tether',
      'USDC': 'usd-coin'
    };
    return mapping[symbol.toUpperCase()];
  }

  getFallbackPrice(pair) {
    // Fallback prices (last known good prices)
    const fallbackPrices = {
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
    
    return fallbackPrices[pair] || 1.0;
  }

  async getAllPrices() {
    const prices = {};
    
    for (const pair of this.supportedPairs) {
      try {
        prices[pair] = await this.getPrice(pair);
      } catch (error) {
        console.error(`Error getting price for ${pair}:`, error.message);
        prices[pair] = this.getFallbackPrice(pair);
      }
    }
    
    return prices;
  }

  async getPriceHistory(pair, days = 7) {
    try {
      const [base, quote] = pair.split('/');
      const baseId = this.getCoinGeckoId(base);
      const quoteId = this.getCoinGeckoId(quote);
      
      if (!baseId || !quoteId) {
        throw new Error('Unsupported coin pair');
      }

      const url = `${this.sources.coingecko.baseUrl}/coins/${baseId}/market_chart`;
      const params = {
        vs_currency: quoteId,
        days: days
      };

      const response = await axios.get(url, { params, timeout: 10000 });
      const prices = response.data.prices.map(([timestamp, price]) => ({
        timestamp,
        price
      }));
      
      return prices;
    } catch (error) {
      console.error(`Error fetching price history for ${pair}:`, error.message);
      return [];
    }
  }

  async getMarketStats(pair) {
    try {
      const [base, quote] = pair.split('/');
      const baseId = this.getCoinGeckoId(base);
      const quoteId = this.getCoinGeckoId(quote);
      
      if (!baseId || !quoteId) {
        throw new Error('Unsupported coin pair');
      }

      const url = `${this.sources.coingecko.baseUrl}/coins/${baseId}`;
      const params = {
        localization: false,
        tickers: false,
        market_data: true,
        community_data: false,
        developer_data: false
      };

      const response = await axios.get(url, { params, timeout: 10000 });
      const marketData = response.data.market_data;
      
      return {
        currentPrice: marketData.current_price[quoteId.toLowerCase()],
        marketCap: marketData.market_cap[quoteId.toLowerCase()],
        volume24h: marketData.total_volume[quoteId.toLowerCase()],
        priceChange24h: marketData.price_change_percentage_24h,
        high24h: marketData.high_24h[quoteId.toLowerCase()],
        low24h: marketData.low_24h[quoteId.toLowerCase()]
      };
    } catch (error) {
      console.error(`Error fetching market stats for ${pair}:`, error.message);
      return null;
    }
  }

  // Calculate cross-pair prices
  calculateCrossPairPrice(base, quote, via = 'USDT') {
    const basePrice = this.cache.get(`price_${base}/${via}`);
    const quotePrice = this.cache.get(`price_${quote}/${via}`);
    
    if (basePrice && quotePrice) {
      return basePrice / quotePrice;
    }
    
    return null;
  }

  // Validate price data
  validatePrice(price, pair) {
    if (!price || price <= 0) {
      return false;
    }
    
    // Check for reasonable price ranges
    const [base] = pair.split('/');
    const maxPrices = {
      'BTC': 1000000,
      'LTC': 10000,
      'TLS': 100,
      'USDT': 2,
      'USDC': 2
    };
    
    const maxPrice = maxPrices[base] || 1000000;
    return price <= maxPrice;
  }
}

module.exports = new PriceFeedService(); 