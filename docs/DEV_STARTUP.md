# Developer Quick Start Guide

Get the Alpaca Trading Bot Fleet running locally in under 5 minutes.

## Prerequisites

- **Node.js 20+** and npm
- **Docker** and Docker Compose
- **Git**
- (Optional) Alpaca Paper API keys for real data

## Quick Start (Fastest Path)

### 1. Clone and Install

```bash
# Clone the repository
git clone https://github.com/rezolve/trading-bot-dashboard.git
cd trading-bot-dashboard

# Install dashboard dependencies
npm install

# Install Cloud Functions dependencies
cd functions && npm install && cd ..
```

### 2. Configure Environment

```bash
# Copy environment template
cp .env.example .env.local

# Edit .env.local - set Firebase demo config for emulators
```

**Required for local dev** - Edit `.env.local` and add these Firebase demo values:

```bash
# Firebase Configuration (Demo values for emulator)
NEXT_PUBLIC_FIREBASE_API_KEY=demo-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=demo-test.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=demo-test
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=demo-test.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456

# Use Firebase Emulators
NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true

# Firebase Project ID (for emulators and bots)
FIREBASE_PROJECT_ID=demo-test
```

**Note**: Alpaca keys are optional. The system works locally **without** them. Backtests will use sample data, clearly labeled in the UI.

### 3. Start Everything

```bash
# Start full stack (dashboard + emulators + bots)
docker compose up
```

**What starts:**
- Dashboard: http://localhost:43123
- Firebase Emulator UI: http://localhost:4100
- Firebase Auth: localhost:9199
- Firestore: localhost:8180
- Cloud Functions: localhost:5001
- Cloud Storage: localhost:9199
- Bot containers: example-sma, example-stub, hackathon-iron-condor

### 4. First Login

1. Open http://localhost:43123
2. Click **"Sign up"**
3. Use any email/password (e.g., `test@example.com` / `password123`)
4. You're in! The emulator accepts any credentials.

### 5. Create Your First Bot

1. Go to **Fleet** (top of sidebar)
2. Click **"Create Bot"**
3. Fill in:
   - Name: `My First Bot`
   - Strategy: `SMA Crossover (Stocks)`
   - Symbol: `SPY`
   - Fast Period: `10`
   - Slow Period: `30`
   - Max Notional: `10000`
   - Max Position: `20`
4. Click **"Create Bot"**

### 6. Run a Backtest

1. Click on your newly created bot
2. Click **"Run Backtest"**
3. Wait ~2 seconds
4. See results: return %, Sharpe ratio, trades

### 7. Swap In to Paper Trading

1. Review backtest results
2. Click **"Swap In to Paper"**
3. Bot status changes to **PAPER**
4. Bot is now "trading" (simulated in local dev)

### 8. Explore the Dashboard

- **Fleet**: List all bots, status overview
- **Overview**: Account summary, P&L
- **Positions**: Open positions (bot-filterable)
- **Orders**: Order history (bot-filterable)
- **Trade Desk**: Manual trade submission
- **Bot Settings**: Per-bot configuration
- **Activity Log**: All events

## Development Workflow

### Without Docker (Manual Start)

If you prefer not to use Docker:

```bash
# Terminal 1: Firebase Emulators
npm run emulators

# Terminal 2: Dashboard
npm run dev

# Terminal 3: Cloud Functions (optional)
cd functions && npm run serve

# Terminal 4+: Run bots manually (optional)
cd bots
export BOT_ID=example-sma
export FIREBASE_EMULATOR=true
export FIRESTORE_EMULATOR_HOST=localhost:8180
export APCA_API_BASE_URL=https://paper-api.alpaca.markets
python bots/example-sma/main.py
```

### Hot Reload

- **Dashboard**: Changes auto-reload (Next.js Fast Refresh)
- **Cloud Functions**: Restart `npm run serve` in functions/
- **Bots**: Restart bot containers or Python processes

### Stopping

```bash
# Stop all Docker services
docker compose down

# Or just Ctrl+C in the terminal
```

