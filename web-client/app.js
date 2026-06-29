const API_BASE = window.location.origin;

const sessionBadge = document.getElementById('sessionBadge');
const sessionLog = document.getElementById('sessionLog');
const connectBtn = document.getElementById('connectBtn');
const orderForm = document.getElementById('orderForm');
const orderStatus = document.getElementById('orderStatus');
const swapForm = document.getElementById('swapForm');
const swapLog = document.getElementById('swapLog');
const swapBtn = document.getElementById('swapBtn');
const htlcBadge = document.getElementById('htlcBadge');

let pollTimer = null;
let activeConnectionId = null;
let bridgeSession = null;
let socket = null;

async function fetchJSON(path, options) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${path} failed (${res.status})`);
  return data;
}

function log(message) {
  sessionLog.textContent = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
}

function swapStatus(message) {
  swapLog.textContent = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
}

function setBadge(text, kind = 'muted') {
  sessionBadge.textContent = text;
  sessionBadge.className = `badge ${kind}`;
}

function getBridgeSession() {
  if (bridgeSession) return bridgeSession;
  try {
    const saved = localStorage.getItem('powdex_bridge_session');
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    if (parsed.expiresAt * 1000 > Date.now()) {
      bridgeSession = parsed;
      return parsed;
    }
  } catch (_) { /* ignore */ }
  return null;
}

function ensureSocket() {
  if (socket) return socket;
  socket = io(API_BASE, { transports: ['websocket', 'polling'] });
  socket.on('orderBookUpdate', () => loadOrderBook());
  socket.on('orderMatch', (payload) => {
    orderStatus.textContent = `Match: ${JSON.stringify(payload)}`;
    loadOrderBook();
  });
  socket.on('bridgeSignRequestUpdated', (payload) => {
    swapStatus({ event: 'signUpdated', ...payload });
  });
  return socket;
}

async function loadMarkets() {
  const data = await fetchJSON('/api/markets');
  const tbody = document.querySelector('#marketsTable tbody');
  tbody.innerHTML = '';
  for (const market of data.markets || []) {
    const tr = document.createElement('tr');
    const badge = market.settlement === 'pre-settlement'
      ? '<span class="badge warn">pre-settlement</span>'
      : '<span class="badge muted">oracle</span>';
    tr.innerHTML = `<td>${market.pair}</td><td>${badge}</td>`;
    tbody.appendChild(tr);
  }
}

async function loadPrices() {
  const prices = await fetchJSON('/api/prices');
  const tbody = document.querySelector('#pricesTable tbody');
  tbody.innerHTML = '';
  for (const [pair, price] of Object.entries(prices)) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${pair}</td><td>${Number(price).toLocaleString()}</td>`;
    tbody.appendChild(tr);
  }
}

function renderOrders(tableId, orders) {
  const tbody = document.querySelector(`#${tableId} tbody`);
  tbody.innerHTML = '';
  for (const order of orders || []) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${order.price ?? '—'}</td><td>${order.remainingAmount ?? order.amount}</td>`;
    tbody.appendChild(tr);
  }
}

async function loadOrderBook() {
  try {
    const book = await fetchJSON('/api/orders/BTC%2FTLS');
    renderOrders('bidsTable', book.buyOrders);
    renderOrders('asksTable', book.sellOrders);
    ensureSocket().emit('joinOrderBook', 'BTC/TLS');
  } catch (err) {
    orderStatus.textContent = `Order book unavailable: ${err.message}`;
  }
}

async function loadHtlcStatus() {
  try {
    const status = await fetchJSON('/api/htlc/status');
    if (!status.enabled) {
      htlcBadge.textContent = 'disabled';
      swapBtn.disabled = true;
    } else if (status.testnetOnly) {
      htlcBadge.textContent = status.broadcastEnabled ? 'testnet + broadcast' : 'testnet scaffold';
    } else {
      htlcBadge.textContent = 'mainnet';
      htlcBadge.className = 'badge ok';
    }
  } catch (_) { /* ignore */ }
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function pollAuthStatus(connectionId) {
  try {
    const status = await fetchJSON(`/api/bridge/auth/status/${connectionId}`);
    if (status.status === 'completed' && status.session) {
      stopPolling();
      activeConnectionId = null;
      connectBtn.disabled = false;
      setBadge('Connected', 'ok');
      bridgeSession = status.session;
      log({
        message: 'Zeroa session verified',
        tlsAddress: status.session.tlsAddress,
        bridgeSessionId: status.session.bridgeSessionId,
        expiresAt: status.session.expiresAt
      });
      localStorage.setItem('powdex_bridge_session', JSON.stringify(status.session));
      return;
    }
    if (status.status === 'expired') {
      stopPolling();
      connectBtn.disabled = false;
      setBadge('Expired', 'muted');
      log('Connection expired. Try again.');
    }
  } catch (err) {
    log(`Polling error: ${err.message}`);
  }
}

async function connectZeroa() {
  connectBtn.disabled = true;
  setBadge('Waiting for Zeroa…', 'warn');
  log('Starting bridge auth…');

  try {
    const init = await fetchJSON('/api/bridge/auth/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permissions: ['dex.read', 'dex.trade', 'dex.sign.swap'] })
    });

    activeConnectionId = init.connectionId;
    log({ step: 'init', connectionId: init.connectionId, nonce: init.nonce });

    const zeroaURL = `zeroa://powdex/auth?connectionId=${encodeURIComponent(init.connectionId)}`;
    window.location.href = zeroaURL;

    pollTimer = setInterval(() => pollAuthStatus(init.connectionId), 1000);
    setTimeout(() => pollAuthStatus(init.connectionId), 500);
  } catch (err) {
    connectBtn.disabled = false;
    setBadge('Error', 'muted');
    log(`Connect failed: ${err.message}`);
  }
}

