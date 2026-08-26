#!/usr/bin/env node

/**
 * Seed script for Firebase Firestore
 * Seeds demo data for paper trading bot dashboard
 * 
 * Usage: node scripts/seed-firestore.js <userId>
 */

const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc, addDoc, collection, connectFirestoreEmulator } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-project.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-alpaca-bot',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-project.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '123456789',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:123456789:web:abcdef',
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Connect to emulator
if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

async function seedData(userId) {
  console.log(`Seeding data for user: ${userId}`);

  try {
    // Bot Settings
    console.log('Creating bot settings...');
    await setDoc(doc(db, 'bot-settings', userId), {
      userId,
      killSwitch: false,
      confirmationMode: true,
      maxNotionalPerOrder: 10000,
      maxPositionPercent: 20,
      allowedAssetClasses: ['stock', 'option'],
      updatedAt: new Date(),
    });

    // Account snapshot
    console.log('Creating account snapshot...');
    await setDoc(doc(db, 'accounts', userId), {
      userId,
      accountNumber: 'PA2J8KXXXX',
      equity: 103245.67,
      cash: 45678.90,
      buyingPower: 182712.45,
      optionsLevel: 2,
      daytradeCount: 1,
      patternDayTrader: false,
      updatedAt: new Date(),
    });

    // Sample Positions
    console.log('Creating sample positions...');
    const positions = [
      {
        userId,
        symbol: 'AAPL',
        assetClass: 'stock',
        qty: 100,
        avgEntryPrice: 175.50,
        currentPrice: 182.30,
        marketValue: 18230,
        costBasis: 17550,
        unrealizedPL: 680,
        unrealizedPLPercent: 3.87,
        side: 'long',
        updatedAt: new Date(),
      },
      {
        userId,
        symbol: 'TSLA',
        assetClass: 'stock',
        qty: 50,
        avgEntryPrice: 245.80,
        currentPrice: 238.50,
        marketValue: 11925,
        costBasis: 12290,
        unrealizedPL: -365,
        unrealizedPLPercent: -2.97,
        side: 'long',
        updatedAt: new Date(),
      },
      {
        userId,
        symbol: 'SPY',
        assetClass: 'stock',
        qty: 75,
        avgEntryPrice: 442.20,
        currentPrice: 448.75,
        marketValue: 33656.25,
        costBasis: 33165,
        unrealizedPL: 491.25,
        unrealizedPLPercent: 1.48,
        side: 'long',
        updatedAt: new Date(),
      },
    ];

    for (const position of positions) {
      await addDoc(collection(db, 'positions'), position);
    }

    // Sample Orders
    console.log('Creating sample orders...');
    const orders = [
      {
        userId,
        clientOrderId: 'order-001',
        symbol: 'AAPL',
        assetClass: 'stock',
        side: 'buy',
        orderType: 'limit',
        timeInForce: 'day',
        qty: 100,
        limitPrice: 175.50,
        status: 'filled',
        filledQty: 100,
        filledAvgPrice: 175.48,
        submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        filledAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000),
      },
      {
        userId,
        clientOrderId: 'order-002',
        symbol: 'MSFT',
        assetClass: 'stock',
        side: 'buy',
        orderType: 'limit',
        timeInForce: 'day',
        qty: 50,
        limitPrice: 385.00,
        status: 'new',
        filledQty: 0,
        submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        userId,
        clientOrderId: 'order-003',
        symbol: 'NVDA',
        assetClass: 'stock',
        side: 'sell',
        orderType: 'market',
        timeInForce: 'day',
        qty: 25,
        status: 'canceled',
        filledQty: 0,
        submittedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        canceledAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      },
    ];

    for (const order of orders) {
      await addDoc(collection(db, 'orders'), order);
    }

    // Sample Trade Intents
    console.log('Creating sample trade intents...');
    const tradeIntents = [
      {
        userId,
        symbol: 'GOOGL',
        assetClass: 'stock',
        side: 'buy',
        orderType: 'limit',
        timeInForce: 'day',
        qty: 30,
        limitPrice: 142.50,
        status: 'pending_approval',
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
        updatedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        userId,
        symbol: 'AMZN',
        assetClass: 'stock',
        side: 'buy',
        orderType: 'market',
        timeInForce: 'day',
        notional: 5000,
        status: 'approved',
        approvedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      },
      {
        userId,
        symbol: 'META',
        assetClass: 'stock',
        side: 'sell',
        orderType: 'limit',
        timeInForce: 'gtc',
        qty: 20,
        limitPrice: 520.00,
        status: 'rejected',
        rejectionReason: 'Position not held',
        rejectedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    ];

    for (const intent of tradeIntents) {
      await addDoc(collection(db, 'trade-intents'), intent);
    }

    // Sample Activity Events
    console.log('Creating sample activity events...');
    const activities = [
      {
        userId,
        eventType: 'settings_updated',
        message: 'Bot settings updated',
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      },
      {
        userId,
        eventType: 'confirmation_mode_enabled',
        message: 'Confirmation mode enabled - all trades require approval',
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      },
      {
        userId,
        eventType: 'trade_intent_created',
        message: 'Trade intent created: BUY 30 GOOGL @ $142.50',
        metadata: { symbol: 'GOOGL', side: 'buy', qty: 30 },
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        userId,
        eventType: 'order_filled',
        message: 'Order filled: BUY 100 AAPL @ $175.48',
        metadata: { symbol: 'AAPL', side: 'buy', qty: 100, fillPrice: 175.48 },
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      },
    ];

    for (const activity of activities) {
      await addDoc(collection(db, 'activity'), activity);
    }

    console.log('✅ Seed data created successfully!');
    console.log('');
    console.log('Summary:');
    console.log('- Bot settings configured');
    console.log('- Account snapshot created ($103,245.67 equity)');
    console.log('- 3 open positions added (AAPL, TSLA, SPY)');
    console.log('- 3 orders added (1 filled, 1 open, 1 canceled)');
    console.log('- 3 trade intents added (1 pending approval, 1 approved, 1 rejected)');
    console.log('- 4 activity events logged');
    console.log('');
    console.log('You can now sign in with this user ID and see the demo data.');
    
  } catch (error) {
    console.error('Error seeding data:', error);
    process.exit(1);
  }
}

// Get userId from command line argument
const userId = process.argv[2];

if (!userId) {
  console.error('Usage: node scripts/seed-firestore.js <userId>');
  console.error('Example: node scripts/seed-firestore.js demo-user-123');
  process.exit(1);
}

seedData(userId).then(() => process.exit(0));
