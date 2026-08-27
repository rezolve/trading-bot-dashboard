# Cloud Functions - Live-Shaped Paper Execution

Firebase Cloud Functions for paper trading execution. Uses Google Secret Manager for secure API key storage.

## Paper-Only Enforcement

This execution path is **PAPER ONLY**. Multiple validation layers:

1. **Base URL validation**: Refuses to start if `APCA_API_BASE_URL` doesn't contain 'paper'
2. **Live API detection**: Explicitly refuses `https://api.alpaca.markets`
3. **Default URL**: `https://paper-api.alpaca.markets` (hardcoded)
4. **No live keys**: Never accepts live Alpaca API keys

## Secret Manager Setup

**NEVER commit API keys to the repository.**

Set secrets via Firebase CLI:

```bash
# Set paper API keys
firebase functions:secrets:set APCA_PAPER_API_KEY_ID
# Paste your Alpaca PAPER API key when prompted

firebase functions:secrets:set APCA_PAPER_API_SECRET_KEY
# Paste your Alpaca PAPER API secret when prompted
```

Verify secrets:

```bash
firebase functions:secrets:access APCA_PAPER_API_KEY_ID
firebase functions:secrets:access APCA_PAPER_API_SECRET_KEY
```

## Functions

### `scheduledCheck` (RTH Worker)

**Schedule**: Every 1 minute  
**Secrets**: `APCA_PAPER_API_KEY_ID`, `APCA_PAPER_API_SECRET_KEY`

**Behavior**:
- **Market closed**: No-op (except flatten window)
- **09:30-15:55 ET weekdays**: Process paper-live day-trade bots
- **Strategy v1**: ORB 15m SPY long-only
  - After 9:45 ET
  - Entry: SPY price > opening range high (09:30-09:45) AND SMA10 > SMA30 daily
  - Position size: $10k or 10% equity, whichever smaller
  - Logs signals to `bot-activity` even if no order
- **Data feed**: Alpaca SIP 1Min bars (`feed=sip`)
- **Never live**: Refuses to start if live API detected

**Limitations (v1)**:
- No SIP websocket (Functions cannot hold it)
- 1-min poll is the v1 live shape
- ORB strategy only (movers scanner future work)

### `flattenEOD` (EOD Flatten)

**Schedule**: 15:50 ET weekdays (Mon-Fri)  
**Timezone**: America/New_York  
**Secrets**: `APCA_PAPER_API_KEY_ID`, `APCA_PAPER_API_SECRET_KEY`

**Behavior**:
- Close ALL paper positions (hard no-overnight rule)
- Log to `lineup-snapshots` collection with `reason: 'flatten-eod'`
- Log to `bot-activity` for each day-trade bot
- Runs 5 minutes before market close (15:55 ET) to ensure fills

**Early close detection**: Future work to detect Alpaca calendar for 12:50 ET flatten.

## Data APIs

- **Trading API**: `https://paper-api.alpaca.markets` (paper REST only)
- **Data API**: `https://data.alpaca.markets` (SIP bars via paper account keys)
  - Uses `feed=sip` query parameter (requires Algo Trading Plus subscription)
  - 1Min bars for intraday signals
  - 1Day bars for daily SMA calculation

## Firestore Collections

### `bot-activity`
- Logs all signals, orders, errors
- Event types: `position_opened`, `position_closed`, `warning`, `error`

### `lineup-snapshots`
- EOD flatten logs
- Market open/noon/close heartbeats (if implemented)
- Reason: `flatten-eod`, `flatten-eod-error`

## Bot Selection Criteria

Functions process bots that are:
1. `paperLive == true` (swapped in via UI)
2. `category == 'day-trade'` OR `holdsOvernight == false`

Swing and position bots are ignored by the RTH worker.

## Deployment

```bash
# Build functions
cd functions
npm run build

# Deploy all functions
npm run deploy

# Deploy specific function
firebase deploy --only functions:scheduledCheck
firebase deploy --only functions:flattenEOD
```

## Local Development

Functions emulator does NOT support Secret Manager. For local testing:

1. Set environment variables in `.env.local` (DO NOT COMMIT):
   ```
   APCA_PAPER_API_KEY_ID=your-paper-key
   APCA_PAPER_API_SECRET_KEY=your-paper-secret
   ```

2. Start emulator:
   ```bash
   npm run serve
   ```

3. Trigger manually:
   ```bash
   firebase functions:shell
   > scheduledCheck({})
   ```

## Security Notes

- **Secrets are encrypted** in Google Secret Manager
- **Never log API keys** in function output
- **Paper-only validation** on every order placement
- **Client order IDs** are unique: `{botId}-{timestamp}`
- **Day orders only** (`time_in_force: 'day'`) - no GTC overnight

## Future Work

- Add early-close detection (Alpaca calendar API)
- Implement movers scanner (liquid universe)
- Add heartbeat lineup snapshots (open/noon/close)
- Support multiple strategies per bot
- Add position tracking in Firestore
- Implement stop-loss management
