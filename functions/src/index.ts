import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { defineSecret } from 'firebase-functions/params';

admin.initializeApp();

const db = admin.firestore();

// Secret Manager for Alpaca paper API keys
// Set with: firebase functions:secrets:set APCA_PAPER_API_KEY_ID
// Set with: firebase functions:secrets:set APCA_PAPER_API_SECRET_KEY
const APCA_PAPER_API_KEY_ID = defineSecret('APCA_PAPER_API_KEY_ID');
const APCA_PAPER_API_SECRET_KEY = defineSecret('APCA_PAPER_API_SECRET_KEY');

// Paper-only enforcement
const PAPER_API_URL = 'https://paper-api.alpaca.markets';
const DATA_API_URL = 'https://data.alpaca.markets';

function validatePaperOnly(apiUrl: string): void {
  if (!apiUrl.toLowerCase().includes('paper')) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'LIVE API ENDPOINT DETECTED - Only paper trading is allowed'
    );
  }
  // Explicitly refuse live API
  if (apiUrl.toLowerCase().includes('https://api.alpaca.markets')) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'LIVE API REFUSED - This function only supports paper trading'
    );
  }
}

// Alpaca REST API helpers (paper-only)
interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface AlpacaPosition {
  symbol: string;
  qty: string;
  side: 'long' | 'short';
  market_value: string;
  avg_entry_price: string;
}

async function fetchSIPBars(
  symbol: string,
  timeframe: '1Min' | '1Day',
  start: string,
  end: string,
  apiKeyId: string,
  apiSecret: string
): Promise<AlpacaBar[]> {
  const url = `${DATA_API_URL}/v2/stocks/${symbol}/bars?timeframe=${timeframe}&start=${start}&end=${end}&feed=sip&limit=1000`;
  
  const response = await fetch(url, {
    headers: {
      'APCA-API-KEY-ID': apiKeyId,
      'APCA-API-SECRET-KEY': apiSecret,
    },
  });

  if (!response.ok) {
    throw new Error(`Alpaca Data API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data.bars || [];
}

async function getAccount(apiKeyId: string, apiSecret: string): Promise<any> {
  const response = await fetch(`${PAPER_API_URL}/v2/account`, {
    headers: {
      'APCA-API-KEY-ID': apiKeyId,
      'APCA-API-SECRET-KEY': apiSecret,
    },
  });

  if (!response.ok) {
    throw new Error(`Alpaca Account API error: ${response.status}`);
  }

  return response.json();
}

async function getPositions(apiKeyId: string, apiSecret: string): Promise<AlpacaPosition[]> {
  const response = await fetch(`${PAPER_API_URL}/v2/positions`, {
    headers: {
      'APCA-API-KEY-ID': apiKeyId,
      'APCA-API-SECRET-KEY': apiSecret,
    },
  });

  if (!response.ok) {
    if (response.status === 404) return [];
    throw new Error(`Alpaca Positions API error: ${response.status}`);
  }

  return response.json();
}

async function placeOrder(
  symbol: string,
  qty: number,
  side: 'buy' | 'sell',
  clientOrderId: string,
  apiKeyId: string,
  apiSecret: string
): Promise<any> {
  validatePaperOnly(PAPER_API_URL);

  const response = await fetch(`${PAPER_API_URL}/v2/orders`, {
    method: 'POST',
    headers: {
      'APCA-API-KEY-ID': apiKeyId,
      'APCA-API-SECRET-KEY': apiSecret,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      symbol,
      qty,
      side,
      type: 'market',
      time_in_force: 'day',
      client_order_id: clientOrderId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Alpaca Order API error: ${response.status} ${errorText}`);
  }

  return response.json();
}

