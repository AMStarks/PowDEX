# PowDEX Path A — Web Client Integration (for upstream PR)

This folder adds the Path A web-first client and documents backend changes needed in `server.js`.

## Added in this PR

- `client/` — static PowDEX web UI (markets, prices, Connect Zeroa)
- `PATH_A_INTEGRATION.md` — this file

## Backend changes required (merge into `server.js`)

See monorepo reference implementation: `Zeroa/powdex/backend/server.js`

Key additions:
1. `POST /api/bridge/auth/init` — web starts connect flow
2. `GET /api/bridge/auth/request/:connectionId` — Zeroa fetches nonce
3. `GET /api/bridge/auth/status/:connectionId` — web polls completion
4. `POST /api/bridge/auth/complete` — Zeroa submits signed session
5. `GET /api/markets` — pair list with settlement badges
6. Static serve `web-client/` at `/`

## Local dev (monorepo)

```bash
cd powdex/backend
POWDEX_DEV_NO_DB=1 PORT=5050 npm run dev:no-db
open http://127.0.0.1:5050
```

## Zeroa connect flow

1. User taps **Connect Zeroa** in web UI
2. Web opens `zeroa://powdex/auth?connectionId=...`
3. Zeroa signs and POSTs to `/api/bridge/auth/complete`
4. Web polls status → JWT session
