// Seed data directly from browser console
// Paste this in browser console while signed in

const { doc, setDoc, addDoc, collection } = window.firebaseImports || await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
const db = window.db; // assuming db is exported

const userId = JSON.parse(localStorage.getItem('firebase:authUser:AIzaSyAbdWH2FvBCsdAAy4f__MxdFRPuRD1-VDQ:[DEFAULT]')).uid;

async function seedData() {
  console.log('Seeding data for user:', userId);
  
  // Bot Settings
  await setDoc(doc(db, 'bot-settings', userId), {
    userId,
    killSwitch: false,
    confirmationMode: true,
    maxNotionalPerOrder: 10000,
    maxPositionPercent: 20,
    allowedAssetClasses: ['stock', 'option'],
    updatedAt: new Date(),
  });
  
  // Account - no dummy data, real account snapshot comes from Functions/agent
  // Removed: PA2J8KXXXX, equity: 103245.67 - never fabricate account numbers or balances
  
  // Positions
  const positions = [
    { symbol: 'AAPL', qty: 100, avgEntryPrice: 175.50, currentPrice: 182.30, marketValue: 18230, costBasis: 17550, unrealizedPL: 680, unrealizedPLPercent: 3.87, side: 'long', assetClass: 'stock' },
    { symbol: 'TSLA', qty: 50, avgEntryPrice: 245.80, currentPrice: 238.50, marketValue: 11925, costBasis: 12290, unrealizedPL: -365, unrealizedPLPercent: -2.97, side: 'long', assetClass: 'stock' },
    { symbol: 'SPY', qty: 75, avgEntryPrice: 442.20, currentPrice: 448.75, marketValue: 33656.25, costBasis: 33165, unrealizedPL: 491.25, unrealizedPLPercent: 1.48, side: 'long', assetClass: 'stock' },
  ];
  
  for (const pos of positions) {
    await addDoc(collection(db, 'positions'), { userId, ...pos, updatedAt: new Date() });
  }
  
  console.log('✅ Seed complete! Refresh the page.');
}

seedData();
