# Fleet Architecture

## Overview

This document describes the multi-bot fleet architecture that extends the original single-bot dashboard into a fleet management system for independent containerized trading bots.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FIREBASE CONTROL PLANE                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Firestore   │  │   Functions  │  │   Storage    │          │
│  │              │  │              │  │              │          │
│  │ • Bot        │  │ • Trigger    │  │ • Backtest   │          │
│  │   Registry   │  │   Backtest   │  │   Reports    │          │
│  │ • Configs    │  │ • Swap In/Out│  │ • Equity     │          │
│  │ • Status     │  │ • Webhooks   │  │   Curves     │          │
│  │ • Backtests  │  │ • Scheduled  │  │ • Trade CSVs │          │
│  │ • Activity   │  │   Triggers   │  │ • Logs       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                        DASHBOARD (Next.js)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  • Fleet Overview (list all bots)                               │
│  • Bot Detail (config, backtests, logs)                         │
│  • Create/Configure Bot                                          │
│  • Swap In/Out Controls                                          │
│  • Legacy: Positions, Orders, Trade Desk (bot-scoped)           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                        BOT CONTAINERS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  Bot 1       │  │  Bot 2       │  │  Bot N       │          │
│  │  (example-   │  │  (stub)      │  │  (user-      │          │
│  │   sma)       │  │              │  │   created)   │          │
│  │              │  │              │  │              │          │
│  │ • Strategy   │  │ • Strategy   │  │ • Strategy   │          │
│  │ • Signals    │  │ • Signals    │  │ • Signals    │          │
│  │ • Triggers   │  │ • Triggers   │  │ • Triggers   │          │
│  │ • Paper API  │  │ • Paper API  │  │ • Paper API  │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                   │
│  Paper-Only Enforcement: APCA_API_BASE_URL must contain         │
│  "paper" or container refuses to start                           │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Firebase Control Plane

#### Cloud Firestore (Source of Truth)

**Collections:**

1. **`bots/{botId}`** - Bot registry
   ```typescript
   {
     botId: string;              // Unique bot identifier
     userId: string;             // Owner
     name: string;               // Display name
     description?: string;       // Optional description
     status: 'draft' | 'backtest' | 'paper' | 'stopped';
     
     // Strategy configuration
     strategy: {
       type: string;             // e.g., 'sma-crossover', 'mean-reversion'
       params: Record<string, any>; // Strategy-specific parameters
     };
     
     // Signals & Triggers
     signals: {
       type: string;             // e.g., 'indicator', 'ml-model', 'webhook'
       config: Record<string, any>;
     }[];
     
     triggers: {
       type: string;             // e.g., 'scheduled', 'price-alert', 'webhook'
       config: Record<string, any>;
     }[];
     
     // Risk limits
     riskLimits: {
       maxNotionalPerOrder: number;
       maxPositionPercent: number;
       allowedAssetClasses: ('stock' | 'option')[];
       maxDailyDrawdown?: number;
     };
     
     // Runtime state
     paperLive: boolean;         // Currently swapped into paper execution
     containerId?: string;       // Docker container ID when running
     lastBacktestId?: string;    // Most recent backtest run
     
     createdAt: Date;
     updatedAt: Date;
   }
   ```

2. **`backtest-runs/{backtestId}`** - Backtest execution metadata
   ```typescript
   {
     backtestId: string;
     botId: string;
     userId: string;
     
     // Backtest parameters
     startDate: Date;
     endDate: Date;
     initialCapital: number;
     
     // Status
     status: 'queued' | 'running' | 'completed' | 'failed';
     startedAt?: Date;
     completedAt?: Date;
     error?: string;
     
     // Results summary (stored here for quick access)
     summary?: {
       totalReturn: number;
       sharpeRatio: number;
       maxDrawdown: number;
       winRate: number;
       totalTrades: number;
     };
     
     // Storage references
     reportUrl?: string;         // Cloud Storage URL for full report
     equityCurveUrl?: string;    // Cloud Storage URL for equity curve
     tradesUrl?: string;         // Cloud Storage URL for trades CSV
     logsUrl?: string;           // Cloud Storage URL for logs
     
     createdAt: Date;
   }
   ```

