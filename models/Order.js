'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Order extends Model {
    static associate(models) {
      Order.belongsTo(models.User, { foreignKey: 'userId' });
      Order.hasMany(models.AtomicSwap, { as: 'BuySwaps', foreignKey: 'buyOrderId' });
      Order.hasMany(models.AtomicSwap, { as: 'SellSwaps', foreignKey: 'sellOrderId' });
    }
  }
  
  Order.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    pair: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [['BTC/USDT', 'BTC/USDC', 'LTC/USDT', 'LTC/USDC', 'TLS/USDT', 'TLS/USDC', 'BTC/LTC', 'BTC/TLS', 'LTC/TLS']]
      }
    },
    side: {
      type: DataTypes.STRING(4),
      allowNull: false,
      validate: {
        isIn: [['buy', 'sell']]
      }
    },
    type: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        isIn: [['market', 'limit']]
      }
    },
    amount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      validate: {
        min: 0.00000001
      }
    },
    price: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true,
      validate: {
        min: 0.00000001
      }
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'filled', 'cancelled', 'partial']]
      }
    },
    remainingAmount: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: false,
      validate: {
        min: 0
      }
    },
    filledAmount: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    averagePrice: {
      type: DataTypes.DECIMAL(20, 8),
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Order',
    tableName: 'orders',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['userId']
      },
      {
        fields: ['pair']
      },
      {
        fields: ['status']
      },
      {
        fields: ['createdAt']
      }
    ]
  });
  
  return Order;
}; 