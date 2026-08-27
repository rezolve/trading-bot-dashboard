#!/usr/bin/env ts-node
/**
 * Seed the Movers Day-Trade Book bot to Firestore
 * 
 * This script creates the bot_movers_day bot in Firestore if it doesn't exist.
 * Run this to populate the fleet with the movers day-trade scanner bot.
 * 
 * Usage:
 *   ts-node scripts/seed-movers-day.ts
 *   or: npm run seed-movers-day
 */

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Use emulator if FIRESTORE_EMULATOR_HOST is set
  const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
  if (emulatorHost) {
    process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
    console.log(`Using Firestore emulator: ${emulatorHost}`);
  }
  
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'demo-test',
  });
}

const db = admin.firestore();

async function seedMoversDay() {
  const botId = 'bot_movers_day';
  const userId = process.env.USER_ID || 'system';
  
  console.log(`Checking if bot ${botId} exists...`);
  
  const botRef = db.collection('bots').doc(botId);
  const botDoc = await botRef.get();
  
  if (botDoc.exists) {
    console.log(`Bot ${botId} already exists. Skipping.`);
    return;
  }
  
  console.log(`Creating bot ${botId}...`);
  
  const now = admin.firestore.Timestamp.now();
  
  await botRef.set({
    botId,
    userId,
    name: 'Movers Day-Trade Book',
    description: 'Gap-and-go continuation scanner on liquid market movers. Hard rule: never hold overnight. PAPER ONLY.',
    status: 'draft',
    
    strategy: {
      type: 'gap-and-go',
      params: {
        universe: 'Alpaca SIP market movers (gainers + most-active)',
        filters: {
          minPrice: 5.0,
          minADV: 5000000,
          excludeWarrants: true,
          excludeOTC: true,
          maxWatchlistSize: 20,
        },
        signals: {
          type: 'continuation',
          regime: 'SPY daily SMA10 > SMA30 (bullish only)',
          entry: 'Break of premarket high or first RTH 1Min high',
          stop: 'Signal-bar low or premarket low',
        },
        timeframe: '1Min',
        dataFeed: 'sip',
      },
    },
    
    signals: [
      {
        type: 'indicator',
        config: {
          name: 'gap-and-go',
          description: 'Break of premarket high on gainer continuation',
        },
      },
    ],
    
    triggers: [
      {
        type: 'scheduled',
        config: {
          description: 'Market open scan',
          schedule: '09:30 ET daily',
        },
      },
      {
        type: 'manual',
        config: {
          description: 'Manual start/stop from Fleet UI',
        },
      },
    ],
    
    riskLimits: {
      maxNotionalPerOrder: 10000,
      maxPositionPercent: 0.10,
      allowedAssetClasses: ['stock'],
      maxDailyDrawdown: 0,
      maxPositions: 3,
    },
    
    paperLive: false,
    containerId: null,
    lastBacktestId: null,
    
    createdAt: now,
    updatedAt: now,
  });
  
  console.log(`✓ Bot ${botId} created successfully`);
  
  // Log activity
  const activityRef = db.collection('bot-activity').doc();
  await activityRef.set({
    botId,
    userId,
    eventType: 'bot_created',
    message: 'Movers Day-Trade Book bot created',
    metadata: {
      source: 'seed-script',
      note: 'First real test is 1Min SIP on filtered liquid universe, not SPY SMA',
    },
    createdAt: now,
  });
  
  console.log(`✓ Activity log created`);
}

seedMoversDay()
  .then(() => {
    console.log('Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
