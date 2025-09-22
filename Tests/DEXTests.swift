import XCTest
@testable import PowDEX

class DEXTests: XCTestCase {
    var dexService: DEXCoreService!
    var walletService: MultiCoinWalletService!
    
    override func setUp() {
        super.setUp()
        dexService = DEXCoreService.shared
        walletService = MultiCoinWalletService.shared
    }
    
    override func tearDown() {
        dexService = nil
        walletService = nil
        super.tearDown()
    }
    
    // MARK: - DEX Core Tests
    
    func testDEXInitialization() async {
        // Test DEX initialization
        await dexService.initialize()
        
        XCTAssertTrue(dexService.isConnected)
        XCTAssertFalse(dexService.tradingPairs.isEmpty)
        XCTAssertFalse(dexService.supportedCoins.isEmpty)
    }
    
    func testTradingPairCreation() {
        let btcUsdt = TradingPair(base: .bitcoin, quote: .usdt)
        let ltcUsdc = TradingPair(base: .litecoin, quote: .usdc)
        
        XCTAssertEqual(btcUsdt.displayName, "BTC/USDT")
        XCTAssertEqual(ltcUsdc.displayName, "LTC/USDC")
        XCTAssertNotEqual(btcUsdt, ltcUsdc)
    }
    
    func testOrderCreation() {
        let pair = TradingPair(base: .bitcoin, quote: .usdt)
        let order = Order(
            id: "test_order",
            pair: pair,
            side: .buy,
            type: .limit,
            amount: 0.1,
            price: 45000.0,
            status: .pending,
            timestamp: Date(),
            userId: "test_user"
        )
        
        XCTAssertEqual(order.pair, pair)
        XCTAssertEqual(order.side, .buy)
        XCTAssertEqual(order.type, .limit)
        XCTAssertEqual(order.amount, 0.1)
        XCTAssertEqual(order.price, 45000.0)
        XCTAssertEqual(order.status, .pending)
    }
    
    func testOrderValidation() {
        let pair = TradingPair(base: .bitcoin, quote: .usdt)
        
        // Valid order
        let validResult = DEXUtilities.validateOrder(
            amount: 0.1,
            price: 45000.0,
            side: .buy,
            userBalance: 5000.0
        )
        XCTAssertTrue(validResult.isValid)
        XCTAssertNil(validResult.error)
        
        // Invalid order - insufficient balance
        let invalidResult = DEXUtilities.validateOrder(
            amount: 1.0,
            price: 45000.0,
            side: .buy,
            userBalance: 1000.0
        )
        XCTAssertFalse(invalidResult.isValid)
        XCTAssertNotNil(invalidResult.error)
    }
    
    // MARK: - Order Book Tests
    
    func testOrderBookMatching() {
        var orderBook = OrderBook()
        
        // Add buy order
        let buyOrder = Order(
            id: "buy1",
            pair: TradingPair(base: .bitcoin, quote: .usdt),
            side: .buy,
            type: .limit,
            amount: 0.1,
            price: 45000.0,
            status: .pending,
            timestamp: Date(),
            userId: "user1"
        )
        
        // Add sell order
        let sellOrder = Order(
            id: "sell1",
            pair: TradingPair(base: .bitcoin, quote: .usdt),
            side: .sell,
            type: .limit,
            amount: 0.05,
            price: 44900.0,
            status: .pending,
            timestamp: Date(),
            userId: "user2"
        )
        
        orderBook.addOrder(buyOrder)
        orderBook.addOrder(sellOrder)
        
        let matches = orderBook.findMatches()
        XCTAssertEqual(matches.count, 1)
        
        let match = matches.first!
        XCTAssertEqual(match.amount, 0.05) // Min of 0.1 and 0.05
        XCTAssertEqual(match.price, 44950.0) // Average of 45000 and 44900
    }
    
