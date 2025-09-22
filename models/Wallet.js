'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Wallet extends Model {
    static associate(models) {
      Wallet.belongsTo(models.User, { foreignKey: 'userId' });
    }
  }
  
  Wallet.init({
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
    coinType: {
      type: DataTypes.STRING(10),
      allowNull: false,
      validate: {
        isIn: [['BTC', 'LTC', 'TLS', 'USDT', 'USDC']]
      }
    },
    address: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    balance: {
      type: DataTypes.DECIMAL(20, 8),
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'Wallet',
    tableName: 'wallets',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ['userId', 'coinType']
      },
      {
        fields: ['address']
      }
    ]
  });
  
  return Wallet;
}; 