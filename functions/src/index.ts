import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();

// Paper-only enforcement
const PAPER_API_URL = 'https://paper-api.alpaca.markets';

function validatePaperOnly(apiUrl: string): void {
  if (!apiUrl.toLowerCase().includes('paper')) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'LIVE API ENDPOINT DETECTED - Only paper trading is allowed'
    );
  }
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

  // TODO: In production, this would trigger a Cloud Run job or container
  // For now, we'll simulate a backtest completion after a delay
  // The actual backtest runner will be implemented in Python

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

  const { botId, signal, signature } = req.body;

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
 * Monitors paper-live bots and processes scheduled triggers
 */
export const scheduledCheck = functions.pubsub
  .schedule('every 1 minutes')
  .onRun(async (context) => {
    // Get all paper-live bots
    const botsSnapshot = await db
      .collection('bots')
      .where('paperLive', '==', true)
      .get();

    if (botsSnapshot.empty) {
      console.log('No paper-live bots to check');
      return null;
    }

    const checkTimestamp = new Date().toISOString();
    console.log(`Checking ${botsSnapshot.size} paper-live bots at ${checkTimestamp}`);

    // Process each bot
    const promises = botsSnapshot.docs.map(async (doc) => {
      const bot = doc.data();
      const botId = doc.id;

      try {
        // Check for scheduled triggers
        const scheduledTriggers = (bot.triggers || []).filter(
          (t: any) => t.type === 'scheduled'
        );

        if (scheduledTriggers.length > 0) {
          // Log heartbeat
          await db.collection('bot-activity').add({
            botId,
            userId: bot.userId,
            eventType: 'warning',
            message: 'Scheduled check - bot is alive',
            metadata: { timestamp: checkTimestamp, triggerCount: scheduledTriggers.length },
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }

        // TODO: In production, this would check bot health and trigger strategy evaluation
      } catch (error) {
        console.error(`Error checking bot ${botId}:`, error);
        
        await db.collection('bot-activity').add({
          botId,
          userId: bot.userId,
          eventType: 'error',
          message: `Scheduled check error: ${error}`,
          metadata: { timestamp: checkTimestamp, error: String(error) },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    });

    await Promise.all(promises);
    return null;
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
