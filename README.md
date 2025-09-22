# PowDEX - Proof-of-Work Decentralized Exchange

A trustless, decentralized exchange built on atomic swaps for proof-of-work cryptocurrencies, integrated with the Zeroa multi-wallet system.

## Overview

PowDEX is a decentralized exchange that enables peer-to-peer trading of proof-of-work cryptocurrencies without requiring users to deposit funds into a centralized exchange. All trades are executed through atomic swaps, ensuring users maintain full control of their funds throughout the trading process.

## Supported Cryptocurrencies

- **Bitcoin (BTC)** - The original cryptocurrency
- **Litecoin (LTC)** - Faster Bitcoin alternative
- **Telestai (TLS)** - Privacy-focused cryptocurrency
- **Tether (USDT)** - Stablecoin
- **USD Coin (USDC)** - Regulated stablecoin

## Key Features

### 🔐 Trustless Trading
- **Atomic Swaps**: All trades are executed through atomic swap protocols
- **No Custodial Risk**: Users never deposit funds to the exchange
- **Self-Custody**: Full control of private keys and funds

### 💼 Zeroa Wallet Integration
- **Multi-Chain Support**: Native support for all supported cryptocurrencies
- **Unified Interface**: Single wallet for all trading pairs
- **Secure Key Management**: BIP44 derivation and secure storage

### 📊 Advanced Trading Features
- **Limit Orders**: Set specific prices for trades
- **Market Orders**: Execute trades at current market prices
- **Order Book**: Real-time order matching
- **Price Discovery**: Transparent price formation

### 🛡️ Security Features
- **Multi-Signature Escrow**: Secure fund holding during swaps
- **Address Validation**: Comprehensive address format checking
- **Transaction Monitoring**: Real-time transaction status tracking
- **Error Handling**: Robust error recovery mechanisms

## Architecture

### Core Components

1. **DEXCoreService** - Main DEX logic and order management
2. **MultiCoinWalletService** - Zeroa wallet integration
3. **Atomic Swap Engine** - Trustless cross-chain trading
4. **Order Book** - Real-time order matching
5. **Price Oracle** - Market price discovery

### Trading Flow

1. **Order Placement**: User creates buy/sell order
2. **Order Matching**: System matches compatible orders
3. **Atomic Swap Initiation**: Creates escrow transactions
4. **Fund Verification**: Both parties verify fund availability
5. **Swap Execution**: Simultaneous fund transfer
6. **Order Settlement**: Update balances and order status

## Installation

### Prerequisites