async function submitOrder(event) {
  event.preventDefault();
  const session = getBridgeSession();
  if (!session?.bridgeSessionId) {
    orderStatus.textContent = 'Connect Zeroa first.';
    return;
  }

  const side = document.getElementById('orderSide').value;
  const amount = document.getElementById('orderAmount').value;
  const price = document.getElementById('orderPrice').value;

  try {
    const order = await fetchJSON('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: session.tlsAddress,
        pair: 'BTC/TLS',
        side,
        type: 'limit',
        amount,
        price
      })
    });
    orderStatus.textContent = `Order placed: ${order.id || 'ok'}`;
    await loadOrderBook();
  } catch (err) {
    orderStatus.textContent = `Order failed: ${err.message}`;
  }
}

function openZeroaSign(requestId) {
  const zeroaURL = `zeroa://powdex/sign?requestId=${encodeURIComponent(requestId)}`;
  window.location.href = zeroaURL;
}

async function pollSignRequest(requestId, label) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const status = await fetchJSON(`/api/bridge/sign-requests/${requestId}`);
      if (status.status === 'submitted') {
        swapStatus({ step: label, requestId, status: 'signed' });
        return status;
      }
    } catch (_) { /* retry */ }
  }
  throw new Error(`${label} sign timed out`);
}

async function prepareSwap(event) {
  event.preventDefault();
  const session = getBridgeSession();
  if (!session?.bridgeSessionId) {
    swapStatus('Connect Zeroa first.');
    return;
  }

  const side = document.getElementById('swapSide').value;
  const amount = document.getElementById('swapAmount').value;
  const price = document.getElementById('swapPrice').value;

  swapBtn.disabled = true;
  try {
    swapStatus('Creating HTLC swap…');
    const swap = await fetchJSON('/api/htlc/swaps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bridgeSessionId: session.bridgeSessionId,
        pair: 'BTC/TLS',
        side,
        amount,
        price: price || undefined
      })
    });

    swapStatus({ step: 'swap_created', swapId: swap.swapId, status: swap.status });

    if (swap.btcSignRequestId) {
      swapStatus({ step: 'opening_zeroa_btc', requestId: swap.btcSignRequestId });
      openZeroaSign(swap.btcSignRequestId);
      await pollSignRequest(swap.btcSignRequestId, 'BTC');
    }

    if (swap.tlsSignRequestId) {
      swapStatus({ step: 'opening_zeroa_tls', requestId: swap.tlsSignRequestId });
      openZeroaSign(swap.tlsSignRequestId);
      await pollSignRequest(swap.tlsSignRequestId, 'TLS');
    }

    const refreshed = await fetchJSON(`/api/htlc/swaps/${swap.swapId}`);
    swapStatus({ step: 'ready', swap: refreshed });
  } catch (err) {
    swapStatus(`Swap failed: ${err.message}`);
  } finally {
    swapBtn.disabled = false;
  }
}

connectBtn.addEventListener('click', connectZeroa);
orderForm.addEventListener('submit', submitOrder);
swapForm.addEventListener('submit', prepareSwap);

Promise.all([loadMarkets(), loadPrices(), loadOrderBook(), loadHtlcStatus()]).catch((err) => {
  log(`Backend unreachable: ${err.message}`);
});

const saved = getBridgeSession();
if (saved) {
  setBadge('Connected', 'ok');
  log({ message: 'Restored session', ...saved });
  ensureSocket();
}
