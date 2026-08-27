# Alpaca Paper Trading Bot Fleet - Operations Dashboard

A Firebase-powered fleet management system for independent containerized trading bots. Create, backtest, and manage multiple paper-trading bots with different strategies, signals, and risk profiles.

⚠️ **PAPER TRADING ONLY** - This system is architecturally designed for simulated trading only. Not investment advice.

## 🚀 What Changed: Single Bot → Fleet

This application has been pivoted from managing a single bot to a **fleet management system**:

- **Before**: One dashboard controls one bot
- **After**: One dashboard manages N independent bots, each with its own strategy, config, and lifecycle

### Key Features

- **Multi-Bot Fleet**: Create and manage unlimited independent bots
- **Bot Lifecycle**: Draft → Backtest → Paper (swapped in) → Stopped
- **Backtest Engine**: Test strategies on historical data before going live
- **Firebase Control Plane**: Firestore (registry), Cloud Functions (orchestration), Cloud Storage (artifacts)
- **Docker Compose**: Local development with dashboard + bot containers + emulators
- **Paper-Only Enforcement**: Multiple validation layers prevent live trading
- **Example Bots Included**: SMA Crossover + Stub bot to demonstrate the architecture

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    FIREBASE CONTROL PLANE                        │
│  Firestore (registry) + Functions (orchestration) + Storage     │
│  (artifacts)                                                     │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                   DASHBOARD (Next.js)                            │
│  Fleet Overview • Bot Config • Backtest Viewer • Swap Controls  │
└─────────────────────────────────────────────────────────────────┘
                               ↕
┌─────────────────────────────────────────────────────────────────┐
│                    BOT CONTAINERS (Python)                       │
│  Bot 1 (SMA) • Bot 2 (Stub) • Bot N (User-Created)             │
│  Each bot: isolated folder, Docker image, config, artifacts     │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### Fleet Management
- **Bot Registry**: Create, configure, and organize multiple bots
- **Lifecycle Management**: Draft → Backtest → Paper → Stopped
- **Status Dashboard**: Real-time status for all bots in your fleet
- **Swap In/Out**: Promote bots to paper-live or demote them with one click

### Backtesting
- **Historical Data**: Uses Alpaca historical API (or sample data fallback)
- **Backtest Reports**: Equity curves, trade logs, performance metrics
- **Cloud Storage**: Backtest artifacts stored in Firebase Storage
- **Comparison**: View multiple backtest runs side-by-side

### Trading & Monitoring
- **Paper Execution**: Bots trade using Alpaca PAPER API only
- **Real-time Positions**: Monitor open positions per bot or aggregated
- **Order Tracking**: View and manage orders across all bots
- **Activity Feed**: Bot-specific and global activity logs

### Strategy Framework
- **Pluggable Strategies**: Python base class for custom strategies
- **Signals & Triggers**: First-class support for indicators, webhooks, schedules
- **Risk Limits**: Per-bot max notional, position size, asset class controls
- **Example Strategies**: SMA Crossover (working) and Stub (template)

### Security & Safety
- **Paper-Only Enforcement**: Cloud Functions and bot containers refuse live endpoints
- **Firebase Auth**: Email/password and Google sign-in
- **Firestore Rules**: User-scoped data access (only see your own bots)
- **Storage Rules**: User-scoped artifact access
- **Prominent UI Warnings**: PAPER indicators on every screen

## Tech Stack

- **Next.js 16** with TypeScript and App Router
- **Firebase**: Auth, Firestore, Hosting
- **Tailwind CSS**: Dark ops-console theme
- **Lucide React**: Icons

## Prerequisites

- Node.js 18+ and npm
- Firebase account (for production) or Firebase Emulators (for local development)

## Quick Start (Docker Compose + Firebase Emulators)

The recommended way to run the full stack locally:

### 1. Prerequisites

- Docker & Docker Compose
- Node.js 20+
- (Optional) Alpaca Paper API keys for real backtests

### 2. Clone and Configure

```bash
# Clone the repo
git clone <repo-url>
cd <repo-dir>

# Copy environment template
cp .env.example .env.local

# Edit .env.local and set your Alpaca PAPER keys (optional)
# If not set, backtests will use sample data
```