3. **`bot-activity/{eventId}`** - Bot-specific activity log
   ```typescript
   {
     eventId: string;
     botId: string;
     userId: string;
     eventType: 'bot_created' | 'bot_updated' | 'backtest_started' 
               | 'backtest_completed' | 'swapped_in' | 'swapped_out'
               | 'trade_executed' | 'error';
     message: string;
     metadata?: Record<string, any>;
     createdAt: Date;
   }
   ```

4. **Existing Collections (now bot-scoped):**
   - `bot-settings/{botId}` - Bot settings (replaces userId with botId)
   - `accounts/{botId}` - Account snapshot per bot
   - `positions/{positionId}` - Now includes `botId` field
   - `orders/{orderId}` - Now includes `botId` field
   - `trade-intents/{intentId}` - Now includes `botId` field
   - `activity/{eventId}` - Legacy activity (kept for compatibility)

#### Cloud Functions (Orchestration)

**Functions:**

1. **`triggerBacktest`** (HTTPS Callable)
   - Input: `{ botId, startDate, endDate, initialCapital }`
   - Validates bot exists and user owns it
   - Creates backtest-run document
   - Spawns backtest container with Alpaca historical data
   - Returns `backtestId`
   - Paper-only: validates Alpaca keys point to paper endpoint

2. **`swapInBot`** (HTTPS Callable)
   - Input: `{ botId }`
   - Validates bot has successful backtest
   - Swaps out any currently paper-live bot (if exclusive mode)
   - Starts bot container with paper execution enabled
   - Updates bot status to `paper`
   - Logs swap-in event
   - Paper-only: injects PAPER API endpoint env vars

3. **`swapOutBot`** (HTTPS Callable)
   - Input: `{ botId }`
   - Stops bot container gracefully
   - Updates bot status to `stopped`
   - Logs swap-out event
   - Preserves all positions/orders/history

4. **`webhookTrigger`** (HTTPS)
   - Input: webhook payload with `botId` and `signal`
   - Validates webhook signature
   - Triggers bot signal processing
   - Used for external signals (TradingView, Discord, etc.)

5. **`scheduledCheck`** (Cloud Scheduler)
   - Runs every minute during market hours
   - Checks all paper-live bots for scheduled triggers
   - Monitors health (heartbeat checks)
   - Auto-stops unhealthy bots

**Secrets Management:**
- Alpaca API keys stored in Secret Manager or Functions config
- Paper-only enforcement: refuse to start if `APCA_API_BASE_URL` doesn't contain "paper"
- Never expose keys to client

#### Cloud Storage (Artifacts)

**Buckets:**

1. **`{project-id}-bot-backtests`**
   - Structure: `/{userId}/{botId}/{backtestId}/`
   - Contents:
     - `report.json` - Full backtest results
     - `equity_curve.json` - Time-series equity data
     - `trades.csv` - All trades executed
     - `logs.txt` - Backtest execution logs
     - `metrics.json` - Performance metrics

2. **`{project-id}-bot-logs`**
   - Structure: `/{userId}/{botId}/sessions/{sessionId}/`
   - Contents:
     - `runtime.log` - Bot runtime logs
     - `trades.log` - Trade execution logs
     - `errors.log` - Error logs
     - `notes.md` - Developer session notes

**Security:**
- Storage rules: only authenticated operator can read/write their own files
- Signed URLs with expiration for dashboard access
- Automatic cleanup of old artifacts (retention policy)

### 2. Dashboard (Next.js)

#### New Pages

1. **`/dashboard/fleet`** - Fleet overview
   - List all bots with status
   - Create new bot button
   - Quick actions: swap in/out, view details
   - Filter by status (draft, paper, stopped)
   - Last backtest summary per bot

