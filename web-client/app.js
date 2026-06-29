const API_BASE = window.location.origin;

const sessionBadge = document.getElementById('sessionBadge');
const sessionLog = document.getElementById('sessionLog');
const connectBtn = document.getElementById('connectBtn');

let pollTimer = null;
let activeConnectionId = null;

async function fetchJSON(path, options) {
  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${path} failed (${res.status})`);
  return data;
}

function log(message) {
  sessionLog.textContent = typeof message === 'string' ? message : JSON.stringify(message, null, 2);
}

function setBadge(text, kind = 'muted') {
  sessionBadge.textContent = text;
  sessionBadge.className = `badge ${kind}`;
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

async function loadOrderBook() {
  try {
    const book = await fetchJSON('/api/orders/BTC%2FTLS');
    document.getElementById('orderBook').textContent = JSON.stringify(book, null, 2);
  } catch (err) {
    document.getElementById('orderBook').textContent = `Order book unavailable: ${err.message}`;
  }
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

connectBtn.addEventListener('click', connectZeroa);

Promise.all([loadMarkets(), loadPrices(), loadOrderBook()]).catch((err) => {
  log(`Backend unreachable: ${err.message}`);
});

const saved = localStorage.getItem('powdex_bridge_session');
if (saved) {
  try {
    const session = JSON.parse(saved);
    if (session.expiresAt * 1000 > Date.now()) {
      setBadge('Connected', 'ok');
      log({ message: 'Restored session', ...session });
    }
  } catch (_) { /* ignore */ }
}