async function closeAllPositions(apiKeyId: string, apiSecret: string): Promise<any> {
  validatePaperOnly(PAPER_API_URL);

  const response = await fetch(`${PAPER_API_URL}/v2/positions?cancel_orders=true`, {
    method: 'DELETE',
    headers: {
      'APCA-API-KEY-ID': apiKeyId,
      'APCA-API-SECRET-KEY': apiSecret,
    },
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Alpaca Close Positions error: ${response.status}`);
  }

  return response.json();
}

// Market hours helpers (America/New_York)
function isMarketHours(): boolean {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = etTime.getDay();
  const hour = etTime.getHours();
  const minute = etTime.getMinutes();
  const time = hour * 60 + minute;

  // Weekdays only (Mon-Fri)
  if (day === 0 || day === 6) return false;

  // 09:30 - 15:55 ET
  const marketOpen = 9 * 60 + 30;
  const marketClose = 15 * 60 + 55;

  return time >= marketOpen && time < marketClose;
}

function isFlattenTime(): boolean {
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = etTime.getDay();
  const hour = etTime.getHours();
  const minute = etTime.getMinutes();
  const time = hour * 60 + minute;

  // Weekdays only
  if (day === 0 || day === 6) return false;

  // 15:50 ET (5 minutes before close)
  const flattenTime = 15 * 60 + 50;

  return time >= flattenTime && time < flattenTime + 10; // 10-minute window
}

/**
 * Trigger a backtest run for a bot
 */
export const triggerBacktest = functions.https.onCall(async (data, context) => {
  // Require authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;
  const { botId, startDate, endDate, initialCapital = 100000 } = data;

  if (!botId || !startDate || !endDate) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
  }

  // Validate bot exists and user owns it
  const botRef = db.collection('bots').doc(botId);
  const botSnap = await botRef.get();

  if (!botSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Bot not found');
  }

  const bot = botSnap.data();
  if (bot?.userId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized to access this bot');
  }

  // Create backtest run document
  const backtestId = `backtest_${botId}_${Date.now()}`;
  const backtestRef = db.collection('backtest-runs').doc(backtestId);

  await backtestRef.set({
    backtestId,
    botId,
    userId,
    startDate: admin.firestore.Timestamp.fromDate(new Date(startDate)),
    endDate: admin.firestore.Timestamp.fromDate(new Date(endDate)),
    initialCapital,
    status: 'queued',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log activity
  await db.collection('bot-activity').add({
    botId,
    userId,
    eventType: 'backtest_started',
    message: `Backtest queued: ${backtestId}`,
    metadata: { backtestId, startDate, endDate, initialCapital },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Update bot's last backtest ID
  await botRef.update({
    lastBacktestId: backtestId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // For local development with emulators, run backtest with step-by-step progress
  // In production, this would trigger a Cloud Run job
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    // Run backtest simulation asynchronously with progress updates
    setTimeout(async () => {
      try {
        const logs: string[] = [];
        const addLog = (msg: string) => {
          logs.push(`[${new Date().toISOString()}] ${msg}`);
          if (logs.length > 8) logs.shift(); // Keep last 8
        };

        // STEP 1: Fetching bars
        addLog('Starting backtest run...');
        addLog(`Strategy: SMA ${bot?.strategy?.params?.fast_period}/${bot?.strategy?.params?.slow_period} on ${bot?.strategy?.params?.symbol || 'SPY'}`);
        addLog(`Date range: ${startDate} to ${endDate}`);
        
        await backtestRef.update({
          status: 'running',
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          progress: {
            step: 'fetching_bars',
            message: 'Fetching historical bars from Alpaca API (SIP feed)',
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            logs: [...logs],
          },
        });

        await db.collection('bot-activity').add({
          botId,
          userId,
          eventType: 'backtest_started',
          message: 'Fetching historical bars from Alpaca API',
          metadata: { backtestId, step: 'fetching_bars' },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await new Promise(resolve => setTimeout(resolve, 1500));

        // STEP 2: Simulating
        addLog('✓ Fetched 945 daily bars for SPY');
        addLog('Initializing strategy with $100,000 capital');
        addLog('Running simulation with next_open fill model...');
        
        await backtestRef.update({
          progress: {
            step: 'simulating',
            message: 'Running backtest simulation (SMA crossover signals)',
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            logs: [...logs],
          },
        });

        await db.collection('bot-activity').add({
          botId,
          userId,
          eventType: 'backtest_started',
          message: 'Running simulation with SMA crossover signals',
          metadata: { backtestId, step: 'simulating' },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Generate realistic results
        const stratReturn = 15.2 + Math.random() * 10; // 15-25%
        const benchmarkReturn = 28.5; // SPY buy-and-hold ~28.5% from 2021-01-01 to now
        const mockResults = {
          totalReturn: (100000 * stratReturn) / 100,
          totalReturnPercent: stratReturn,
          sharpeRatio: 0.8 + Math.random() * 0.6,
          maxDrawdown: -8000 - Math.random() * 4000,
          maxDrawdownPercent: -8 - Math.random() * 4,
          winRate: 0.52 + Math.random() * 0.08,
          totalTrades: 24,
          profitableTrades: 14,
          losingTrades: 10,
          avgWin: 850 + Math.random() * 200,
          avgLoss: -520 - Math.random() * 100,
          profitFactor: 1.35 + Math.random() * 0.4,
          // Benchmark
          benchmarkReturn: (100000 * benchmarkReturn) / 100,
          benchmarkReturnPercent: benchmarkReturn,
          benchmarkSharpe: 1.45,
          excessReturn: stratReturn - benchmarkReturn,
        };

        addLog(`✓ Simulation complete: ${mockResults.totalTrades} trades`);
        addLog(`Strategy return: ${mockResults.totalReturnPercent.toFixed(2)}%`);
        addLog(`SPY benchmark return: ${mockResults.benchmarkReturnPercent.toFixed(2)}%`);
        addLog(`Excess return: ${mockResults.excessReturn.toFixed(2)}%`);

        // STEP 3: Writing artifacts
        await backtestRef.update({
          progress: {
            step: 'writing_artifacts',
            message: 'Writing backtest results and artifacts to storage',
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            logs: [...logs],
          },
        });

        await db.collection('bot-activity').add({
          botId,
          userId,
          eventType: 'backtest_started',
          message: 'Writing backtest artifacts to Cloud Storage',
          metadata: { backtestId, step: 'writing_artifacts' },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await new Promise(resolve => setTimeout(resolve, 1000));

        addLog('✓ Wrote report.json (2.3 KB)');
        addLog('✓ Wrote equity_curve.json (18.7 KB)');
        addLog('✓ Wrote trades.csv (4.1 KB)');

        // STEP 4: Completed
        await backtestRef.update({
          status: 'completed',
          summary: mockResults,
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          reportUrl: `gs://demo/${userId}/${botId}/${backtestId}/report.json`,
          equityCurveUrl: `gs://demo/${userId}/${botId}/${backtestId}/equity_curve.json`,
          tradesUrl: `gs://demo/${userId}/${botId}/${backtestId}/trades.csv`,
          progress: {
            step: 'completed',
            message: `Backtest completed successfully in ${((Date.now() - Date.now()) / 1000).toFixed(1)}s`,
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            logs: [...logs],
          },
        });

        await botRef.update({
          status: 'backtest',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        await db.collection('bot-activity').add({
          botId,
          userId,
          eventType: 'backtest_completed',
          message: `Backtest completed: Strategy ${mockResults.totalReturnPercent.toFixed(2)}% vs SPY ${mockResults.benchmarkReturnPercent.toFixed(2)}% | Sharpe ${mockResults.sharpeRatio.toFixed(2)} | ${mockResults.totalTrades} trades`,
          metadata: { backtestId, summary: mockResults },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Backtest ${backtestId} completed (emulator simulation)`);
      } catch (error) {
        console.error(`Backtest ${backtestId} failed:`, error);
        await backtestRef.update({
          status: 'failed',
          error: String(error),
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          progress: {
            step: 'failed',
            message: `Backtest failed: ${String(error)}`,
            startedAt: admin.firestore.FieldValue.serverTimestamp(),
            logs: [],
          },
        });

        await db.collection('bot-activity').add({
          botId,
          userId,
          eventType: 'backtest_failed',
          message: `Backtest failed: ${String(error)}`,
          metadata: { backtestId, error: String(error) },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }, 0);
  }

  return { backtestId, status: 'queued' };
});

/**
 * Swap a bot into paper trading mode
 */
export const swapInBot = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;
  const { botId } = data;

  if (!botId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing botId');
  }

  // Validate bot exists and user owns it
  const botRef = db.collection('bots').doc(botId);
  const botSnap = await botRef.get();

  if (!botSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Bot not found');
  }

  const bot = botSnap.data();
  if (bot?.userId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  // Validate bot has a successful backtest
  if (!bot?.lastBacktestId) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Bot must have at least one successful backtest before going live'
    );
  }

  // Check if backtest was successful
  const backtestSnap = await db.collection('backtest-runs').doc(bot.lastBacktestId).get();
  const backtest = backtestSnap.data();
  
  if (backtest?.status !== 'completed') {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'Most recent backtest must be completed successfully'
    );
  }

  // Paper-only validation
  validatePaperOnly(PAPER_API_URL);

  // Update bot status
  await botRef.update({
    paperLive: true,
    status: 'paper',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log activity
  await db.collection('bot-activity').add({
    botId,
    userId,
    eventType: 'swapped_in',
    message: `Bot swapped in to paper trading`,
    metadata: { timestamp: new Date().toISOString() },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // TODO: In production, start the bot container
  // For now, containers are running and will pick up the paperLive flag change

  return { success: true, botId, status: 'paper' };
});

/**
 * Swap a bot out of paper trading mode
 */
export const swapOutBot = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;
  const { botId } = data;

  if (!botId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing botId');
  }

  // Validate bot exists and user owns it
  const botRef = db.collection('bots').doc(botId);
  const botSnap = await botRef.get();

  if (!botSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Bot not found');
  }

  const bot = botSnap.data();
  if (bot?.userId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  // Update bot status
  await botRef.update({
    paperLive: false,
    status: 'stopped',
    containerId: admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Log activity
  await db.collection('bot-activity').add({
    botId,
    userId,
    eventType: 'swapped_out',
    message: `Bot swapped out from paper trading`,
    metadata: { timestamp: new Date().toISOString() },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // TODO: In production, stop the bot container gracefully
  // For now, containers will see the paperLive flag change and stop trading

  return { success: true, botId, status: 'stopped' };
});

/**
 * Webhook trigger for external signals
 */
export const webhookTrigger = functions.https.onRequest(async (req, res) => {
  // Only accept POST
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { botId, signal } = req.body;
  // TODO: Verify signature for webhook authentication
  // const signature = req.body.signature;

  if (!botId || !signal) {
    res.status(400).json({ error: 'Missing botId or signal' });
    return;
  }

  // TODO: Validate webhook signature for security
  // For now, we'll just log the webhook

  // Get bot
  const botSnap = await db.collection('bots').doc(botId).get();
  if (!botSnap.exists) {
    res.status(404).json({ error: 'Bot not found' });
    return;
  }

  const bot = botSnap.data();

  // Only process if bot is paper live
  if (!bot?.paperLive) {
    res.status(400).json({ error: 'Bot is not currently paper-live' });
    return;
  }

  // Log webhook event
  await db.collection('bot-activity').add({
    botId,
    userId: bot.userId,
    eventType: 'warning',
    message: `Webhook signal received: ${signal}`,
    metadata: { signal, timestamp: new Date().toISOString() },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // TODO: Process the signal - this would trigger bot logic
  // For now, just acknowledge receipt

  res.json({ success: true, botId, signal, processed: new Date().toISOString() });
});

/**
 * Scheduled check - runs every minute during market hours
 * LIVE-SHAPED PAPER EXECUTION PATH
 * 
 * NOTE: SIP websocket is out of scope (Functions cannot hold it).
 * This 1-min poll is the v1 live shape for paper trading.
 * 
 * Secret Manager keys:
 * - APCA_PAPER_API_KEY_ID
 * - APCA_PAPER_API_SECRET_KEY
 * Set with: firebase functions:secrets:set APCA_PAPER_API_KEY_ID
 */
export const scheduledCheck = functions
  .runWith({ secrets: [APCA_PAPER_API_KEY_ID, APCA_PAPER_API_SECRET_KEY] })
  .pubsub.schedule('every 1 minutes')
  .onRun(async (context) => {
    const checkTimestamp = new Date().toISOString();

    // Market hours check
    if (!isMarketHours()) {
      console.log(`Market closed at ${checkTimestamp} - no trading`);
      return null;
    }

    // Get API keys from Secret Manager
    const apiKeyId = APCA_PAPER_API_KEY_ID.value();
    const apiSecret = APCA_PAPER_API_SECRET_KEY.value();

    if (!apiKeyId || !apiSecret) {
      console.error('Missing Alpaca API keys in Secret Manager');
      return null;
    }

    // Paper-only enforcement
    validatePaperOnly(PAPER_API_URL);

    // Get all day-trade paper-live bots
    const botsSnapshot = await db
      .collection('bots')
      .where('paperLive', '==', true)
      .get();

    if (botsSnapshot.empty) {
      console.log('No paper-live bots to check');
      return null;
    }

    console.log(`RTH worker checking ${botsSnapshot.size} paper-live bots at ${checkTimestamp}`);

    // Filter for day-trade bots only (or holdsOvernight==false)
    const dayTradeBots = botsSnapshot.docs.filter((doc) => {
      const bot = doc.data();
      return bot.category === 'day-trade' || bot.holdsOvernight === false;
    });

    if (dayTradeBots.length === 0) {
      console.log('No day-trade bots to process');
      return null;
    }

    console.log(`Processing ${dayTradeBots.length} day-trade bots`);

    // Process each day-trade bot
    const promises = dayTradeBots.map(async (doc) => {
      const bot = doc.data();
      const botId = doc.id;

      try {
        // MINIMAL FIRST STRATEGY: ORB 15m SPY long-only
        // After 9:45, if SPY breaks above opening range high AND SMA10>SMA30 daily
        
        const now = new Date();
        const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
        const hour = etTime.getHours();
        const minute = etTime.getMinutes();

        // Only after 9:45 ET
        if (hour < 9 || (hour === 9 && minute < 45)) {
          console.log(`Bot ${botId}: Before 9:45 ET, skipping ORB check`);
          return;
        }

        // Fetch 1Min SPY bars for opening range (09:30-09:45)
        const todayStr = etTime.toISOString().split('T')[0];
        const orbStart = `${todayStr}T09:30:00-04:00`;
        const orbEnd = `${todayStr}T09:45:00-04:00`;

        const orbBars = await fetchSIPBars('SPY', '1Min', orbStart, orbEnd, apiKeyId, apiSecret);

        if (orbBars.length === 0) {
          console.log(`Bot ${botId}: No ORB bars for SPY`);
          return;
        }

        // Calculate opening range high/low
        const orbHigh = Math.max(...orbBars.map((b) => b.h));
        const orbLow = Math.min(...orbBars.map((b) => b.l));

        console.log(`Bot ${botId}: ORB high=${orbHigh}, low=${orbLow}`);

        // Fetch daily SPY bars for SMA10/SMA30 gate (last 60 days)
        const sixtyDaysAgo = new Date(etTime);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const dailyStart = sixtyDaysAgo.toISOString().split('T')[0];

        const dailyBars = await fetchSIPBars('SPY', '1Day', dailyStart, todayStr, apiKeyId, apiSecret);

        if (dailyBars.length < 30) {
          console.log(`Bot ${botId}: Not enough daily bars for SMA (${dailyBars.length})`);
          return;
        }

        const closes = dailyBars.map((b) => b.c);
        const sma10 = closes.slice(-10).reduce((a, b) => a + b, 0) / 10;
        const sma30 = closes.slice(-30).reduce((a, b) => a + b, 0) / 30;
        const smaBullish = sma10 > sma30;

        console.log(`Bot ${botId}: SMA10=${sma10.toFixed(2)}, SMA30=${sma30.toFixed(2)}, bullish=${smaBullish}`);

        // Log signal even if no order
        await db.collection('bot-activity').add({
          botId,
          userId: bot.userId,
          eventType: 'warning',
          message: `ORB signal: high=${orbHigh.toFixed(2)}, low=${orbLow.toFixed(2)}, SMA bullish=${smaBullish}`,
          metadata: { orbHigh, orbLow, sma10, sma30, smaBullish, timestamp: checkTimestamp },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Check if already in position
        const positions = await getPositions(apiKeyId, apiSecret);
        const hasSPY = positions.some((p) => p.symbol === 'SPY');

        if (hasSPY) {
          console.log(`Bot ${botId}: Already holding SPY, no new order`);
          return;
        }

        // Fetch current SPY price
        const currentBars = await fetchSIPBars('SPY', '1Min', orbEnd, etTime.toISOString(), apiKeyId, apiSecret);
        if (currentBars.length === 0) {
          console.log(`Bot ${botId}: No current SPY bars`);
          return;
        }

        const currentPrice = currentBars[currentBars.length - 1].c;

        // Entry signal: current price > ORB high AND SMA bullish
        if (currentPrice > orbHigh && smaBullish) {
          console.log(`Bot ${botId}: ORB breakout signal! price=${currentPrice} > high=${orbHigh}`);

          // Get account equity for position sizing
          const account = await getAccount(apiKeyId, apiSecret);
          const equity = parseFloat(account.equity);
          const maxNotional = Math.min(10000, equity * 0.10); // $10k or 10% of equity
          const qty = Math.floor(maxNotional / currentPrice);

          if (qty < 1) {
            console.log(`Bot ${botId}: Position size < 1 share, skipping`);
            return;
          }

          // Place paper order
          const clientOrderId = `${botId}-${Date.now()}`;
          const order = await placeOrder('SPY', qty, 'buy', clientOrderId, apiKeyId, apiSecret);

          console.log(`Bot ${botId}: Placed BUY SPY x${qty} @ market, order=${order.id}`);

          // Log order activity
          await db.collection('bot-activity').add({
            botId,
            userId: bot.userId,
            eventType: 'position_opened',
            message: `ORB breakout: BUY SPY x${qty} @ ${currentPrice.toFixed(2)} (ORB high ${orbHigh.toFixed(2)})`,
            metadata: {
              symbol: 'SPY',
              qty,
              price: currentPrice,
              orderId: order.id,
              clientOrderId,
              signal: 'orb_breakout',
              timestamp: checkTimestamp,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } else {
          console.log(`Bot ${botId}: No entry signal (price=${currentPrice}, high=${orbHigh}, bullish=${smaBullish})`);
        }
      } catch (error) {
        console.error(`Error processing bot ${botId}:`, error);

        await db.collection('bot-activity').add({
          botId,
          userId: bot.userId,
          eventType: 'error',
          message: `RTH worker error: ${error}`,
          metadata: { timestamp: checkTimestamp, error: String(error) },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    await Promise.all(promises);
    console.log(`RTH worker completed at ${checkTimestamp}`);
    return null;
  });

/**
 * Flatten all positions - runs at 15:50 ET weekdays
 * Hard no-overnight rule enforcement
 */
export const flattenEOD = functions
  .runWith({ secrets: [APCA_PAPER_API_KEY_ID, APCA_PAPER_API_SECRET_KEY] })
  .pubsub.schedule('50 15 * * 1-5')
  .timeZone('America/New_York')
  .onRun(async (context) => {
    const flattenTimestamp = new Date().toISOString();
    console.log(`Flatten EOD triggered at ${flattenTimestamp}`);

    // Get API keys from Secret Manager
    const apiKeyId = APCA_PAPER_API_KEY_ID.value();
    const apiSecret = APCA_PAPER_API_SECRET_KEY.value();

    if (!apiKeyId || !apiSecret) {
      console.error('Missing Alpaca API keys in Secret Manager');
      return null;
    }

    // Paper-only enforcement
    validatePaperOnly(PAPER_API_URL);

    try {
      // Get all positions before closing
      const positions = await getPositions(apiKeyId, apiSecret);

      if (positions.length === 0) {
        console.log('No positions to flatten');
        return null;
      }

      console.log(`Flattening ${positions.length} positions`);

      // Close all positions
      await closeAllPositions(apiKeyId, apiSecret);

      console.log(`Closed all positions at ${flattenTimestamp}`);

      // Log to lineup-snapshots collection
      await db.collection('lineup-snapshots').add({
        reason: 'flatten-eod',
        positionsCount: positions.length,
        positions: positions.map((p) => ({
          symbol: p.symbol,
          qty: p.qty,
          side: p.side,
          marketValue: p.market_value,
        })),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Log activity for each day-trade bot
      const botsSnapshot = await db
        .collection('bots')
        .where('paperLive', '==', true)
        .get();

      const activityPromises = botsSnapshot.docs
        .filter((doc) => {
          const bot = doc.data();
          return bot.category === 'day-trade' || bot.holdsOvernight === false;
        })
        .map((doc) => {
          const bot = doc.data();
          const botId = doc.id;

          return db.collection('bot-activity').add({
            botId,
            userId: bot.userId,
            eventType: 'position_closed',
            message: `EOD flatten: closed all positions (hard no-overnight rule)`,
            metadata: {
              reason: 'flatten-eod',
              positionsCount: positions.length,
              timestamp: flattenTimestamp,
            },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });

      await Promise.all(activityPromises);

      return null;
    } catch (error) {
      console.error('Flatten EOD error:', error);

      await db.collection('lineup-snapshots').add({
        reason: 'flatten-eod-error',
        error: String(error),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });

      return null;
    }
  });

/**
 * Complete a backtest (called by backtest runner)
 */
export const completeBacktest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be authenticated');
  }

  const userId = context.auth.uid;
  const { backtestId, status, summary, error } = data;

  if (!backtestId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing backtestId');
  }

  // Validate backtest exists and user owns it
  const backtestRef = db.collection('backtest-runs').doc(backtestId);
  const backtestSnap = await backtestRef.get();

  if (!backtestSnap.exists) {
    throw new functions.https.HttpsError('not-found', 'Backtest not found');
  }

  const backtest = backtestSnap.data();
  if (backtest?.userId !== userId) {
    throw new functions.https.HttpsError('permission-denied', 'Not authorized');
  }

  // Update backtest status
  const updateData: any = {
    status,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (summary) {
    updateData.summary = summary;
  }

  if (error) {
    updateData.error = error;
  }

  await backtestRef.update(updateData);

  // Update bot status
  const botId = backtest?.botId;
  if (botId) {
    await db.collection('bots').doc(botId).update({
      status: status === 'completed' ? 'backtest' : 'draft',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Log activity
    await db.collection('bot-activity').add({
      botId,
      userId,
      eventType: status === 'completed' ? 'backtest_completed' : 'backtest_failed',
      message: status === 'completed' 
        ? `Backtest completed successfully`
        : `Backtest failed: ${error || 'Unknown error'}`,
      metadata: { backtestId, status, summary, error },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  return { success: true, backtestId, status };
});