2. **`/dashboard/fleet/create`** - Create/configure bot
   - Bot name and description
   - Strategy selection (dropdown)
   - Strategy parameters (dynamic form)
   - Signals configuration
   - Triggers configuration
   - Risk limits
   - Save as draft

3. **`/dashboard/fleet/[botId]`** - Bot detail page
   - Tabs:
     - **Config**: View/edit strategy, signals, triggers, risk limits
     - **Backtests**: List all backtest runs with summary, view reports
     - **Logs**: Stream runtime logs from Cloud Storage
     - **Activity**: Bot-specific activity feed
   - Actions: Run backtest, Swap in/out, Delete

4. **`/dashboard/fleet/[botId]/backtest/[backtestId]`** - Backtest report
   - Summary metrics (return, Sharpe, drawdown, win rate)
   - Equity curve chart
   - Trade list table
   - Logs viewer
   - Compare with previous backtests

#### Updated Pages

1. **`/dashboard`** (Overview)
   - Now shows fleet summary
   - Select bot from dropdown to view its account/positions
   - Or show aggregated view across all paper-live bots

2. **`/dashboard/positions`**
   - Add bot filter dropdown
   - Show positions for selected bot or all bots

3. **`/dashboard/orders`**
   - Add bot filter dropdown
   - Show orders for selected bot or all bots

4. **`/dashboard/trade-desk`**
   - Bot selection required
   - Create trade intent for specific bot

5. **`/dashboard/settings`**
   - Now per-bot settings
   - Bot selection dropdown
   - Keeps kill switch (now per-bot)

### 3. Bot Containers

#### Structure

```
/workspace/bots/
├── runtime/                    # Shared bot runtime
│   ├── bot_base.py            # Base bot class
│   ├── firebase_client.py     # Firestore/Storage client
│   ├── alpaca_client.py       # Alpaca paper client (enforced)
│   ├── backtest_runner.py     # Backtest orchestrator
│   ├── strategy_interface.py  # Strategy base class
│   └── requirements.txt       # Python dependencies
│
├── strategies/                 # Strategy implementations
│   ├── sma_crossover.py       # Example: SMA crossover
│   ├── mean_reversion.py      # Stub strategy
│   └── ...
│
├── bots/                       # Bot instances
│   ├── example-sma/
│   │   ├── config.json        # Bot configuration
│   │   ├── Dockerfile         # Bot-specific Dockerfile
│   │   └── main.py            # Entry point (imports strategy)
│   │
│   └── example-stub/
│       ├── config.json
│       ├── Dockerfile
│       └── main.py
│
└── Dockerfile.base            # Base image for all bots
```

#### Bot Runtime

**bot_base.py:**
- Connects to Firestore to read config
- Listens for swap-in/swap-out commands
- Enforces paper-only (checks APCA_API_BASE_URL)
- Implements signal/trigger handlers
- Writes positions/orders/activity to Firestore
- Heartbeat to confirm health

**Paper-Only Enforcement:**
```python
def validate_paper_only():
    base_url = os.getenv('APCA_API_BASE_URL', '')
    if 'paper' not in base_url.lower():
        raise ValueError('PAPER API endpoint required. Refusing to start.')
```

#### Example Bots

1. **example-sma** (SMA Crossover)
   - Signals: SMA(10) crosses SMA(30)
   - Trigger: Scheduled (every minute during market hours)
   - Strategy params: `{ "fast_period": 10, "slow_period": 30, "symbol": "SPY" }`

2. **example-stub** (Placeholder)
   - Minimal strategy that does nothing
   - Demonstrates bot structure
   - Template for creating new bots

### 4. Docker Compose

**docker-compose.yml:**