    func testOrderBookNoMatch() {
        var orderBook = OrderBook()
        
        // Add buy order with lower price than sell order
        let buyOrder = Order(
            id: "buy1",
            pair: TradingPair(base: .bitcoin, quote: .usdt),
            side: .buy,
            type: .limit,
            amount: 0.1,
            price: 44000.0, // Lower than sell price
            status: .pending,
            timestamp: Date(),
            userId: "user1"
        )
        
        let sellOrder = Order(
            id: "sell1",
            pair: TradingPair(base: .bitcoin, quote: .usdt),
            side: .sell,
            type: .limit,
            amount: 0.05,
            price: 45000.0, // Higher than buy price
            status: .pending,
            timestamp: Date(),
            userId: "user2"
        )
        
        orderBook.addOrder(buyOrder)
        orderBook.addOrder(sellOrder)
        
        let matches = orderBook.findMatches()
        XCTAssertEqual(matches.count, 0) // No matches should occur
    }
    
    // MARK: - Atomic Swap Tests
    
    func testAtomicSwapCreation() {
        let buyOrder = Order(
            id: "buy1",
            pair: TradingPair(base: .bitcoin, quote: .usdt),
            side: .buy,
            type: .limit,
            amount: 0.1,
            price: 45000.0,
            status: .pending,
            timestamp: Date(),
            userId: "user1"
        )
        
        let sellOrder = Order(
            id: "sell1",
            pair: TradingPair(base: .bitcoin, quote: .usdt),
            side: .sell,
            type: .limit,
            amount: 0.1,
            price: 45000.0,
            status: .pending,
            timestamp: Date(),
            userId: "user2"
        )
        
        let swap = AtomicSwap(
            id: "swap1",
            buyOrder: buyOrder,
            sellOrder: sellOrder,
            amount: 0.1,
            price: 45000.0,
            status: .initiated,
            timestamp: Date()
        )
        
        XCTAssertEqual(swap.amount, 0.1)
        XCTAssertEqual(swap.price, 45000.0)
        XCTAssertEqual(swap.status, .initiated)
        XCTAssertEqual(swap.buyOrder.id, "buy1")
        XCTAssertEqual(swap.sellOrder.id, "sell1")
    }
    
    // MARK: - Wallet Integration Tests
    
    func testWalletServiceIntegration() {
        // Test that wallet service is properly initialized
        XCTAssertNotNil(walletService)
        XCTAssertNotNil(walletService.wallets)
        XCTAssertNotNil(walletService.selectedWallet)
    }
    
    func testSupportedCoins() {
        let supportedCoins = [CoinType.bitcoin, .litecoin, .telestai, .usdt, .usdc]
        
        for coin in supportedCoins {
            XCTAssertTrue(dexService.supportedCoins.contains(coin))
        }
    }
    
    func testTradingPairs() {
        let pairs = dexService.tradingPairs
        
        // Should have BTC pairs
        XCTAssertTrue(pairs.contains { $0.base == .bitcoin && $0.quote == .usdt })
        XCTAssertTrue(pairs.contains { $0.base == .bitcoin && $0.quote == .usdc })
        
        // Should have LTC pairs
        XCTAssertTrue(pairs.contains { $0.base == .litecoin && $0.quote == .usdt })
        XCTAssertTrue(pairs.contains { $0.base == .litecoin && $0.quote == .usdc })
        
        // Should have TLS pairs
        XCTAssertTrue(pairs.contains { $0.base == .telestai && $0.quote == .usdt })
        XCTAssertTrue(pairs.contains { $0.base == .telestai && $0.quote == .usdc })
    }
    
    // MARK: - Utility Tests
    
    func testDEXUtilities() {
        // Test amount formatting
        let formattedAmount = DEXUtilities.formatAmount(0.12345678, decimals: 4)
        XCTAssertEqual(formattedAmount, "0.1235")
        
        // Test price formatting
        let formattedPrice = DEXUtilities.formatPrice(45000.0, decimals: 2)
        XCTAssertEqual(formattedPrice, "$45000.00")
        
        // Test total calculation
        let total = DEXUtilities.calculateTotal(amount: 0.1, price: 45000.0)
        XCTAssertEqual(total, 4500.0)
        
        // Test order ID generation
        let orderId = DEXUtilities.generateOrderId()
        XCTAssertFalse(orderId.isEmpty)
        
        // Test swap ID generation
        let swapId = DEXUtilities.generateSwapId()
        XCTAssertTrue(swapId.hasPrefix("swap_"))
    }
    
