/**
 * Seed script to create the SMA SPY bot if it doesn't exist
 * Run with: npx ts-node scripts/seed-sma-spy.ts
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin (uses emulator if FIRESTORE_EMULATOR_HOST is set)
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'demo-test',
  });
}

const db = admin.firestore();

async function seedSmaSpy() {
  const BOT_ID = 'bot_sma_spy';
  const USER_ID = 'seed_user'; // Placeholder - will be replaced with actual user

  console.log('Checking for SMA SPY bot...');

  const botRef = db.collection('bots').doc(BOT_ID);
  const botSnap = await botRef.get();

  if (botSnap.exists) {
    console.log('✅ SMA SPY bot already exists');
    return;
  }

  console.log('Creating SMA SPY bot...');

  await botRef.set({
    botId: BOT_ID,
    userId: USER_ID,
    name: 'SMA SPY',
    description: 'SMA 10/30 crossover on SPY - 1Day timeframe with SIP feed',
    status: 'draft',
    category: 'day-trade',
    holdsOvernight: false,
    
    strategy: {
      type: 'sma-crossover',
      params: {
        symbol: 'SPY',
        fast_period: 10,
        slow_period: 30,
        position_size_pct: 1.0, // 100% of capital
        timeframe: '1Day',
        feed: 'sip', // Algo Trader Plus
      },
    },
    
    riskLimits: {
      maxNotionalPerOrder: 100000, // Full capital
      maxPositionPercent: 100,
      allowedAssetClasses: ['stock'],
      maxContracts: 0,
      allowNakedShorts: false,
    },
    
    signals: {
      enabled: ['sma_cross'],
      sma_cross: {
        fast: 10,
        slow: 30,
      },
    },
    
    triggers: {
      enabled: ['schedule'],
      schedule: {
        frequency: 'daily',
        time: '09:30',
        timezone: 'America/New_York',
      },
    },
    
    confirmationMode: false,
    killSwitch: false,
    paperOnly: true,
    
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  console.log('✅ Created SMA SPY bot');
}

seedSmaSpy()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
