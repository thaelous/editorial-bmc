import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';

/**
 * Sanitizes and cleans an environment variable value:
 * - Strips leading/trailing and internal whitespace, newlines, tabs, zero-width spaces, and BOM
 * - Strips surrounding quotes (" or ')
 * - Normalizes Unicode and strips diacritics/accents (e.g. 'í' -> 'i')
 */
function sanitizeEnvValue(val: unknown): string {
  if (val === undefined || val === null) return '';
  return String(val)
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/[\s\u200B\uFEFF\u00A0\r\n\t]/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Specifically cleans an API Key:
 * - Applies general env sanitization (no quotes, no spaces, no accents)
 * - Strips any remaining characters outside ASCII [A-Za-z0-9_-]
 */
function sanitizeApiKey(rawKey: unknown): string {
  return sanitizeEnvValue(rawKey).replace(/[^A-Za-z0-9_-]/g, '');
}

// Read Firebase configuration exclusively from Vite environment variables (VITE_*)
// ZERO hardcoded keys, secrets, or fallback values are present in this file.
export const firebaseConfig = {
  apiKey: sanitizeApiKey(import.meta.env.VITE_FIREBASE_API_KEY),
  authDomain: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId: sanitizeEnvValue(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) || undefined,
};

const isKeyValid = /^[A-Za-z0-9_-]{30,45}$/.test(firebaseConfig.apiKey);
const isMissingKey = !firebaseConfig.apiKey;

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  isKeyValid
);

let detectedErrorDetail: string | null = null;
if (isMissingKey) {
  detectedErrorDetail = 'Variables de entorno de Firebase no detectadas. Por favor configura VITE_FIREBASE_API_KEY y VITE_FIREBASE_PROJECT_ID en el panel de Netlify.';
} else if (!isKeyValid) {
  if (/[^\x20-\x7E]/.test(String(import.meta.env.VITE_FIREBASE_API_KEY))) {
    detectedErrorDetail = `El valor de VITE_FIREBASE_API_KEY contiene caracteres no ASCII o con tildes (ej: 'í'). Las claves deben contener solo caracteres [A-Za-z0-9_-].`;
  } else {
    detectedErrorDetail = `El formato de VITE_FIREBASE_API_KEY no es válido (debe tener entre 30 y 45 caracteres válidos).`;
  }
}

export const firebaseStatus = {
  isConfigured: isFirebaseConfigured,
  hasKeyError: !isKeyValid || isMissingKey,
  detectedErrorDetail,
};

// Initialize Firebase App
export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firestore cleanly using only the Firebase App instance (no database arguments or '(default)' reference)
export const db: Firestore = getFirestore(app);

// Initialize Firebase Auth
export const auth: Auth = getAuth(app);




