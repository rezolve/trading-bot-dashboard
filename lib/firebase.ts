import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, Functions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;

if (typeof window !== 'undefined') {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);
  db = getFirestore(app);
  functions = getFunctions(app);

  // Connect to emulators if enabled
  if (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === 'true') {
    try {
      connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, '127.0.0.1', 8180);
      connectFunctionsEmulator(functions, '127.0.0.1', 5001);
    } catch (error) {
      // Emulators already connected
    }
  }
}

// Cloud Functions helpers
export const callTriggerBacktest = httpsCallable<
  { botId: string; startDate: string; endDate: string; initialCapital?: number },
  { backtestId: string; status: string }
>(functions, 'triggerBacktest');

export const callSwapInBot = httpsCallable<
  { botId: string },
  { success: boolean; botId: string; status: string }
>(functions, 'swapInBot');

export const callSwapOutBot = httpsCallable<
  { botId: string },
  { success: boolean; botId: string; status: string }
>(functions, 'swapOutBot');

export { app, auth, db, functions };