## Accessing Services

| Service | URL | Purpose |
|---------|-----|---------|
| Dashboard | http://localhost:43123 | Main UI |
| Firebase UI | http://localhost:4100 | View Firestore/Auth/Functions |
| Auth Emulator | http://localhost:9199 | Authentication |
| Firestore | localhost:8180 | Database (use SDK, not browser) |
| Functions | http://localhost:5001 | Cloud Functions endpoint |
| Storage | localhost:9199 | Cloud Storage (use SDK) |

## Project Structure

```
/workspace
├── app/                    # Next.js dashboard
│   ├── dashboard/
│   │   ├── fleet/         # Fleet management UI
│   │   ├── positions/     # Positions screen
│   │   ├── orders/        # Orders screen
│   │   └── ...
│   └── login/             # Auth screen
│
├── functions/              # Cloud Functions (orchestration)
│   └── src/
│       └── index.ts       # triggerBacktest, swapInBot, swapOutBot
│
├── bots/                   # Bot runtime & strategies
│   ├── runtime/           # Bot framework
│   │   ├── bot_base.py
│   │   ├── firebase_client.py
│   │   ├── alpaca_client.py
│   │   └── backtest_runner.py
│   ├── strategies/        # Strategy implementations
│   │   ├── sma_crossover.py
│   │   ├── iron_condor_ai.py  # 🏆 Hackathon
│   │   └── stub_strategy.py
│   └── bots/              # Bot instances
│       ├── example-sma/
│       ├── example-stub/
│       └── hackathon-iron-condor/  # 🏆 Competition
│
├── lib/                    # Core library
│   ├── firebase.ts        # Firebase SDK + Functions
│   ├── types.ts           # TypeScript types
│   └── ...
│
└── docs/                   # Documentation
    ├── FLEET_ARCHITECTURE.md
    ├── HACKATHON.md       # 🏆 Competition submission
    └── DEV_STARTUP.md     # This file
```

## Common Tasks

### Create a New Bot Strategy

1. **Create strategy file**: `bots/strategies/my_strategy.py`
2. **Inherit from StrategyInterface**: Implement `generate_signals()` and `get_position_size()`
3. **Register in UI**: Add to `app/dashboard/fleet/create/page.tsx` dropdown
4. **Test**: Create bot via UI, run backtest

### Add New Bot to Fleet

1. **Create bot folder**: `bots/bots/my-bot/`
2. **Add files**: `main.py`, `config.json`, `Dockerfile`
3. **Update Docker Compose**: Add service in `docker-compose.yml`
4. **Test**: `docker compose up`

### Deploy Cloud Functions

```bash
# Local testing
cd functions && npm run serve

# Deploy to Firebase (requires Firebase project)
firebase deploy --only functions
```

### View Logs

```bash
# Dashboard logs
docker compose logs dashboard -f

# Bot logs
docker compose logs bot-example-sma -f

# Emulator logs
docker compose logs firebase-emulators -f

# All logs
docker compose logs -f
```

### Reset Everything

```bash
# Stop and remove all containers
docker compose down -v

# Clear emulator data
rm -rf .firebase/

# Restart fresh
docker compose up
```

## Environment Variables

### Required (None for local dev!)

Local development works **without** any credentials. The system uses Firebase emulators.

### Optional - For Real Data

Add to `.env.local`:

```bash
# Alpaca Paper Trading (for real backtests)
APCA_PAPER_API_KEY_ID=your-paper-api-key
APCA_PAPER_API_SECRET_KEY=your-paper-secret-key

# Alpaca Competition Account (for hackathon)
APCA_COMPETITION_API_KEY_ID=your-competition-key
APCA_COMPETITION_API_SECRET_KEY=your-competition-secret

# Firebase (only needed for production deployment)
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
# ... etc
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 43123 (dashboard)
lsof -i :43123

# Kill process
kill -9 <PID>

# Or change port in package.json: "dev": "next dev -p <NEW_PORT>"
```

### Firebase Emulators Won't Start