### 3. Install Dependencies

```bash
# Dashboard dependencies
npm install

# Cloud Functions dependencies
cd functions && npm install && cd ..

# Bot dependencies
cd bots/runtime && pip install -r requirements.txt && cd ../..
```

### 4. Start Everything with Docker Compose

```bash
docker compose up
```

This starts:
- **Dashboard**: http://localhost:43123
- **Firebase Emulators**: http://localhost:4100 (UI)
  - Auth: localhost:9199
  - Firestore: localhost:8180
  - Functions: localhost:5001
  - Storage: localhost:9199
- **Bot Containers**: example-sma, example-stub, orb-spy, movers-day, hackathon-iron-condor

### 5. Create Your First Bot

1. Open http://localhost:43123
2. Sign up (any email/password works in emulator)
3. Go to **Fleet** → **Create Bot**
4. Fill in:
   - Name: "My SMA Bot"
   - Strategy: SMA Crossover
   - Symbol: SPY
   - Fast Period: 10, Slow Period: 30
5. Click **Create Bot**

### 6. Run a Backtest

1. Open your bot's detail page
2. Click **Run Backtest** (TODO: wire up Cloud Function)
3. Wait for backtest to complete (~1 min)
4. View results: return %, Sharpe ratio, equity curve, trades

### 7. Swap In to Paper Trading

1. Review backtest results
2. Click **Swap In to Paper**
3. Bot status changes to PAPER
4. Bot container starts paper trading
5. View positions/orders in dashboard

### 8. Swap Out

1. Click **Swap Out**
2. Bot stops trading
3. Positions remain open (visible in dashboard)

## Alternative: Local Dev Without Docker

If you prefer not to use Docker:

```bash
# Terminal 1: Firebase emulators
npm run emulators

# Terminal 2: Dashboard
npm run dev

# Terminal 3: Cloud Functions (optional, for local testing)
cd functions && npm run serve

# Terminal 4+: Bot containers (run manually)
cd bots
export BOT_ID=example-sma
export FIREBASE_EMULATOR=true
export APCA_API_BASE_URL=https://paper-api.alpaca.markets
python bots/example-sma/main.py
```

## Firebase Project Setup (Production)

To deploy to a real Firebase project:

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project: `alpaca-trading-bot`
3. Enable Authentication:
   - Go to Authentication → Sign-in method
   - Enable Email/Password
   - Enable Google (optional)
