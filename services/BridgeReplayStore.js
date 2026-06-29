class BridgeReplayStore {
  constructor() {
    this.usedNonces = new Set();
    this.usedRequestIds = new Set();
  }

  consumeNonce(sessionToken, nonce) {
    const key = `${sessionToken}:${nonce}`;
    if (this.usedNonces.has(key)) {
      return false;
    }
    this.usedNonces.add(key);
    return true;
  }

  consumeRequestId(requestId) {
    if (this.usedRequestIds.has(requestId)) {
      return false;
    }
    this.usedRequestIds.add(requestId);
    return true;
  }
}

module.exports = new BridgeReplayStore();
