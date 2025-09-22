# Database Integration Plan

## Current State
- Using in-memory storage (Map objects)
- Data lost on server restart
- No persistence for orders, users, swaps

## Recommended Database: PostgreSQL

### Why PostgreSQL?
- ACID compliance for financial transactions
- JSON support for flexible data structures
- Excellent performance for read/write operations
- Built-in support for complex queries

### Schema Design

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) UNIQUE NOT NULL,
    public_keys JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Wallets table
CREATE TABLE wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    coin_type VARCHAR(10) NOT NULL,
    address VARCHAR(255) NOT NULL,
    balance DECIMAL(20,8) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    pair VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL, -- 'buy' or 'sell'
    type VARCHAR(10) NOT NULL, -- 'market' or 'limit'
    amount DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8),
    status VARCHAR(20) DEFAULT 'pending',
    remaining_amount DECIMAL(20,8) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Atomic swaps table
CREATE TABLE atomic_swaps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buy_order_id UUID REFERENCES orders(id),
    sell_order_id UUID REFERENCES orders(id),
    amount DECIMAL(20,8) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    escrow_addresses JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- Order book table (for historical data)
CREATE TABLE order_book_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pair VARCHAR(20) NOT NULL,
    side VARCHAR(4) NOT NULL,
    price DECIMAL(20,8) NOT NULL,
    total_amount DECIMAL(20,8) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Implementation Steps
1. Install PostgreSQL dependencies
2. Create database connection pool
3. Migrate in-memory data to database
4. Update all service methods to use database
5. Add database error handling
6. Implement data validation 