- iOS 15.0+
- Xcode 14.0+
- Swift 5.7+

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/powdex.git
   cd powdex
   ```

2. **Install dependencies**
   ```bash
   # Add Zeroa as a dependency
   # This will be handled through your package manager
   ```

3. **Build and run**
   ```bash
   xcodebuild -scheme PowDEX -destination 'platform=iOS Simulator,name=iPhone 14'
   ```

## Usage

### Getting Started

1. **Launch the app** - PowDEX will initialize and connect to networks
2. **Set up wallet** - Create or import a Zeroa wallet
3. **Fund your wallet** - Send supported cryptocurrencies to your addresses
4. **Start trading** - Place buy/sell orders on supported pairs

### Trading

1. **Select Trading Pair** - Choose from available BTC/LTC/TLS pairs
2. **Choose Order Type** - Limit or Market orders
3. **Set Parameters** - Amount and price (for limit orders)
4. **Place Order** - Submit to the order book
5. **Monitor Status** - Track order execution and swap progress

### Wallet Management

- **View Balances** - Real-time balance across all supported coins
- **Send Funds** - Transfer to external addresses
- **Receive Funds** - Display addresses for incoming transfers
- **Transaction History** - Complete transaction records

## Technical Details

### Atomic Swap Protocol

```swift
// Simplified atomic swap flow
func performAtomicSwap(_ swap: AtomicSwap) async -> Bool {
    // 1. Create escrow transactions
    let buyEscrow = await createEscrowTransaction(from: buyer, to: seller, amount: price)
    let sellEscrow = await createEscrowTransaction(from: seller, to: buyer, amount: crypto)
    
    // 2. Verify both escrows are funded
    if buyEscrow && sellEscrow {
        // 3. Release funds to final recipients
        return await releaseEscrowFunds(swap)
    }
    
    return false
}
```

### Order Matching

```swift
// Order book matching algorithm
func findMatches() -> [OrderMatch] {
    var matches: [OrderMatch] = []
    
    for buyOrder in buyOrders {
        for sellOrder in sellOrders {
            if let match = createMatch(buyOrder: buyOrder, sellOrder: sellOrder) {
                matches.append(match)
            }
        }
    }
    
    return matches
}
```

### Multi-Chain Support

The DEX integrates with Zeroa's multi-chain wallet system:

- **Bitcoin Service** - BTC transaction handling
- **Litecoin Service** - LTC transaction handling  
- **Telestai Service** - TLS transaction handling
- **USDT/USDC Services** - Stablecoin transaction handling

## Security Considerations

### Private Key Security
- Keys are stored securely in iOS Keychain
- No keys are transmitted over the network
- BIP44 derivation for deterministic addresses

### Transaction Security
- All transactions are signed locally
- Multi-signature escrow for atomic swaps
- Address validation for all supported formats

### Network Security
- Encrypted communication with blockchain nodes
- Connection timeout handling
- Automatic retry mechanisms

## Development

### Project Structure

```
PowDEX/
├── DEXCore.swift          # Core DEX service
├── DEXViews.swift         # UI components
├── PowDEXApp.swift        # Main app file
├── README.md             # Documentation
└── Tests/                # Unit tests
```

### Key Services

- **DEXCoreService**: Main DEX logic
- **MultiCoinWalletService**: Zeroa integration
- **MultiCoinTransactionService**: Transaction handling
- **OrderBook**: Order matching engine

### Adding New Cryptocurrencies

1. **Add to CoinType enum**
2. **Implement CoinServiceProtocol**
3. **Add to supportedCoins array**
4. **Update trading pairs**
5. **Test integration**

## Testing

### Unit Tests

```bash
# Run all tests
xcodebuild test -scheme PowDEX -destination 'platform=iOS Simulator,name=iPhone 14'
```

### Integration Tests

- **Wallet Integration**: Test Zeroa wallet connectivity
- **Order Matching**: Verify order book functionality
- **Atomic Swaps**: Test cross-chain trading
- **Error Handling**: Validate error recovery

## Deployment

### App Store Deployment

1. **Build for release**
   ```bash
   xcodebuild -scheme PowDEX -configuration Release archive
   ```

2. **Upload to App Store Connect**
3. **Submit for review**

### TestFlight Distribution

1. **Create TestFlight build**
2. **Add test users**
3. **Distribute for testing**

## Contributing

### Development Setup

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

### Code Style

- Follow Swift style guidelines
- Use meaningful variable names
- Add comprehensive comments
- Include unit tests for new features

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

### Documentation
- [API Reference](docs/api.md)
- [Trading Guide](docs/trading.md)
- [Security Guide](docs/security.md)

### Community
- [Discord](https://discord.gg/powdex)
- [Telegram](https://t.me/powdex)
- [Twitter](https://twitter.com/powdex)

### Issues
- [Bug Reports](https://github.com/your-org/powdex/issues)
- [Feature Requests](https://github.com/your-org/powdex/issues)

## Roadmap

### Phase 1 (Current)
- ✅ Core DEX functionality
- ✅ Zeroa wallet integration
- ✅ Basic trading interface
- ✅ Atomic swap implementation

### Phase 2 (Next)
- 🔄 Advanced order types
- 🔄 Chart integration
- 🔄 Price alerts
- 🔄 Mobile notifications

### Phase 3 (Future)
- 📋 Additional cryptocurrencies
- 📋 Advanced trading features
- 📋 Institutional tools
- 📋 API for third-party integration

## Acknowledgments

- **Zeroa Team** - Multi-wallet infrastructure
- **Decred DEX** - Atomic swap inspiration
- **Bitcoin Community** - Proof-of-work foundation

---

**PowDEX** - Trustless trading for the proof-of-work ecosystem. 