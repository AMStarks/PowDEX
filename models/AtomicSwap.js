'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class AtomicSwap extends Model {
    static associate(models) {
      AtomicSwap.belongsTo(models.Order, { as: 'BuyOrder', foreignKey: 'buyOrderId' });
      AtomicSwap.belongsTo(models.Order, { as: 'SellOrder', foreignKey: 'sellOrderId' });
    }
  }
  
  AtomicSwap.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    buyOrderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id'
      }
    },
    sellOrderId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'orders',
        key: 'id'
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
      allowNull: false,
      validate: {
        min: 0.00000001
      }
    },
    status: {
      type: DataTypes.STRING(20),
      defaultValue: 'pending',
      validate: {
        isIn: [['pending', 'escrow_created', 'escrow_funded', 'completed', 'cancelled', 'failed']]
      }
    },
    escrowAddresses: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    transactionHashes: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'AtomicSwap',
    tableName: 'atomic_swaps',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['buyOrderId']
      },
      {
        fields: ['sellOrderId']
      },
      {
        fields: ['status']
      },
      {
        fields: ['createdAt']
      }
    ]
  });
  
  return AtomicSwap;
}; 