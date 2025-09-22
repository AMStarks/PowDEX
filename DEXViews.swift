import SwiftUI
import Combine

// MARK: - Main DEX View
struct DEXMainView: View {
    @StateObject private var dexService = DEXCoreService.shared
    @StateObject private var walletService = MultiCoinWalletService.shared
    @State private var selectedTab = 0
    @State private var showingWalletSetup = false
    
    var body: some View {
        NavigationView {
            VStack {
                if dexService.isConnected {
                    TabView(selection: $selectedTab) {
                        TradingView()
                            .tabItem {
                                Image(systemName: "chart.line.uptrend.xyaxis")
                                Text("Trade")
                            }
                            .tag(0)
                        
                        OrderBookView()
                            .tabItem {
                                Image(systemName: "list.bullet")
                                Text("Order Book")
                            }
                            .tag(1)
                        
                        WalletView()
                            .tabItem {
                                Image(systemName: "wallet.pass")
                                Text("Wallet")
                            }
                            .tag(2)
                        
                        OrdersView()
                            .tabItem {
                                Image(systemName: "doc.text")
                                Text("Orders")
                            }
                            .tag(3)
                    }
                } else {
                    ConnectionView()
                }
            }
            .navigationTitle("PowDEX")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        showingWalletSetup = true
                    }) {
                        Image(systemName: "person.circle")
                    }
                }
            }
            .sheet(isPresented: $showingWalletSetup) {
                WalletSetupView()
            }
        }
        .onAppear {
            Task {
                await dexService.initialize()
            }
        }
    }
}

// MARK: - Trading View
struct TradingView: View {
    @StateObject private var dexService = DEXCoreService.shared
    @State private var selectedPair: TradingPair?
    @State private var orderSide: OrderSide = .buy
    @State private var orderType: OrderType = .limit
    @State private var amount: String = ""
    @State private var price: String = ""
    @State private var showingOrderConfirmation = false
    @State private var orderResult: OrderResult?
    
    var body: some View {
        VStack(spacing: 20) {
            // Trading Pair Selector
            TradingPairSelector(selectedPair: $selectedPair)
            
            // Order Form
            VStack(spacing: 15) {
                // Order Side Toggle
                Picker("Order Side", selection: $orderSide) {
                    Text("Buy").tag(OrderSide.buy)
                    Text("Sell").tag(OrderSide.sell)
                }
                .pickerStyle(SegmentedPickerStyle())
                
                // Order Type Toggle
                Picker("Order Type", selection: $orderType) {
                    Text("Limit").tag(OrderType.limit)
                    Text("Market").tag(OrderType.market)
                }
                .pickerStyle(SegmentedPickerStyle())
                
                // Amount Input
                HStack {
                    Text("Amount")
                    Spacer()
                    TextField("0.0", text: $amount)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                        .frame(width: 120)
                }
                
                // Price Input (for limit orders)
                if orderType == .limit {
                    HStack {
                        Text("Price")
                        Spacer()
                        TextField("0.0", text: $price)
                            .keyboardType(.decimalPad)
                            .textFieldStyle(RoundedBorderTextFieldStyle())
                            .frame(width: 120)
                    }
                }
                
                // Current Price Display
                if let pair = selectedPair {
                    HStack {
                        Text("Current Price:")
                        Spacer()
                        Text("$\(dexService.currentPrices[pair] ?? 0, specifier: "%.2f")")
                            .fontWeight(.semibold)
                    }
                    .padding(.horizontal)
                }
                
                // Place Order Button
                Button(action: placeOrder) {
                    Text("Place \(orderSide.rawValue.capitalized) Order")
                        .fontWeight(.semibold)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(orderSide == .buy ? Color.green : Color.red)
                        .cornerRadius(10)
                }
                .disabled(selectedPair == nil || amount.isEmpty || (orderType == .limit && price.isEmpty))
            }
            .padding()
            .background(Color(.systemGray6))
            .cornerRadius(15)
            
            // Balance Display
            BalanceDisplay()
            
            Spacer()
        }
        .padding()
        .alert("Order Result", isPresented: .constant(orderResult != nil)) {
            Button("OK") {
                orderResult = nil
            }
        } message: {
            if let result = orderResult {
                Text(result.success ? "Order placed successfully!" : (result.error ?? "Unknown error"))
            }
        }
    }
    
    private func placeOrder() {
        guard let pair = selectedPair,
              let amountValue = Double(amount),
              let priceValue = orderType == .limit ? Double(price) : nil else {
            return
        }
        
        dexService.placeOrder(
            pair: pair,
            side: orderSide,
            type: orderType,
            amount: amountValue,
            price: priceValue
        ) { result in
            orderResult = result
            if result.success {
                amount = ""
                price = ""
            }
        }
    }
}

