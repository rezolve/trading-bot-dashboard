# Movers Day-Trade Book

**PAPER ONLY** gap-and-go continuation scanner on liquid market movers. Hard rule: **NEVER hold overnight**.

## Strategy Overview

This bot scans Alpaca SIP market movers and trades intraday continuation on liquid names that pass strict filters. It's designed for active day-trading with zero overnight exposure.

### Universe

- **Source**: Alpaca SIP market movers API
  - Gainers (top 10 by percent)
  - Most-active (top 10 by volume)
- **UNION**: Combine both lists for ~20 candidate symbols
- **NOT a full tape scanner**: Focused universe via Alpaca's curated movers

### Mandatory Filters

1. **Price >= $5**: Skip penny stocks
2. **No warrants/units**: Exclude symbols with `.WS`, `.U`, `.W`, `+`, `^` suffixes
3. **No OTC**: Skip symbols with `.` or starting with digits
4. **Prefer ADV >= 5M**: 5 million shares average daily volume (preference, not hard rule)
5. **Watchlist cap**: ~20 symbols maximum
6. **Max 3 simultaneous positions**

### Strategy (v1 Long-Only)

**Market Regime Gate**:
- Only trade when **SPY daily SMA10 > SMA30** (bullish)
- Recalculate at market open (09:30 ET)

**Entry Signal (Gap-and-Go Continuation)**:
- Break of premarket high OR first RTH 1Min high
- v1 simplified: current price > premarket high

**Stop Loss**:
- Signal-bar low OR premarket low (whichever is tighter)

**Position Sizing**:
- $10k notional per name OR 10% of equity, whichever is **smaller**

**Exit Rules**:
- Stop hit (signal-bar low / premarket low)
- **Hard flatten ALL by 15:55 ET** (calendar-aware early close)
- **No GTC overnight**. Day orders only (TimeInForce.DAY)

## Data Feed

- **Alpaca SIP websocket**: Unlimited symbols (Algo Trading Plus)
- **Minute bars**: 1Min RTH bars for entry signals
- **Snapshots**: Real-time price and volume checks

## Risk Management

### Position Limits
- Max 3 simultaneous positions
- Max $10k notional per name
- Max 10% of equity per position

### Intraday-Only Enforcement
- Flatten ALL positions by 15:55 ET
- Day orders only (no GTC)
- Market closed = no trading

### Paper-Only Enforcement
- Multi-layer validation:
  1. `APCA_API_BASE_URL` must contain 'paper'
  2. `APCA_API_BASE_URL` must NOT contain 'live'
  3. `TradingClient(paper=True)` forced
  4. Bot refuses to start if live API detected

### Kill Switch
- Checks Firestore `bot-settings/{userId}` for `killSwitch`
- If true: flattens all positions and stops trading

### Paper-Live Gate
- Polls Firestore `bots/bot_movers_day` for `paperLive` flag
- Only places orders when `paperLive === true`
- Stays connected but does not trade when false

## Firestore Integration

### Activity Logging
Writes to `bot-activity` collection for every key event:
- `scan_complete`: Watchlist updated with filtered symbols
- `scan_filter`: Symbols skipped and reasons (penny filter, warrants, OTC)
- `position_opened`: Entry with symbol, qty, price, stop
- `position_closed`: Exit with reason (stop, eod_flatten)

### Status Polling
- Reads `bots/bot_movers_day` for `paperLive` boolean
- Reads `bot-settings/{userId}` for `killSwitch` boolean

## Environment Variables

**Required**:
- `APCA_API_KEY_ID`: Alpaca API key (paper account)
- `APCA_API_SECRET_KEY`: Alpaca API secret (paper account)
- `APCA_API_BASE_URL`: Must be `https://paper-api.alpaca.markets` (PAPER ONLY)
- `USER_ID`: Firestore user ID for activity logs

**Optional**:
- `FIRESTORE_EMULATOR_HOST`: For local emulator (e.g., `localhost:8080`)

**NEVER** log API keys or secrets. The bot validates paper-only before starting.

## Running the Bot

### Local Development (Docker Compose)

```bash
# 1. Ensure .env.local has paper Alpaca credentials
# APCA_PAPER_API_KEY_ID=your-paper-key
# APCA_PAPER_API_SECRET_KEY=your-paper-secret

# 2. Start the bot
docker compose up bot-movers-day

# 3. Set paperLive=true in Firestore
# Use Firebase console or Firestore emulator UI to set:
# bots/bot_movers_day: { paperLive: true }
```

### Production

```bash
# Build the image
docker build -t bot-movers-day ./bots/bots/movers-day/

# Run with production Firebase and paper Alpaca
docker run -e APCA_API_KEY_ID="..." \
           -e APCA_API_SECRET_KEY="..." \
           -e APCA_API_BASE_URL="https://paper-api.alpaca.markets" \
           -e USER_ID="your-user-id" \
           -e GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json" \
           -v /path/to/service-account.json:/app/service-account.json:ro \
           bot-movers-day
```

## Safety Features

### Paper-Only Validation
1. **Startup check**: Refuses to run if `APCA_API_BASE_URL` doesn't contain 'paper' or contains 'live'
2. **Trading client**: `TradingClient(paper=True)` hardcoded
3. **No live keys**: Never uses live API keys

### Intraday-Only
1. **Flatten time**: 15:55 ET hard deadline
2. **Day orders**: `TimeInForce.DAY` only (no GTC)
3. **Market hours check**: No trading outside 09:30-16:00 ET

### Kill Switch
- Emergency stop via Firestore `bot-settings/{userId}.killSwitch`
- Flattens all positions immediately

### Paper-Live Gate
- Polls `bots/bot_movers_day.paperLive` flag
- Only trades when `paperLive === true`

## Limitations (v1)

1. **Long-only**: No short selling
2. **Simplified entry**: Break of premarket high (no real-time premarket tracking yet)
3. **No backtest**: First test is live 1Min SIP on filtered universe, not a 5-year all-stock sim
4. **Fixed stops**: Signal-bar low (no trailing stops)
5. **No partial exits**: Full position flatten only
6. **Market orders**: No limit orders (for guaranteed fills before close)

## Monitoring

### Dashboard (Fleet UI)
- Fleet page: Drag bot between Bench and Live to swap in/out
- Bot detail: View activity log for scan lists, entries, exits

### Activity Log Events
- `scan_complete`: Watchlist size and symbols
- `scan_filter`: Skipped symbols and reasons
- `position_opened`: Entry details (symbol, qty, price, stop)
- `position_closed`: Exit reason (stop, eod_flatten)

### Firestore Collections
- `bots/bot_movers_day`: Bot status and config
- `bot-activity`: Event log for this bot (`botId: 'bot_movers_day'`)

## Future Enhancements (Not v1)

- Short selling on downtrends (SPY SMA10 < SMA30)
- Real-time premarket high tracking (4:00-9:30 ET bars)
- Trailing stops (move stop to breakeven after X% profit)
- Partial exits (scale out at profit targets)
- Limit orders for entries (reduce slippage)
- Real backtest on 1Min SIP historical data (2024-2025)

---

**PAPER ONLY. NO LIVE TRADING. NEVER HOLD OVERNIGHT.**