```yaml
version: '3.8'

services:
  # Firebase Emulators
  firebase:
    image: node:18
    working_dir: /app
    volumes:
      - .:/app
    command: npm run emulators
    ports:
      - "9199:9199"  # Auth
      - "8180:8180"  # Firestore
      - "5001:5001"  # Functions
      - "9199:9199"  # Storage
      - "4100:4100"  # UI
    environment:
      - FIREBASE_EMULATOR_HUB=true

  # Dashboard
  dashboard:
    build:
      context: .
      dockerfile: Dockerfile.dashboard
    ports:
      - "43123:43123"
    environment:
      - NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY}
      - NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
    depends_on:
      - firebase

  # Bot: Example SMA
  bot-example-sma:
    build:
      context: ./bots
      dockerfile: bots/example-sma/Dockerfile
    environment:
      - BOT_ID=example-sma
      - FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
      - FIREBASE_EMULATOR=true
      - APCA_API_KEY_ID=${APCA_PAPER_API_KEY_ID}
      - APCA_API_SECRET_KEY=${APCA_PAPER_API_SECRET_KEY}
      - APCA_API_BASE_URL=https://paper-api.alpaca.markets
    depends_on:
      - firebase
    restart: unless-stopped

  # Bot: Example Stub
  bot-example-stub:
    build:
      context: ./bots
      dockerfile: bots/example-stub/Dockerfile
    environment:
      - BOT_ID=example-stub
      - FIREBASE_PROJECT_ID=${FIREBASE_PROJECT_ID}
      - FIREBASE_EMULATOR=true
      - APCA_API_KEY_ID=${APCA_PAPER_API_KEY_ID}
      - APCA_API_SECRET_KEY=${APCA_PAPER_API_SECRET_KEY}
      - APCA_API_BASE_URL=https://paper-api.alpaca.markets
    depends_on:
      - firebase
    restart: unless-stopped
```

## Bot Lifecycle

### 1. Draft → Backtest

1. User creates bot in UI (`/dashboard/fleet/create`)
2. Bot saved to Firestore with `status: 'draft'`
3. User clicks "Run Backtest"
4. Cloud Function `triggerBacktest` called
5. Backtest container spawned with historical data
6. Results written to Cloud Storage
7. Summary written to Firestore `backtest-runs`
8. Bot status updated to `backtest` (ready to promote)

### 2. Backtest → Paper (Swap In)

1. User reviews backtest results
2. User clicks "Swap In to Paper"
3. Cloud Function `swapInBot` called
4. Function validates backtest exists
5. Bot container started with paper execution enabled
6. Bot status updated to `paper`
7. Bot begins live paper trading

### 3. Paper → Stopped (Swap Out)

1. User clicks "Swap Out"
2. Cloud Function `swapOutBot` called
3. Bot container stopped gracefully
4. Positions remain open (visible in dashboard)
5. Bot status updated to `stopped`
6. Bot can be swapped back in later

### 4. Concurrent Paper Bots

- Multiple bots can be paper-live simultaneously
- Each bot is independent (own positions, orders, activity)
- Dashboard allows filtering by bot
- Aggregate views show combined portfolio

## Paper-Only Guarantee

### Enforcement Points

1. **Cloud Functions:**
   - Validate `APCA_API_BASE_URL` contains "paper"
   - Refuse to inject live API keys
   - Check Alpaca account type before swap-in

2. **Bot Containers:**
   - Startup validation: check env vars
   - Runtime validation: reject live endpoints
   - Fail fast if paper requirement violated

3. **Dashboard:**
   - Prominent "PAPER" indicators
   - Warning banners on all pages
   - No UI path to configure live keys

4. **Configuration:**
   - Docker Compose hardcodes paper URL
   - .env.example shows paper endpoints only
   - README explicitly documents paper-only design

### Litmus Test

**Before any bot starts:**
```python
if 'paper' not in os.getenv('APCA_API_BASE_URL', '').lower():
    print('❌ LIVE API DETECTED - REFUSING TO START')
    sys.exit(1)
```