// MARK: - Trading Pair Selector
struct TradingPairSelector: View {
    @Binding var selectedPair: TradingPair?
    @StateObject private var dexService = DEXCoreService.shared
    
    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 10) {
                ForEach(dexService.tradingPairs, id: \.self) { pair in
                    Button(action: {
                        selectedPair = pair
                    }) {
                        Text(pair.displayName)
                            .fontWeight(.medium)
                            .padding(.horizontal, 16)
                            .padding(.vertical, 8)
                            .background(selectedPair == pair ? Color.blue : Color(.systemGray5))
                            .foregroundColor(selectedPair == pair ? .white : .primary)
                            .cornerRadius(20)
                    }
                }
            }
            .padding(.horizontal)
        }
    }
}

// MARK: - Order Book View
struct OrderBookView: View {
    @StateObject private var dexService = DEXCoreService.shared
    @State private var selectedPair: TradingPair?
    
    var body: some View {
        VStack {
            // Trading Pair Selector
            TradingPairSelector(selectedPair: $selectedPair)
            
            if let pair = selectedPair,
               let orderBook = dexService.orderBook[pair] {
                OrderBookDisplay(orderBook: orderBook, pair: pair)
            } else {
                VStack {
                    Image(systemName: "chart.line.uptrend.xyaxis")
                        .font(.system(size: 50))
                        .foregroundColor(.gray)
                    Text("Select a trading pair to view order book")
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
    }
}

// MARK: - Order Book Display
struct OrderBookDisplay: View {
    let orderBook: OrderBook
    let pair: TradingPair
    
    var body: some View {
        VStack {
            HStack {
                Text("Price")
                    .fontWeight(.semibold)
                Spacer()
                Text("Amount")
                    .fontWeight(.semibold)
                Spacer()
                Text("Total")
                    .fontWeight(.semibold)
            }
            .padding(.horizontal)
            
            Divider()
            
            // Sell Orders (Red)
            ForEach(0..<min(10, 5), id: \.self) { index in
                HStack {
                    Text("$\(45000 - Double(index * 10), specifier: "%.2f")")
                        .foregroundColor(.red)
                    Spacer()
                    Text("\(Double.random(in: 0.1...2.0), specifier: "%.4f")")
                    Spacer()
                    Text("\(Double.random(in: 100...1000), specifier: "%.2f")")
                }
                .padding(.horizontal)
                .padding(.vertical, 2)
            }
            
            Divider()
                .background(Color.blue)
            
            // Buy Orders (Green)
            ForEach(0..<min(10, 5), id: \.self) { index in
                HStack {
                    Text("$\(44900 + Double(index * 10), specifier: "%.2f")")
                        .foregroundColor(.green)
                    Spacer()
                    Text("\(Double.random(in: 0.1...2.0), specifier: "%.4f")")
                    Spacer()
                    Text("\(Double.random(in: 100...1000), specifier: "%.2f")")
                }
                .padding(.horizontal)
                .padding(.vertical, 2)
            }
            
            Spacer()
        }
    }
}

// MARK: - Wallet View
struct WalletView: View {
    @StateObject private var walletService = MultiCoinWalletService.shared
    @StateObject private var dexService = DEXCoreService.shared
    @State private var showingSendView = false
    @State private var showingReceiveView = false
    
    var body: some View {
        VStack {
            if let wallet = walletService.selectedWallet {
                // Wallet Info
                VStack(spacing: 15) {
                    HStack {
                        Text("Wallet: \(wallet.name)")
                            .font(.headline)
                        Spacer()
                        Button("Settings") {
                            // Show wallet settings
                        }
                    }
                    
                    // Balances
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible()), count: 2), spacing: 15) {
                        ForEach(CoinType.allCases.filter { dexService.supportedCoins.contains($0) }, id: \.self) { coinType in
                            BalanceCard(
                                coinType: coinType,
                                balance: dexService.userBalances[coinType] ?? 0
                            )
                        }
                    }
                    
                    // Action Buttons
                    HStack(spacing: 20) {
                        Button(action: { showingSendView = true }) {
                            VStack {
                                Image(systemName: "arrow.up.circle.fill")
                                    .font(.system(size: 30))
                                Text("Send")
                            }
                            .foregroundColor(.blue)
                        }
                        
                        Button(action: { showingReceiveView = true }) {
                            VStack {
                                Image(systemName: "arrow.down.circle.fill")
                                    .font(.system(size: 30))
                                Text("Receive")
                            }
                            .foregroundColor(.green)
                        }
                    }
                    .padding(.top)
                }
                .padding()
            } else {
                VStack {
                    Image(systemName: "wallet.pass")
                        .font(.system(size: 50))
                        .foregroundColor(.gray)
                    Text("No wallet connected")
                        .font(.headline)
                    Text("Please set up a wallet to start trading")
                        .foregroundColor(.gray)
                }
            }
            
            Spacer()
        }
        .sheet(isPresented: $showingSendView) {
            SendView()
        }
        .sheet(isPresented: $showingReceiveView) {
            ReceiveView()
        }
    }
}

