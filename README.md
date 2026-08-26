# Alpaca Paper Trading Bot - Operations Dashboard

A Firebase web application for managing an Alpaca paper-trading bot. This dashboard provides real-time monitoring and control of a paper trading bot for US stocks and options.

⚠️ **PAPER TRADING ONLY** - This is for simulated trading. Not investment advice.

## Features

- **Firebase Authentication**: Email/password and Google sign-in
- **Real-time Dashboard**: Monitor account equity, cash, buying power, and today's P&L
- **Position Management**: View open positions with live unrealized P&L
- **Order Tracking**: Monitor open and recent orders with cancel functionality
- **Trade Desk**: Create and approve trade intents with full order parameter control
- **Bot Settings**: Configure kill switch, confirmation mode, and risk limits
- **Activity Log**: Chronological feed of bot and trading events
- **Security**: Firestore rules ensure data is locked to signed-in operator only

## Tech Stack

- **Next.js 16** with TypeScript and App Router
- **Firebase**: Auth, Firestore, Hosting
- **Tailwind CSS**: Dark ops-console theme
- **Lucide React**: Icons

## Prerequisites

- Node.js 18+ and npm
- Firebase account (for production) or Firebase Emulators (for local development)

## Quick Start (Firebase Emulators)

The fastest way to get started is using Firebase Emulators for local development:

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Firebase Emulators

In one terminal:

```bash
npm run emulators
```

This starts:
- Auth Emulator on http://localhost:9099
- Firestore Emulator on http://localhost:8080
- Emulator UI on http://localhost:4000

### 3. Start Development Server

In another terminal:

```bash
npm run dev
```

The app runs at **http://localhost:43123**

### 4. Create a Test Account

1. Open http://localhost:43123
2. Click "Sign up" and create an account (any email/password works in emulator)
3. After signing in, note your user ID from the browser console or Firebase Emulator UI

### 5. Seed Demo Data

```bash
npm run seed <your-user-id>
```

Example:
```bash
npm run seed ZqxYr8pXYzAbCd123456
```

This creates:
- Bot settings (confirmation mode ON, kill switch OFF)
- Account snapshot ($103,245.67 equity)
- 3 open positions (AAPL, TSLA, SPY)
- 3 orders (filled, open, canceled)
- 3 trade intents (pending, approved, rejected)
- Activity log events

### 6. Explore the Dashboard

Refresh the app and explore all screens:
- **Overview**: Account summary, P&L, bot status
- **Positions**: Open positions with unrealized P&L
- **Orders**: Order history and management
- **Trade Desk**: Create and approve paper trade intents
- **Bot Settings**: Configure risk limits and controls
- **Activity Log**: Event timeline

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
├── app/                      # Next.js App Router
│   ├── dashboard/           # Protected dashboard routes
│   │   ├── page.tsx        # Overview screen
│   │   ├── positions/      # Positions screen
│   │   ├── orders/         # Orders screen
│   │   ├── trade-desk/     # Trade desk & approval queue
│   │   ├── settings/       # Bot settings
│   │   └── activity/       # Activity log
│   ├── login/              # Authentication screen
│   ├── layout.tsx          # Root layout with AuthProvider
│   └── globals.css         # Global styles
├── lib/                     # Core library code
│   ├── firebase.ts         # Firebase initialization
│   ├── auth-context.tsx    # Auth context provider
│   ├── types.ts            # TypeScript types
│   └── utils.ts            # Utility functions
├── scripts/
│   └── seed-firestore.js   # Demo data seeding script
├── firebase.json            # Firebase config
├── firestore.rules         # Firestore security rules
├── firestore.indexes.json  # Firestore indexes
└── .env.local              # Environment variables
```

## Firestore Schema

### Collections

#### `bot-settings/{userId}`
Bot configuration for each user:
```typescript
{
  userId: string;
  killSwitch: boolean;              // Halt all new orders
  confirmationMode: boolean;        // Require manual approval
  maxNotionalPerOrder: number;      // Max $ per order
  maxPositionPercent: number;       // Max % of portfolio
  allowedAssetClasses: string[];    // ['stock', 'option']
  updatedAt: Date;
}
```

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

## Bot Integration

This dashboard is designed to work with an external trading bot that:

1. **Reads** from Firestore:
   - `bot-settings/{userId}` - Check kill switch and confirmation mode
   - `trade-intents` - Fetch approved intents for execution

2. **Writes** to Firestore:
   - `accounts/{userId}` - Update account snapshot periodically
   - `positions` - Update open positions with current prices
   - `orders` - Create/update orders as they're submitted/filled
   - `trade-intents` - Update status (submitted → filled)
   - `activity` - Log events

### Sample Bot Workflow

```javascript
// 1. Check if bot is allowed to operate
const settings = await getDoc(doc(db, 'bot-settings', userId));
if (settings.data().killSwitch) {
  console.log('Kill switch active - halting');
  return;
}

// 2. Fetch approved trade intents
const approvedIntents = await getDocs(
  query(
    collection(db, 'trade-intents'),
    where('userId', '==', userId),
    where('status', '==', 'approved')
  )
);

// 3. Submit to Alpaca PAPER API
for (const intent of approvedIntents.docs) {
  const order = await alpacaPaperClient.createOrder({
    symbol: intent.data().symbol,
    qty: intent.data().qty,
    side: intent.data().side,
    type: intent.data().orderType,
    time_in_force: intent.data().timeInForce,
  });
  
  // 4. Update Firestore
  await updateDoc(doc(db, 'trade-intents', intent.id), {
    status: 'submitted',
    alpacaOrderId: order.id,
    submittedAt: new Date(),
  });
  
  await addDoc(collection(db, 'activity'), {
    userId,
    eventType: 'trade_intent_submitted',
    message: `Order submitted: ${intent.data().side.toUpperCase()} ${intent.data().qty} ${intent.data().symbol}`,
    createdAt: new Date(),
  });
}

// 5. Update account snapshot periodically
const account = await alpacaPaperClient.getAccount();
await setDoc(doc(db, 'accounts', userId), {
  userId,
  accountNumber: account.account_number,
  equity: parseFloat(account.equity),
  cash: parseFloat(account.cash),
  buyingPower: parseFloat(account.buying_power),
  updatedAt: new Date(),
});
```

## Security

- **Authentication Required**: All routes protected with Firebase Auth
- **Firestore Rules**: Users can only read/write their own data
- **Paper Trading Only**: No live API keys stored in the app
- **Clear UI Indicators**: PAPER badge visible on every screen

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

## Disclaimer

This dashboard is for PAPER TRADING only. All trades are simulated using Alpaca's paper trading environment. This is not investment advice. Use at your own risk.