```bash
# Check if ports 4100, 8180, 9199, 5001 are free
lsof -i :4100

# Or kill all Firebase processes
pkill -f firebase

# Restart
docker compose up
```

### Docker Containers Failing

```bash
# Check logs
docker compose logs <service-name>

# Rebuild containers
docker compose build --no-cache

# Restart specific service
docker compose restart bot-example-sma
```

### "Cannot connect to Firestore"

```bash
# Ensure emulators are running
docker compose ps

# Check NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true in .env.local

# Restart dashboard
docker compose restart dashboard
```

### Changes Not Appearing

```bash
# Dashboard: Should auto-reload, but try:
docker compose restart dashboard

# Functions: Restart emulator
docker compose restart firebase-emulators

# Bots: Rebuild
docker compose build bot-example-sma
docker compose up -d bot-example-sma
```

## Testing

### Manual Testing Checklist

- [ ] Sign up / Sign in works
- [ ] Fleet page loads
- [ ] Create bot saves to Firestore
- [ ] Bot appears in fleet list
- [ ] Bot detail page loads
- [ ] Run backtest shows results
- [ ] Swap in updates status to PAPER
- [ ] Swap out updates status to STOPPED
- [ ] Real-time updates work (no reload needed)
- [ ] Activity log shows events

### Automated Testing (Future)

```bash
# Run tests (when implemented)
npm test

# Run e2e tests (when implemented)
npm run test:e2e
```

## Production Deployment

### Firebase Setup

1. Create Firebase project: https://console.firebase.google.com
2. Enable services:
   - Authentication (Email/Password, Google)
   - Firestore Database (production mode)
   - Cloud Functions
   - Cloud Storage
3. Deploy security rules:
   ```bash
   firebase deploy --only firestore:rules
   firebase deploy --only storage:rules
   firebase deploy --only firestore:indexes
   ```
4. Deploy functions:
   ```bash
   cd functions && npm run build && cd ..
   firebase deploy --only functions
   ```
5. Build and deploy dashboard:
   ```bash
   npm run build
   firebase deploy --only hosting
   ```

### Bot Deployment

1. Build bot images:
   ```bash
   docker build -t gcr.io/PROJECT/bot-sma -f bots/bots/example-sma/Dockerfile bots/
   docker push gcr.io/PROJECT/bot-sma
   ```
2. Deploy to Cloud Run or Kubernetes
3. Set environment variables (Firebase project ID, Alpaca keys)

## Getting Help

### Documentation

- **Fleet Architecture**: `docs/FLEET_ARCHITECTURE.md`
- **Hackathon Submission**: `docs/HACKATHON.md`
- **Implementation Summary**: `docs/IMPLEMENTATION_SUMMARY.md`
- **Integration Guide**: `docs/INTEGRATION_COMPLETE.md`

### Common Issues

1. **No data in dashboard**: Run the seed script (future feature) or create a bot
2. **Backtest shows sample data**: Normal without Alpaca keys, or set keys in `.env.local`
3. **Bot not trading**: Check if swapped in (status = PAPER)
4. **Functions not working**: Ensure emulator running on port 5001

### Debug Mode

```bash
# Enable verbose logging
export DEBUG=*

# Dashboard debug
docker compose logs dashboard --tail=100 -f

# Check Firebase emulator status
curl http://localhost:4100
```

## Next Steps

1. **Explore the dashboard** - Create bots, run backtests
2. **Review strategies** - Check `bots/strategies/` for examples
3. **Read architecture docs** - Understand the system design
4. **Create custom strategy** - Build your own trading logic
5. **Deploy to production** - Set up Firebase project

## Resources

- **Repository**: https://github.com/rezolve/trading-bot-dashboard
- **Alpaca Docs**: https://alpaca.markets/docs/
- **Firebase Docs**: https://firebase.google.com/docs
- **Docker Docs**: https://docs.docker.com/

---

**Need help?** Check the docs/ folder for comprehensive guides, or review the code comments in each file.

**Paper Trading Only**: This system is designed exclusively for paper trading. All enforcement layers prevent live trading.
