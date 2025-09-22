'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.hasMany(models.Wallet, { foreignKey: 'userId' });
      User.hasMany(models.Order, { foreignKey: 'userId' });
      User.hasMany(models.AtomicSwap, { as: 'BuySwaps', foreignKey: 'buyOrderId' });
      User.hasMany(models.AtomicSwap, { as: 'SellSwaps', foreignKey: 'sellOrderId' });
    }
  }
  
  User.init({
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false
    },
    publicKeys: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    lastLoginAt: {
      type: DataTypes.DATE
    }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    timestamps: true,
    underscored: true
  });
  
  return User;
}; 