// MARK: - Balance Card
struct BalanceCard: View {
    let coinType: CoinType
    let balance: Double
    
    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack {
                Text(coinType.symbol)
                    .font(.headline)
                Spacer()
                Text(coinType.name)
                    .font(.caption)
                    .foregroundColor(.gray)
            }
            
            Text("\(balance, specifier: "%.8f")")
                .font(.title2)
                .fontWeight(.semibold)
            
            Text("$\(balance * getMockPrice(coinType), specifier: "%.2f")")
                .font(.caption)
                .foregroundColor(.gray)
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }
    
    private func getMockPrice(_ coinType: CoinType) -> Double {
        switch coinType {
        case .bitcoin: return 45000.0
        case .litecoin: return 120.0
        case .telestai: return 0.85
        case .usdt: return 1.0
        case .usdc: return 1.0
        default: return 1.0
        }
    }
}

// MARK: - Orders View
struct OrdersView: View {
    @StateObject private var dexService = DEXCoreService.shared
    
    var body: some View {
        VStack {
            if dexService.userOrders.isEmpty {
                VStack {
                    Image(systemName: "doc.text")
                        .font(.system(size: 50))
                        .foregroundColor(.gray)
                    Text("No orders yet")
                        .font(.headline)
                    Text("Place your first order to see it here")
                        .foregroundColor(.gray)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else {
                List(dexService.userOrders) { order in
                    OrderRow(order: order)
                }
            }
        }
    }
}

// MARK: - Order Row
struct OrderRow: View {
    let order: Order
    @StateObject private var dexService = DEXCoreService.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(order.pair.displayName)
                    .font(.headline)
                Spacer()
                Text(order.side.rawValue.capitalized)
                    .font(.caption)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(order.side == .buy ? Color.green : Color.red)
                    .foregroundColor(.white)
                    .cornerRadius(8)
            }
            
            HStack {
                VStack(alignment: .leading) {
                    Text("Amount: \(order.amount, specifier: "%.8f")")
                    if let price = order.price {
                        Text("Price: $\(price, specifier: "%.2f")")
                    }
                }
                
                Spacer()
                
                VStack(alignment: .trailing) {
                    Text(order.status.rawValue.capitalized)
                        .font(.caption)
                        .foregroundColor(statusColor)
                    Text(order.timestamp, style: .relative)
                        .font(.caption2)
                        .foregroundColor(.gray)
                }
            }
        }
        .padding(.vertical, 4)
    }
    
    private var statusColor: Color {
        switch order.status {
        case .pending: return .orange
        case .filled: return .green
        case .cancelled: return .red
        case .partial: return .blue
        }
    }
}

// MARK: - Connection View
struct ConnectionView: View {
    @StateObject private var dexService = DEXCoreService.shared
    
    var body: some View {
        VStack {
            Image(systemName: "wifi.slash")
                .font(.system(size: 50))
                .foregroundColor(.gray)
            
            Text("Connecting to DEX...")
                .font(.headline)
            
            ProgressView()
                .padding()
            
            Text("Please wait while we connect to the network")
                .foregroundColor(.gray)
        }
    }
}

