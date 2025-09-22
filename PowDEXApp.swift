import SwiftUI

@main
struct PowDEXApp: App {
    @StateObject private var dexService = DEXCoreService.shared
    @StateObject private var walletService = MultiCoinWalletService.shared
    
    var body: some Scene {
        WindowGroup {
            DEXMainView()
                .onAppear {
                    // Initialize the DEX when the app starts
                    Task {
                        await dexService.initialize()
                    }
                }
        }
    }
}

// MARK: - App Configuration
struct AppConfig {
    static let appName = "PowDEX"
    static let appVersion = "1.0.0"
    static let supportedCoins: [CoinType] = [.bitcoin, .litecoin, .telestai, .usdt, .usdc]
    
    // DEX Configuration
    static let maxOrderAmount = 1000000.0 // Maximum order amount
    static let minOrderAmount = 0.0001 // Minimum order amount
    static let maxPriceDeviation = 0.1 // 10% maximum price deviation from market
    
    // Network Configuration
    static let connectionTimeout = 30.0 // seconds
    static let priceUpdateInterval = 30.0 // seconds
    static let balanceUpdateInterval = 60.0 // seconds
    
    // UI Configuration
    static let maxDecimalPlaces = 8
    static let priceDecimalPlaces = 2
    static let amountDecimalPlaces = 4
}

// MARK: - Error Handling
enum DEXError: Error, LocalizedError {
    case walletNotConnected
    case insufficientBalance
    case invalidOrder
    case networkError
    case atomicSwapFailed
    case invalidAddress
    case transactionFailed
    
    var errorDescription: String? {
        switch self {
        case .walletNotConnected:
            return "No wallet connected. Please set up a wallet first."
        case .insufficientBalance:
            return "Insufficient balance for this transaction."
        case .invalidOrder:
            return "Invalid order parameters."
        case .networkError:
            return "Network connection error. Please check your internet connection."
        case .atomicSwapFailed:
            return "Atomic swap failed. Please try again."
        case .invalidAddress:
            return "Invalid address format."
        case .transactionFailed:
            return "Transaction failed. Please try again."
        }
    }
}

// MARK: - Logging
struct DEXLogger {
    static func log(_ message: String, level: LogLevel = .info) {
        let timestamp = DateFormatter.logTimestamp.string(from: Date())
        let logMessage = "[\(timestamp)] [\(level.rawValue.uppercased())] \(message)"
        
        #if DEBUG
        print(logMessage)
        #endif
        
        // In production, you might want to send logs to a service
        // or save them to a file
    }
    
    enum LogLevel: String {
        case debug = "DEBUG"
        case info = "INFO"
        case warning = "WARNING"
        case error = "ERROR"
    }
}

// MARK: - Extensions
extension DateFormatter {
    static let logTimestamp: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateFormat = "yyyy-MM-dd HH:mm:ss"
        return formatter
    }()
}

extension Double {
    func formatted(decimals: Int) -> String {
        return String(format: "%.\(decimals)f", self)
    }
}

extension String {
    func isValidAddress(for coinType: CoinType) -> Bool {
        // Basic address validation
        switch coinType {
        case .bitcoin:
            return self.count >= 26 && self.count <= 35 && 
                   (self.hasPrefix("1") || self.hasPrefix("3") || self.hasPrefix("bc1"))
        case .litecoin:
            return self.count >= 26 && self.count <= 35 && 
                   (self.hasPrefix("L") || self.hasPrefix("3") || self.hasPrefix("ltc1"))
        case .telestai:
            return self.count >= 26 && self.count <= 35 && 
                   (self.hasPrefix("T") || self.hasPrefix("t"))
        case .usdt, .usdc:
            return self.count >= 26 && self.count <= 35 && 
                   (self.hasPrefix("1") || self.hasPrefix("3") || self.hasPrefix("bc1"))
        default:
            return self.count >= 26 && self.count <= 35
        }
    }
}

// MARK: - Constants
struct DEXConstants {
    // Trading
    static let maxOrderSize = 1000000.0
    static let minOrderSize = 0.0001
    static let maxPriceDeviation = 0.1
    
    // UI
    static let maxDecimalPlaces = 8
    static let priceDecimalPlaces = 2
    static let amountDecimalPlaces = 4
    
    // Network
    static let connectionTimeout = 30.0
    static let priceUpdateInterval = 30.0
    static let balanceUpdateInterval = 60.0
    
    // Colors
    static let buyColor = Color.green
    static let sellColor = Color.red
    static let pendingColor = Color.orange
    static let completedColor = Color.green
    static let cancelledColor = Color.red
    static let failedColor = Color.red
}

// MARK: - Utilities
struct DEXUtilities {
    static func formatAmount(_ amount: Double, decimals: Int = 8) -> String {
        return amount.formatted(decimals: decimals)
    }
    
    static func formatPrice(_ price: Double, decimals: Int = 2) -> String {
        return "$\(price.formatted(decimals: decimals))"
    }
    
    static func calculateTotal(amount: Double, price: Double) -> Double {
        return amount * price
    }
    
    static func validateOrder(
        amount: Double,
        price: Double?,
        side: OrderSide,
        userBalance: Double
    ) -> (isValid: Bool, error: String?) {
        // Check minimum order size
        guard amount >= DEXConstants.minOrderSize else {
            return (false, "Order amount must be at least \(DEXConstants.minOrderSize)")
        }
        
        // Check maximum order size
        guard amount <= DEXConstants.maxOrderSize else {
            return (false, "Order amount cannot exceed \(DEXConstants.maxOrderSize)")
        }
        
        // Check price for limit orders
        if let price = price {
            guard price > 0 else {
                return (false, "Price must be greater than 0")
            }
        }
        
        // Check balance
        let requiredBalance = side == .buy ? (amount * (price ?? 0)) : amount
        guard userBalance >= requiredBalance else {
            return (false, "Insufficient balance")
        }
        
        return (true, nil)
    }
    
    static func generateOrderId() -> String {
        return UUID().uuidString
    }
    
    static func generateSwapId() -> String {
        return "swap_\(UUID().uuidString)"
    }
    
    static func getCurrentTimestamp() -> Date {
        return Date()
    }
}

// MARK: - Mock Data for Development
struct MockData {
    static let sampleOrders: [Order] = [
        Order(
            id: "1",
            pair: TradingPair(base: .bitcoin, quote: .usdt),
            side: .buy,
            type: .limit,
            amount: 0.1,
            price: 45000.0,
            status: .pending,
            timestamp: Date(),
            userId: "user1"
        ),
        Order(
            id: "2",
            pair: TradingPair(base: .bitcoin, quote: .usdt),
            side: .sell,
            type: .limit,
            amount: 0.05,
            price: 45100.0,
            status: .pending,
            timestamp: Date(),
            userId: "user2"
        )
    ]
    
    static let sampleBalances: [CoinType: Double] = [
        .bitcoin: 1.5,
        .litecoin: 25.0,
        .telestai: 1000.0,
        .usdt: 5000.0,
        .usdc: 3000.0
    ]
    
    static let samplePrices: [TradingPair: Double] = [
        TradingPair(base: .bitcoin, quote: .usdt): 45000.0,
        TradingPair(base: .bitcoin, quote: .usdc): 45000.0,
        TradingPair(base: .litecoin, quote: .usdt): 120.0,
        TradingPair(base: .litecoin, quote: .usdc): 120.0,
        TradingPair(base: .telestai, quote: .usdt): 0.85,
        TradingPair(base: .telestai, quote: .usdc): 0.85
    ]
} 