4. Create Firestore Database:
   - Go to Firestore Database → Create database
   - Start in **production mode** (we'll deploy rules)
   - Choose a region

### 2. Get Firebase Config

1. Go to Project Settings → Your apps
2. Add a web app
3. Copy the Firebase configuration object

### 3. Configure Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id

# Set to false for production
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=false
```

### 4. Install Firebase CLI

```bash
npm install -g firebase-tools
firebase login
```

### 5. Initialize Firebase Project

```bash
firebase use --add
# Select your project and give it an alias (e.g., "production")
```

### 6. Deploy Firestore Rules & Indexes

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 7. Deploy to Firebase Hosting

Build and deploy:

```bash
npm run build
firebase init hosting
# Choose your project
# Set public directory to: out
# Configure as single-page app: Yes
# Overwrite index.html: No

firebase deploy --only hosting
```

Your app will be live at: `https://your-project.firebaseapp.com`

## Project Structure

```
/
├── app/                          # Next.js App Router
│   ├── dashboard/
│   │   ├── fleet/                # 🆕 Fleet management
│   │   │   ├── page.tsx         # Fleet overview (list all bots)
│   │   │   ├── create/page.tsx  # Create new bot
│   │   │   └── [botId]/page.tsx # Bot detail page
│   │   ├── page.tsx             # Overview (now fleet-aware)
│   │   ├── positions/           # Positions (bot-filterable)
│   │   ├── orders/              # Orders (bot-filterable)
│   │   ├── trade-desk/          # Trade desk (bot-scoped)
│   │   ├── settings/            # Bot settings (per-bot)
│   │   └── activity/            # Activity log
│   └── login/                   # Authentication
│
├── lib/
│   ├── firebase.ts              # Firebase init (+ Functions SDK)
│   ├── auth-context.tsx         # Auth provider
│   ├── types.ts                 # 🆕 Bot, BacktestRun, BotActivity types
│   └── utils.ts                 # Utilities
│
├── functions/                    # 🆕 Cloud Functions
│   ├── src/
│   │   └── index.ts             # triggerBacktest, swapInBot, swapOutBot, etc.
│   ├── package.json
│   └── tsconfig.json
│
├── bots/                         # 🆕 Bot Runtime & Strategies
│   ├── runtime/
│   │   ├── bot_base.py          # Base bot class
│   │   ├── firebase_client.py   # Firestore/Storage client
│   │   ├── alpaca_client.py     # Alpaca client (paper-only)
│   │   ├── backtest_runner.py   # Backtest engine
│   │   ├── strategy_interface.py # Strategy base class
│   │   └── requirements.txt
│   │
│   ├── strategies/
│   │   ├── sma_crossover.py     # Example: SMA strategy
│   │   └── stub_strategy.py     # Stub/template
│   │
│   └── bots/
│       ├── example-sma/
│       │   ├── config.json
│       │   ├── Dockerfile
│       │   └── main.py
│       ├── example-stub/
│       │   ├── config.json
│       │   ├── Dockerfile
│       │   └── main.py
│       ├── orb-spy/                 # Opening Range Breakout (SPY, SIP websocket)
│       │   ├── config.json
│       │   ├── Dockerfile
│       │   └── README.md
│       ├── movers-day/              # Gap-and-Go Scanner (liquid movers, intraday-only)
│       │   ├── config.json
│       │   ├── Dockerfile
│       │   └── README.md
│       └── hackathon-iron-condor/  # Options competition bot (Iron Condor AI)
│           ├── config.json
│           ├── Dockerfile
│           └── main.py
│
├── docs/
│   ├── FLEET_ARCHITECTURE.md    # 🆕 Detailed architecture doc
│   ├── PROJECT_SUMMARY.md       # Original summary
│   └── GITHUB_SETUP.md
│
├── docker-compose.yml            # 🆕 Full stack compose file
├── Dockerfile.dashboard          # 🆕 Dashboard container
├── firebase.json                 # 🆕 Now includes Functions & Storage
├── firestore.rules               # 🆕 Updated with bot collections
├── storage.rules                 # 🆕 Cloud Storage rules
├── firestore.indexes.json        # 🆕 Indexes for bots, backtests
└── .env.example                  # 🆕 Template with Alpaca keys
```

## Firestore Schema

### New Collections (Fleet)

#### `bots/{botId}` - Bot Registry
```typescript
{
  botId: string;
  userId: string;
  name: string;
  description?: string;
  status: 'draft' | 'backtest' | 'paper' | 'stopped';
  strategy: {
    type: string;  // e.g., 'sma-crossover'
    params: Record<string, any>;
  };
  signals: { type: string; config: any }[];
  triggers: { type: string; config: any }[];
  riskLimits: {
    maxNotionalPerOrder: number;
    maxPositionPercent: number;
    allowedAssetClasses: ('stock' | 'option')[];
  };
  paperLive: boolean;
  containerId?: string;
  lastBacktestId?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `backtest-runs/{backtestId}` - Backtest Results
```typescript
{
  backtestId: string;
  botId: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  initialCapital: number;
  status: 'queued' | 'running' | 'completed' | 'failed';
  summary?: {
    totalReturn: number;
    totalReturnPercent: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
    totalTrades: number;
    // ... more metrics
  };
  reportUrl?: string;       // Cloud Storage URL
  equityCurveUrl?: string;
  tradesUrl?: string;
  createdAt: Date;
}
```

#### `bot-activity/{eventId}` - Bot Activity Log
```typescript
{
  eventId: string;
  botId: string;
  userId: string;
  eventType: 'bot_created' | 'backtest_started' | 'swapped_in' | ...;
  message: string;
  metadata?: Record<string, any>;
  createdAt: Date;
}
```

### Legacy Collections (Now Bot-Scoped)

#### `bot-settings/{botId}` (was `{userId}`)
Bot-specific settings - now per bot instead of per user

#### `accounts/{userId}`
Account snapshot (written by external bot):
```typescript
{
  userId: string;
  accountNumber: string;
  equity: number;
  cash: number;
  buyingPower: number;
  optionsLevel: number;
  updatedAt: Date;
}
```

#### `positions/{positionId}`
Open positions:
```typescript
{
  userId: string;
  symbol: string;
  assetClass: 'stock' | 'option';
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPL: number;
  unrealizedPLPercent: number;
  side: 'long' | 'short';
  updatedAt: Date;
}
```

#### `orders/{orderId}`
Order history:
```typescript
{
  userId: string;
  symbol: string;
  assetClass: 'stock' | 'option';
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  qty?: number;
  notional?: number;
  limitPrice?: number;
  stopPrice?: number;
  status: string;
  filledQty: number;
  filledAvgPrice?: number;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `trade-intents/{intentId}`
Trade intents for approval:
```typescript
{
  userId: string;
  symbol: string;
  assetClass: 'stock' | 'option';
  side: 'buy' | 'sell';
  orderType: 'market' | 'limit' | 'stop' | 'stop_limit';
  timeInForce: 'day' | 'gtc' | 'ioc' | 'fok';
  qty?: number;
  notional?: number;
  limitPrice?: number;
  stopPrice?: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'submitted' | 'filled' | 'canceled' | 'error';
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

#### `activity/{eventId}`
Activity log:
```typescript
{
  userId: string;
  eventType: string;
  message: string;
  metadata?: object;
  createdAt: Date;
}
```

## Cloud Functions (Orchestration)

The Firebase Cloud Functions handle orchestration that the browser must not do:

### `triggerBacktest` (HTTPS Callable)
- Input: `{ botId, startDate, endDate, initialCapital }`
- Validates bot exists and user owns it
- Creates `backtest-runs` document
- Spawns backtest container (TODO: Cloud Run integration)
- Returns `{ backtestId, status: 'queued' }`

### `swapInBot` (HTTPS Callable)
- Input: `{ botId }`
- Validates bot has successful backtest
- Enforces paper-only (checks APCA_API_BASE_URL)
- Updates bot status to `paper`, `paperLive: true`
- Starts bot container (currently reads flag change)
- Logs swap-in event

### `swapOutBot` (HTTPS Callable)
- Input: `{ botId }`
- Updates bot status to `stopped`, `paperLive: false`
- Stops bot container gracefully
- Positions remain open (visible in dashboard)
- Logs swap-out event

### `webhookTrigger` (HTTPS Endpoint)
- Input: `{ botId, signal, signature }`
- Validates webhook signature (TODO)
- Only processes if bot is paper-live
- Logs webhook event
- Triggers bot signal processing

### `scheduledCheck` (Cloud Scheduler, every 1 min)
- Queries all paper-live bots
- Checks scheduled triggers
- Monitors health (heartbeat)
- Auto-stops unhealthy bots

### `completeBacktest` (HTTPS Callable)
- Input: `{ backtestId, status, summary, error }`
- Updates backtest status to completed/failed
- Updates bot status to 'backtest' if successful
- Logs completion event

## How Bots Work

### Bot Lifecycle

1. **Draft**: Bot exists in Firestore, not running
2. **Backtest**: Backtest completed successfully, ready to promote
3. **Paper**: Swapped in, container running, trading paper
4. **Stopped**: Swapped out, container stopped, positions remain

### Bot Runtime

Each bot container:
- Reads config from Firestore on startup
- Enforces paper-only (validates `APCA_API_BASE_URL`)
- Watches `paperLive` flag for swap-in/swap-out commands
- Generates signals using its strategy
- Places orders via Alpaca PAPER API
- Writes positions/orders/activity to Firestore
- Sends heartbeat for health monitoring

### Adding a New Bot

1. **Create Strategy** (Python):
   - Inherit from `StrategyInterface`
   - Implement `generate_signals()` and `get_position_size()`
   - Place in `bots/strategies/<strategy-name>.py`

2. **Create Bot Folder**:
   - `bots/bots/<bot-name>/`
   - `config.json`: Bot configuration
   - `main.py`: Entry point that imports strategy
   - `Dockerfile`: Extends base bot image

3. **Register in Dashboard**:
   - Add strategy type to fleet/create page dropdown
   - Map strategy type to Python class in bot config

4. **Add to Docker Compose** (optional):
   - Add service for new bot
   - Set `BOT_ID` env var

5. **Deploy**:
   - Build image: `docker build -t bot-<name> -f bots/bots/<name>/Dockerfile bots/`
   - Run: `docker run -e BOT_ID=<name> bot-<name>`

## Paper-Only Guarantee

This system is **architecturally designed for paper trading only**. Multiple enforcement layers:

### 1. Cloud Functions
- `validatePaperOnly()` checks `APCA_API_BASE_URL` contains "paper"
- Refuses to inject live API keys
- Checks account type before swap-in

### 2. Bot Containers
- Startup validation: `validate_paper_only()` in `alpaca_client.py`
- Runtime validation: reject live endpoints
- Fail fast with clear error if paper requirement violated

### 3. Dashboard
- Prominent "PAPER" badges on every screen
- Warning banners on critical pages
- No UI path to configure live keys

### 4. Configuration
- Docker Compose hardcodes paper URL
- `.env.example` shows paper endpoints only
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
  message: '✅ Paper-only enforcement validated'
}
```

## Security

- **Authentication**: Firebase Auth (email/password, Google)
- **Authorization**: Firestore rules enforce user isolation
- **Bot Ownership**: Users can only access their own bots
- **Storage Access**: User-scoped artifact access
- **Secrets**: Alpaca keys in Secret Manager (prod) or env vars (dev)
- **Client Safety**: API keys never exposed to browser

## Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase API key | `AIzaSyA...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Auth domain | `myproject.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Project ID | `myproject-123` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Storage bucket | `myproject.appspot.com` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Sender ID | `123456789` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | App ID | `1:123:web:abc` |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATOR` | Use emulators | `true` or `false` |

## Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server (port 43123)
npm run emulators        # Start Firebase emulators

# Build
npm run build           # Build production bundle
npm run start           # Start production server

# Firebase
npm run seed <userId>   # Seed demo data for a user
firebase deploy         # Deploy to Firebase

# Linting
npm run lint            # Run ESLint
```

## Troubleshooting

### "Cannot connect to Firestore"

- Make sure Firebase emulators are running (`npm run emulators`)
- Check that `.env.local` has `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`
- Verify emulator ports in `firebase.json` match `lib/firebase.ts`

### "Auth emulator not connecting"

- Clear browser cache and reload
- Check browser console for CORS errors
- Restart emulators: `Ctrl+C` and `npm run emulators`

### "No data showing after login"

- Run the seed script: `npm run seed <your-user-id>`
- Find your user ID in browser console or Emulator UI (http://localhost:4000)

### "Google sign-in not working"

- Google sign-in only works with real Firebase project (not emulators)
- Configure Google provider in Firebase Console → Authentication

## License

Private use only. Not investment advice.

## Known Limitations & TODOs

### Current Implementation
- ✅ Fleet management UI (list, create, detail)
- ✅ Cloud Functions (backtest, swap in/out, webhooks)
- ✅ Bot runtime with paper-only enforcement
- ✅ Backtest engine with Alpaca historical data
- ✅ Example strategies (SMA Crossover, Stub)
- ✅ Docker Compose setup
- ✅ Firebase emulators integration

### TODOs / Future Work
- [ ] Wire Cloud Functions to dashboard UI (currently stub alerts)
- [ ] Complete backtest runner Cloud Run integration
- [ ] Add real-time log streaming to dashboard
- [ ] Implement webhook signature validation
- [ ] Add bot cloning/versioning
- [ ] Parameter optimization for backtests
- [ ] Alert system (Slack, Discord, SMS)
- [ ] Bot marketplace (share strategies)
- [ ] A/B testing framework

### Deployment Notes
- Local dev works via Docker Compose + emulators
- Production deployment requires:
  - Firebase project with Functions + Storage enabled
  - Cloud Run for backtest runners
  - Secret Manager for Alpaca keys
  - Container registry for bot images

## FAQ

**Q: Can multiple bots be paper-live simultaneously?**  
A: Yes. Each bot is independent with its own positions, orders, and activity.

**Q: What happens to positions when I swap out a bot?**  
A: Positions remain open in your Alpaca paper account. The dashboard still shows them. You can manually close them or let them ride.

**Q: Can I backtest without Alpaca credentials?**  
A: Yes. The backtest runner falls back to generated sample data. Results are clearly labeled "SAMPLE DATA - NOT REAL BACKTEST".

**Q: How do I add Alpaca credentials?**  
A: Set `APCA_PAPER_API_KEY_ID` and `APCA_PAPER_API_SECRET_KEY` in `.env.local`. Only paper keys are accepted.

**Q: Can I run live trading (real money)?**  
A: No. The system is architecturally paper-only. Removing this guarantee requires extensive changes across Cloud Functions, bot runtime, and UI.

**Q: How do I add a new strategy?**  
A: Create a new file in `bots/strategies/` inheriting from `StrategyInterface`. Implement `generate_signals()` and `get_position_size()`. Register it in the dashboard's strategy dropdown.

**Q: Can multiple users use this system?**  
A: Yes. Firestore rules already enforce user isolation. Each user sees only their own bots.

## Included Bots

### 1. SMA SPY (Opening Range Breakout)
- **Strategy**: Opening Range Breakout on SPY with SMA filter
- **Universe**: SPY only
- **Data Feed**: Alpaca SIP websocket (1-minute bars)
- **Entry**: Break of opening range (09:30-09:45 ET) when SPY SMA10 > SMA30
- **Exit**: Flatten before 15:55 ET
- **Paper-only**: Strict validation, refuses live API
- **Location**: `bots/bots/orb-spy/`

### 2. Movers Day-Trade Book (Gap-and-Go Scanner)
- **Strategy**: Gap-and-go continuation on liquid market movers
- **Universe**: Alpaca SIP market movers (gainers + most-active by volume)
- **Filters**: Price >= $5, no warrants/OTC, prefer ADV >= 5M, max 20 watchlist
- **Max Positions**: 3 simultaneous
- **Entry**: Break of premarket high when SPY SMA10 > SMA30 (bullish regime)
- **Stop**: Signal-bar low or premarket low
- **Exit**: **Hard flatten ALL by 15:55 ET** (no overnight holds)
- **Size**: $10k or 10% equity per position, whichever is smaller
- **Data Feed**: Alpaca SIP websocket + market movers API
- **Paper-only**: Multi-layered validation, day orders only (no GTC)
- **Backtest Note**: No synthetic 5-year all-stock backtest. First test is live 1Min SIP on filtered liquid universe.
- **Location**: `bots/bots/movers-day/`

### 3. Hackathon Iron Condor (Options AI)
- **Strategy**: Defined-risk Iron Condor for Alpaca AI Trading Agents Hackathon
- **Asset Class**: US options (level 2+)
- **Competition Account**: Dedicated $100k paper account
- **Risk Management**: Max notional, max contracts, no naked shorts, kill switch
- **Paper-only**: Refuses live API, competition account validation
- **Location**: `bots/bots/hackathon-iron-condor/`

### 4. Example SMA (Template)
- **Strategy**: Simple SMA crossover (example implementation)
- **Location**: `bots/bots/example-sma/`

### 5. Example Stub (Template)
- **Strategy**: Minimal stub for new bot development
- **Location**: `bots/bots/example-stub/`

## Disclaimer

This system is for **PAPER TRADING ONLY**. All trades are simulated using Alpaca's paper trading environment. This is not investment advice. Use at your own risk.

## Documentation

- **Architecture**: See `docs/FLEET_ARCHITECTURE.md` for detailed design
- **Original Summary**: See `docs/PROJECT_SUMMARY.md` for the single-bot version
- **GitHub Setup**: See `docs/GITHUB_SETUP.md` for repo configuration
