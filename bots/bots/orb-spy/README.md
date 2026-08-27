# ORB SPY Bot - PAPER ONLY

Opening Range Breakout strategy for SPY using Alpaca SIP websocket data.

## Strategy

**Opening Range Breakout (ORB)**
- Symbol: SPY
- Opening Range: 09:30-09:45 ET (15 minutes)
- Signal: First 1-minute bar close above range high
- Filter: SMA10 > SMA30 (daily) must be true
- Exit: Flatten before 15:55 ET
- Direction: Long only (v1)

## Data Feed

- **Alpaca SIP Websocket**: `wss://stream.data.alpaca.markets/v2/sip`
- Requires Algo Trading Plus subscription for SIP access
- 1-minute bars emit AFTER the minute completes (e.g., 09:30 bar at 09:31:00)
- Real-time streaming (MCP cannot hold websocket, so this is a standalone process)

## Risk Management

- **Position Size**: 10% of equity OR $10,000 notional, whichever is smaller
- **Max Trades**: One round-turn per session
- **Flatten Time**: 15:55 ET (before market close)
- **Paper Only**: Refuses to start if `APCA_API_BASE_URL` doesn't contain 'paper'

## Firestore Integration

- **paperLive flag**: Bot checks `bots/bot_orb_spy` document for `paperLive` field
- **Kill switch**: Honors `killSwitch` field if present
- **Activity logging**: Writes events to `bot-activity` collection:
  - `sma_calculated`: Daily SMA10 vs SMA30 status
  - `range_set`: Opening range high/low determined
  - `breakout_skipped`: Signal occurred but filter/flag prevented trade
  - `position_opened`: Long order submitted
  - `position_closed`: Flatten order submitted
  - `error`: Any errors during execution

## Environment Variables

```bash
APCA_API_BASE_URL=https://paper-api.alpaca.markets  # MUST contain 'paper'
APCA_API_KEY_ID=<your_paper_key>
APCA_API_SECRET_KEY=<your_paper_secret>

# Firebase (if not using default credentials)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

## Running

### Local (with Firebase emulators)

```bash
# Set environment variables
export APCA_API_BASE_URL=https://paper-api.alpaca.markets
export APCA_API_KEY_ID=your_paper_key
export APCA_API_SECRET_KEY=your_paper_secret

# Run
python bots/runtime/orb_sip_ws.py
```

### Docker

```bash
# Build
cd bots/bots/orb-spy
docker build -t orb-spy-bot .

# Run
docker run -it --rm \
  -e APCA_API_BASE_URL=https://paper-api.alpaca.markets \
  -e APCA_API_KEY_ID=your_paper_key \
  -e APCA_API_SECRET_KEY=your_paper_secret \
  -e GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json \
  -v /path/to/service-account.json:/app/service-account.json:ro \
  orb-spy-bot
```

## Safety Features

1. **Paper-only enforcement**: Bot refuses to start if BASE_URL is not paper
2. **TradingClient(paper=True)**: Force paper mode in client initialization
3. **paperLive gate**: Checks Firestore flag before placing orders
4. **Kill switch**: Honors kill switch if set in Firestore
5. **No secrets logged**: API keys never appear in logs
6. **Client order IDs**: Unique prefix `orbspy-YYYYMMDD-` for tracking

## Limitations

- **Long only**: No short trades in v1
- **Single position**: One round-turn per session, no pyramiding
- **No overnight**: Always flattens before 15:55 ET
- **US equity only**: SPY only, no options/crypto/forex
- **Market orders**: No limit orders (fills at next available price)
- **SMA filter**: Static daily SMA, not intraday adaptive

## Development Notes

- **MCP limitation**: MCP clients cannot hold websocket connections, so this must run as a standalone process
- **Bar timing**: Minute bars emit AFTER the minute closes (not at the start)
- **Range calculation**: Opening range is only known after 09:45 bar completes
- **Timezone**: All times are America/New_York (ET)
- **Paper API**: Uses Alpaca paper trading API exclusively

## Monitoring

Check Firestore `bot-activity` collection for real-time events:

```javascript
// Firebase console or dashboard
db.collection('bot-activity')
  .where('botId', '==', 'bot_orb_spy')
  .orderBy('createdAt', 'desc')
  .limit(20)
```

## PAPER ONLY

**This bot CANNOT trade live. It will refuse to start if:**
- `APCA_API_BASE_URL` does not contain 'paper'
- `APCA_API_BASE_URL` contains 'live'
- `TradingClient` is not initialized with `paper=True`

No live trading path exists in the codebase.