// MARK: - Wallet Setup View
struct WalletSetupView: View {
    @Environment(\.presentationMode) var presentationMode
    @StateObject private var walletService = MultiCoinWalletService.shared
    @State private var walletName = ""
    @State private var mnemonic = ""
    @State private var isImporting = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Wallet Setup")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                VStack(alignment: .leading, spacing: 10) {
                    Text("Wallet Name")
                        .font(.headline)
                    TextField("Enter wallet name", text: $walletName)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                }
                
                VStack(alignment: .leading, spacing: 10) {
                    Text("Mnemonic Phrase")
                        .font(.headline)
                    TextField("Enter 12-word mnemonic", text: $mnemonic)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                }
                
                HStack {
                    Button("Generate New") {
                        mnemonic = generateMnemonic()
                    }
                    .buttonStyle(.bordered)
                    
                    Spacer()
                    
                    Button("Import Existing") {
                        isImporting = true
                    }
                    .buttonStyle(.bordered)
                }
                
                Spacer()
                
                Button("Create Wallet") {
                    createWallet()
                }
                .buttonStyle(.borderedProminent)
                .disabled(walletName.isEmpty || mnemonic.isEmpty)
            }
            .padding()
            .navigationBarItems(trailing: Button("Cancel") {
                presentationMode.wrappedValue.dismiss()
            })
        }
    }
    
    private func generateMnemonic() -> String {
        // Generate a new mnemonic phrase
        return "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
    }
    
    private func createWallet() {
        walletService.createWallet(name: walletName, mnemonic: mnemonic) { success in
            if success {
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

// MARK: - Send View
struct SendView: View {
    @Environment(\.presentationMode) var presentationMode
    @StateObject private var transactionService = MultiCoinTransactionService.shared
    @State private var selectedCoin: CoinType = .bitcoin
    @State private var toAddress = ""
    @State private var amount = ""
    @State private var showingConfirmation = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Send")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                VStack(alignment: .leading, spacing: 10) {
                    Text("Coin")
                        .font(.headline)
                    Picker("Coin", selection: $selectedCoin) {
                        ForEach(CoinType.allCases, id: \.self) { coin in
                            Text(coin.symbol).tag(coin)
                        }
                    }
                    .pickerStyle(MenuPickerStyle())
                }
                
                VStack(alignment: .leading, spacing: 10) {
                    Text("To Address")
                        .font(.headline)
                    TextField("Enter address", text: $toAddress)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                }
                
                VStack(alignment: .leading, spacing: 10) {
                    Text("Amount")
                        .font(.headline)
                    TextField("Enter amount", text: $amount)
                        .keyboardType(.decimalPad)
                        .textFieldStyle(RoundedBorderTextFieldStyle())
                }
                
                Spacer()
                
                Button("Send") {
                    showingConfirmation = true
                }
                .buttonStyle(.borderedProminent)
                .disabled(toAddress.isEmpty || amount.isEmpty)
            }
            .padding()
            .navigationBarItems(trailing: Button("Cancel") {
                presentationMode.wrappedValue.dismiss()
            })
            .alert("Confirm Send", isPresented: $showingConfirmation) {
                Button("Cancel", role: .cancel) { }
                Button("Send") {
                    sendTransaction()
                }
            } message: {
                Text("Send \(amount) \(selectedCoin.symbol) to \(toAddress)?")
            }
        }
    }
    
    private func sendTransaction() {
        guard let amountValue = Double(amount) else { return }
        
        Task {
            let response = await transactionService.sendTransaction(
                coinType: selectedCoin,
                toAddress: toAddress,
                amount: amountValue
            )
            
            if response.success {
                presentationMode.wrappedValue.dismiss()
            }
        }
    }
}

// MARK: - Receive View
struct ReceiveView: View {
    @Environment(\.presentationMode) var presentationMode
    @StateObject private var walletService = MultiCoinWalletService.shared
    @State private var selectedCoin: CoinType = .bitcoin
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                Text("Receive")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                VStack(alignment: .leading, spacing: 10) {
                    Text("Coin")
                        .font(.headline)
                    Picker("Coin", selection: $selectedCoin) {
                        ForEach(CoinType.allCases, id: \.self) { coin in
                            Text(coin.symbol).tag(coin)
                        }
                    }
                    .pickerStyle(MenuPickerStyle())
                }
                
                if let wallet = walletService.selectedWallet,
                   let address = wallet.getAddress(for: selectedCoin) {
                    VStack(spacing: 15) {
                        Text("Your \(selectedCoin.symbol) Address")
                            .font(.headline)
                        
                        Text(address)
                            .font(.system(.body, design: .monospaced))
                            .padding()
                            .background(Color(.systemGray6))
                            .cornerRadius(10)
                        
                        Button("Copy Address") {
                            UIPasteboard.general.string = address
                        }
                        .buttonStyle(.bordered)
                    }
                } else {
                    Text("No address available for \(selectedCoin.symbol)")
                        .foregroundColor(.gray)
                }
                
                Spacer()
            }
            .padding()
            .navigationBarItems(trailing: Button("Done") {
                presentationMode.wrappedValue.dismiss()
            })
        }
    }
}

// MARK: - Balance Display
struct BalanceDisplay: View {
    @StateObject private var dexService = DEXCoreService.shared
    
    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Your Balances")
                .font(.headline)
            
            ForEach(CoinType.allCases.filter { dexService.supportedCoins.contains($0) }, id: \.self) { coinType in
                HStack {
                    Text(coinType.symbol)
                    Spacer()
                    Text("\(dexService.userBalances[coinType] ?? 0, specifier: "%.8f")")
                        .fontWeight(.semibold)
                }
            }
        }
        .padding()
        .background(Color(.systemGray6))
        .cornerRadius(10)
    }
} 