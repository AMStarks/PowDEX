'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Create users table
    await queryInterface.createTable('users', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.STRING,
        unique: true,
        allowNull: false
      },
      public_keys: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      email: {
        type: Sequelize.STRING,
        allowNull: true
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      last_login_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create wallets table
    await queryInterface.createTable('wallets', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      coin_type: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      address: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      balance: {
        type: Sequelize.DECIMAL(20, 8),
        defaultValue: 0
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create orders table
    await queryInterface.createTable('orders', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      pair: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      side: {
        type: Sequelize.STRING(4),
        allowNull: false
      },
      type: {
        type: Sequelize.STRING(10),
        allowNull: false
      },
      amount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false
      },
      price: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: true
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'pending'
      },
      remaining_amount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false
      },
      filled_amount: {
        type: Sequelize.DECIMAL(20, 8),
        defaultValue: 0
      },
      average_price: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Create atomic_swaps table
    await queryInterface.createTable('atomic_swaps', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true
      },
      buy_order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sell_order_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'orders',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      amount: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false
      },
      price: {
        type: Sequelize.DECIMAL(20, 8),
        allowNull: false
      },
      status: {
        type: Sequelize.STRING(20),
        defaultValue: 'pending'
      },
      escrow_addresses: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      transaction_hashes: {
        type: Sequelize.JSONB,
        allowNull: true
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      failure_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW
      }
    });

    // Add indexes
    await queryInterface.addIndex('wallets', ['user_id', 'coin_type'], { unique: true });
    await queryInterface.addIndex('wallets', ['address']);
    await queryInterface.addIndex('orders', ['user_id']);
    await queryInterface.addIndex('orders', ['pair']);
    await queryInterface.addIndex('orders', ['status']);
    await queryInterface.addIndex('orders', ['created_at']);
    await queryInterface.addIndex('atomic_swaps', ['buy_order_id']);
    await queryInterface.addIndex('atomic_swaps', ['sell_order_id']);
    await queryInterface.addIndex('atomic_swaps', ['status']);
    await queryInterface.addIndex('atomic_swaps', ['created_at']);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('atomic_swaps');
    await queryInterface.dropTable('orders');
    await queryInterface.dropTable('wallets');
    await queryInterface.dropTable('users');
  }
}; 