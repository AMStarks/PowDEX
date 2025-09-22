const { User, Wallet, Order, AtomicSwap } = require('../models');
const { Op } = require('sequelize');

class DatabaseService {
  constructor() {
    this.isConnected = false;
  }

  async initialize() {
    try {
      await User.sequelize.authenticate();
      this.isConnected = true;
      console.log('✅ Database connection established successfully.');
    } catch (error) {
      console.error('❌ Database connection failed:', error);
      throw error;
    }
  }

  // User operations
  async createUser(userData) {
    try {
      const user = await User.create(userData);
      return user;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async findUserByUserId(userId) {
    try {
      const user = await User.findOne({
        where: { userId },
        include: [{ model: Wallet, as: 'Wallets' }]
      });
      return user;
    } catch (error) {
      console.error('Error finding user:', error);
      throw error;
    }
  }

  async updateUserLastLogin(userId) {
    try {
      await User.update(
        { lastLoginAt: new Date() },
        { where: { userId } }
      );
    } catch (error) {
      console.error('Error updating user last login:', error);
      throw error;
    }
  }

  // Wallet operations
  async createWallet(walletData) {
    try {
      const wallet = await Wallet.create(walletData);
      return wallet;
    } catch (error) {
      console.error('Error creating wallet:', error);
      throw error;
    }
  }

  async findWalletsByUserId(userId) {
    try {
      const wallets = await Wallet.findAll({
        where: { userId },
        include: [{ model: User, as: 'User' }]
      });
      return wallets;
    } catch (error) {
      console.error('Error finding wallets:', error);
      throw error;
    }
  }

  async updateWalletBalance(walletId, balance) {
    try {
      await Wallet.update(
        { balance },
        { where: { id: walletId } }
      );
    } catch (error) {
      console.error('Error updating wallet balance:', error);
      throw error;
    }
  }

  // Order operations
  async createOrder(orderData) {
    try {
      const order = await Order.create(orderData);
      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      throw error;
    }
  }

  async findOrdersByUserId(userId, limit = 50, offset = 0) {
    try {
      const orders = await Order.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit,
        offset,
        include: [{ model: User, as: 'User' }]
      });
      return orders;
    } catch (error) {
      console.error('Error finding orders:', error);
      throw error;
    }
  }

  async findOrdersByPair(pair, status = 'pending') {
    try {
      const orders = await Order.findAll({
        where: { 
          pair,
          status,
          remainingAmount: { [Op.gt]: 0 }
        },
        order: [
          ['side', 'ASC'],
          ['price', 'ASC']
        ],
        include: [{ model: User, as: 'User' }]
      });
      return orders;
    } catch (error) {
      console.error('Error finding orders by pair:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId, status, filledAmount = 0, averagePrice = null) {
    try {
      const updateData = { status };
      if (filledAmount > 0) {
        updateData.filledAmount = filledAmount;
        updateData.remainingAmount = { [Op.col]: 'amount' } - filledAmount;
      }
      if (averagePrice) {
        updateData.averagePrice = averagePrice;
      }

      await Order.update(updateData, { where: { id: orderId } });
    } catch (error) {
      console.error('Error updating order status:', error);
      throw error;
    }
  }

  async cancelOrder(orderId, userId) {
    try {
      const result = await Order.update(
        { status: 'cancelled' },
        { where: { id: orderId, userId } }
      );
      return result[0] > 0;
    } catch (error) {
      console.error('Error cancelling order:', error);
      throw error;
    }
  }

  // Atomic swap operations
  async createAtomicSwap(swapData) {
    try {
      const swap = await AtomicSwap.create(swapData);
      return swap;
    } catch (error) {
      console.error('Error creating atomic swap:', error);
      throw error;
    }
  }

  async findSwapsByUserId(userId) {
    try {
      const swaps = await AtomicSwap.findAll({
        where: {
          [Op.or]: [
            { '$BuyOrder.userId$': userId },
            { '$SellOrder.userId$': userId }
          ]
        },
        include: [
          { model: Order, as: 'BuyOrder', include: [{ model: User, as: 'User' }] },
          { model: Order, as: 'SellOrder', include: [{ model: User, as: 'User' }] }
        ],
        order: [['createdAt', 'DESC']]
      });
      return swaps;
    } catch (error) {
      console.error('Error finding swaps:', error);
      throw error;
    }
  }

  async updateSwapStatus(swapId, status, completedAt = null) {
    try {
      const updateData = { status };
      if (completedAt) {
        updateData.completedAt = completedAt;
      }

      await AtomicSwap.update(updateData, { where: { id: swapId } });
    } catch (error) {
      console.error('Error updating swap status:', error);
      throw error;
    }
  }

  // Order book operations
  async getOrderBook(pair) {
    try {
      const buyOrders = await Order.findAll({
        where: {
          pair,
          side: 'buy',
          status: 'pending',
          remainingAmount: { [Op.gt]: 0 }
        },
        order: [['price', 'DESC']],
        limit: 20
      });

      const sellOrders = await Order.findAll({
        where: {
          pair,
          side: 'sell',
          status: 'pending',
          remainingAmount: { [Op.gt]: 0 }
        },
        order: [['price', 'ASC']],
        limit: 20
      });

      return { buyOrders, sellOrders };
    } catch (error) {
      console.error('Error getting order book:', error);
      throw error;
    }
  }

  // Statistics operations
  async getTradingStats(pair, timeframe = '24h') {
    try {
      const timeFilter = new Date();
      switch (timeframe) {
        case '1h':
          timeFilter.setHours(timeFilter.getHours() - 1);
          break;
        case '24h':
          timeFilter.setDate(timeFilter.getDate() - 1);
          break;
        case '7d':
          timeFilter.setDate(timeFilter.getDate() - 7);
          break;
        default:
          timeFilter.setDate(timeFilter.getDate() - 1);
      }

      const completedSwaps = await AtomicSwap.findAll({
        where: {
          status: 'completed',
          createdAt: { [Op.gte]: timeFilter }
        },
        include: [
          { model: Order, as: 'BuyOrder', where: { pair } },
          { model: Order, as: 'SellOrder', where: { pair } }
        ]
      });

      const totalVolume = completedSwaps.reduce((sum, swap) => sum + parseFloat(swap.amount), 0);
      const totalTrades = completedSwaps.length;
      const avgPrice = completedSwaps.length > 0 
        ? completedSwaps.reduce((sum, swap) => sum + parseFloat(swap.price), 0) / completedSwaps.length 
        : 0;

      return {
        totalVolume,
        totalTrades,
        averagePrice: avgPrice,
        timeframe
      };
    } catch (error) {
      console.error('Error getting trading stats:', error);
      throw error;
    }
  }
}

module.exports = new DatabaseService(); 