**Logged to Firestore:**
```typescript
{
  eventType: 'safety_check_passed',
  message: '✅ Paper-only enforcement validated',
  metadata: { endpoint: 'https://paper-api.alpaca.markets' }
}
```

## Local Development

### Quick Start

```bash
# 1. Install dependencies
npm install
cd functions && npm install && cd ..
cd bots/runtime && pip install -r requirements.txt && cd ../..

# 2. Start emulators + dashboard + bots
docker compose up

# 3. Open dashboard
http://localhost:43123

# 4. Create account and seed data
npm run seed <user-id>

# 5. Create first bot
# - Go to Fleet → Create Bot
# - Name: "My SMA Bot"
# - Strategy: SMA Crossover
# - Save as draft

# 6. Run backtest
# - Click "Run Backtest"
# - Wait for completion (~1 min)
# - Review results

# 7. Swap in to paper
# - Click "Swap In to Paper"
# - Bot begins paper trading
# - View live positions/orders

# 8. Swap out
# - Click "Swap Out"
# - Bot stops (positions remain)
```

### Emulator Ports

- Dashboard: http://localhost:43123
- Firebase UI: http://localhost:4100
- Auth Emulator: http://localhost:9199
- Firestore Emulator: http://localhost:8180
- Functions Emulator: http://localhost:5001
- Storage Emulator: http://localhost:9199

## Production Deployment

### Firebase Setup

1. Enable Cloud Firestore
2. Enable Cloud Functions
3. Enable Cloud Storage
4. Deploy security rules
5. Configure Secret Manager with Alpaca paper keys
6. Deploy functions

### Bot Deployment

1. Build bot images
2. Push to container registry
3. Deploy to Cloud Run or Kubernetes
4. Configure environment variables
5. Enable auto-scaling based on swap-in events

### Monitoring

- Cloud Functions logs
- Bot container logs in Cloud Storage
- Firestore activity feed
- Custom metrics (trades/day, P&L, uptime)

## Security

### Authentication
- Firebase Auth required for all dashboard access
- Service account for Cloud Functions
- Bot containers use Firebase Admin SDK

### Authorization
- Firestore rules: user can only access their own bots
- Storage rules: user can only access their own artifacts
- Functions validate user ownership before operations

### Secrets
- Alpaca keys in Secret Manager (production)
- Environment variables (local dev)
- Never exposed to client
- Paper-only validation before use

## Future Enhancements

- [ ] Multi-user support (already architected)
- [ ] Bot marketplace (share strategies)
- [ ] Real-time equity curve updates
- [ ] Advanced backtesting (walk-forward, parameter optimization)
- [ ] Alert system (Slack, Discord, SMS)
- [ ] Live streaming logs in dashboard
- [ ] Bot cloning/versioning
- [ ] A/B testing (run multiple bots with same strategy, different params)

## Questions & Answers

**Q: Can multiple users use this system?**
A: Yes, Firestore rules already enforce user isolation. Each user sees only their own bots.

**Q: How do I add a new strategy?**
A: Create a new file in `bots/strategies/` inheriting from `StrategyInterface`. Register it in the dashboard's strategy dropdown.

**Q: Can I run live trading (real money)?**
A: No. The system is architecturally paper-only. Removing this guarantee requires forking and extensive changes.

**Q: How do I add Alpaca credentials?**
A: Set `APCA_PAPER_API_KEY_ID` and `APCA_PAPER_API_SECRET_KEY` in `.env.local` (dev) or Secret Manager (prod). Only paper keys accepted.

**Q: What happens to positions when I swap out?**
A: Positions remain open in your Alpaca paper account. The dashboard still shows them. You can manually close them or let them ride.

**Q: Can I backtest without Alpaca credentials?**
A: Yes. The backtest runner falls back to local/sample data if credentials are missing. Results are clearly labeled "SAMPLE DATA - NOT REAL BACKTEST".