    func testAddressValidation() {
        // Test Bitcoin address validation
        XCTAssertTrue("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa".isValidAddress(for: .bitcoin))
        XCTAssertTrue("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy".isValidAddress(for: .bitcoin))
        XCTAssertFalse("invalid_address".isValidAddress(for: .bitcoin))
        
        // Test Litecoin address validation
        XCTAssertTrue("LQnYzMCbTh5DRbdcV1d2Vx5qFH84FuqAko".isValidAddress(for: .litecoin))
        XCTAssertFalse("invalid_address".isValidAddress(for: .litecoin))
        
        // Test Telestai address validation
        XCTAssertTrue("TQn9Y2KhDDX5DRbdcV1d2Vx5qFH84FuqAko".isValidAddress(for: .telestai))
        XCTAssertFalse("invalid_address".isValidAddress(for: .telestai))
    }
    
    // MARK: - Error Handling Tests
    
    func testDEXErrorHandling() {
        let walletError = DEXError.walletNotConnected
        XCTAssertEqual(walletError.errorDescription, "No wallet connected. Please set up a wallet first.")
        
        let balanceError = DEXError.insufficientBalance
        XCTAssertEqual(balanceError.errorDescription, "Insufficient balance for this transaction.")
        
        let orderError = DEXError.invalidOrder
        XCTAssertEqual(orderError.errorDescription, "Invalid order parameters.")
    }
    
    // MARK: - Performance Tests
    
    func testOrderBookPerformance() {
        var orderBook = OrderBook()
        
        // Add many orders
        for i in 0..<1000 {
            let order = Order(
                id: "order_\(i)",
                pair: TradingPair(base: .bitcoin, quote: .usdt),
                side: i % 2 == 0 ? .buy : .sell,
                type: .limit,
                amount: Double.random(in: 0.01...1.0),
                price: Double.random(in: 40000...50000),
                status: .pending,
                timestamp: Date(),
                userId: "user_\(i)"
            )
            orderBook.addOrder(order)
        }
        
        // Measure matching performance
        measure {
            let _ = orderBook.findMatches()
        }
    }
    
    // MARK: - Integration Tests
    
    func testFullTradingFlow() async {
        // Initialize DEX
        await dexService.initialize()
        XCTAssertTrue(dexService.isConnected)
        
        // Create trading pair
        let pair = TradingPair(base: .bitcoin, quote: .usdt)
        
        // Place buy order
        var orderResult: OrderResult?
        dexService.placeOrder(
            pair: pair,
            side: .buy,
            type: .limit,
            amount: 0.01,
            price: 45000.0
        ) { result in
            orderResult = result
        }
        
        // Wait for order processing
        await Task.sleep(1_000_000_000) // 1 second
        
        // Verify order was placed
        XCTAssertNotNil(orderResult)
        // Note: In a real test, you'd want to verify the order was actually added to the order book
    }
}

// MARK: - Mock Data for Testing

extension DEXTests {
    func createMockOrder(
        id: String = "test_order",
        pair: TradingPair = TradingPair(base: .bitcoin, quote: .usdt),
        side: OrderSide = .buy,
        type: OrderType = .limit,
        amount: Double = 0.1,
        price: Double = 45000.0
    ) -> Order {
        return Order(
            id: id,
            pair: pair,
            side: side,
            type: type,
            amount: amount,
            price: price,
            status: .pending,
            timestamp: Date(),
            userId: "test_user"
        )
    }
    
    func createMockSwap(
        buyOrder: Order,
        sellOrder: Order,
        amount: Double = 0.1,
        price: Double = 45000.0
    ) -> AtomicSwap {
        return AtomicSwap(
            id: "test_swap",
            buyOrder: buyOrder,
            sellOrder: sellOrder,
            amount: amount,
            price: price,
            status: .initiated,
            timestamp: Date()
        )
    }
} 