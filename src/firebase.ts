import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';

/**
 * Firebase Client Configuration loaded directly from Vite environment variables (VITE_*).
 * This eliminates static secret-containing JSON files, allowing secure continuous
 * deployment to Netlify and other hosting platforms.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
};

// Check for missing mandatory environment variables to aid debugging during setup
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
  console.warn(
    '[Firebase Setup] Missing Firebase configuration environment variables.\n' +
    'Please configure VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID, etc. in your environment or Netlify Site settings.'
  );
}

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const customDatabaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID;
export const db: Firestore = customDatabaseId && customDatabaseId !== '(default)'
  ? getFirestore(app, customDatabaseId)
  : getFirestore(app);

export { firebaseConfig };
